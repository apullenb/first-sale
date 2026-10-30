import { afterEach, describe, expect, it, vi } from "vitest";
import { type AIEvent, onAIEvent } from "../telemetry";
import { AIProviderError } from "../types";
import { createMockProvider } from "./mock";
import {
  backoffMs,
  buildRequestBody,
  createOpenAICompatibleProvider,
  readSearchOutput,
  retryAfter,
  type OpenAICompatibleConfig,
} from "./openai-compatible";

const config: OpenAICompatibleConfig = {
  name: "Test",
  baseUrl: "https://api.example.test/v1/",
  apiKey: "test-key",
  model: "test-model",
  capabilities: { vision: true, pdf: true, jsonSchema: true, reasoningEffort: true, webSearch: true },
  // Retries happen at once in tests
  wait: async () => {},
};

// A fresh response for every attempt, as a real server sends
const respond = (body: BodyInit | null, init: ResponseInit) => vi.fn().mockImplementation(() => Promise.resolve(new Response(body, init)));

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
      {
        ...config,
        capabilities: { vision: false, pdf: false, jsonSchema: false, reasoningEffort: false, webSearch: false },
      },
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

  it("maps PDF file parts to file parts with filename and file_data", () => {
    const body = buildRequestBody(config, {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Read this form." },
            { type: "file", filename: "form.pdf", data: "data:application/pdf;base64,JVBERi0=" },
          ],
        },
      ],
    });
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "Read this form." },
          { type: "file", file: { filename: "form.pdf", file_data: "data:application/pdf;base64,JVBERi0=" } },
        ],
      },
    ]);
  });

  it("refuses PDFs when pdf is off", () => {
    expect(() =>
      buildRequestBody(
        { ...config, capabilities: { ...config.capabilities, pdf: false } },
        {
          messages: [
            { role: "user", content: [{ type: "file", filename: "a.pdf", data: "data:application/pdf;base64,AA" }] },
          ],
        },
      ),
    ).toThrow(/not configured to accept PDF files/);
  });

  it("sends safety_identifier only when sendUserKey and userKey are both set", () => {
    const messages = [{ role: "user" as const, content: "Hi" }];
    expect(buildRequestBody({ ...config, sendUserKey: true }, { messages, userKey: "u-1" })).toMatchObject({
      safety_identifier: "u-1",
    });
    expect(buildRequestBody({ ...config, sendUserKey: true }, { messages })).not.toHaveProperty("safety_identifier");
    expect(buildRequestBody({ ...config, sendUserKey: false }, { messages, userKey: "u-1" })).not.toHaveProperty(
      "safety_identifier",
    );
    expect(buildRequestBody(config, { messages, userKey: "u-1" })).not.toHaveProperty("safety_identifier");
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
      usage: { inputTokens: 3, cachedInputTokens: 0, outputTokens: 1, reasoningTokens: 0 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
  });

  it("marks rate limits as retryable, and gives up after two retries", async () => {
    const fetchMock = respond("slow down", { status: 429 });
    vi.stubGlobal("fetch", fetchMock);

    const error = await createOpenAICompatibleProvider(config)
      .complete({ messages: [{ role: "user", content: "Hi" }] })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error).toMatchObject({ status: 429, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries a temporary failure, waiting as long as Retry-After asks", async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAICompatibleProvider({ ...config, wait: async (ms) => void waits.push(ms) }).complete({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(result.text).toBe("ok");
    expect(waits).toEqual([3000]);
  });

  it("doesn't retry when the wait the provider asks for leaves too little of the call's time", async () => {
    const fetchMock = respond("overloaded", { status: 503, headers: { "Retry-After": "60" } });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], timeoutMs: 45_000 }),
    ).rejects.toMatchObject({
      status: 503,
      retryAfterMs: 60_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits as long as Retry-After asks when the call has time for it", async () => {
    const waits: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "Retry-After": "15" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAICompatibleProvider({ ...config, wait: async (ms) => void waits.push(ms) }).complete({
      messages: [{ role: "user", content: "Hi" }],
      timeoutMs: 100_000,
    });
    expect(result.text).toBe("ok");
    expect(waits).toEqual([15_000]);
  });

  it("doesn't retry a gateway timeout, which Meta says usually times out again", async () => {
    const fetchMock = respond("timed out", { status: 504 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }] })).rejects.toMatchObject({
      status: 504,
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't retry an attempt that already used a quarter of its time", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response("busy", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], timeoutMs: 100 }),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the cache key and asks for usage on streams, and reads cached and reasoning tokens", async () => {
    const events = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "{}" }, finish_reason: "stop" }] })}\n\n`,
      `data: ${JSON.stringify({
        choices: [],
        usage: { prompt_tokens: 900, completion_tokens: 50, prompt_tokens_details: { cached_tokens: 800 }, completion_tokens_details: { reasoning_tokens: 40 } },
      })}\n\ndata: [DONE]\n\n`,
    ].join("");
    const fetchMock = respond(events, { status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAICompatibleProvider({ ...config, sendCacheKey: true }).complete({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
      cacheKey: "business_plan",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      prompt_cache_key: "business_plan",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("prompt_cache_retention");
    expect(result.usage).toEqual({ inputTokens: 900, cachedInputTokens: 800, outputTokens: 50, reasoningTokens: 40 });
  });

  it("asks for a day's cache retention only when the call opts in", () => {
    const body = buildRequestBody({ ...config, sendCacheKey: true }, { messages: [{ role: "user", content: "Hi" }], cacheKey: "research", retainCache: true });
    expect(body).toMatchObject({ prompt_cache_key: "research", prompt_cache_retention: "24h" });
  });

  it("leaves the cache key out for endpoints that don't take it", () => {
    const body = buildRequestBody(config, { messages: [{ role: "user", content: "Hi" }], cacheKey: "x" });
    expect(body).not.toHaveProperty("prompt_cache_key");
    expect(body).not.toHaveProperty("prompt_cache_retention");
  });

  it("joins streamed chunks, even when an event is split across reads", async () => {
    const events = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"a":' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "1}" }, finish_reason: "stop" }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } })}\n\ndata: [DONE]\n\n`,
    ].join("");
    const encoded = new TextEncoder().encode(events);
    const split = 30;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoded.slice(0, split));
            controller.enqueue(encoded.slice(split));
            controller.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAICompatibleProvider(config).complete({
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    });

    expect(result).toEqual({
      text: '{"a":1}',
      finishReason: "stop",
      usage: { inputTokens: 7, cachedInputTokens: 0, outputTokens: 2, reasoningTokens: 0 },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ stream: true });
  });

  it("turns a streamed error event into a retryable provider error", async () => {
    const body = `data: ${JSON.stringify({ error: { message: "overloaded" } })}\n\n`;
    vi.stubGlobal("fetch", respond(body, { status: 200 }));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], stream: true }),
    ).rejects.toMatchObject({ name: "AIProviderError", retryable: true, message: expect.stringMatching(/overloaded/) });
  });

  it("treats a stream that stops early as a retryable error, not a reply", async () => {
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"a":' } }] })}\n\n`;
    vi.stubGlobal("fetch", respond(body, { status: 200 }));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], stream: true }),
    ).rejects.toMatchObject({ name: "AIProviderError", retryable: true, message: expect.stringMatching(/ended before/) });
  });

  it("marks bad requests as not retryable, and never retries them", async () => {
    const fetchMock = respond("bad", { status: 400 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toMatchObject({ status: 400, retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("backoffMs and retryAfter", () => {
  it("doubles from 1 s with jitter, and lets the provider ask for longer", () => {
    expect(backoffMs(0, null, () => 0)).toBe(500);
    expect(backoffMs(0, null, () => 1)).toBe(1000);
    expect(backoffMs(1, null, () => 1)).toBe(2000);
    expect(backoffMs(0, 5000, () => 0)).toBe(5000);
    expect(backoffMs(0, 60_000, () => 0)).toBe(60_000);
  });

  it("reads seconds or an HTTP date", () => {
    expect(retryAfter("2")).toBe(2000);
    expect(retryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(retryAfter("soon")).toBeNull();
    expect(retryAfter(null)).toBeNull();
  });
});

describe("webSearch", () => {
  const searchResponse = {
    output: [
      {
        type: "web_search_call",
        results: [
          { title: "Seen only", url: "https://a.gov/seen", snippet: "seen snippet" },
          { title: "Cited", url: "https://b.gov/cited", snippet: "cited snippet" },
        ],
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "You need a vendor license.",
            annotations: [{ type: "url_citation", url: "https://b.gov/cited", title: "Ignored title" }],
          },
        ],
      },
    ],
  };

  it("posts to /responses with the web_search tool, results included, nothing stored", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(searchResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = createOpenAICompatibleProvider({ ...config, sendUserKey: true });
    const result = await provider.webSearch!({
      question: "vendor license Columbus OH",
      location: { region: "OH", city: "Columbus" },
      userKey: "u-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/responses");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({
      model: "test-model",
      input: "vendor license Columbus OH",
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
          user_location: { type: "approximate", country: "US", region: "OH", city: "Columbus" },
        },
      ],
      include: ["web_search_call.results"],
      store: false,
      reasoning: { effort: "low" },
      safety_identifier: "u-1",
    });
    expect(result.answer).toBe("You need a vendor license.");
    expect(result.hits.map((hit) => hit.url)).toEqual(["https://b.gov/cited", "https://a.gov/seen"]);
  });

  it("leaves out user_location when no location is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createOpenAICompatibleProvider(config).webSearch!({ question: "q" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tools[0]).not.toHaveProperty("user_location");
    expect(body).not.toHaveProperty("safety_identifier");
  });

  it("throws a provider error when the body has an error field", async () => {
    vi.stubGlobal("fetch", respond(JSON.stringify({ error: { message: "tool unavailable" } }), { status: 200 }));

    const error = await createOpenAICompatibleProvider(config)
      .webSearch!({ question: "q" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).message).toMatch(/tool unavailable/);
  });

  it("throws a provider error on a failed status", async () => {
    vi.stubGlobal("fetch", respond("nope", { status: 503 }));

    await expect(createOpenAICompatibleProvider(config).webSearch!({ question: "q" })).rejects.toMatchObject({
      name: "AIProviderError",
      status: 503,
      retryable: true,
    });
  });

  it("is absent when webSearch is off", () => {
    const provider = createOpenAICompatibleProvider({
      ...config,
      capabilities: { ...config.capabilities, webSearch: false },
    });
    expect(provider.webSearch).toBeUndefined();
    expect(provider.simulated).toBe(false);
  });
});

describe("readSearchOutput", () => {
  it("merges search results with url_citation annotations, cited hits first", () => {
    const result = readSearchOutput({
      output: [
        {
          type: "web_search_call",
          results: [
            { title: "First", url: "https://a.gov/1", snippet: "one" },
            { title: "Second", url: "https://a.gov/2", snippet: "two" },
            { title: "Dup", url: "https://a.gov/1", snippet: "dup" },
          ],
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Answer ",
              annotations: [
                { type: "url_citation", url: "https://a.gov/2", title: "Other title" },
                { type: "url_citation", url: "https://c.gov/only-cited", title: "Only cited" },
                { type: "file_citation", url: "https://d.gov/ignored" },
              ],
            },
            { type: "refusal", text: "skip me" },
            { type: "output_text", text: "continues." },
          ],
        },
      ],
    });

    expect(result.answer).toBe("Answer continues.");
    expect(result.hits).toEqual([
      { title: "Second", url: "https://a.gov/2", snippet: "two", cited: true },
      { title: "Only cited", url: "https://c.gov/only-cited", snippet: "", cited: true },
      { title: "First", url: "https://a.gov/1", snippet: "one", cited: false },
    ]);
  });

  it("handles an empty response", () => {
    expect(readSearchOutput({})).toEqual({ hits: [], answer: "" });
  });
});

describe("mock provider", () => {
  it("is simulated and has no web search", () => {
    const mock = createMockProvider();
    expect(mock.simulated).toBe(true);
    expect(mock.capabilities.webSearch).toBe(false);
    expect(mock.webSearch).toBeUndefined();
  });
});

describe("measuring events", () => {
  it("reports each retry and each search's query count and tokens, without any text", async () => {
    const events: AIEvent[] = [];
    const stop = onAIEvent((event) => events.push(event));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("busy", { status: 503 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              output: [{ type: "web_search_call", results: [] }, { type: "web_search_call", results: [] }],
              usage: { input_tokens: 900, output_tokens: 40, input_tokens_details: { cached_tokens: 100 }, output_tokens_details: { reasoning_tokens: 10 } },
            }),
            { status: 200 },
          ),
        ),
    );
    await createOpenAICompatibleProvider(config).webSearch!({ question: "q" });
    stop();
    expect(events.map((event) => event.type)).toEqual(["retry", "search"]);
    expect(events[0]).toMatchObject({ status: 503 });
    expect(events[1]).toMatchObject({ queries: 2, usage: { inputTokens: 900, cachedInputTokens: 100, outputTokens: 40, reasoningTokens: 10 } });
  });
});
