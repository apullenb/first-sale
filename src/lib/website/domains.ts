import type { DomainCheck } from "./types";

// Web address ideas and a registration check against the official .com/.net registry (Verisign RDAP, listed in IANA's
// bootstrap file https://data.iana.org/rdap/dns.json). "Not registered" is a snapshot, never a promise it stays free.

const REGISTRY: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain/",
  net: "https://rdap.verisign.com/net/v1/domain/",
};
export const CHECKABLE_ENDINGS = Object.keys(REGISTRY);

// Letters, digits and inner hyphens, 1–63 characters, then .com or .net. Hyphens in places 3 and 4 are reserved.
const DOMAIN = /^(?=.{1,63}\.)(?!..--)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(com|net)$/;

export function normalizeDomain(input: string): string | null {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return DOMAIN.test(domain) ? domain : null;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

// A few short, plain ideas from the business name and town
export function domainIdeas(name: string | null, city: string): string[] {
  const base = slug(name ?? "");
  if (!base) return [];
  const town = slug(city);
  const ideas = [`${base}.com`, `shop${base}.com`, `${base}shop.com`, `get${base}.com`];
  if (town && base.length + town.length <= 40) ideas.splice(1, 0, `${base}${town}.com`);
  ideas.push(`${base}.net`);
  return [...new Set(ideas)].filter((idea) => normalizeDomain(idea) !== null).slice(0, 6);
}

export async function checkDomain(domain: string, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<DomainCheck> {
  const ending = domain.split(".").at(-1) ?? "";
  const base = REGISTRY[ending];
  const unknown = { domain, status: "unknown" as const, checkedAt: now.toISOString() };
  if (!base || normalizeDomain(domain) !== domain) return unknown;
  try {
    const response = await fetchImpl(`${base}${domain}`, {
      headers: { Accept: "application/rdap+json" },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    await response.body?.cancel();
    if (response.status === 200) return { ...unknown, status: "taken" };
    if (response.status === 404) return { ...unknown, status: "available" };
    return unknown;
  } catch {
    return unknown;
  }
}
