import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createMockProvider } from "./providers/mock";
import { generateObject, StructuredOutputError, toJsonSchema } from "./structured";
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
