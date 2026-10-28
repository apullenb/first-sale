import { createMockProvider } from "./providers/mock";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import type { ModelProvider } from "./types";
import type { ImageModel } from "./image-types";
import { createMockImageProvider } from "./providers/mock-image";
import { createMuseImageProvider } from "./providers/muse-image";

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
        // Muse Spark: images, PDFs, JSON Schema, reasoning effort, and web search on the Responses API
        capabilities: { vision: true, pdf: true, jsonSchema: true, reasoningEffort: true, webSearch: true },
        sendUserKey: true,
        sendCacheKey: true,
        dataHandling: museDataHandling(env.MUSE_MODEL || MUSE_DEFAULTS.model),
      });

    case "openai-compatible":
      return createOpenAICompatibleProvider({
        name: env.AI_NAME || "OpenAI-compatible",
        baseUrl: required(env, "AI_BASE_URL"),
        apiKey: required(env, "AI_API_KEY"),
        model: required(env, "AI_MODEL"),
        capabilities: {
          vision: env.AI_VISION === "true",
          pdf: env.AI_PDF === "true",
          jsonSchema: env.AI_JSON_SCHEMA !== "false",
          reasoningEffort: env.AI_REASONING_EFFORT === "true",
          webSearch: env.AI_WEB_SEARCH === "true",
        },
        sendUserKey: false,
        dataHandling: {
          recipient: `the AI service this copy of First Sale is set up with (${env.AI_NAME || "an OpenAI-compatible service"})`,
          notes: ["That service’s own terms say how it handles what’s sent to it."],
        },
      });

    default:
      throw new Error(`Unknown AI_PROVIDER "${provider}". Use muse, openai-compatible, or mock.`);
  }
}

// From Meta's docs (dev.meta.ai, pricing and models pages), checked 2026-10-27
function museDataHandling(model: string) {
  const recipient = "Meta’s AI service (Muse)";
  if (/contributor/i.test(model)) {
    return { recipient, notes: ["This copy of First Sale uses Meta’s Contributor mode, which lets Meta use what’s sent to train its models."] };
  }
  return {
    recipient,
    notes: [
      "First Sale uses Meta’s Standard mode, which Meta says doesn’t use your content to train its models.",
      "Meta’s documentation doesn’t say how long it keeps requests, so we can’t promise more than that.",
      "To cost less, requirement checks ask Meta to keep their prompt cache for up to a day. That cache holds the official pages and your business answers.",
    ],
  };
}

function required(env: Env, key: string): string {
  const value = env[key];
  if (!value) throw new Error(`${key} is not set. Add it to .env.local.`);
  return value;
}

export const MUSE_IMAGE_DEFAULTS = { model: "muse-image-1.0" } as const;

// Image editing, picked from env like getModel. Null when the provider has no image editing First Sale supports.
export function getImageModel(env: Env = process.env): ImageModel | null {
  if (!env.AI_PROVIDER && env.NODE_ENV === "production") {
    throw new Error("AI_PROVIDER is not set. Production never falls back to the mock model.");
  }
  const provider = env.AI_PROVIDER || "mock";
  if (provider === "mock") return createMockImageProvider();
  // The JSON edit body is Meta's own; other endpoints only take multipart uploads
  if (provider !== "muse") return null;

  const model = env.MUSE_IMAGE_MODEL || MUSE_IMAGE_DEFAULTS.model;
  if (/contributor/i.test(model) && env.AI_ALLOW_CONTRIBUTOR_MODELS !== "true") {
    throw new Error(`${model} may use owners' data for training. Use a standard model, or set AI_ALLOW_CONTRIBUTOR_MODELS=true.`);
  }
  return createMuseImageProvider({
    baseUrl: env.MUSE_BASE_URL || MUSE_DEFAULTS.baseUrl,
    apiKey: required(env, "MUSE_API_KEY"),
    model,
  });
}
