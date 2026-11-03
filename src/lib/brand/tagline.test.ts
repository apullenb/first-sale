import { describe, expect, it } from "vitest";
import { type CompletionRequest, getModel, type ModelProvider } from "@/lib/ai";
import { cleanTaglines, MAX_TAGLINES, suggestTaglines, TAGLINE_RULES } from "./tagline";
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

  it("fit under a logo: 2 to 6 words and at most 40 characters", () => {
    const fits = "Warm loaves for slow Sunday mornings";
    expect(fits.length).toBeLessThanOrEqual(TAGLINE_RULES.maxChars);
    expect(cleanTaglines(["Welcome", "Come early, stay late, bring friends, share bread", "Slow mornings and warm kitchens for everybody", fits], "Rise Bakery")).toEqual([fits]);
  });

  it("lose emoji, keeping the words", () => {
    expect(cleanTaglines(["Warm welcome 🍞✨", "👋 Come say hello!"], "Rise Bakery")).toEqual(["Warm welcome", "Come say hello"]);
  });

  it("drop diet, origin and craft claims unless the owner's own answers make them", () => {
    const raw = ["Gluten-free and good", "All-natural sweet treats", "Vegan treats daily", "Your local sweet spot", "Handmade with care", "Made by hand daily", "Homemade every morning", "Artisan breads daily"];
    expect(cleanTaglines(raw, "Rise Bakery")).toEqual([]);
    expect(cleanTaglines(raw, "Rise Bakery", "Gluten-free cookies for local markets")).toEqual(["Gluten-free and good", "Your local sweet spot"]);
  });

  it("drop any recognizable word of the business name, not only the whole name", () => {
    const raw = ["Rise early with us", "Shine on, neighbor", "Your bakery next door", "The good stuff, daily", "Good mornings start here"];
    expect(cleanTaglines(raw, "Rise & Shine Bakery")).toEqual(["The good stuff, daily", "Good mornings start here"]);
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
