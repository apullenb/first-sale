// Muse prices from Meta's own page, https://dev.meta.ai/docs/pricing-rate-limits, read 2026-10-30 (Standard mode).
// Null means not checked: costs are then left out and only tokens are reported.

export interface Prices {
  model: string;
  checked: string;
  source: string;
  // USD per million tokens; reasoning tokens bill as output
  inputPerMTok: number | null;
  cachedInputPerMTok: number | null;
  outputPerMTok: number | null;
  // USD per web search query, on top of tokens
  searchPerQuery: number | null;
  // USD per returned image; the page prices generated images and names no separate edit price
  imagePerPicture: number | null;
}

const SOURCE = "https://dev.meta.ai/docs/pricing-rate-limits";

// "Cached input $0.15 / Input $1.25 / Output $4.25" per 1M tokens for muse-spark-1.3, 1.2 and 1.1
const SPARK = { inputPerMTok: 1.25, cachedInputPerMTok: 0.15, outputPerMTok: 4.25 } as const;
// "$2.50 per 1,000 search queries"; "$0.01 per image" for muse-image-1.0
const SEARCH_PER_QUERY = 2.5 / 1000;
const IMAGE_PER_PICTURE = 0.01;

const CHECKED: Record<string, Omit<Prices, "model" | "checked" | "source">> = {
  "muse-spark-1.3": { ...SPARK, searchPerQuery: SEARCH_PER_QUERY, imagePerPicture: IMAGE_PER_PICTURE },
  "muse-spark-1.2": { ...SPARK, searchPerQuery: SEARCH_PER_QUERY, imagePerPicture: IMAGE_PER_PICTURE },
  "muse-spark-1.1": { ...SPARK, searchPerQuery: SEARCH_PER_QUERY, imagePerPicture: IMAGE_PER_PICTURE },
};

const UNCHECKED = { inputPerMTok: null, cachedInputPerMTok: null, outputPerMTok: null, searchPerQuery: null, imagePerPicture: null };

// Practice mode is priced as Muse would be, so its estimates show what a live run might cost
export function pricesFor(model: string): Prices {
  return { model, checked: "2026-10-30", source: SOURCE, ...(CHECKED[model] ?? UNCHECKED) };
}

export function hasPrices(prices: Prices): boolean {
  return prices.inputPerMTok !== null && prices.cachedInputPerMTok !== null && prices.outputPerMTok !== null;
}
