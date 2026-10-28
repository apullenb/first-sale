import { AIProviderError, type ModelProvider, type WebSearchHit, type WebSearchRequest } from "@/lib/ai";
import type { BusinessProfile, JurisdictionLevel } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import type { ResearchCategory } from "./coverage";
import { governmentFor, governsPlace } from "./official-sites";
import type { SourceToRead } from "./retrieve";

// Finds the state, county and city pages a source list can't know about ahead of time.
// Search only suggests addresses: the app reads each page itself, and code decides which government owns it.

export interface SearchTopic {
  id: string;
  level: Exclude<JurisdictionLevel, "federal">;
  category: ResearchCategory;
  // Owner-facing, as in "We couldn't find an official page about …"
  about: string;
  question: string;
}

export interface SearchGap {
  level: SearchTopic["level"];
  category: ResearchCategory;
  about: string;
  // The search itself failed, rather than finding nothing official
  failed: boolean;
}

// Recent results for the same question and place; a cache that can't be reached never stops a search
export interface SearchCache {
  get(request: Pick<WebSearchRequest, "question" | "location">): Promise<WebSearchHit[] | null>;
  put(request: Pick<WebSearchRequest, "question" | "location">, hits: WebSearchHit[]): Promise<void>;
}

export interface Discovery {
  sources: SourceToRead[];
  gaps: SearchGap[];
}

const PAGES_PER_TOPIC = 2;
// All at once: the whole search step has one time limit
const CONCURRENCY = 12;

// One narrow question per topic: search grounding is most reliable on focused questions
export function searchTopics(profile: BusinessProfile): SearchTopic[] {
  const state = STATE_NAMES[profile.location.state];
  const county = profile.location.county.trim().replace(/\s+(county|parish|borough)$/i, "");
  const city = profile.location.city.trim();
  const food = profile.offeringKinds.includes("food");
  const goods = profile.offeringKinds.some((kind) => kind !== "services");
  const hiring = profile.hiringPlans === "first_year" || profile.hiringPlans === "right_away";
  const space = profile.premises === "rented_space" || profile.channels.includes("storefront");
  const official = (government: string, subject: string) =>
    `Find the official ${government} government web page that explains ${subject}. Use only official government websites, and give the page's address.`;

  const topics: SearchTopic[] = [
    {
      id: "state-name",
      level: "state",
      category: "formation",
      about: `registering a business name in ${state}`,
      question: official(`${state} state`, "how to register a business name or assumed name (DBA)"),
    },
    {
      id: "state-formation",
      level: "state",
      category: "formation",
      about: `forming an LLC or other business entity in ${state}`,
      question: official(`${state} state`, "how to form an LLC, including the filing form and fee"),
    },
  ];
  if (goods) {
    topics.push({
      id: "state-sales-tax",
      level: "state",
      category: "tax",
      about: `registering to collect sales tax in ${state}`,
      question: official(`${state} state`, "how a new business registers to collect sales tax"),
    });
  }
  if (food) {
    topics.push({
      id: "state-food",
      level: "state",
      category: "food",
      about: `selling food made at home in ${state}`,
      question: official(`${state} state`, "the rules for selling food made in a home kitchen (cottage food)"),
    });
  }
  if (hiring) {
    topics.push({
      id: "state-employer",
      level: "state",
      category: "tax",
      about: `registering as a new employer in ${state}`,
      question: official(`${state} state`, "how a new employer registers for state payroll taxes and unemployment insurance"),
    });
  }
  if (county) {
    topics.push({
      id: "county-license",
      level: "county",
      category: "licenses",
      about: `business licenses in ${county} County`,
      question: official(`${county} County, ${state}`, "whether a new business needs a county business license or permit"),
    });
    if (food) {
      topics.push({
        id: "county-food",
        level: "county",
        category: "food",
        about: `food permits from the ${county} County health department`,
        question: official(`${county} County, ${state}`, "health department permits for selling food"),
      });
    }
  }
  if (city) {
    topics.push({
      id: "city-license",
      level: "city",
      category: "licenses",
      about: `business licenses in ${city}`,
      question: official(`city of ${city}, ${state}`, "whether a new business needs a city business license"),
    });
    if (profile.premises === "home" || profile.handoff.includes("pickup_home")) {
      topics.push({
        id: "city-home",
        level: "city",
        category: "zoning",
        about: `running a business from home in ${city}`,
        question: official(`city of ${city}, ${state}`, "the rules or permit for running a business from home (home occupation)"),
      });
    }
    if (space) {
      topics.push({
        id: "city-space",
        level: "city",
        category: "zoning",
        about: `zoning and occupancy for a business space in ${city}`,
        question: official(`city of ${city}, ${state}`, "zoning approval or a certificate of occupancy for a business space"),
      });
    }
  }
  return topics;
}

export async function discoverOfficialPages(
  model: ModelProvider,
  profile: BusinessProfile,
  options: { timeoutMs?: number; userKey?: string; cache?: SearchCache } = {},
): Promise<Discovery> {
  const topics = searchTopics(profile);
  if (!model.webSearch) {
    return { sources: [], gaps: topics.map(({ level, category, about }) => ({ level, category, about, failed: false })) };
  }
  const search = model.webSearch;
  const location = { region: STATE_NAMES[profile.location.state], city: profile.location.city.trim() || undefined };

  const outcomes = await inBatches(topics, CONCURRENCY, async (topic) => {
    const request = { question: topic.question, location };
    const cached = await options.cache?.get(request).catch(cacheFailed);
    if (cached) return { topic, hits: cached, failed: false };
    try {
      const result = await search({ ...request, timeoutMs: options.timeoutMs, userKey: options.userKey });
      // Kept only when an official page for this place turned up, so a search that found none runs again next time
      const official = result.hits.some((hit) => {
        const government = governmentFor(hit.url);
        return government?.level === topic.level && governsPlace(government, profile.location);
      });
      if (official) await options.cache?.put(request, result.hits).catch(cacheFailed);
      return { topic, hits: result.hits, failed: false };
    } catch (error) {
      if (!(error instanceof AIProviderError)) throw error;
      console.error("Search failed:", topic.id, error.status ?? "no status");
      return { topic, hits: [], failed: true };
    }
  });

  const seen = new Set<string>();
  const sources: SourceToRead[] = [];
  const gaps: SearchGap[] = [];
  for (const { topic, hits, failed } of outcomes) {
    let kept = 0;
    for (const hit of hits) {
      if (kept >= PAGES_PER_TOPIC) break;
      const government = governmentFor(hit.url);
      // Wrong level or another place's government: not evidence for this owner
      if (!government || government.level !== topic.level || !governsPlace(government, profile.location)) continue;
      const url = hit.url.split("#")[0];
      if (seen.has(url)) {
        kept++;
        continue;
      }
      seen.add(url);
      kept++;
      sources.push({
        id: `${topic.id}-${kept}`,
        title: hit.title || government.name,
        url,
        level: government.level,
        allowedHosts: [government.domain],
        government: government.name,
        discovered: true,
        categories: [topic.category],
      });
    }
    if (kept === 0) gaps.push({ level: topic.level, category: topic.category, about: topic.about, failed });
  }
  return { sources, gaps };
}

function cacheFailed(error: unknown): null {
  console.error("Search cache unavailable:", error instanceof Error ? error.name : "unknown error");
  return null;
}

async function inBatches<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(run))));
  }
  return results;
}
