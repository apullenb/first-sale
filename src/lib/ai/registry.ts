import { createMockProvider } from "./providers/mock";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import type { ModelProvider } from "./types";

type Env = Record<string, string | undefined>;

export const MUSE_DEFAULTS = {
  baseUrl: "https://api.meta.ai/v1",
  model: "muse-spark-1.3",
} as const;

// Picks the model from env so features never name a vendor.
export function getModel(env: Env = process.env): ModelProvider {
  if (!env.AI_PROVIDER && env.NODE_ENV === "production") {
    throw new Error("AI_PROVIDER is not set. Production never falls back to the mock model.");
  }

  const model = createProvider(env.AI_PROVIDER || "mock", env);
  // Contributor models may use prompts to train Meta models
  if (/contributor/i.test(model.model) && env.AI_ALLOW_CONTRIBUTOR_MODELS !== "true") {
    throw new Error(
      `${model.model} may use owners' data for training. Use a standard model, or set AI_ALLOW_CONTRIBUTOR_MODELS=true.`,
    );
  }
  return model;
}

function createProvider(provider: string, env: Env): ModelProvider {
  switch (provider) {
    case "mock":
      return createMockProvider();

    case "muse":
      return createOpenAICompatibleProvider({
        name: "Meta Muse",
        baseUrl: env.MUSE_BASE_URL || MUSE_DEFAULTS.baseUrl,
        apiKey: required(env, "MUSE_API_KEY"),
        model: env.MUSE_MODEL || MUSE_DEFAULTS.model,
        capabilities: { vision: true, jsonSchema: true, reasoningEffort: true },
      });

    case "openai-compatible":
      return createOpenAICompatibleProvider({
        name: env.AI_NAME || "OpenAI-compatible",
        baseUrl: required(env, "AI_BASE_URL"),
        apiKey: required(env, "AI_API_KEY"),
        model: required(env, "AI_MODEL"),
        capabilities: {
          vision: env.AI_VISION === "true",
          jsonSchema: env.AI_JSON_SCHEMA !== "false",
          reasoningEffort: env.AI_REASONING_EFFORT === "true",
        },
      });

    default:
      throw new Error(`Unknown AI_PROVIDER "${provider}". Use muse, openai-compatible, or mock.`);
  }
}

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set. Add it to .env.local.`);
  return value;
}
