import { z } from "zod";
import { addCounts, countOf, redactSensitive, type SensitiveCounts } from "@/lib/privacy/sensitive";
import { emitAIEvent } from "./telemetry";
import { AIProviderError, type ChatMessage, type CompletionResult, type Effort, type ModelProvider } from "./types";

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
  // Cancels the call; see generateObjectInTime
  signal?: AbortSignal;
}

export class StructuredOutputError extends Error {
  readonly rawText: string;

  constructor(name: string, problem: string, rawText: string) {
    super(`Model output for "${name}" failed validation: ${problem}`);
    this.name = "StructuredOutputError";
    this.rawText = rawText;
  }
}

export interface TimeFallback {
  // Effort for the backup: lower means less thinking and a sooner answer
  effort: Effort;
  // When the caller's own time runs out, as a Date.now() time
  deadline: number;
  // Start the backup if the first answer isn't back by then
  hedgeAfterMs: number;
  // The least time worth a backup, and the most it gets
  minMs: number;
  maxMs: number;
}

// A hedged request, for calls whose slowest replies would miss the caller's deadline. If the first answer isn't back
// after hedgeAfterMs, or runs out of time before then, a backup starts at a lower effort; the first valid answer wins
// and the other call is cancelled. Both go through the same schema, and the caller's same checks. Any other failure of
// the first call, with no backup running, is thrown as is.
export function generateObjectInTime<T>(model: ModelProvider, options: GenerateObjectOptions<T>, fallback: TimeFallback): Promise<T> {
  const first = new AbortController();
  const backup = new AbortController();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let second: Promise<T> | null = null;
    let firstError: unknown = null;
    let firstDone = false;
    let secondDone = false;
    const win = (value: T, loser: AbortController) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      loser.abort();
      resolve(value);
    };
    // Fails only once nothing is left running
    const lose = (error: unknown) => {
      if (settled || !firstDone || (second && !secondDone)) return;
      settled = true;
      clearTimeout(timer);
      reject(firstError ?? error);
    };
    const launch = () => {
      if (settled || second) return;
      const left = fallback.deadline - Date.now();
      if (left < fallback.minMs) return lose(firstError);
      const timeoutMs = Math.min(fallback.maxMs, left);
      emitAIEvent({ type: "fallback", name: options.name, effort: fallback.effort, timeoutMs });
      // No repair round: it has to finish inside the caller's deadline
      second = generateObject(model, { ...options, effort: fallback.effort, timeoutMs, maxRepairs: 0, signal: backup.signal });
      second.then(
        (value) => win(value, first),
        (error) => {
          secondDone = true;
          lose(error);
        },
      );
    };
    const timer = setTimeout(launch, Math.max(0, fallback.hedgeAfterMs));
    generateObject(model, { ...options, signal: first.signal }).then(
      (value) => win(value, backup),
      (error) => {
        firstDone = true;
        firstError = error;
        if (!second && error instanceof AIProviderError && error.timedOut) return launch();
        if (!second) clearTimeout(timer);
        lose(error);
      },
    );
  });
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
  // Last line of defense: numbers SnapStart never sends are taken out of every message's text, in code.
  // Images and PDFs can't be scrubbed here; uploads say so before they're read.
  const { messages: scrubbed, counts } = scrubMessages(options.messages);
  if (countOf(counts)) console.info(`AI ${options.name}: removed ${countOf(counts)} sensitive numbers before sending`);
  const messages: ChatMessage[] = [...scrubbed];
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
      signal: options.signal,
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

export function scrubMessages(messages: readonly ChatMessage[]): { messages: ChatMessage[]; counts: SensitiveCounts } {
  let counts: SensitiveCounts = {};
  const clean = (text: string) => {
    const result = redactSensitive(text);
    counts = addCounts(counts, result.counts);
    return result.text;
  };
  const out = messages.map((message): ChatMessage => {
    if (message.role !== "user") return { ...message, content: clean(message.content) };
    if (typeof message.content === "string") return { ...message, content: clean(message.content) };
    return { ...message, content: message.content.map((part) => (part.type === "text" ? { ...part, text: clean(part.text) } : part)) };
  });
  return { messages: out, counts };
}
