import type { BusinessProfile } from "@/lib/domain";
import { type SiteDesign, type SiteProduct, withProducts } from "./site/design";
import type { WebsiteCopy } from "./types";

// Price and ordering claims in the site's words, checked in code against the owner's saved prices and handoff answers.
// Conflicts are shown to the owner to settle; code never picks a side. Browser-safe.

export interface ClaimRecords {
  // Prices the site shows, from saved products and item prices
  prices: { name: string; cents: number }[];
  handoff: BusinessProfile["handoff"];
}

type Handoff = BusinessProfile["handoff"][number];

// The prices the site would show for these words, with saved products joined as the site joins them
export function siteClaimRecords(copy: WebsiteCopy, products: SiteProduct[], design: SiteDesign, handoff: ClaimRecords["handoff"]): ClaimRecords {
  const shown = withProducts(copy, products, design);
  const names = new Set(shown.copy.offerings.map((offering) => offering.name.trim().toLowerCase()));
  const prices = shown.design.items.flatMap((item) =>
    item.priceCents != null && names.has(item.name.trim().toLowerCase()) ? [{ name: item.name, cents: item.priceCents }] : [],
  );
  return { prices, handoff };
}

function labeled(copy: WebsiteCopy): { label: string; text: string }[] {
  return [
    { label: "Headline", text: copy.headline },
    { label: "Line under the headline", text: copy.subheadline },
    { label: "Welcome", text: copy.intro },
    { label: "Your story", text: copy.about },
    ...copy.offerings.map((item, index) => ({ label: `Item ${index + 1}`, text: `${item.name}. ${item.description}` })),
    { label: "How to buy", text: copy.howToBuy },
    { label: "How to reach you", text: copy.contact },
    ...copy.faq.map((entry, index) => ({ label: `Answer ${index + 1}`, text: entry.answer })),
    { label: "Search description", text: copy.seoDescription },
  ];
}

const AMOUNT = String.raw`\$\s?(\d[\d,]*(?:\.\d{1,2})?)`;
// "under $10" counts $10 as over; "up to $10" doesn't
const CEILING_BEFORE = new RegExp(String.raw`\b(under|less than|below|no more than|not more than|at most|up to|never more than|nothing over|nothing above)\s+${AMOUNT}`, "gi");
const CEILING_AFTER = new RegExp(String.raw`${AMOUNT}\s+(or less|or under|and under|or below|max)\b`, "gi");
const FLOOR = new RegExp(String.raw`\b(starting at|starts at|start at|from just|from only)\s+${AMOUNT}`, "gi");
const INCLUSIVE = /^(no more than|not more than|at most|up to|never more than|nothing over|nothing above|or less|or under|and under|max)$/i;
// "Most cookies are under $10" can be true with one $12 item
const HEDGE = /\b(most|many|some|several|plenty|lots|a few|mostly|usually|often|typically|generally|plenty of)\b/i;

const cents = (text: string) => Math.round(Number(text.replace(/,/g, "")) * 100);
const money = (value: number) => `$${(value / 100).toFixed(value % 100 ? 2 : 0)}`;

const sentences = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

function priceConflicts(label: string, text: string, prices: ClaimRecords["prices"]): string[] {
  if (!prices.length) return [];
  const found: string[] = [];
  for (const sentence of sentences(text)) {
    const hedged = HEDGE.test(sentence);
    const ceilings = [
      ...[...sentence.matchAll(CEILING_BEFORE)].map((match) => ({ words: match[0], limit: cents(match[2]), inclusive: INCLUSIVE.test(match[1]) })),
      ...[...sentence.matchAll(CEILING_AFTER)].map((match) => ({ words: match[0], limit: cents(match[1]), inclusive: INCLUSIVE.test(match[2]) })),
    ];
    for (const { words, limit, inclusive } of ceilings) {
      const over = prices.filter((price) => (inclusive ? price.cents > limit : price.cents >= limit));
      const under = prices.filter((price) => !over.includes(price));
      if (hedged ? under.length === 0 : over.length > 0) {
        const example = over[0];
        found.push(`${label} says “${words}”, but ${example.name} is ${money(example.cents)}. Change the words or the price.`);
      }
    }
    for (const match of sentence.matchAll(FLOOR)) {
      const floor = cents(match[2]);
      const cheaper = prices.find((price) => price.cents < floor);
      if (cheaper) found.push(`${label} says “${match[0]}”, but ${cheaper.name} is ${money(cheaper.cents)}. Change the words or the price.`);
    }
  }
  return found;
}

const DELIVERY: readonly Handoff[] = ["local_delivery"];
const SHIPPING: readonly Handoff[] = ["ship_in_state", "ship_out_of_state"];
const PICKUP: readonly Handoff[] = ["pickup_home", "pickup_elsewhere"];

const NO_DELIVERY = /\b(pick ?-?up only|only (?:offer |do |have )?pick ?-?ups?|no deliver(?:y|ies)|(?:don[’']t|do not|can[’']t|cannot|won[’']t) deliver|deliver(?:y|ies) (?:is|are)n[’']t (?:available|offered)|deliver(?:y|ies) (?:is|are) not (?:available|offered)|not offer(?:ing)? deliver(?:y|ies))\b/i;
const NO_SHIPPING = /\b(pick ?-?up only|only (?:offer |do |have )?pick ?-?ups?|no shipping|(?:don[’']t|do not|can[’']t|cannot|won[’']t) ship|shipping (?:isn[’']t|is not) (?:available|offered)|not offer(?:ing)? shipping|local (?:orders )?only)\b/i;
const NO_PICKUP = /\b(no pick ?-?ups?|(?:don[’']t|do not|can[’']t|cannot) offer pick ?-?ups?|delivery only|shipping only|ship only)\b/i;
const OFFERS_DELIVERY = /\b(we|I) (?:can |also |will |happily )?deliver\b|\b(local|home|free|nearby|same-day) deliver(?:y|ies)\b|\bdeliver(?:y|ies) (?:is|are) available\b|\bpickup or delivery\b|\bdelivery or pickup\b/i;
const OFFERS_SHIPPING = /\b(we|I) (?:can |also |will |happily )?ship\b|\b(free|fast|flat-rate) shipping\b|\bshipping (?:is|are) available\b|\bships? (?:anywhere|nationwide|to you|across)\b/i;

const offered = (handoff: ClaimRecords["handoff"], group: readonly Handoff[]) => handoff.some((each) => group.includes(each));

function handoffConflicts(label: string, text: string, handoff: ClaimRecords["handoff"]): string[] {
  const known = handoff.some((each) => each !== "unsure");
  if (!known) return [];
  const delivers = offered(handoff, DELIVERY);
  const ships = offered(handoff, SHIPPING);
  const pickup = offered(handoff, PICKUP);
  const found = new Set<string>();
  for (const sentence of sentences(text)) {
    if (sentence.endsWith("?")) continue;
    if (delivers && NO_DELIVERY.test(sentence)) found.add(`${label} says there’s no delivery, but you said you deliver nearby. Change the words or your answers.`);
    if (ships && NO_SHIPPING.test(sentence)) found.add(`${label} says you don’t ship, but you said you ship orders. Change the words or your answers.`);
    if (pickup && NO_PICKUP.test(sentence)) found.add(`${label} says there’s no pickup, but you said customers can pick up. Change the words or your answers.`);
    if (!delivers && OFFERS_DELIVERY.test(sentence) && !NO_DELIVERY.test(sentence)) found.add(`${label} offers delivery, but your answers don’t say you deliver. Change the words or your answers.`);
    if (!ships && OFFERS_SHIPPING.test(sentence) && !NO_SHIPPING.test(sentence)) found.add(`${label} offers shipping, but your answers don’t say you ship. Change the words or your answers.`);
  }
  return [...found];
}

// Each way the owner gets orders to customers should show up in How to buy, [bracketed] notes included
function missingHandoff(howToBuy: string, handoff: ClaimRecords["handoff"]): string[] {
  const missing: string[] = [];
  if (offered(handoff, DELIVERY) && !/deliver/i.test(howToBuy)) missing.push("How to buy doesn’t mention local delivery, which you offer. Say how delivery works.");
  if (offered(handoff, PICKUP) && !/pick ?-?up|collect/i.test(howToBuy)) missing.push("How to buy doesn’t mention pickup, which you offer. Say how pickup works.");
  if (offered(handoff, SHIPPING) && !/\bship|\bmail/i.test(howToBuy)) missing.push("How to buy doesn’t mention shipping, which you offer. Say how shipping works.");
  return missing;
}

export function claimConflicts(copy: WebsiteCopy, records: ClaimRecords): string[] {
  const found = labeled(copy).flatMap(({ label, text }) => [...priceConflicts(label, text, records.prices), ...handoffConflicts(label, text, records.handoff)]);
  return [...new Set([...found, ...missingHandoff(copy.howToBuy, records.handoff)])];
}
