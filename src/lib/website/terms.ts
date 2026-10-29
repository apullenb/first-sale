import { feeText, usd } from "./costs";
import type { PlatformInfo } from "./platforms";

// The pieces of an online presence, and how each package covers them. Decided by rules from the platform data.

export const TERMS = ["domain", "hosting", "builder", "checkout", "email"] as const;
export type TermId = (typeof TERMS)[number];

export const TERM_LABELS: Record<TermId, string> = {
  domain: "Web address",
  hosting: "Hosting",
  builder: "Website builder",
  checkout: "Online store and checkout",
  email: "Business email",
};

// "extra": the package offers it for more money; "not_included": get it somewhere else
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
  const free = domain.freeAddress ? ` Free address: ${domain.freeAddress}.` : "";
  if (domain.firstYearFree && !domain.needsPlan) {
    return { term: "domain", status: "included", note: `Free for the first year${domain.later ? `, then ${domain.later}` : ""}.` };
  }
  const price = domain.firstUsd !== null ? `${domain.from ? "from " : ""}${usd(domain.firstUsd)}${domain.per ? ` a ${domain.per}` : ""}` : null;
  if (domain.needsPlan) {
    return {
      term: "domain",
      status: "extra",
      note: `Needs ${domain.needsPlan.name} (${usd(domain.needsPlan.monthlyUsd)} a month)${price ? `, plus the address, ${price}` : ""}.${free}`,
    };
  }
  if (domain.sold === "here") return { term: "domain", status: "extra", note: `${price ? `${price[0].toUpperCase()}${price.slice(1)} from ${name}` : `Sold by ${name}`}.${free}` };
  return { term: "domain", status: "not_included", note: `Buy one from any company that sells web addresses.${free}` };
}

function emailRow(platform: PlatformInfo): TermRow {
  const { email } = platform;
  const price = email.monthlyUsd !== null ? `, ${usd(email.monthlyUsd)} a month` : "";
  switch (email.kind) {
    case "addon":
      return { term: "email", status: "extra", note: `Through ${email.via}, for a fee${price}.` };
    case "forwarding":
      return { term: "email", status: "extra", note: `Forwarding is free; a full inbox through ${email.via} costs extra.` };
    case "none":
      return { term: "email", status: "not_included", note: "Get it from the company you buy your web address from, or an email service." };
  }
}

export function packageTerms(platform: PlatformInfo): TermRow[] {
  const fee = feeText(platform.cardFee);
  return [
    domainRow(platform),
    platform.hosting
      ? { term: "hosting", status: "included", note: platform.builtBy === "first_sale" ? "Part of the First Sale fee." : "Part of every plan." }
      : { term: "hosting", status: "not_included", note: "Find a host yourself." },
    platform.builtBy === "first_sale"
      ? { term: "builder", status: "included", note: "First Sale builds it from your choices." }
      : { term: "builder", status: "included", note: `You build it yourself with ${platform.name}’s designs.` },
    platform.checkout === "built_in"
      ? { term: "checkout", status: "included", note: `Card fee ${fee} per sale.` }
      : { term: "checkout", status: "not_included", note: `No cart. Buy buttons open your Stripe or Square payment page (${fee} per sale with Stripe).` },
    emailRow(platform),
  ];
}
