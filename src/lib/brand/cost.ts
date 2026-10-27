// Meta charges per returned image (dev.meta.ai/docs/pricing-rate-limits, checked 2026-10-27)
export const PRICE_PER_IMAGE = 0.01;
export const dollars = (images: number) => `$${(images * PRICE_PER_IMAGE).toFixed(2)}`;

// Ideas per round: one drawing each
export const IDEAS = { first: 5, more: 3 } as const;
