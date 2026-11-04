import { comparePlan, feeText, needsUpgrade, usd } from "./costs";
import type { PlatformInfo } from "./platforms";

// The pieces of an online presence, and how each package covers them on the plan it's priced on. Decided in code
// from the platform data.

export const TERMS = ["domain", "hosting", "builder", "checkout", "email"] as const;
export type TermId = (typeof TERMS)[number];

export const TERM_LABELS: Record<TermId, string> = {
  domain: "Web address",
  hosting: "Hosting",
  builder: "Website builder",
  checkout: "Online store and checkout",
  email: "Business email",
};

// "extra": the package sells it for more money; "not_included": get it somewhere else
export type TermStatus = "included" | "extra" | "not_included";

export const STATUS_LABELS: Record<TermStatus, string> = {
  included: "Included",
  extra: "Extra cost",
  not_included: "Not included",
};

export interface TermRow {
  term: TermId;
  status: TermStatus;
  note: string;
}

function domainRow(platform: PlatformInfo): TermRow {
  const { domain, name } = platform;
  const plan = comparePlan(platform);
  const upgrade = needsUpgrade(platform) ? ` Needs ${plan.name} or higher, the plan priced here.` : "";
  const free = domain.freeAddress ? ` A free ${domain.freeAddress} address comes with it.` : "";
  if (domain.firstYearFreeWithYearly && plan.billing === "yearly") {
    return { term: "domain", status: "included", note: `Free for the first year on yearly plans${domain.later ? `, then ${domain.later}` : ""}.${upgrade}` };
  }
  if (domain.sold === "included") return { term: "domain", status: "included", note: `Included with ${name}, and set up for you.` };
  if (domain.sold === "here") {
    if (domain.firstUsd === null) return { term: "domain", status: "extra", note: `Sold by ${name}; price not checked here.${upgrade}${free}` };
    const price = `${domain.from ? "From " : ""}${usd(domain.firstUsd)}${domain.per ? ` a ${domain.per}` : ""} from ${name}`;
    const period = domain.per ? "" : `; ${name} doesn’t say how long that covers`;
    return { term: "domain", status: "extra", note: `${price}${period}.${upgrade}${free}` };
  }
  return { term: "domain", status: "not_included", note: `Buy one from any company that sells web addresses.${free}` };
}

function emailRow(platform: PlatformInfo): TermRow {
  const { email, name } = platform;
  const price = email.monthlyUsd !== null ? `, ${usd(email.monthlyUsd)} a month` : "";
  switch (email.kind) {
    case "addon":
      return { term: "email", status: "extra", note: `Through ${email.via}, for a fee${price}.` };
    case "forwarding":
      return { term: "email", status: "not_included", note: `${name} forwards email for free but doesn’t sell inboxes. Get one from ${email.via}.` };
    case "none":
      return { term: "email", status: "not_included", note: "Get it from the company you buy your web address from, or an email service." };
  }
}

export function packageTerms(platform: PlatformInfo): TermRow[] {
  const plan = comparePlan(platform);
  const fee = plan.cardFee ? feeText(plan.cardFee) : null;
  return [
    domainRow(platform),
    platform.hosting
      ? { term: "hosting", status: "included", note: platform.builtBy === "first_sale" ? "Part of the SnapStart fee." : "Part of every plan." }
      : { term: "hosting", status: "not_included", note: "Find a host yourself." },
    platform.builtBy === "first_sale"
      ? { term: "builder", status: "included", note: "SnapStart builds it from your choices." }
      : { term: "builder", status: "included", note: `You build it yourself with ${platform.name}’s designs.` },
    platform.checkout === "built_in"
      ? { term: "checkout", status: "included", note: fee ? `Card fee ${fee} per sale on ${plan.name}.` : `Card fee on ${plan.name} not checked here.` }
      : { term: "checkout", status: "not_included", note: `No cart. Buy buttons open your Stripe or Square payment page${fee ? ` (${fee} per sale with Stripe)` : ""}.` },
    emailRow(platform),
  ];
}
