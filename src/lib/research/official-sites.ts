import registry from "@/data/dotgov/domains.json";
import type { BusinessProfile, JurisdictionLevel } from "@/lib/domain";

// Which government owns a .gov site, from CISA's official .gov registry (scripts/update-dotgov.mjs).
// Only registry sites count as official; other domains, even real government ones, need checking by the owner.

export interface Government {
  domain: string;
  level: JurisdictionLevel;
  name: string;
  city: string;
  state: string;
}

export const REGISTRY_AS_OF: string = registry.asOf;

let byDomain: Map<string, Government> | null = null;

function lookup(): Map<string, Government> {
  byDomain ??= new Map(
    (registry.domains as [string, JurisdictionLevel, string, string, string][]).map(([domain, level, name, city, state]) => [
      domain,
      { domain, level, name, city, state },
    ]),
  );
  return byDomain;
}

// Null unless the URL is https on a registered .gov domain
export function governmentFor(url: string): Government | null {
  const parsed = URL.parse(url);
  if (!parsed || parsed.protocol !== "https:") return null;
  const labels = parsed.hostname.toLowerCase().split(".");
  if (labels.length < 2 || labels.at(-1) !== "gov") return null;
  return lookup().get(labels.slice(-2).join(".")) ?? null;
}

// Whether a government is the federal government, or the owner's own state, county or city
export function governsPlace(government: Government, location: BusinessProfile["location"]): boolean {
  if (government.level === "federal") return true;
  if (government.state !== location.state) return false;
  if (government.level === "state") return true;

  const name = normalize(government.name);
  if (government.level === "county") {
    const county = normalize(location.county).replace(/\s+(county|parish|borough)$/, "");
    return county !== "" && new RegExp(`\\b${escape(county)}\\s+(county|parish|borough)\\b`).test(name);
  }
  // By the government's own name: the registry's city column is only its mailing address,
  // and a township or village with the same name is a different government
  const city = normalize(location.city);
  if (!city || /\btownship\b/.test(name)) return false;
  const place = escape(city);
  return new RegExp(`\\b(city|town|village|borough) of ${place}\\b|^${place}( city| town| village)?\\b`).test(name);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\bst\b/g, "saint")
    .replace(/\s+/g, " ")
    .trim();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
