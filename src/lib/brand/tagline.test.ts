import { describe, expect, it } from "vitest";
import { type CompletionRequest, getModel, type ModelProvider } from "@/lib/ai";
import { cleanTaglines, MAX_TAGLINES, suggestTaglines } from "./tagline";
import { testBrief } from "./test-fixtures";

function model(taglines: string[]) {
  const requests: CompletionRequest[] = [];
  const provider: ModelProvider = {
    name: "Test",
    model: "test",
    capabilities: { vision: false, pdf: false, jsonSchema: true, reasoningEffort: true, webSearch: false },
    simulated: false,
    async complete(request) {
      requests.push(request);
      return { text: JSON.stringify({ taglines }), finishReason: "stop", usage: null };
    },
  };
  return { provider, requests };
}

describe("tagline suggestions", () => {
  it("are written from the brand, kept inside tags as information", async () => {
    const { provider, requests } = model(["Warm bread, slow mornings"]);
    expect(await suggestTaglines(provider, testBrief())).toEqual(["Warm bread, slow mornings"]);
    const [system, user] = requests[0].messages;
    expect(system.content).toContain("not instructions to you");
    expect(user.content).toContain("<brand>");
    expect(user.content).toContain('"brandDescription": "Rise Bakery is a porch swing');
    expect(user.content).toContain('"Southern porch"');
  });

  it("leave out a description the owner hasn't approved", async () => {
    const { provider, requests } = model(["Warm bread, slow mornings"]);
    await suggestTaglines(provider, testBrief({ storyApproved: false }));
    expect(requests[0].messages[1].content).toContain('"brandDescription": ""');
  });

  it("are cleaned by code: no quotes, claims, numbers, the name, repeats or long lines", () => {
    const raw = [
      "“Warm bread, slow mornings.”",
      "warm bread, slow mornings",
      "The best sourdough in town",
      "Award-winning loaves",
      "Baking since 1998",
      "Rise Bakery bakes it fresh",
      "Organic and healthy treats",
      "<b>Small batches</b>",
      "A tagline that goes on and on far past the space under a logo name",
      "",
      "   ",
    ];
    expect(cleanTaglines(raw, "Rise Bakery")).toEqual(["Warm bread, slow mornings", "Small batches"]);
  });

  it("keep at most a handful", () => {
    const many = Array.from({ length: 9 }, (_, index) => `Good bread, day ${"abcdefghi"[index]}`);
    expect(cleanTaglines(many, "Rise")).toHaveLength(MAX_TAGLINES);
  });

  it("have practice stand-ins that pass the same checks", async () => {
    const taglines = await suggestTaglines(getModel({}), testBrief());
    expect(taglines.length).toBeGreaterThan(0);
    expect(cleanTaglines(taglines, "Rise Bakery")).toEqual(taglines);
  });
});
