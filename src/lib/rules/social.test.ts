import { describe, expect, it } from "vitest";
import { MARKETING_PLATFORMS, PLATFORM_DATA } from "@/data/marketing-platforms";
import { PROFILE_FACTS, profileSources } from "@/data/social-profiles";
import type { StoredIntake } from "@/lib/marketing/intake";
import {
  bioLimit,
  charCount,
  checkBio,
  checkHandle,
  checkName,
  fitText,
  isSetUp,
  nameWords,
  setUpCount,
  socialAccounts,
  suggestHandles,
  suggestName,
  withPickedAccounts,
} from "./social";

const facts = (id: (typeof MARKETING_PLATFORMS)[number]) => {
  const each = PROFILE_FACTS[id];
  if (!each) throw new Error(`No profile facts for ${id}`);
  return each;
};

const INTAKE: StoredIntake = {
  include: ["tiktok", "instagram", "facebook"],
  have: ["facebook"],
  exclude: ["yelp"],
  social: "new",
  seo: "confident",
  content: "some",
  done: ["none"],
  doneNote: "",
};

describe("platform profile facts", () => {
  it.each(MARKETING_PLATFORMS)("links %s only to that company's own https pages, with a check date", (id) => {
    const each = PROFILE_FACTS[id];
    if (!each) return expect(id).toBe("email_list");
    const hosts: Record<string, string[]> = {
      instagram: ["instagram.com"],
      facebook: ["facebook.com"],
      tiktok: ["tiktok.com"],
      pinterest: ["pinterest.com"],
      youtube: ["google.com"],
      linkedin: ["linkedin.com"],
      google_business: ["google.com"],
      nextdoor: ["nextdoor.com"],
      yelp: ["yelp.com"],
    };
    for (const source of profileSources(each)) {
      const host = new URL(source.url).hostname;
      expect(source.url.startsWith("https://")).toBe(true);
      expect(hosts[id].some((vendor) => host === vendor || host.endsWith(`.${vendor}`))).toBe(true);
      expect(source.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("keeps every draft within the platform's limit", () => {
    for (const id of MARKETING_PLATFORMS) {
      const bio = PROFILE_FACTS[id]?.bio;
      if (!bio) continue;
      expect(bioLimit(bio)).toBeLessThanOrEqual(bio.max ?? Infinity);
      expect(bioLimit(bio)).toBe(Math.min(bio.target, bio.max ?? bio.target));
    }
  });

  it("matches the limits on each company's pages", () => {
    expect(facts("instagram").bio?.max).toBe(150);
    expect(facts("tiktok").bio?.max).toBe(80);
    expect(facts("tiktok").name.max).toBe(30);
    expect(facts("tiktok").handle).toMatchObject({ min: 2, max: 24 });
    expect(facts("pinterest").bio?.max).toBe(500);
    expect(facts("pinterest").handle).toMatchObject({ min: 3, max: 30 });
    expect(facts("youtube").handle).toMatchObject({ min: 3, max: 30 });
    expect(facts("facebook").handle?.min).toBe(5);
    expect(facts("google_business").bio?.max).toBe(750);
    expect(facts("yelp").bio?.max).toBe(1500);
  });
});

describe("social accounts", () => {
  it("lists every included account, the plan's lead first, with the plan's reasons", () => {
    const plan = {
      platforms: [
        { platform: "instagram" as const, role: "main" as const, why: "Your bread photographs well.", cadence: "Post twice a week." },
        { platform: "tiktok" as const, role: "later" as const, why: "Videos later.", cadence: "" },
      ],
    };
    const accounts = socialAccounts(INTAKE, plan);
    expect(accounts.map((account) => account.id)).toEqual(["instagram", "tiktok", "facebook"]);
    expect(accounts[0]).toMatchObject({ role: "main", why: "Your bread photographs well.", cadence: "Post twice a week.", have: false });
    expect(accounts[2]).toMatchObject({ role: null, have: true });
    expect(accounts[2].why).toContain(PLATFORM_DATA.facebook.goodFor);
  });

  it("gives each account the help its area's answer calls for", () => {
    const accounts = socialAccounts({ ...INTAKE, include: ["instagram", "google_business"] }, null);
    expect(accounts.find((account) => account.id === "instagram")?.help).toBe("walkthrough");
    expect(accounts.find((account) => account.id === "google_business")?.help).toBe("checklist");
    expect(socialAccounts({ ...INTAKE, social: null }, null)[0].help).toBe("walkthrough");
  });

  it("never lists a ruled-out platform", () => {
    expect(socialAccounts({ ...INTAKE, include: ["yelp", "instagram"] }, null).map((account) => account.id)).toEqual(["instagram"]);
  });

  it("counts accounts marked here or already had as set up", () => {
    const accounts = socialAccounts(INTAKE, null);
    const marks = new Set(["social:instagram", "social:pinterest"]);
    expect(isSetUp({ id: "facebook", have: true }, new Set())).toBe(true);
    expect(setUpCount(accounts, marks)).toBe(2);
  });

  it("saves accounts picked here with the marketing answers, keeping them consistent", () => {
    expect(withPickedAccounts(null, ["instagram", "instagram", "tiktok"], "some")).toEqual({
      include: ["instagram", "tiktok"],
      have: [],
      exclude: [],
      social: "some",
      seo: null,
      content: null,
      done: [],
      doneNote: "",
    });
    const picked = withPickedAccounts(INTAKE, ["yelp", "instagram"], null);
    expect(picked).toMatchObject({ include: ["yelp", "instagram"], have: [], exclude: [], social: "new", seo: "confident" });
  });
});

describe("names and handles", () => {
  it("turns a business name into plain words", () => {
    expect(nameWords("Rosa’s Café & Bakery, LLC")).toEqual(["rosas", "cafe", "and", "bakery"]);
  });

  it("suggests handles within each platform's rules", () => {
    for (const id of MARKETING_PLATFORMS) {
      const rule = PROFILE_FACTS[id]?.handle;
      if (!rule) continue;
      const handles = suggestHandles("Rosa’s Café & Bakery, LLC", "Austin", rule);
      expect(handles.length).toBeGreaterThan(0);
      for (const handle of handles) expect(checkHandle(handle, rule)).toEqual([]);
    }
    expect(suggestHandles("Rosa’s Bakery", "Austin", facts("instagram").handle!)).toEqual(["rosasbakery", "rosasbakeryaustin", "rosas.bakery"]);
    expect(suggestHandles(null, "Austin", facts("instagram").handle!)).toEqual([]);
  });

  it("cuts long names at a word and pads short ones to the minimum", () => {
    const tiktok = facts("tiktok").handle!;
    for (const handle of suggestHandles("The Wonderful Sourdough Company of Central Texas", "Austin", tiktok)) expect(handle.length).toBeLessThanOrEqual(24);
    expect(suggestHandles("Joe", "Austin", facts("facebook").handle!)[0]).toBe("joeaustin");
  });

  it("explains what's wrong with a handle", () => {
    const youtube = facts("youtube").handle!;
    expect(checkHandle("", youtube)).toEqual(["Add a handle."]);
    expect(checkHandle("rosa bakery!", youtube)[0]).toContain("spaces");
    expect(checkHandle("_rosa", youtube)).toContain("Don’t start or end it with a symbol.");
    expect(checkHandle("ro", youtube)).toContain("Use at least 3 characters.");
    expect(checkHandle("rosabakery.com", youtube)).toContain("Don’t end it like a web address.");
    expect(checkHandle("rosa.", facts("tiktok").handle!)).toContain("Don’t end it with “.”.");
    expect(checkHandle("12345", facts("pinterest").handle!)).toContain("Use at least one letter.");
    expect(checkHandle("a".repeat(25), facts("tiktok").handle!)[0]).toContain("24 characters or fewer");
  });

  it("fits the suggested name to the platform", () => {
    expect(suggestName("Rosa’s Bakery", facts("instagram"))).toBe("Rosa’s Bakery");
    const long = suggestName("The Wonderful Sourdough Company of Central Texas", facts("tiktok"));
    expect(charCount(long)).toBeLessThanOrEqual(30);
    expect(long).toBe("The Wonderful Sourdough");
    expect(checkName(" ", facts("tiktok"))).toEqual(["Add a name."]);
    expect(checkName("x".repeat(31), facts("tiktok"))[0]).toContain("30 characters or fewer");
  });
});

describe("bios", () => {
  it("blocks bios over the platform's limit, and links or contact details where the platform refuses them", () => {
    expect(checkBio("x".repeat(150), facts("instagram").bio!, "Instagram")).toEqual([]);
    expect(checkBio("x".repeat(151), facts("instagram").bio!, "Instagram")[0]).toContain("150");
    expect(checkBio("Fresh bread. See rosasbakery.com", facts("google_business").bio!, "Google Business Profile")).toContain("Google Business Profile doesn’t allow links here.");
    expect(checkBio("Call 512-555-0100", facts("yelp").bio!, "Yelp")[0]).toContain("contact details");
    expect(checkBio("Call 512-555-0100", facts("instagram").bio!, "Instagram")).toEqual([]);
    expect(checkBio("", facts("instagram").bio!, "Instagram")).toEqual(["Write a bio first."]);
  });

  it("counts emoji as people see them", () => {
    expect(charCount("Bread 🍞")).toBe(7);
  });

  it("shortens to whole sentences, or whole words", () => {
    expect(fitText("Fresh sourdough. Baked in Austin. Order by message.", 35)).toBe("Fresh sourdough. Baked in Austin.");
    expect(fitText("Sourdough loaves baked fresh every single morning", 20)).toBe("Sourdough loaves");
    expect(fitText("Short.", 20)).toBe("Short.");
  });
});
