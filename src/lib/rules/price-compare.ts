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
