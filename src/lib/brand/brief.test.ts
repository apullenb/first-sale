import { describe, expect, it } from "vitest";
import { testProfile } from "@/test/fixtures";
import { briefDefaults, ideasProblem, withBrandAnswers, withLogoChoices } from "./brief";
import { conceptMessages } from "./concepts";
import { logoPrompt } from "./prompts";
import { testBrief, testConcept } from "./test-fixtures";
import { readBrief } from "./types";

describe("the brief starts from earlier answers", () => {
  it("fills in the name, what they sell and who buys it from the business profile", () => {
    const brief = briefDefaults(testProfile({ name: "Rise Bakery", firstItems: "Sourdough loaves", channels: ["markets", "social_media"] }), null);
    expect(brief).toMatchObject({ name: "Rise Bakery", sells: "Sourdough loaves", customers: "Shoppers at local markets and people who follow us on social media" });
    expect(brief).toMatchObject({ vibes: [], story: "", storyApproved: false });
  });

  it("falls back to the description, then the kind of business", () => {
    expect(briefDefaults(testProfile({ firstItems: "", description: "A home bakery" }), null).sells).toBe("A home bakery");
    expect(briefDefaults(testProfile({ firstItems: "", description: "", offeringKinds: ["food"] }), null).sells).toBe("Food you make");
  });

  it("keeps a saved brief, filling only what it left empty", () => {
    const saved = testBrief({ name: "", tagline: "Baked at dawn" });
    expect(briefDefaults(testProfile({ name: "Rise Bakery" }), saved)).toMatchObject({ name: "Rise Bakery", tagline: "Baked at dawn", vibes: saved.vibes });
  });

  it("leaves the name empty when the owner hasn't picked one", () => {
    expect(briefDefaults(testProfile({ name: null }), null).name).toBe("");
  });
});

describe("logo ideas wait for the brand picture", () => {
  it("needs a picture the owner said fits", () => {
    expect(ideasProblem(testBrief())).toBeNull();
    expect(ideasProblem(testBrief({ storyApproved: false }))).toContain("This feels like my business");
    expect(ideasProblem(testBrief({ storyApproved: false }))).toContain("Build your brand");
    expect(ideasProblem(testBrief({ story: "  " }))).not.toBeNull();
  });
});

describe("saved briefs", () => {
  it("read with empty values for fields added since", () => {
    const old = { name: "Rise Bakery", tagline: "", sells: "Bread", customers: "", personality: ["warm"], style: "handmade" };
    expect(readBrief(old)).toMatchObject({ name: "Rise Bakery", sells: "Bread", vibes: [], colors: [], logoKinds: [], logoLikes: "", story: "", storyApproved: false, leanings: { era: null } });
    expect(readBrief(null).name).toBe("");
  });
});

describe("each page saves only its own answers", () => {
  const saved = testBrief({ tagline: "Baked at dawn", logoKinds: ["emblem"], symbolIdea: "a wheat stalk", logoLikes: "bold letters" });

  it("keeps the logo choices when the brand page saves", () => {
    const fromBrandPage = testBrief({ sells: "Cookies", vibes: ["cozy", "warm", "rustic"], tagline: "", logoKinds: [], symbolIdea: "", logoLikes: "", name: "Other Name" });
    const next = withBrandAnswers(saved, fromBrandPage);
    expect(next).toMatchObject({ sells: "Cookies", vibes: ["cozy", "warm", "rustic"], tagline: "Baked at dawn", logoKinds: ["emblem"], symbolIdea: "a wheat stalk", logoLikes: "bold letters", name: "Rise Bakery" });
  });

  it("lets the brand page set the name only when none is saved", () => {
    expect(withBrandAnswers(testBrief({ name: "" }), testBrief({ name: "Rise & Shine" })).name).toBe("Rise & Shine");
  });

  it("keeps the brand answers and approved description when the logo page saves", () => {
    const next = withLogoChoices(saved, { name: "Rise Bakery", tagline: "Fresh every morning", logoKinds: ["wordmark"], symbolIdea: "", logoLikes: "" });
    expect(next).toMatchObject({ tagline: "Fresh every morning", logoKinds: ["wordmark"], symbolIdea: "", story: saved.story, storyApproved: true, vibes: saved.vibes, sells: saved.sells });
  });
});

describe("logo ideas use the approved brand description", () => {
  it("send it with the logo choices to the creative director and into every drawing", () => {
    const brief = withLogoChoices(testBrief({ story: "Rise Bakery is a warm kitchen at dawn, flour on the counter.", storyApproved: true }), {
      name: "Rise Bakery",
      tagline: "Fresh every morning",
      logoKinds: ["wordmark"],
      symbolIdea: "",
      logoLikes: "",
    });
    const [, user] = conceptMessages({ brief, basedOn: null });
    expect(user.content).toContain('"brandPicture": "Rise Bakery is a warm kitchen at dawn, flour on the counter."');
    expect(user.content).toContain('"tagline": "Fresh every morning"');
    expect(user.content).toContain('"kindsTheyWant": [\n    "wordmark"\n  ]');
    const prompt = logoPrompt(brief, testConcept({ kind: "wordmark", symbol: null }));
    expect(prompt).toContain("“Rise Bakery is a warm kitchen at dawn, flour on the counter.”");
    expect(prompt).toContain("Tagline, smaller than the name and spelled exactly: “Fresh every morning”");
  });
});
