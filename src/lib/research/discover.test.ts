import { describe, expect, it, vi } from "vitest";
import { AIProviderError, type ModelProvider, type WebSearchHit, type WebSearchRequest } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { testProfile } from "@/test/fixtures";
import { discoverOfficialPages, searchTopics } from "./discover";

const columbus = testProfile({
  offeringKinds: ["food"],
  channels: ["markets"],
  premises: "home",
  hiringPlans: "first_year",
  location: { state: "OH", county: "Franklin County", city: "Columbus" },
});

const hit = (url: string, title = ""): WebSearchHit => ({ title, url, snippet: "", cited: true });

// A model whose search answers by topic id; unknown topics find nothing
function searchingModel(byTopic: Record<string, WebSearchHit[] | Error>, profile = columbus) {
  const idFor = new Map(searchTopics(profile).map((topic) => [topic.question, topic.id]));
  const webSearch = vi.fn(async (request: WebSearchRequest) => {
    const answer = byTopic[idFor.get(request.question) ?? ""] ?? [];
    if (answer instanceof Error) throw answer;
    return { hits: answer, answer: "" };
  });
  const model: ModelProvider = {
    ...createMockProvider(),
    simulated: false,
    capabilities: { ...createMockProvider().capabilities, webSearch: true },
    webSearch,
  };
  return { model, webSearch };
}

describe("searchTopics", () => {
  const ids = (profile = columbus) => searchTopics(profile).map((topic) => topic.id);

  it("asks about every level for a food business with a home kitchen, a county, a city and hiring plans", () => {
    expect(ids()).toEqual([
      "state-name",
      "state-formation",
      "state-sales-tax",
      "state-food",
      "state-employer",
      "county-license",
      "county-food",
      "city-license",
      "city-home",
    ]);
    expect(searchTopics(columbus).map((topic) => topic.level)).toEqual([
      "state",
      "state",
      "state",
      "state",
      "state",
      "county",
      "county",
      "city",
      "city",
    ]);
  });

  it("names the owner's state, county and city, without doubling the word County", () => {
    const topics = new Map(searchTopics(columbus).map((topic) => [topic.id, topic]));
    expect(topics.get("state-name")?.about).toBe("registering a business name in Ohio");
    expect(topics.get("state-name")?.question).toMatch(/official Ohio state government web page/);
    expect(topics.get("county-license")?.about).toBe("business licenses in Franklin County");
    expect(topics.get("county-license")?.question).toContain("Franklin County, Ohio");
    expect(topics.get("city-home")?.question).toContain("city of Columbus, Ohio");
  });

  it("skips sales tax for services only, and food topics when there's no food", () => {
    const services = testProfile({ offeringKinds: ["services"], location: { county: "Franklin" } });
    expect(ids(services)).toEqual(["state-name", "state-formation", "county-license"]);
    const crafts = testProfile({ offeringKinds: ["handmade", "services"] });
    expect(ids(crafts)).toEqual(["state-name", "state-formation", "state-sales-tax"]);
  });

  it("asks about employers only for owners hiring this year", () => {
    expect(ids(testProfile({ hiringPlans: "right_away" }))).toContain("state-employer");
    expect(ids(testProfile({ hiringPlans: "not_now" }))).not.toContain("state-employer");
    expect(ids(testProfile({ hiringPlans: null }))).not.toContain("state-employer");
  });

  it("asks about county and city rules only when the owner gave them", () => {
    const stateOnly = ids(testProfile({ location: { county: " ", city: "" } }));
    expect(stateOnly.some((id) => id.startsWith("county") || id.startsWith("city"))).toBe(false);
  });

  it("asks about zoning for a storefront or rented space, and home rules only for a home business", () => {
    const storefront = ids(testProfile({ channels: ["storefront"], premises: null, location: { city: "Columbus" } }));
    expect(storefront).toContain("city-space");
    expect(storefront).not.toContain("city-home");
    const rented = ids(testProfile({ premises: "rented_space", location: { city: "Columbus" } }));
    expect(rented).toContain("city-space");
  });
});

describe("discoverOfficialPages", () => {
  it("keeps only registry .gov pages at the topic's level, for the owner's own place", async () => {
    const { model, webSearch } = searchingModel({
      "state-name": [
        hit("https://www.legalzoom.com/dba-ohio", "Not official"),
        hit("https://www.michigan.gov/lara/dba", "Another state"),
        hit("https://www.columbus.gov/business", "Wrong level"),
        hit("https://www.irs.gov/dba", "Federal, wrong level"),
        hit("http://www.ohiosos.gov/insecure", "Not https"),
        hit("https://www.ohiosos.gov/businesses/trade-names#dba", "Ohio SOS: trade names"),
      ],
      "county-license": [
        hit("https://www.delawarecountyohio.gov/licenses", "Another county"),
        hit("https://www.franklincountyohio.gov/licenses", ""),
      ],
      "city-license": [hit("https://www.columbusga.gov/license", "Columbus, Georgia"), hit("https://www.columbus.gov/license", "License")],
    });

    const discovery = await discoverOfficialPages(model, columbus, { timeoutMs: 1000, userKey: "u-1" });

    expect(discovery.sources).toEqual([
      {
        id: "state-name-1",
        title: "Ohio SOS: trade names",
        url: "https://www.ohiosos.gov/businesses/trade-names",
        level: "state",
        allowedHosts: ["ohiosos.gov"],
        government: "State of Ohio",
        discovered: true,
      },
      {
        id: "county-license-1",
        title: "Franklin County Data Center",
        url: "https://www.franklincountyohio.gov/licenses",
        level: "county",
        allowedHosts: ["franklincountyohio.gov"],
        government: "Franklin County Data Center",
        discovered: true,
      },
      {
        id: "city-license-1",
        title: "License",
        url: "https://www.columbus.gov/license",
        level: "city",
        allowedHosts: ["columbus.gov"],
        government: "City of Columbus",
        discovered: true,
      },
    ]);
    expect(webSearch).toHaveBeenCalledTimes(searchTopics(columbus).length);
    expect(webSearch.mock.calls[0][0]).toMatchObject({ location: { region: "Ohio", city: "Columbus" }, timeoutMs: 1000, userKey: "u-1" });
  });

  it("keeps at most two pages a topic, and each page once across topics", async () => {
    const { model } = searchingModel({
      "state-name": [
        hit("https://www.ohiosos.gov/a"),
        hit("https://business.ohio.gov/b#part"),
        hit("https://www.ohiosos.gov/c"),
      ],
      "state-formation": [hit("https://www.ohiosos.gov/a#llc")],
    });

    const { sources, gaps } = await discoverOfficialPages(model, columbus);

    expect(sources.map(({ id, url, allowedHosts }) => ({ id, url, allowedHosts }))).toEqual([
      { id: "state-name-1", url: "https://www.ohiosos.gov/a", allowedHosts: ["ohiosos.gov"] },
      { id: "state-name-2", url: "https://business.ohio.gov/b", allowedHosts: ["ohio.gov"] },
    ]);
    // Already found for another topic, so not a gap
    expect(gaps.map((gap) => gap.about)).not.toContain("forming an LLC or other business entity in Ohio");
  });

  it("turns a topic with nothing kept into a gap", async () => {
    const { model } = searchingModel({ "state-name": [hit("https://www.ohiosos.gov/a")] });
    const { gaps } = await discoverOfficialPages(model, columbus);
    expect(gaps).toHaveLength(searchTopics(columbus).length - 1);
    expect(gaps[0]).toEqual({ level: "state", about: "forming an LLC or other business entity in Ohio", failed: false });
    expect(gaps.at(-1)).toEqual({ level: "city", about: "running a business from home in Columbus", failed: false });
  });

  it("marks a topic whose search failed", async () => {
    const { model } = searchingModel({
      "state-name": new AIProviderError("Search returned 503", 503, true),
      "state-formation": [hit("https://www.ohiosos.gov/llc")],
    });
    const { sources, gaps } = await discoverOfficialPages(model, columbus);
    expect(sources.map((source) => source.id)).toEqual(["state-formation-1"]);
    expect(gaps[0]).toEqual({ level: "state", about: "registering a business name in Ohio", failed: true });
    expect(gaps.slice(1).every((gap) => !gap.failed)).toBe(true);
  });

  it("lets other errors through", async () => {
    const { model } = searchingModel({ "state-name": new TypeError("bug") });
    await expect(discoverOfficialPages(model, columbus)).rejects.toThrow("bug");
  });

  it("makes every topic a gap, not a failure, for a model that can't search", async () => {
    const { sources, gaps } = await discoverOfficialPages(createMockProvider(), columbus);
    expect(sources).toEqual([]);
    expect(gaps).toEqual(searchTopics(columbus).map(({ level, about }) => ({ level, about, failed: false })));
  });

  it("searches without a city when the owner has none", async () => {
    const stateOnly = testProfile({ location: { county: "", city: "" } });
    const { model, webSearch } = searchingModel({}, stateOnly);
    await discoverOfficialPages(model, stateOnly);
    expect(webSearch.mock.calls[0][0].location).toEqual({ region: "Ohio", city: undefined });
  });
});
