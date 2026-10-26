import {
  AIProviderError,
  type ChatMessage,
  type CompletionRequest,
  type CompletionResult,
  type ModelCapabilities,
  type ModelProvider,
} from "../types";

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  capabilities: ModelCapabilities;
  timeoutMs?: number;
}

type WireContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface WireMessage {
  role: ChatMessage["role"];
  content: string | WireContentPart[];
}

interface WireResponse {
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Chat Completions over fetch: Meta Muse, and any other compatible endpoint.
export function createOpenAICompatibleProvider(
  config: OpenAICompatibleConfig,
): ModelProvider {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: config.name,
    model: config.model,
    capabilities: config.capabilities,

    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const body = buildRequestBody(config, request);

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(config.timeoutMs ?? 120_000),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new AIProviderError(`${config.name} request failed: ${reason}`, null, true);
      }

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 500);
        throw new AIProviderError(
          `${config.name} returned ${response.status}: ${detail}`,
          response.status,
          response.status === 408 || response.status === 429 || response.status >= 500,
        );
      }

      let data: WireResponse;
      try {
        data = (await response.json()) as WireResponse;
      } catch {
        throw new AIProviderError(`${config.name} returned a non-JSON body`, response.status, true);
      }

      const choice = data.choices?.[0];
      const text = choice?.message?.content;
      if (typeof text !== "string") {
        throw new AIProviderError(`${config.name} returned no message content`, response.status, false);
      }

      return {
        text,
        finishReason: choice?.finish_reason ?? null,
        usage: data.usage
          ? {
              inputTokens: data.usage.prompt_tokens ?? 0,
              outputTokens: data.usage.completion_tokens ?? 0,
            }
          : null,
      };
    },
  };
}

export function buildRequestBody(
  config: OpenAICompatibleConfig,
  request: CompletionRequest,
): Record<string, unknown> {
  if (!config.capabilities.vision && request.messages.some(hasImage)) {
    throw new Error(`${config.name} (${config.model}) is not configured to accept images`);
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: request.messages.map(toWireMessage),
  };
  if (request.maxOutputTokens !== undefined) {
    body.max_completion_tokens = request.maxOutputTokens;
  }
  if (request.effort && config.capabilities.reasoningEffort) {
    body.reasoning_effort = request.effort;
  }
  if (request.responseFormat && config.capabilities.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: request.responseFormat.name,
        schema: request.responseFormat.schema,
      },
    };
  }
  return body;
}

function toWireMessage(message: ChatMessage): WireMessage {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content };
  }
  return {
    role: message.role,
    content: message.content.map((part): WireContentPart =>
      part.type === "text"
        ? { type: "text", text: part.text }
        : { type: "image_url", image_url: { url: part.url } },
    ),
  };
}

function hasImage(message: ChatMessage): boolean {
  return typeof message.content !== "string" && message.content.some((part) => part.type === "image");
}
