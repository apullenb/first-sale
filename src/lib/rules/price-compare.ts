// Prices found by search: kept only when the source page's text contains them, and summed up in code

export interface FoundPrice {
  item: string;
  seller: string;
  // Exactly as the source shows it, such as "$24.00" or "$40/hour"
  price: string;
  // Read from that text in code: the first dollar amount
  cents: number;
  url: string;
  sourceTitle: string;
}

export interface PriceCheck {
  prices: FoundPrice[];
  // Where it searched, in words, such as "Denver, Colorado and online"
  area: string;
  searchedAt: string;
  // Practice sample, not a real search
  simulated: boolean;
}

export const MIN_TO_COMPARE = 3;
const MAX_CENTS = 10_000_000;

// "$1,200.50" -> 120050; every dollar amount in the text, in order
export function dollarAmounts(text: string): number[] {
  const out: number[] = [];
  for (const match of text.matchAll(/\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?!\d)/g)) {
    const whole = Number(match[1].replace(/,/g, ""));
    const cents = whole * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
    if (cents > 0 && cents <= MAX_CENTS) out.push(cents);
  }
  return out;
}

// Every dollar amount the price states must appear as a dollar amount in the source's own text
export function sourceContainsPrice(price: string, sourceText: string): boolean {
  const wanted = dollarAmounts(price);
  if (!wanted.length) return false;
  const found = new Set(dollarAmounts(sourceText));
  return wanted.every((cents) => found.has(cents));
}

export interface PriceStats {
  count: number;
  lowCents: number;
  // The median
  typicalCents: number;
  highCents: number;
  // Fewer than three prices are too few to compare
  enough: boolean;
}

export function priceStats(cents: readonly number[]): PriceStats | null {
  const sorted = cents.filter((each) => Number.isInteger(each) && each > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  const typicalCents = sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  return { count: sorted.length, lowCents: sorted[0], typicalCents, highCents: sorted.at(-1)!, enough: sorted.length >= MIN_TO_COMPARE };
}

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|search\.brave)\.[a-z.]+$/i;
const SEARCH_PATH = /(^|\/)(search|s|find|results?|query)(\/|$)/i;
const SEARCH_QUERY = /^(q|query|search|keywords?|k|s|term)$/i;

// A seller's own item page: https, not a home page, not a search or results page
export function isItemPage(url: string): boolean {
  const parsed = URL.parse(url);
  if (!parsed || parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
  if (SEARCH_HOSTS.test(parsed.hostname)) return false;
  const path = parsed.pathname.replace(/\/+$/, "");
  if (!path || SEARCH_PATH.test(path)) return false;
  return ![...parsed.searchParams.keys()].some((key) => SEARCH_QUERY.test(key));
}

// What a price is for, read from its own words: "per hour", "a visit", "/month"; "" for a one-off price
const UNITS: [string, RegExp][] = [
  ["hour", /(?:per|an?|\/|each)\s*(?:hour|hr)s?\b|\/\s*h\b|hourly/i],
  ["visit", /(?:per|a|\/|each)\s*(?:visit|groom|cleaning|clean|appointment|service|job|mow|walk|trip)s?\b/i],
  ["session", /(?:per|a|\/|each)\s*(?:session|lesson|class)(?:es|s)?\b/i],
  ["day", /(?:per|a|\/|each)\s*day\b|daily/i],
  ["week", /(?:per|a|\/|each)\s*(?:week|wk)\b|weekly/i],
  ["month", /(?:per|a|\/|each)\s*(?:month|mo)\b|monthly/i],
];

export function priceUnit(text: string): string {
  return UNITS.find(([, pattern]) => pattern.test(text))?.[0] ?? "";
}

export const UNIT_WORDS: Record<string, string> = { hour: "per hour", visit: "per visit", session: "per session", day: "per day", week: "per week", month: "per month", "": "" };

// Low, typical and high only across prices for the same unit: the owner's own unit when found, else the most common
export function comparableStats(prices: readonly Pick<FoundPrice, "price" | "cents">[], ownPrice = ""): { unit: string; stats: PriceStats } | null {
  if (!prices.length) return null;
  const units = prices.map((price) => priceUnit(price.price));
  const counts = new Map<string, number>();
  for (const unit of units) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  const own = ownPrice ? priceUnit(ownPrice) : null;
  const unit = own !== null && counts.has(own) ? own : [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const stats = priceStats(prices.filter((_, index) => units[index] === unit).map((price) => price.cents));
  return stats ? { unit, stats } : null;
}
