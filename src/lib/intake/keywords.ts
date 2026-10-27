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

  // Only stated stages; "not registered yet" isn't a registration
  let stage: IntakeSuggestion["stage"] = null;
  const notRegistered = has(["not registered", "not yet registered", "haven t registered", "never registered", "get registered", "getting registered", "be registered", "unregistered"]);
  const registered = [" i registered", " we registered", "already registered", "registered my", "registered our", "registered an", "registered the", "is registered", "formed an llc", "formed my llc", "formed our llc", "have an llc", "set up an llc"];
  if (!notRegistered && has(registered)) {
    stage = "registered";
  } else if (has(["already sell", "been selling", "started selling", "currently selling", "already sold", "ve sold"])) {
    stage = "selling_informally";
  } else if (has(["want to start", "plan to start", "planning to start", "hoping to start", "like to start", "thinking about starting", "haven t started", "just an idea"])) {
    stage = "idea";
  }

  let registeredAs: IntakeSuggestion["registeredAs"] = null;
  if (stage === "registered") {
    if (has([" llc "])) registeredAs = "llc";
    else if (has(["corporation", " corp ", " inc ", "incorporated"])) registeredAs = "corporation";
    else if (has(["partnership"])) registeredAs = "partnership";
    else if (has(["sole proprietor"])) registeredAs = "sole_proprietorship";
  }

  // First match wins, most specific first
  const categories: [NonNullable<IntakeSuggestion["category"]>, string[]][] = [
    ["baked_goods", ["bake", "cake", "cookie", "bread", " pie", "cupcake", "candy", "fudge", "pastr"]],
    ["packaged_food", ["jam", "jelly", "salsa", "hot sauce", "pickle", "granola", "honey"]],
    ["prepared_food", ["cater", "meal", "food truck", "tamale", "lunch"]],
    ["woodworking", ["wood", "cutting board", "furniture", "carpent"]],
    ["clothing_boutique", ["boutique", "clothing", "clothes", "dress", "apparel"]],
    ["crafts", ["candle", "pottery", "jewelry", "craft", "soap", " knit", " sew", "quilt", "painting"]],
    ["resale_shop", ["resell", "resale", "vintage", "antique", "gift shop"]],
    ["personal_care", ["hair", "nails", "lashes", "massage", "makeup"]],
    ["home_services", ["cleaning", "repair", "handyman", "lawn", "pet sitting", "dog walking"]],
    ["lessons_care", ["tutor", "lessons", "childcare", "daycare", "fitness", "coaching"]],
    ["creative_services", ["photograph", "graphic design", "bookkeeping", "writing"]],
  ];
  const category = categories.find(([, words]) => has(words))?.[0] ?? null;

  // Longest names first, so "west virginia" isn't read as "virginia"
  const byLength = [...US_STATE_CODES].sort((a, b) => STATE_NAMES[b].length - STATE_NAMES[a].length);
  const state = byLength.find((code) => t.includes(` ${STATE_NAMES[code].toLowerCase()} `)) ?? null;

  return { category, state, owners, stage, registeredAs, offeringKinds, channels, premises };
}
