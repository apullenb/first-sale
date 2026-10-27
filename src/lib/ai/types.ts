// Provider-neutral model interface. Features depend on this, never on a vendor SDK.

export type Effort = "low" | "medium" | "high";

export type ContentPart =
  | { type: "text"; text: string }
  // https URL or data: URL
  | { type: "image"; url: string }
  // A PDF as a data: URL; the model reads its text and page images
  | { type: "file"; filename: string; data: string };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string };

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  effort?: Effort;
  maxOutputTokens?: number;
  responseFormat?: JsonSchemaFormat;
  // For long calls: some APIs time out requests that don't stream
  stream?: boolean;
  timeoutMs?: number;
  // Stable, non-identifying id for the owner behind the request, for the provider's abuse checks
  userKey?: string;
}

export interface CompletionResult {
  text: string;
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface ModelCapabilities {
  vision: boolean;
  // PDF files as input
  pdf: boolean;
  jsonSchema: boolean;
  reasoningEffort: boolean;
  webSearch: boolean;
}

export interface WebSearchRequest {
  question: string;
  location?: { region?: string; city?: string };
  timeoutMs?: number;
  userKey?: string;
}

export interface WebSearchHit {
  title: string;
  url: string;
  snippet: string;
  // The model cited it in its answer, not just saw it
  cited: boolean;
}

export interface WebSearchResult {
  hits: WebSearchHit[];
  answer: string;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ModelCapabilities;
  // Practice mode: built-in rules, not a real model. Results must be labeled as such.
  readonly simulated: boolean;
  // Owner-facing: who receives what's sent, and what that service says it does with it
  readonly dataHandling?: { recipient: string; notes: string[] };
  complete(request: CompletionRequest): Promise<CompletionResult>;
  // Present when capabilities.webSearch is true
  webSearch?(request: WebSearchRequest): Promise<WebSearchResult>;
}

export class AIProviderError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}
