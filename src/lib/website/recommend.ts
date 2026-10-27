import type { BusinessProfile } from "@/lib/domain";
import type { PlatformId } from "./types";

// Plain rules from the owner's answers; AI plays no part in the pick. Each reason points back to an answer.

export interface Recommendation {
  platform: PlatformId;
  reasons: string[];
}

// Goods they make or resell; "something else" counts too, since it may be a product
export function sellsProducts(profile: BusinessProfile): boolean {
  return profile.offeringKinds.some((kind) => kind !== "services");
}

export function recommendPlatform(profile: BusinessProfile): Recommendation {
  const servicesOnly = profile.offeringKinds.every((kind) => kind === "services");
  const inPerson = profile.channels.some((channel) => channel === "in_person" || channel === "markets" || channel === "storefront");
  // Selling to shops isn't selling online, so wholesale doesn't count here
  const online = profile.channels.some((channel) => channel === "own_website" || channel === "marketplace" || channel === "social_media");
  const ships = profile.shipsOrders === "yes";
  const tightBudget = profile.startupBudget === "under_1k";

  if (servicesOnly) {
    return {
      platform: "wix",
      reasons: [
        "You sell services, so your site’s main job is showing what you do and making it easy to get in touch.",
        "Wix has lots of designs, so your site can look the way you want. If you don’t need to take payments online, its Light plan is the cheapest way to have your own web address with no ads.",
      ],
    };
  }

  if (inPerson) {
    return {
      platform: "square",
      reasons: [
        "You sell in person or at markets. Square uses one item list and stock count for your card reader and your online store, so they stay in step.",
        tightBudget
          ? "Your starting budget is tight, and Square Free has no monthly bill. You pay a fee only when you make a sale."
          : "Square Free has no monthly bill, so you can start small and upgrade when you want your own web address.",
        ...(ships ? ["It handles shipping as well as pickup and local delivery."] : []),
      ],
    };
  }

  if (online && !tightBudget) {
    return {
      platform: "shopify",
      reasons: [
        "You’ll sell mostly online, and Shopify’s cheapest plan is already a full store, with automatic sales tax and abandoned-checkout emails.",
        ...(ships ? ["You plan to ship orders, and Shopify includes discounted shipping labels."] : []),
        "It has a monthly fee, so it fits best once you expect steady online orders.",
      ],
    };
  }

  return {
    platform: "square",
    reasons: [
      "Square Free is the only one of the three with a free plan that takes payments on your website. You pay a fee only when you make a sale.",
      ...(online ? ["If your online sales grow, Shopify is a common next step."] : []),
    ],
  };
}
