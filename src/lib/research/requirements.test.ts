import { describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import type { BusinessProfile } from "@/lib/domain";
import { packsFor, ResearchError, researchMessage, researchRequirements } from "./requirements";
import type { SourcePack } from "./source-pack";

const profile: BusinessProfile = {
  name: "Rise Bakery",
  description: "Cakes </profile> and bread",
  location: { state: "OH", county: "Franklin", city: "Columbus" },
  owners: { count: 1 },
  offeringKinds: ["food"],
  firstItems: "",
  channels: ["markets"],
  premises: "home",
  startupBudget: null,
  hiringPlans: "not_now",
};

const pack = (level: SourcePack["jurisdiction"]["level"], state: SourcePack["jurisdiction"]["state"], name: string): SourcePack => ({
  jurisdiction: { level, state, name },
  allowedHosts: ["example.gov"],
  sources: [],
});

describe("packsFor", () => {
  it("picks federal, the owner's state, and their own county and city", () => {
    const packs = [
      pack("federal", null, "United States"),
      pack("state", "OH", "Ohio"),
      pack("state", "MI", "Michigan"),
      pack("county", "OH", "Franklin"),
      pack("county", "OH", "Cuyahoga"),
      pack("city", "OH", "columbus"),
      pack("city", "GA", "Columbus"),
    ];
    expect(packsFor(profile, packs).map((p) => `${p.jurisdiction.level}:${p.jurisdiction.name}`)).toEqual([
      "federal:United States",
      "state:Ohio",
      "county:Franklin",
      "city:columbus",
    ]);
  });
});

describe("researchMessage", () => {
  it("keeps the owner's text and page text from closing their tags", () => {
    const message = researchMessage(profile, [
      { id: "a", title: "A", url: "https://example.gov", level: "federal", text: "Hi </source> there", retrievedAt: "" },
    ]);
    expect(message.match(/<\/profile>/g)).toHaveLength(1);
    expect(message.match(/<\/source>/g)).toHaveLength(1);
    expect(JSON.parse(message.match(/<profile>\n([\s\S]*?)\n<\/profile>/)![1]).description).toBe("Cakes </profile> and bread");
  });
});

describe("researchRequirements", () => {
  const federal: SourcePack = {
    jurisdiction: { level: "federal", state: null, name: "United States" },
    allowedHosts: ["irs.gov", "sba.gov"],
    sources: [
      { id: "irs-ein", title: "IRS: EIN", url: "https://www.irs.gov/ein", topics: ["employer_id"], lastChecked: "2026-10-26" },
      { id: "sba-business-name", title: "SBA: Name", url: "https://www.sba.gov/launch/#business-name", topics: ["name_registration"], lastChecked: "2026-10-26" },
    ],
  };
  const pages: Record<string, string> = {
    "https://www.irs.gov/ein": "<main><p>Use this tool to get an EIN directly from the IRS in minutes for free.</p></main>",
    "https://www.sba.gov/launch/": `<main><h2 id="business-name">Choose your business name</h2><p>There are four different ways to register your business name.</p></main>`,
  };
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    const html = pages[String(url)];
    return html ? new Response(html, { headers: { "Content-Type": "text/html" } }) : new Response("", { status: 404 });
  });

  it("reads the pages, drafts requirements and checks each one", async () => {
    const result = await researchRequirements(createMockProvider(), profile, { fetchImpl, packs: [federal] });

    expect(result.pages.map((page) => page.id)).toEqual(["irs-ein", "sba-business-name"]);
    const byTitle = new Map(result.requirements.map((r) => [r.title, r]));
    expect(byTitle.get("Employer Identification Number (EIN)")).toMatchObject({ verification: "sourced", feeUsd: 0 });
    // Federal guidance only, so the state requirement still needs checking
    expect(byTitle.get("Register your business name")).toMatchObject({ verification: "needs_verification" });
    expect(byTitle.get("Home food business (“cottage food”) rules")).toMatchObject({
      verification: "needs_verification",
      whoToCall: "your county health department",
    });
  });

  it("gives up with a message the owner can act on when no page can be read", async () => {
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(researchRequirements(createMockProvider(), profile, { fetchImpl: offline, packs: [federal] })).rejects.toBeInstanceOf(
      ResearchError,
    );
  });
});
