import type { ItemKind } from "./products";

// An item's picture set: the main photo first, then three views made from the approved main. Order and who wears it are rules.

export const PICTURE_VIEWS = ["main", "angle", "detail", "in_use"] as const;
export type PictureView = (typeof PICTURE_VIEWS)[number];
export const EXTRA_VIEWS = ["angle", "detail", "in_use"] as const satisfies readonly PictureView[];

export const WEARERS = ["women", "men", "kids", "anyone"] as const;
export type Wearer = (typeof WEARERS)[number];
export const WEARER_LABELS: Record<Wearer, string> = { women: "Women", men: "Men", kids: "Kids", anyone: "Anyone" };

export const VIEW_LABELS: Record<ItemKind, Record<PictureView, string>> = {
  product: { main: "Main photo", angle: "Another angle", detail: "Close-up", in_use: "In use" },
  service: { main: "Main photo", angle: "In progress", detail: "Detail of the result", in_use: "At work with a customer" },
};

interface Described {
  kind: ItemKind;
  name: string;
  description: string;
}

const text = (item: Described) => `${item.name} ${item.description}`.toLowerCase();

const WORN =
  /\b(dress(es)?|skirts?|shirts?|t-shirts?|tees?|blouses?|tops?|sweaters?|hoodies?|jackets?|coats?|pants|jeans|shorts|leggings|socks|hats?|caps?|beanies?|scarf|scarves|gloves|mittens|onesies?|bibs?|pajamas|jewelry|necklaces?|earrings?|bracelets?|rings?|shoes|boots|sandals|slippers|aprons?|vests?|swimsuits?|bikinis?|ties?|bow ties?)\b/;

// Clothing and things worn on the body; their in-use picture shows a person wearing them
export function isWorn(item: Described): boolean {
  return item.kind === "product" && WORN.test(text(item));
}

// Who it's for, only when the item's own words say; otherwise the owner is asked
export function wearerFrom(item: Described): Wearer | null {
  const words = text(item);
  if (/\b(unisex|everyone|all ages|adults?)\b/.test(words)) return "anyone";
  if (/\b(kids?|kid's|kids'|children'?s?|child'?s|toddlers?|baby|babies|infants?|youth|boys'?|girls'?)\b/.test(words)) return "kids";
  if (/\b(women'?s?|womens|ladies'?|lady|female|maternity)\b/.test(words)) return "women";
  if (/\b(men'?s|mens|male|gentlemen'?s?)\b/.test(words)) return "men";
  return null;
}

// Null: nobody needs to be asked; "ask": the in-use picture waits for the owner's answer
export function wearerFor(item: Described & { wearer: Wearer | null }): Wearer | "ask" | null {
  if (!isWorn(item)) return null;
  return item.wearer ?? wearerFrom(item) ?? "ask";
}

// The gallery: one approved picture per view, in view order, newest approval wins
export function gallery<T extends { view: PictureView; approved: boolean }>(pictures: readonly T[]): T[] {
  return PICTURE_VIEWS.flatMap((view) => pictures.filter((picture) => picture.view === view && picture.approved).slice(-1));
}
