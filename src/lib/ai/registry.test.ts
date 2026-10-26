import { describe, expect, it } from "vitest";
import { getModel, MUSE_DEFAULTS } from "./registry";

describe("getModel", () => {
  it("defaults to the mock provider", () => {
    expect(getModel({}).name).toBe("Mock");
  });

  it("configures Muse with its defaults", () => {
    const model = getModel({ AI_PROVIDER: "muse", MUSE_API_KEY: "k" });
    expect(model.name).toBe("Meta Muse");
    expect(model.model).toBe(MUSE_DEFAULTS.model);
    expect(model.capabilities).toEqual({ vision: true, jsonSchema: true, reasoningEffort: true });
  });

  it("requires a Muse API key", () => {
    expect(() => getModel({ AI_PROVIDER: "muse" })).toThrow(/MUSE_API_KEY/);
  });

  it("refuses contributor models unless allowed", () => {
    const env = { AI_PROVIDER: "muse", MUSE_API_KEY: "k", MUSE_MODEL: "muse-spark-1.3-contributor" };
    expect(() => getModel(env)).toThrow(/training/);
    expect(getModel({ ...env, AI_ALLOW_CONTRIBUTOR_MODELS: "true" }).model).toBe("muse-spark-1.3-contributor");
  });

  it("refuses contributor models behind the generic adapter too", () => {
    expect(() =>
      getModel({
        AI_PROVIDER: "openai-compatible",
        AI_BASE_URL: "https://api.meta.ai/v1",
        AI_API_KEY: "k",
        AI_MODEL: "Muse-Spark-1.3-Contributor",
      }),
    ).toThrow(/training/);
  });

  it("does not fall back to the mock in production", () => {
    expect(() => getModel({ NODE_ENV: "production" })).toThrow(/AI_PROVIDER is not set/);
  });

  it("reads capability flags for other OpenAI-compatible endpoints", () => {
    const model = getModel({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://llm.example.test/v1",
      AI_API_KEY: "k",
      AI_MODEL: "some-model",
      AI_VISION: "true",
    });
    expect(model.capabilities).toEqual({ vision: true, jsonSchema: true, reasoningEffort: false });
  });

  it("rejects unknown providers", () => {
    expect(() => getModel({ AI_PROVIDER: "other" })).toThrow(/Unknown AI_PROVIDER/);
  });
});
