import registry from "@/data/dotgov/domains.json";
import type { BusinessProfile, JurisdictionLevel } from "@/lib/domain";

// Which government owns a .gov site, from CISA's official .gov registry (scripts/update-dotgov.mjs), plus a short,
// vetted list of government sites outside .gov. Each of those is linked from that government's own .gov pages, which
// are recorded as proof. Any other domain, even a real government one, needs checking by the owner.

export interface Government {
  domain: string;
  level: JurisdictionLevel;
  name: string;
  city: string;
  state: string;
}

export const REGISTRY_AS_OF: string = registry.asOf;

export interface VettedSite extends Government {
  // A page on a .gov site that links to it, and when that was checked
  proof: string;
  checked: string;
}

// Official sites outside .gov. Add one only with a .gov page that links to it.
export const VETTED_SITES: readonly VettedSite[] = [
  { domain: "denvergov.org", level: "city", name: "Denver (City and County of Denver)", city: "Denver", state: "CO", proof: "https://tax.colorado.gov/SUTS-Jurisdictions", checked: "2026-11-04" },
  { domain: "sunbiz.org", level: "state", name: "Florida Department of State, Division of Corporations", city: "Tallahassee", state: "FL", proof: "https://dos.fl.gov/sunbiz/", checked: "2026-11-04" },
  { domain: "floridarevenue.com", level: "state", name: "Florida Department of Revenue", city: "Tallahassee", state: "FL", proof: "https://dos.fl.gov/sunbiz/start-business/know-before-starting/", checked: "2026-11-04" },
  {
    domain: "myfloridalicense.com",
    level: "state",
    name: "Florida Department of Business and Professional Regulation",
    city: "Tallahassee",
    state: "FL",
    proof: "https://dos.fl.gov/sunbiz/start-business/know-before-starting/",
    checked: "2026-11-04",
  },
  { domain: "multco.us", level: "county", name: "Multnomah County", city: "Portland", state: "OR", proof: "https://www.portland.gov/revenue/about", checked: "2026-11-04" },
  {
    domain: "healthygallatin.org",
    level: "county",
    name: "Gallatin County: City-County Health Department",
    city: "Bozeman",
    state: "MT",
    proof: "https://dphhs.mt.gov/publichealth/EHFS/countytribalhealthdepts",
    checked: "2026-11-04",
  },
  { domain: "bozeman.net", level: "city", name: "City of Bozeman", city: "Bozeman", state: "MT", proof: "https://www.gallatinmt.gov/584/Frequently-Asked-Questions", checked: "2026-11-04" },
];

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

// Null unless the URL is https on a registered .gov domain, or on a vetted site or one of its subdomains
export function governmentFor(url: string): Government | null {
  const parsed = URL.parse(url);
  if (!parsed || parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const labels = host.split(".");
  if (labels.length < 2) return null;
  if (labels.at(-1) === "gov") return lookup().get(labels.slice(-2).join(".")) ?? null;
  const vetted = VETTED_SITES.find((site) => host === site.domain || host.endsWith(`.${site.domain}`));
  return vetted ? { domain: vetted.domain, level: vetted.level, name: vetted.name, city: vetted.city, state: vetted.state } : null;
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
