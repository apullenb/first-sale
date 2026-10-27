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

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface WireResponse {
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: WireUsage;
}

interface WireStreamChunk {
  choices?: {
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: WireUsage;
  error?: { message?: string };
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
          signal: AbortSignal.timeout(request.timeoutMs ?? config.timeoutMs ?? 120_000),
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

      return request.stream ? readStream(config.name, response) : readJson(config.name, response);
    },
  };
}

async function readJson(name: string, response: Response): Promise<CompletionResult> {
  let data: WireResponse;
  try {
    data = (await response.json()) as WireResponse;
  } catch {
    throw new AIProviderError(`${name} returned a non-JSON body`, response.status, true);
  }

  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== "string") {
    throw new AIProviderError(`${name} returned no message content`, response.status, false);
  }
  return { text, finishReason: choice?.finish_reason ?? null, usage: toUsage(data.usage) };
}

// Server-sent events: "data: {chunk}" lines, ending with "data: [DONE]"
async function readStream(name: string, response: Response): Promise<CompletionResult> {
  if (!response.body) throw new AIProviderError(`${name} returned an empty stream`, response.status, true);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finishReason: string | null = null;
  let usage: CompletionResult["usage"] = null;
  let sawDone = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = done ? "" : (lines.pop() ?? "");

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") sawDone = true;
        if (!data || data === "[DONE]") continue;

        let chunk: WireStreamChunk;
        try {
          chunk = JSON.parse(data) as WireStreamChunk;
        } catch {
          throw new AIProviderError(`${name} sent a malformed stream event`, response.status, true);
        }
        if (chunk.error) {
          throw new AIProviderError(`${name} stream error: ${chunk.error.message ?? "unknown"}`, response.status, true);
        }
        const choice = chunk.choices?.[0];
        if (typeof choice?.delta?.content === "string") text += choice.delta.content;
        if (choice?.finish_reason) finishReason = choice.finish_reason;
        if (chunk.usage) usage = toUsage(chunk.usage);
      }
      if (done) break;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof AIProviderError) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new AIProviderError(`${name} stream failed: ${reason}`, response.status, true);
  }

  // A dropped connection ends the stream without either marker
  if (!sawDone && finishReason === null) {
    throw new AIProviderError(`${name} stream ended before the reply finished`, response.status, true);
  }
  return { text, finishReason, usage };
}

function toUsage(usage: WireUsage | undefined): CompletionResult["usage"] {
  return usage ? { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 } : null;
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
  if (request.stream) body.stream = true;
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
