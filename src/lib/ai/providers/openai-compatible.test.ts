import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../types";
import { createMockProvider } from "./mock";
import {
  buildRequestBody,
  createOpenAICompatibleProvider,
  readSearchOutput,
  type OpenAICompatibleConfig,
} from "./openai-compatible";

const config: OpenAICompatibleConfig = {
  name: "Test",
  baseUrl: "https://api.example.test/v1/",
  apiKey: "test-key",
  model: "test-model",
  capabilities: { vision: true, pdf: true, jsonSchema: true, reasoningEffort: true, webSearch: true },
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

    expect(result).toEqual({ text: '{"a":1}', finishReason: "stop", usage: { inputTokens: 7, outputTokens: 2 } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ stream: true });
  });

  it("turns a streamed error event into a retryable provider error", async () => {
    const body = `data: ${JSON.stringify({ error: { message: "overloaded" } })}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], stream: true }),
    ).rejects.toMatchObject({ name: "AIProviderError", retryable: true, message: expect.stringMatching(/overloaded/) });
  });

  it("treats a stream that stops early as a retryable error, not a reply", async () => {
    const body = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"a":' } }] })}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }], stream: true }),
    ).rejects.toMatchObject({ name: "AIProviderError", retryable: true, message: expect.stringMatching(/ended before/) });
  });

  it("marks bad requests as not retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 400 })));

    await expect(
      createOpenAICompatibleProvider(config).complete({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toMatchObject({ status: 400, retryable: false });
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
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "tool unavailable" } }), { status: 200 })),
    );

    const error = await createOpenAICompatibleProvider(config)
      .webSearch!({ question: "q" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).message).toMatch(/tool unavailable/);
  });

  it("throws a provider error on a failed status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 503 })));

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
