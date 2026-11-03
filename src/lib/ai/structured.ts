import { z } from "zod";
import { emitAIEvent } from "./telemetry";
import type { ChatMessage, CompletionResult, Effort, ModelProvider } from "./types";

export interface GenerateObjectOptions<T> {
  name: string;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  effort?: Effort;
  maxOutputTokens?: number;
  // Extra attempts after a reply fails validation
  maxRepairs?: number;
  // On by default: a long reply that streams doesn't hit a proxy's timeout while the model thinks
  stream?: boolean;
  timeoutMs?: number;
  userKey?: string;
  // Keep the cached prompt a day: only for calls that start with long public text, never uploads
  retainCache?: boolean;
}

export class StructuredOutputError extends Error {
  readonly rawText: string;

  constructor(name: string, problem: string, rawText: string) {
    super(`Model output for "${name}" failed validation: ${problem}`);
    this.name = "StructuredOutputError";
    this.rawText = rawText;
  }
}

// Format OpenAI-compatible APIs require for response_format names
const SCHEMA_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

// JSON out of any provider: schema-constrained where supported, validated always.
export async function generateObject<T>(
  model: ModelProvider,
  options: GenerateObjectOptions<T>,
): Promise<T> {
  if (!SCHEMA_NAME.test(options.name)) {
    throw new Error(`Schema name "${options.name}" must be 1–64 letters, digits, "_" or "-"`);
  }
  const jsonSchema = toJsonSchema(options.schema);
  const messages: ChatMessage[] = [...options.messages];
  if (!model.capabilities.jsonSchema) {
    messages.push({
      role: "user",
      content: `Reply with only a JSON value matching this JSON Schema:\n${JSON.stringify(jsonSchema)}`,
    });
  }

  const maxRepairs = options.maxRepairs ?? 1;
  for (let attempt = 0; ; attempt++) {
    const started = Date.now();
    const result = await model.complete({
      messages,
      effort: options.effort,
      maxOutputTokens: options.maxOutputTokens,
      responseFormat: { name: options.name, schema: jsonSchema },
      stream: options.stream ?? true,
      timeoutMs: options.timeoutMs,
      userKey: options.userKey,
      // Each task's system prompt is a stable prefix, so its schema name names the cache
      cacheKey: options.name,
      retainCache: options.retainCache,
    });
    const ms = Date.now() - started;
    logUsage(options.name, result.usage, ms);
    const report = (outcome: "ok" | "invalid" | "cut_off", problem: string | null = null) =>
      emitAIEvent({ type: "attempt", name: options.name, attempt, ms, finishReason: result.finishReason, usage: result.usage, outcome, problem });

    if (result.finishReason === "length") {
      report("cut_off");
      throw new StructuredOutputError(options.name, "reply was cut off at the output token limit", result.text);
    }

    const outcome = validate(options.schema, result.text);
    report(outcome.ok ? "ok" : "invalid", outcome.ok ? null : outcome.error.slice(0, 300));
    if (outcome.ok) return outcome.value;
    if (attempt >= maxRepairs) {
      throw new StructuredOutputError(options.name, outcome.error, result.text);
    }

    messages.push(
      { role: "assistant", content: result.text },
      {
        role: "user",
        content: `That reply did not match the required JSON schema:\n${outcome.error}\nReply again with only the corrected JSON.`,
      },
    );
  }
}

// Token counts only, never prompt or reply text: shows cache reuse and thinking cost per task
function logUsage(name: string, usage: CompletionResult["usage"], ms: number) {
  if (!usage) return;
  console.info(
    `AI ${name}: ${ms} ms, ${usage.inputTokens} in (${usage.cachedInputTokens} cached), ${usage.outputTokens} out (${usage.reasoningTokens} reasoning)`,
  );
}

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function validate<T>(schema: z.ZodType<T>, text: string): Validation<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    return { ok: false, error: "reply was not valid JSON" };
  }
  const result = schema.safeParse(parsed);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: z.prettifyError(result.error) };
}

function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : text.trim();
}
