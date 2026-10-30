import {
  AIProviderError,
  type ChatMessage,
  type CompletionRequest,
  type CompletionResult,
  type ModelCapabilities,
  type ModelProvider,
  type WebSearchHit,
  type WebSearchRequest,
  type WebSearchResult,
} from "../types";
import { emitAIEvent } from "../telemetry";

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  capabilities: ModelCapabilities;
  timeoutMs?: number;
  // Send the owner's hashed id as safety_identifier (Muse supports it; other endpoints may not)
  sendUserKey?: boolean;
  // Send prompt_cache_key (Muse supports it; other endpoints may reject unknown fields)
  sendCacheKey?: boolean;
  dataHandling?: { recipient: string; notes: string[] };
  // Extra tries after a temporary failure; tests pass their own wait
  retries?: number;
  wait?: (ms: number) => Promise<void>;
}

type WireContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

interface WireMessage {
  role: ChatMessage["role"];
  content: string | WireContentPart[];
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
  completion_tokens_details?: { reasoning_tokens?: number } | null;
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
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  return {
    name: config.name,
    model: config.model,
    capabilities: config.capabilities,
    simulated: false,
    dataHandling: config.dataHandling,

    webSearch: config.capabilities.webSearch
      ? (request) => withRetries(config, request.timeoutMs ?? 60_000, (ms) => webSearch(config, `${base}/responses`, { ...request, timeoutMs: ms }))
      : undefined,

    async complete(request: CompletionRequest): Promise<CompletionResult> {
      const body = buildRequestBody(config, request);
      const timeoutMs = request.timeoutMs ?? config.timeoutMs ?? 120_000;

      return withRetries(config, timeoutMs, async (ms) => {
        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(ms),
          });
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new AIProviderError(`${config.name} request failed: ${reason}`, null, true);
        }

        if (!response.ok) throw await failedStatus(config.name, response);
        return request.stream ? readStream(config.name, response) : readJson(config.name, response);
      });
    },
  };
}

// Retries what can pass on a second try (rate limits, server errors, dropped connections) with backoff and jitter.
// timeoutMs covers every attempt and wait together, so callers' time budgets hold. Never retries a bad request or a
// gateway timeout, and only when, after waiting as long as the provider asks, a quarter of the time is still left.
async function withRetries<T>(config: OpenAICompatibleConfig, timeoutMs: number, attempt: (ms: number) => Promise<T>): Promise<T> {
  const retries = config.retries ?? 2;
  const deadline = Date.now() + timeoutMs;
  for (let tries = 0; ; tries++) {
    try {
      return await attempt(Math.max(1, deadline - Date.now()));
    } catch (error) {
      if (!(error instanceof AIProviderError) || !error.retryable || tries >= retries) throw error;
      const wait = backoffMs(tries, error.retryAfterMs);
      if (deadline - Date.now() - wait < timeoutMs / 4) throw error;
      emitAIEvent({ type: "retry", status: error.status, waitMs: Math.round(wait) });
      await (config.wait ?? sleep)(wait);
    }
  }
}

// 1 s, then 2 s, each with random jitter so many clients don't retry in step; the provider's own ask wins
export function backoffMs(tries: number, retryAfterMs: number | null, random: () => number = Math.random): number {
  const base = 1_000 * 2 ** tries;
  const jittered = base / 2 + random() * (base / 2);
  return Math.max(jittered, retryAfterMs ?? 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function failedStatus(name: string, response: Response, what = "returned"): Promise<AIProviderError> {
  const detail = (await response.text().catch(() => "")).slice(0, 500);
  return new AIProviderError(
    `${name} ${what} ${response.status}: ${detail}`,
    response.status,
    // A 504 means the request ran past the server's limit, and Meta says the same request usually times out again
    response.status === 408 || response.status === 429 || (response.status >= 500 && response.status !== 504),
    retryAfter(response.headers.get("retry-after")),
  );
}

// Seconds, or an HTTP date
export function retryAfter(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
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
  return usage
    ? {
        inputTokens: usage.prompt_tokens ?? 0,
        cachedInputTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
      }
    : null;
}

export function buildRequestBody(
  config: OpenAICompatibleConfig,
  request: CompletionRequest,
): Record<string, unknown> {
  if (!config.capabilities.vision && request.messages.some((message) => hasPart(message, "image"))) {
    throw new Error(`${config.name} (${config.model}) is not configured to accept images`);
  }
  if (!config.capabilities.pdf && request.messages.some((message) => hasPart(message, "file"))) {
    throw new Error(`${config.name} (${config.model}) is not configured to accept PDF files`);
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
  if (request.stream) {
    body.stream = true;
    // Token counts arrive in a last chunk only when asked for
    body.stream_options = { include_usage: true };
  }
  if (request.userKey && config.sendUserKey) body.safety_identifier = request.userKey;
  if (request.cacheKey && config.sendCacheKey) {
    body.prompt_cache_key = request.cacheKey;
    // Only a hint; asked for by calls whose long shared start is public text, never uploaded documents
    if (request.retainCache) body.prompt_cache_retention = "24h";
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
    content: message.content.map((part): WireContentPart => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image") return { type: "image_url", image_url: { url: part.url } };
      return { type: "file", file: { filename: part.filename, file_data: part.data } };
    }),
  };
}

function hasPart(message: ChatMessage, type: "image" | "file"): boolean {
  return typeof message.content !== "string" && message.content.some((part) => part.type === type);
}

interface WireResponsesOutput {
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } | null; output_tokens_details?: { reasoning_tokens?: number } | null };
  output?: {
    type?: string;
    results?: { title?: string; url?: string; snippet?: string }[] | null;
    content?: { type?: string; text?: string; annotations?: { type?: string; url?: string; title?: string }[] }[];
  }[];
  error?: { message?: string } | null;
}

// Search grounding runs only on the Responses API. store: false keeps no copy of the request on the provider's side.
async function webSearch(
  config: OpenAICompatibleConfig,
  url: string,
  request: WebSearchRequest,
): Promise<WebSearchResult> {
  const tool: Record<string, unknown> = { type: "web_search", search_context_size: "medium" };
  if (request.location) tool.user_location = { type: "approximate", country: "US", ...request.location };
  const body: Record<string, unknown> = {
    model: config.model,
    input: request.question,
    tools: [tool],
    include: ["web_search_call.results"],
    store: false,
  };
  if (config.capabilities.reasoningEffort) body.reasoning = { effort: "low" };
  if (request.userKey && config.sendUserKey) body.safety_identifier = request.userKey;

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(request.timeoutMs ?? 60_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AIProviderError(`${config.name} search failed: ${reason}`, null, true);
  }
  if (!response.ok) throw await failedStatus(config.name, response, "search returned");

  let data: WireResponsesOutput;
  try {
    data = (await response.json()) as WireResponsesOutput;
  } catch {
    throw new AIProviderError(`${config.name} search returned a non-JSON body`, response.status, true);
  }
  if (data.error) throw new AIProviderError(`${config.name} search failed: ${data.error.message ?? "unknown"}`, response.status, true);
  logSearch(data, Date.now() - started);
  return readSearchOutput(data);
}

// Searches are billed per query on top of tokens, and one call can run several: counts only, never the question or results
function logSearch(data: WireResponsesOutput, ms: number) {
  const searches = (data.output ?? []).filter((item) => item.type === "web_search_call").length;
  const usage = data.usage;
  emitAIEvent({
    type: "search",
    ms,
    queries: searches,
    usage: usage
      ? {
          inputTokens: usage.input_tokens ?? 0,
          cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
        }
      : null,
  });
  console.info(
    `AI web_search: ${searches} ${searches === 1 ? "query" : "queries"}, ${usage?.input_tokens ?? 0} in (${usage?.input_tokens_details?.cached_tokens ?? 0} cached), ${usage?.output_tokens ?? 0} out (${usage?.output_tokens_details?.reasoning_tokens ?? 0} reasoning)`,
  );
}

export function readSearchOutput(data: WireResponsesOutput): WebSearchResult {
  const hits = new Map<string, WebSearchHit>();
  let answer = "";
  for (const item of data.output ?? []) {
    if (item.type === "web_search_call") {
      for (const result of item.results ?? []) {
        if (result.url && !hits.has(result.url)) {
          hits.set(result.url, { title: result.title ?? "", url: result.url, snippet: result.snippet ?? "", cited: false });
        }
      }
    }
    if (item.type === "message") {
      for (const block of item.content ?? []) {
        if (block.type !== "output_text") continue;
        answer += block.text ?? "";
        for (const note of block.annotations ?? []) {
          if (note.type !== "url_citation" || !note.url) continue;
          const hit = hits.get(note.url);
          hits.set(note.url, { title: hit?.title || note.title || "", url: note.url, snippet: hit?.snippet ?? "", cited: true });
        }
      }
    }
  }
  // Cited pages first, then the rest in the order the search returned them
  return { hits: [...hits.values()].sort((a, b) => Number(b.cited) - Number(a.cited)), answer };
}
