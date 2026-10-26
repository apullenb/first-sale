import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../types";
import {
  buildRequestBody,
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from "./openai-compatible";

const config: OpenAICompatibleConfig = {
  name: "Test",
  baseUrl: "https://api.example.test/v1/",
  apiKey: "test-key",
  model: "test-model",
  capabilities: { vision: true, jsonSchema: true, reasoningEffort: true },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildRequestBody", () => {
  it("maps images to image_url parts and sets optional fields", () => {
    const body = buildRequestBody(config, {
      messages: [
        { role: "system", content: "Be brief." },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this." },
            { type: "image", url: "data:image/png;base64,AAAA" },
          ],
        },
      ],
      effort: "low",
      maxOutputTokens: 500,
      responseFormat: { name: "Listing", schema: { type: "object" } },
    });

    expect(body).toEqual({
      model: "test-model",
      messages: [
        { role: "system", content: "Be brief." },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this." },
            { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
          ],
        },
      ],
      max_completion_tokens: 500,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: { name: "Listing", schema: { type: "object" } },
      },
    });
  });

  it("leaves out fields the model does not support", () => {
    const body = buildRequestBody(
      { ...config, capabilities: { vision: false, jsonSchema: false, reasoningEffort: false } },
      {
        messages: [{ role: "user", content: "Hi" }],
        effort: "high",
        responseFormat: { name: "X", schema: {} },
      },
    );
    expect(body).toEqual({ model: "test-model", messages: [{ role: "user", content: "Hi" }] });
  });

  it("refuses images when vision is off", () => {
    expect(() =>
      buildRequestBody(
        { ...config, capabilities: { ...config.capabilities, vision: false } },
        { messages: [{ role: "user", content: [{ type: "image", url: "https://x.test/a.png" }] }] },
      ),
    ).toThrow(/not configured to accept images/);
  });
});

describe("complete", () => {
  it("posts to /chat/completions and reads the first choice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 3, completion_tokens: 1 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAICompatibleProvider(config).complete({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(result).toEqual({
      text: "Hello",
      finishReason: "stop",
      usage: { inputTokens: 3, outputTokens: 1 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("marks rate limits as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("slow down", { status: 429 })));

    const error = await createOpenAICompatibleProvider(config)
      .complete({ messages: [{ role: "user", content: "Hi" }] })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error).toMatchObject({ status: 429, retryable: true });
  });

  it("marks bad requests as not retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 400 })));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toMatchObject({ status: 400, retryable: false });
  });
});
