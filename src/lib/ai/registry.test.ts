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
    expect(model.capabilities).toEqual({
      vision: true,
      pdf: true,
      jsonSchema: true,
      reasoningEffort: true,
      webSearch: true,
    });
    expect(model.simulated).toBe(false);
    expect(model.webSearch).toBeTypeOf("function");
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
    expect(model.capabilities).toEqual({
      vision: true,
      pdf: false,
      jsonSchema: true,
      reasoningEffort: false,
      webSearch: false,
    });
    expect(model.webSearch).toBeUndefined();
  });

  it("turns on PDFs, web search and reasoning effort from env, and JSON Schema off", () => {
    const model = getModel({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://llm.example.test/v1",
      AI_API_KEY: "k",
      AI_MODEL: "some-model",
      AI_PDF: "true",
      AI_WEB_SEARCH: "true",
      AI_REASONING_EFFORT: "true",
      AI_JSON_SCHEMA: "false",
    });
    expect(model.capabilities).toEqual({
      vision: false,
      pdf: true,
      jsonSchema: false,
      reasoningEffort: true,
      webSearch: true,
    });
    expect(model.webSearch).toBeTypeOf("function");
  });

  it("only treats the exact string \"true\" as on", () => {
    const model = getModel({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "https://llm.example.test/v1",
      AI_API_KEY: "k",
      AI_MODEL: "some-model",
      AI_PDF: "yes",
      AI_WEB_SEARCH: "1",
    });
    expect(model.capabilities).toMatchObject({ pdf: false, webSearch: false });
  });

  it("uses the mock as a simulated model with no web search", () => {
    const model = getModel({});
    expect(model.simulated).toBe(true);
    expect(model.capabilities).toMatchObject({ pdf: false, webSearch: false });
    expect(model.webSearch).toBeUndefined();
  });

  it("rejects unknown providers", () => {
    expect(() => getModel({ AI_PROVIDER: "other" })).toThrow(/Unknown AI_PROVIDER/);
  });
});
