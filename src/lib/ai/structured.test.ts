import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createMockProvider } from "./providers/mock";
import { generateObject, generateObjectInTime, scrubMessages, StructuredOutputError, type TimeFallback, toJsonSchema } from "./structured";
import { AIProviderError } from "./types";
import type { CompletionRequest, ModelProvider } from "./types";

const listingSchema = z.object({ title: z.string(), tags: z.array(z.string()) });

function scripted(replies: string[], finishReason: string | null = "stop") {
  const requests: CompletionRequest[] = [];
  const base = createMockProvider();
  const model: ModelProvider = {
    ...base,
    async complete(request) {
      requests.push(structuredClone(request));
      const text = replies[requests.length - 1];
      if (text === undefined) throw new Error("No scripted reply left");
      return { text, finishReason, usage: null };
    },
  };
  return { model, requests };
}

const messages = [{ role: "user" as const, content: "Write a listing." }];

describe("generateObject", () => {
  it("returns validated JSON and sends the schema", async () => {
    const { model, requests } = scripted(['{"title":"Lemon loaf","tags":["baked"]}']);

    const listing = await generateObject(model, { name: "Listing", schema: listingSchema, messages });

    expect(listing).toEqual({ title: "Lemon loaf", tags: ["baked"] });
    expect(requests[0].responseFormat?.name).toBe("Listing");
    expect(requests[0].responseFormat?.schema).not.toHaveProperty("$schema");
  });

  it("streams by default and names the prompt cache after the task", async () => {
    const { model, requests } = scripted(['{"title":"Pie","tags":[]}', '{"title":"Pie","tags":[]}']);

    await generateObject(model, { name: "Listing", schema: listingSchema, messages });
    await generateObject(model, { name: "Listing", schema: listingSchema, messages, stream: false });
    expect(requests.map((request) => [request.stream, request.cacheKey])).toEqual([
      [true, "Listing"],
      [false, "Listing"],
    ]);
  });

  it("accepts JSON wrapped in a code fence", async () => {
    const { model } = scripted(['```json\n{"title":"Tray","tags":[]}\n```']);
    await expect(
      generateObject(model, { name: "Listing", schema: listingSchema, messages }),
    ).resolves.toEqual({ title: "Tray", tags: [] });
  });

  it("asks once for a repair, then succeeds", async () => {
    const { model, requests } = scripted(['{"title":42}', '{"title":"Tray","tags":["wood"]}']);

    const listing = await generateObject(model, { name: "Listing", schema: listingSchema, messages });

    expect(listing.title).toBe("Tray");
    expect(requests).toHaveLength(2);
    expect(requests[1].messages.at(-1)?.content).toMatch(/did not match the required JSON schema/);
  });

  it("throws after the repair also fails", async () => {
    const { model } = scripted(["not json", "still not json"]);
    await expect(
      generateObject(model, { name: "Listing", schema: listingSchema, messages }),
    ).rejects.toBeInstanceOf(StructuredOutputError);
  });

  it("does not try to repair a reply cut off by the token limit", async () => {
    const { model, requests } = scripted(['{"title":"Tr'], "length");
    await expect(
      generateObject(model, { name: "Listing", schema: listingSchema, messages }),
    ).rejects.toThrow(/cut off/);
    expect(requests).toHaveLength(1);
  });

  it("rejects schema names the API would refuse", async () => {
    const { model, requests } = scripted([]);
    await expect(
      generateObject(model, { name: "Requirement draft", schema: listingSchema, messages }),
    ).rejects.toThrow(/Schema name/);
    expect(requests).toHaveLength(0);
  });

  it("puts the schema in the prompt for models without JSON schema support", async () => {
    const { model, requests } = scripted(['{"title":"Tray","tags":[]}']);
    const plainModel = { ...model, capabilities: { ...model.capabilities, jsonSchema: false } };

    await generateObject(plainModel, { name: "Listing", schema: listingSchema, messages });

    expect(requests[0].messages.at(-1)?.content).toContain(JSON.stringify(toJsonSchema(listingSchema)));
  });
});

describe("scrubMessages", () => {
  it("takes numbers SnapStart never sends out of every message before the model sees it", async () => {
    const { model, requests } = scripted(['{"title":"Lemon loaf","tags":[]}']);
    await generateObject(model, {
      name: "Listing",
      schema: listingSchema,
      messages: [
        { role: "system", content: "Write a listing." },
        { role: "user", content: [{ type: "text", text: "My SSN is 123-45-6789 and my card is 4111 1111 1111 1111." }, { type: "image", url: "https://example.com/a.png" }] },
      ],
    });
    const sent = JSON.stringify(requests[0].messages);
    expect(sent).not.toContain("123-45-6789");
    expect(sent).not.toContain("4111 1111 1111 1111");
    expect(sent).toContain("[Social Security number removed]");
    expect(sent).toContain("https://example.com/a.png");
  });

  it("counts what it removed and leaves other text as it was", () => {
    const { messages, counts } = scrubMessages([{ role: "user", content: "Call 512-555-0123. SSN 123-45-6789." }]);
    expect(messages[0].content).toBe("Call 512-555-0123. SSN [Social Security number removed].");
    expect(counts).toEqual({ ssn: 1 });
  });
});

describe("generateObjectInTime", () => {
  const timedOut = () => new AIProviderError("Meta Muse stream failed: The operation was aborted due to timeout", null, true, null, true);
  // A model whose reply takes the given time at each effort, or fails with the given error, and that stops when cancelled
  function timed(plan: Partial<Record<string, number | Error>>) {
    const requests: CompletionRequest[] = [];
    const cancelled: string[] = [];
    const base = createMockProvider();
    const model: ModelProvider = {
      ...base,
      complete(request) {
        requests.push(request);
        const effort = request.effort ?? "none";
        const step = plan[effort];
        return new Promise((resolve, reject) => {
          if (step instanceof Error) return reject(step);
          const timer = setTimeout(() => resolve({ text: JSON.stringify({ title: effort, tags: [] }), finishReason: "stop", usage: null }), step ?? 0);
          request.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            cancelled.push(effort);
            reject(new AIProviderError("Request cancelled", null, true));
          });
        });
      },
    };
    return { model, requests, cancelled };
  }
  const options = { name: "Listing", schema: listingSchema, messages, effort: "high" as const, timeoutMs: 100_000 };
  const fallback = (over: Partial<TimeFallback> = {}): TimeFallback => ({ effort: "medium", deadline: Date.now() + 200_000, hedgeAfterMs: 30, minMs: 10, maxMs: 90_000, ...over });

  it("takes the first answer when it's back in time, and never starts a backup", async () => {
    const { model, requests } = timed({ high: 5 });
    expect((await generateObjectInTime(model, options, fallback())).title).toBe("high");
    expect(requests.map((request) => request.effort)).toEqual(["high"]);
  });

  it("races a lower-effort backup when the first answer is slow, takes the sooner one, and cancels the other", async () => {
    const { model, requests, cancelled } = timed({ high: 2_000, medium: 10 });
    expect((await generateObjectInTime(model, options, fallback())).title).toBe("medium");
    expect(requests.map((request) => request.effort)).toEqual(["high", "medium"]);
    expect(cancelled).toEqual(["high"]);
    expect(requests[1].timeoutMs).toBeLessThanOrEqual(90_000);
  });

  it("still takes the first answer when it wins the race", async () => {
    const { model, cancelled } = timed({ high: 60, medium: 2_000 });
    expect((await generateObjectInTime(model, options, fallback())).title).toBe("high");
    expect(cancelled).toEqual(["medium"]);
  });

  it("starts the backup at once when the first try runs out of time early", async () => {
    const { model, requests } = timed({ high: timedOut(), medium: 5 });
    expect((await generateObjectInTime(model, options, fallback({ hedgeAfterMs: 60_000 }))).title).toBe("medium");
    expect(requests.map((request) => request.effort)).toEqual(["high", "medium"]);
  });

  it("starts no backup after any other failure, or when too little time is left", async () => {
    const bad = timed({ high: new AIProviderError("Bad request", 400, false) });
    await expect(generateObjectInTime(bad.model, options, fallback({ hedgeAfterMs: 60_000 }))).rejects.toThrow("Bad request");
    expect(bad.requests).toHaveLength(1);

    const late = timed({ high: timedOut() });
    await expect(generateObjectInTime(late.model, options, fallback({ deadline: Date.now() + 5, minMs: 45_000 }))).rejects.toThrow(/timeout/);
    expect(late.requests).toHaveLength(1);
  });

  it("fails with the first call's error when both fail", async () => {
    const { model } = timed({ high: timedOut(), medium: new AIProviderError("Service down", 503, true) });
    await expect(generateObjectInTime(model, options, fallback({ hedgeAfterMs: 60_000 }))).rejects.toThrow(/timeout/);
  });
});
