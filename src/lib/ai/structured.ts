import { z } from "zod";
import type { ChatMessage, Effort, ModelProvider } from "./types";

export interface GenerateObjectOptions<T> {
  name: string;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  effort?: Effort;
  maxOutputTokens?: number;
  // Extra attempts after a reply fails validation
  maxRepairs?: number;
  stream?: boolean;
  timeoutMs?: number;
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
    const result = await model.complete({
      messages,
      effort: options.effort,
      maxOutputTokens: options.maxOutputTokens,
      responseFormat: { name: options.name, schema: jsonSchema },
      stream: options.stream,
      timeoutMs: options.timeoutMs,
    });

    if (result.finishReason === "length") {
      throw new StructuredOutputError(options.name, "reply was cut off at the output token limit", result.text);
    }

    const outcome = validate(options.schema, result.text);
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
