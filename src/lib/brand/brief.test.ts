import { describe, expect, it } from "vitest";
import { testProfile } from "@/test/fixtures";
import { briefDefaults, ideasProblem } from "./brief";
import { testBrief } from "./test-fixtures";
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
    expect(ideasProblem(testBrief({ story: "  " }))).not.toBeNull();
  });
});

describe("saved briefs", () => {
  it("read with empty values for fields added since", () => {
    const old = { name: "Rise Bakery", tagline: "", sells: "Bread", customers: "", personality: ["warm"], style: "handmade" };
    expect(readBrief(old)).toMatchObject({ name: "Rise Bakery", sells: "Bread", vibes: [], colors: [], story: "", storyApproved: false, leanings: { era: null } });
    expect(readBrief(null).name).toBe("");
  });
});
