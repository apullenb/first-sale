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

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
// Longest first, so "seventeen" wins over "seven"
const WORD = String.raw`(?:(?:${TENS.slice(2).join("|")})(?:[-\s](?:${ONES.slice(1, 10).join("|")}))?|${[...ONES.slice(10)].reverse().join("|")}|${ONES.slice(0, 10).join("|")}|(?:a|one) hundred)`;
const DIGITS = String.raw`\d[\d,]*(?:\.\d{1,2})?`;
const UNIT = String.raw`\s?(?:dollars?|bucks?|usd)\b`;
// "$10", "10 dollars", "ten dollars", "twelve bucks"
const MONEY = String.raw`(?:\$\s?${DIGITS}|${DIGITS}${UNIT}|${WORD}${UNIT})`;
// After a ceiling word, "under ten." counts when the sentence is about prices
const BARE = String.raw`(?:${DIGITS}|${WORD})(?=\s*(?:[.!,;)]|$|each\b|apiece\b))`;

const CEILING_WORDS = String.raw`under|less than|below|no more than|not more than|nothing more than|no higher than|at most|up to|never more than|never over|not over|nothing over|nothing above|max|maximum`;
const CEILING_BEFORE = new RegExp(String.raw`\b(${CEILING_WORDS})\s+(${MONEY}|${BARE})`, "gi");
const CEILING_AFTER = new RegExp(String.raw`(${MONEY})\s+(or less|or under|and under|or below|and below|or cheaper|max|maximum)\b`, "gi");
const FLOOR = new RegExp(String.raw`\b(starting at|starting from|starts at|starts from|start at|from just|from only|as low as|as little as)\s+(${MONEY})`, "gi");
const RANGE = new RegExp(String.raw`(?:between\s+(${MONEY})\s+and\s+(${MONEY}))|(\$\s?${DIGITS})\s?(?:[-–—]|to)\s?(\$?\s?${DIGITS})\b|\b(${DIGITS}|${WORD})\s?(?:[-–—]|to)\s?(${MONEY})`, "gi");
const INCLUSIVE = /^(no more than|not more than|nothing more than|no higher than|at most|up to|never more than|never over|not over|nothing over|nothing above|or less|or under|and under|and below|or cheaper|max|maximum)$/i;
// "Most cookies are under $10" can be true with one $12 item
const HEDGE = /\b(most|many|some|several|plenty|lots|a few|mostly|usually|often|typically|generally|plenty of)\b/i;
const ABOUT_PRICES = /\$|\b(prices?|priced|pricing|costs?|dollars?|bucks|pay|spend|cheap|affordable|budget|everything)\b/i;

function wordValue(text: string): number | null {
  const words = text.toLowerCase().split(/[-\s]+/);
  if (words.at(-1) === "hundred") return 100;
  let total = 0;
  for (const word of words) {
    const value = ONES.indexOf(word) >= 0 ? ONES.indexOf(word) : TENS.indexOf(word) >= 2 ? TENS.indexOf(word) * 10 : -1;
    if (value < 0) return null;
    total += value;
  }
  return total;
}

// Cents for "$1,200.50", "12 bucks" or "twenty-five dollars"
function cents(text: string): number | null {
  const bare = text.replace(/\$|\b(dollars?|bucks?|usd)\b/gi, "").trim();
  const digits = /^\d[\d,]*(\.\d{1,2})?$/.test(bare) ? Number(bare.replace(/,/g, "")) : wordValue(bare);
  return digits == null ? null : Math.round(digits * 100);
}
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
  const breaks = (words: string, item: { name: string; cents: number }) =>
    found.push(`${label} says “${words}”, but ${item.name} is ${money(item.cents)}. Change the words or the price.`);
  const lowest = prices.reduce((low, price) => (price.cents < low.cents ? price : low));
  for (const sentence of sentences(text)) {
    const hedged = HEDGE.test(sentence);
    const ceilings = [
      ...[...sentence.matchAll(CEILING_BEFORE)].flatMap((match) => {
        const limit = cents(match[2]);
        const bare = !new RegExp(`^${MONEY}$`, "i").test(match[2]);
        return limit == null || (bare && !ABOUT_PRICES.test(sentence)) ? [] : [{ words: match[0], limit, inclusive: INCLUSIVE.test(match[1]) }];
      }),
      ...[...sentence.matchAll(CEILING_AFTER)].flatMap((match) => {
        const limit = cents(match[1]);
        return limit == null ? [] : [{ words: match[0], limit, inclusive: INCLUSIVE.test(match[2]) }];
      }),
    ];
    for (const { words, limit, inclusive } of ceilings) {
      const over = prices.filter((price) => (inclusive ? price.cents > limit : price.cents >= limit));
      const under = prices.filter((price) => !over.includes(price));
      if (hedged ? under.length === 0 : over.length > 0) breaks(words, over[0]);
    }
    for (const match of sentence.matchAll(FLOOR)) {
      const floor = cents(match[2]);
      if (floor == null) continue;
      if (lowest.cents < floor) breaks(match[0], lowest);
      // "Starting at $5" says something costs $5
      else if (lowest.cents > floor) found.push(`${label} says “${match[0]}”, but your lowest price is ${money(lowest.cents)}. Change the words or the price.`);
    }
    for (const match of sentence.matchAll(RANGE)) {
      const [low, high] = (match[1] ? [match[1], match[2]] : match[3] ? [match[3], match[4]] : [match[5], match[6]]).map(cents);
      if (low == null || high == null || low > high) continue;
      const outside = prices.filter((price) => price.cents < low || price.cents > high);
      if (hedged ? outside.length === prices.length : outside.length > 0) breaks(match[0], outside[0]);
    }
  }
  return found;
}

const DELIVERY: readonly Handoff[] = ["local_delivery"];
const SHIPPING: readonly Handoff[] = ["ship_in_state", "ship_out_of_state"];
const PICKUP: readonly Handoff[] = ["pickup_home", "pickup_elsewhere"];

const NO_DELIVERY = /\b(pick ?-?up only|only (?:offer |do |have )?pick ?-?ups?|no deliver(?:y|ies)|(?:don[’']t|do not|can[’']t|cannot|won[’']t) deliver|deliver(?:y|ies) (?:is|are)n[’']t (?:available|offered)|deliver(?:y|ies) (?:is|are) not (?:available|offered)|not offer(?:ing)? deliver(?:y|ies))\b/i;
const NO_SHIPPING = /\b(pick ?-?up only|only (?:offer |do |have )?pick ?-?ups?|no shipping|(?:don[’']t|do not|can[’']t|cannot|won[’']t) ship|shipping (?:isn[’']t|is not) (?:available|offered)|not offer(?:ing)? shipping|local (?:orders |delivery )?only|deliver(?:y|ies) only)\b/i;
const NO_PICKUP = /\b(no pick ?-?ups?|(?:don[’']t|do not|can[’']t|cannot) offer pick ?-?ups?|delivery only|shipping only|ship only)\b/i;
const OFFERS_DELIVERY = /\b(we|I) (?:can |also |will |happily )?deliver\b|\b(local|home|free|nearby|same-day) deliver(?:y|ies)\b|\bdeliver(?:y|ies) (?:is|are) available\b|\bpickup or delivery\b|\bdelivery or pickup\b/i;
const OFFERS_SHIPPING = /\b(we|I) (?:can |also |will |happily )?ship\b|\b(free|fast|flat-rate|nationwide) shipping\b|\bshipping (?:is|are) available\b|\bshipping (?:nationwide|anywhere)\b|\bships? (?:anywhere|nationwide|to you|across)\b/i;
const OFFERS_PICKUP = /\bpick ?-?ups? (?:is |are )?(?:available|only|welcome)\b|\b(?:available|ready) for pick ?-?up\b|\b(?:curbside|free|local|porch|in-person) pick ?-?ups?\b|\b(?:you|customers) can (?:also )?pick (?:it |them |orders )?up\b|\bpick ?-?up or deliver(?:y)?\b|\bdelivery or pick ?-?up\b/i;
// Beyond the owner's state
const NATIONWIDE = /\b(nationwide|anywhere in the (?:us|u\.s\.|country|united states)|all 50 states|across the (?:us|u\.s\.|country|united states)|coast to coast|out of state|other states)\b/i;

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
    if (!pickup && OFFERS_PICKUP.test(sentence) && !NO_PICKUP.test(sentence)) found.add(`${label} offers pickup, but your answers don’t say customers can pick up. Change the words or your answers.`);
    if (ships && !handoff.includes("ship_out_of_state") && OFFERS_SHIPPING.test(sentence) && NATIONWIDE.test(sentence)) {
      found.add(`${label} says you ship out of state, but you said you ship only within your state. Change the words or your answers.`);
    }
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
