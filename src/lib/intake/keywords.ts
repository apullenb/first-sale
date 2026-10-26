import { US_STATE_CODES } from "@/lib/domain";
import type { IntakeSuggestion } from "./suggestion-schema";
import { STATE_NAMES } from "./options";

// Offline stand-in for the model (mock provider): simple keyword matching.
export function keywordSuggestions(description: string): IntakeSuggestion {
  const t = ` ${description.toLowerCase().replace(/[^a-z0-9$ ]/g, " ").replace(/\s+/g, " ")} `;
  const has = (words: string[]) => words.some((word) => t.includes(word));

  const offeringKinds: IntakeSuggestion["offeringKinds"] = [];
  if (has(["bake", "cake", "cookie", "bread", " pie", "jam", "salsa", "candy", "treats", " food", "cater"])) {
    offeringKinds.push("food");
  }
  if (has(["wood", "handmade", "hand made", "craft", "pottery", "candle", "jewelry", "cutting board", "furniture", " sew", " knit", "quilt"])) {
    offeringKinds.push("handmade");
  }
  if (has(["boutique", "clothing", "clothes", "dress", "resell", "resale", "vintage"])) offeringKinds.push("resale");
  if (has(["cleaning", "repair", "lessons", "tutor", "grooming", "photograph", "haircut", "coaching"])) {
    offeringKinds.push("services");
  }

  const channels: IntakeSuggestion["channels"] = [];
  if (has(["neighbor", "friends", "in person", "pickup", "pick up", " local"])) channels.push("in_person");
  if (has(["market", " fair", "festival", "pop up", "popup"])) channels.push("markets");
  if (has(["storefront", "boutique", "open a shop", "open a store", "retail space", "brick and mortar"])) {
    channels.push("storefront");
  }
  if (has(["website", "online store", "my site", "shopify"])) channels.push("own_website");
  if (has(["etsy", "amazon", "ebay", "marketplace"])) channels.push("marketplace");
  if (has(["instagram", "facebook", "tiktok", "social media"])) channels.push("social_media");
  if (has(["wholesale", "sell to shops", "sell to stores"])) channels.push("wholesale");

  let premises: IntakeSuggestion["premises"] = null;
  if (has(["commercial kitchen", "shared kitchen", "commissary", "studio space"])) premises = "shared_kitchen";
  else if (has(["storefront", "rent a space", " lease", "retail space", "boutique", "open a shop", "open a store"])) {
    premises = "rented_space";
  } else if (has([" home", "kitchen", "garage", "basement"])) premises = "home";

  let owners: IntakeSuggestion["owners"] = null;
  if (has(["brother", "sister", "partner", " we ", " our ", "my wife", "my husband", "together", "cousin"])) {
    owners = "others";
  } else if (has([" i ", " my ", " me "])) owners = "me";

  // Longest names first, so "west virginia" isn't read as "virginia"
  const byLength = [...US_STATE_CODES].sort((a, b) => STATE_NAMES[b].length - STATE_NAMES[a].length);
  const state = byLength.find((code) => t.includes(` ${STATE_NAMES[code].toLowerCase()} `)) ?? null;

  return { state, owners, offeringKinds, channels, premises };
}
