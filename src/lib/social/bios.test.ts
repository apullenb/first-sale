import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { PROFILE_FACTS } from "@/data/social-profiles";
import { bioLimit, charCount } from "@/lib/rules/social";
import { testProfile } from "@/test/fixtures";
import { bioFacts, type BioFacts, biosMessage, checkBios, checkDraftedBio, draftBios, plainBio } from "./bios";
import { readSocialProfiles } from "./types";

const FACTS: BioFacts = {
  name: "Rosa’s Bakery",
  kind: "bakery",
  sells: "sourdough, cinnamon rolls",
  place: "Austin, Texas",
  howTheySell: ["Markets and events"],
  howCustomersGetIt: ["I deliver nearby"],
  tagline: "",
  feel: ["warm", "handmade"],
  customers: "neighbors and busy parents",
};

const instagram = PROFILE_FACTS.instagram!.bio!;
const google = PROFILE_FACTS.google_business!.bio!;

describe("bio facts", () => {
  it("uses only public details, and leaves home pickup out", () => {
    const facts = bioFacts(
      testProfile({ name: "Rosa’s Bakery", firstItems: "sourdough", location: { city: "Austin", state: "TX" }, handoff: ["pickup_home", "local_delivery"] }),
      { tagline: "Bread worth the wait", vibes: ["warm"], customers: "neighbors" },
    );
    expect(facts).toMatchObject({ name: "Rosa’s Bakery", sells: "sourdough", place: "Austin, Texas", tagline: "Bread worth the wait", howCustomersGetIt: ["I deliver nearby"] });
    expect(JSON.stringify(facts)).not.toMatch(/home/i);
  });

  it("puts the platform limits shared by every owner first", () => {
    const message = biosMessage(FACTS, ["instagram"]);
    expect(message.indexOf("<platforms>")).toBe(0);
    expect(message.indexOf("<business>")).toBeLessThan(message.indexOf("<want>"));
  });
});

describe("checking a drafted bio", () => {
  it("takes out links, contact details, prices and claims the owner didn't make", () => {
    const { bio, notes } = checkDraftedBio(
      "Fresh sourdough in Austin. Visit rosasbakery.com today! Call 512-555-0100. Loaves from $8. Voted the best bakery in Texas. Find us at the market.",
      google,
      FACTS,
      [],
    );
    expect(bio).toBe("Fresh sourdough in Austin. Find us at the market.");
    expect(notes).toHaveLength(3);
  });

  it("keeps a claim the owner's own facts make", () => {
    expect(checkDraftedBio("Organic sourdough in Austin.", google, { ...FACTS, sells: "organic sourdough" }, []).bio).toBe("Organic sourdough in Austin.");
    expect(checkDraftedBio("Organic sourdough in Austin.", google, FACTS, []).bio).toBe("");
  });

  it("never names a platform the owner ruled out", () => {
    expect(checkDraftedBio("Fresh bread. Watch us bake on TikTok.", instagram, FACTS, ["tiktok"]).bio).toBe("Fresh bread.");
  });

  it("fits the platform's limit, and says so", () => {
    const long = "Fresh sourdough and cinnamon rolls, baked every morning in Austin. Find us at the Saturday market, or send us a message to order a fresh loaf for delivery nearby this week.";
    const { bio, notes } = checkDraftedBio(long, instagram, FACTS, []);
    expect(charCount(bio)).toBeLessThanOrEqual(150);
    expect(notes).toContain("Shortened to fit 150 characters.");
  });

  it("gives a plain bio when a draft is missing or nothing usable is left", () => {
    const drafted = checkBios({ bios: [{ platform: "instagram", bio: "Visit rosasbakery.com" }] }, FACTS, ["instagram", "facebook", "email_list"], [], false);
    expect(drafted.instagram).toMatchObject({ by: "rule", bio: plainBio(FACTS, instagram) });
    expect(drafted.facebook?.by).toBe("rule");
    expect(drafted.email_list).toBeUndefined();
  });

  it("labels drafts from practice mode", () => {
    const drafted = checkBios({ bios: [{ platform: "instagram", bio: "Fresh sourdough in Austin." }] }, FACTS, ["instagram"], [], true);
    expect(drafted.instagram).toEqual({ bio: "Fresh sourdough in Austin.", by: "practice", notes: [] });
  });
});

describe("drafting bios", () => {
  it("drafts within every limit in practice mode", async () => {
    const want = ["instagram", "tiktok", "google_business", "yelp"] as const;
    const drafted = await draftBios(createMockProvider(), FACTS, want, []);
    for (const id of want) {
      expect(drafted[id]?.by).toBe("practice");
      expect(drafted[id]?.bio).toContain("Bakery in Austin: sourdough, cinnamon rolls.");
      expect(charCount(drafted[id]!.bio)).toBeLessThanOrEqual(bioLimit(PROFILE_FACTS[id]!.bio!));
    }
  });
});

describe("saved profiles", () => {
  it("reads leniently, leaving out anything it can't read", () => {
    const profiles = readSocialProfiles({
      instagram: { name: "Rosa’s Bakery", handle: "rosasbakery", bio: "Bread.", bioBy: "ai", notes: [], approvedAt: null },
      tiktok: { name: "Rosa", bioBy: "robot" },
      myspace: { name: "x" },
      facebook: "oops",
    });
    expect(profiles.instagram?.handle).toBe("rosasbakery");
    expect(profiles.tiktok).toMatchObject({ name: "Rosa", handle: "", bioBy: null, approvedAt: null });
    expect(Object.keys(profiles).sort()).toEqual(["instagram", "tiktok"]);
    expect(readSocialProfiles(null)).toEqual({});
  });
});
