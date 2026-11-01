// Meta charges per returned image (dev.meta.ai/docs/pricing-rate-limits, checked 2026-10-27)
export const PRICE_PER_IMAGE = 0.01;
export const dollars = (images: number) => `$${(images * PRICE_PER_IMAGE).toFixed(2)}`;

// Ideas per round: one drawing each
// Three first, to keep the first round cheap; more come on request ("More ideas like this", "Generate new logo ideas")
export const IDEAS = { first: 3, more: 3 } as const;
