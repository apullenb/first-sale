// Provider-neutral model interface. Features depend on this, never on a vendor SDK.

export type Effort = "low" | "medium" | "high";

export type ContentPart =
  | { type: "text"; text: string }
  // https URL or data: URL
  | { type: "image"; url: string };

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
}

export interface CompletionResult {
  text: string;
  finishReason: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
}

export interface ModelCapabilities {
  vision: boolean;
  jsonSchema: boolean;
  reasoningEffort: boolean;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ModelCapabilities;
  complete(request: CompletionRequest): Promise<CompletionResult>;
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
