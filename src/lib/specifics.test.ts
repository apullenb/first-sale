import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { type BrandBrief, NO_LEANINGS } from "@/lib/brand/types";
import { cleanTaglines, suggestTaglines } from "@/lib/brand/tagline";
import { writeStory } from "@/lib/brand/story";
import { PROFILE_FACTS } from "@/data/social-profiles";
import { bioFacts, checkDraftedBio, draftBios } from "@/lib/social/bios";
import { testProfile } from "@/test/fixtures";
import { businessSpecifics, genericWords, itemsPhrase, specificsSummary, withSpecifics } from "./specifics";

const vibes: BrandBrief["vibes"] = ["warm", "cozy"];
const bakery = testProfile({
  name: "Maple Crumb Test Bakery",
  category: "baked_goods",
  premises: "home",
  productTags: ["cookies", "breads"],
  location: { city: "Denton", state: "TX" },
  channels: ["markets", "own_website", "social_media"],
  handoff: ["pickup_home", "local_delivery"],
});
const products = [{ name: "Cookie six-pack" }];

describe("business specifics", () => {
  it("names the kind of business and what it sells, products first", () => {
    const specifics = businessSpecifics(bakery, products);
    expect(specifics).toEqual({ kind: "home bakery", items: ["Cookie six-pack", "cookies", "bread and rolls"] });
    expect(specificsSummary(specifics)).toBe("Home bakery: cookie six-pack, cookies and bread and rolls");
    expect(itemsPhrase(specifics, 2)).toBe("cookie six-pack and cookies");
  });

  it("swaps category words, keeping sentence case", () => {
    const specifics = businessSpecifics(bakery);
    expect(genericWords("Handmade food and fresh food")).toEqual(["handmade food", "fresh food"]);
    expect(withSpecifics("Fresh food in Denton. We sell food you make.", specifics)).toBe("Cookies and bread and rolls in Denton. We sell cookies and bread and rolls.");
    expect(withSpecifics("Fresh food", { kind: null, items: [] })).toBe("Fresh food");
  });
});

describe("specific brand and social drafts", () => {
  const brief = {
    name: "Maple Crumb Test Bakery",
    sells: "cookies",
    customers: "",
    tagline: "",
    vibes,
    leanings: NO_LEANINGS,
    colors: [],
    likedColors: "",
    avoidColors: "",
    symbolIdea: "",
    avoid: "",
    logoKinds: [],
    logoLikes: "",
    story: "",
    storyByOwner: false,
    storyApproved: false,
  };

  it("says it's a bakery and what it sells in a practice bio", async () => {
    const facts = bioFacts(bakery, null, products);
    const drafted = await draftBios(createMockProvider(), facts, ["instagram"], []);
    expect(drafted.instagram?.bio).toMatch(/^Home bakery in Denton: cookie six-pack, cookies/);
  });

  it("swaps category words in a drafted bio, and says so", () => {
    const facts = bioFacts(bakery, null, products);
    const checked = checkDraftedBio("Handmade food in Denton.", PROFILE_FACTS.instagram!.bio!, facts, []);
    expect(checked.bio).toMatch(/^Cookie six-pack, cookies/);
    expect(checked.notes).toContain("Swapped general words for what you sell.");
  });

  it("names the business and its goods in the practice brand description", async () => {
    const story = await writeStory(createMockProvider(), brief, undefined, businessSpecifics(bakery, products));
    expect(story).toMatch(/is a home bakery selling cookie six-pack, cookies/);
  });

  it("drops taglines with category words, and practice ones name the goods", async () => {
    expect(cleanTaglines(["Fresh food every day", "Warm cookies, warm hearts"], brief.name)).toEqual(["Warm cookies, warm hearts"]);
    const taglines = await suggestTaglines(createMockProvider(), brief, undefined, businessSpecifics(bakery, products));
    expect(taglines[0]).toBe("Cookie six-pack, made with care");
  });
});
