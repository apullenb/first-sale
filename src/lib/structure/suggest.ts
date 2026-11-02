import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { categoryFor } from "@/lib/intake/catalog";
import { STATE_NAMES } from "@/lib/intake/options";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { FactId } from "./facts";
import { fitsOwners } from "./options";

// A suggested starting point from the owner's confirmed answers: code, not a legal determination.
// Every suggestion says what it rests on, what it assumes, and what would change it.

export interface PathSuggestion {
  option: BusinessStructure;
  // They already registered this structure, so the path builds on it
  keepExisting: boolean;
  // Registered as a structure that can't fit their number of owners; one of the answers needs correcting
  mismatch: BusinessStructure | null;
  headline: string;
  // Confirmed answers it rests on
  basedOn: string[];
  // Answers that can raise what a business could owe, in plain words
  signals: string[];
  assumptions: string[];
  alternatives: { option: BusinessStructure; why: string; fact?: FactId }[];
  wouldChange: string[];
  askAProfessional: string[];
  name: { status: "likely" | "maybe" | "not_needed" | "done" | "unknown"; text: string; fact?: FactId };
  tax: { text: string; fact: FactId };
}

interface Signals {
  strong: string[];
  moderate: string[];
}

function signalsFor(p: BusinessProfile): Signals {
  const strong: string[] = [];
  const moderate: string[] = [];
  if (p.takesOnDebt === "yes") strong.push("You expect to sign a lease, take a loan or buy on credit");
  if (p.helpKinds.includes("employees")) strong.push("You plan to have employees");
  else if (p.hiringPlans === "right_away" && (p.helpKinds.length === 0 || p.helpKinds.includes("unsure"))) moderate.push("You may hire help right away");
  if (p.premises === "rented_space" || p.channels.includes("storefront")) strong.push("You’ll have a shop or rented space");
  if (p.makesForKids === "yes") strong.push("Some items are made for young children");
  if (p.offeringKinds.includes("food")) moderate.push("Customers eat what you make");
  if (p.foodContact === "yes") moderate.push("Some items touch food");
  if (p.customersVisit === "yes") moderate.push("Customers come to your home");
  return { strong, moderate };
}

// Owner-facing lines for the answers a structure suggestion rests on; only answered questions
export function basisLines(p: BusinessProfile): string[] {
  const lines: string[] = [];
  lines.push(p.owners.count === 1 ? "You’re the only owner" : `${p.owners.count} owners`);
  if (p.ownerRelation === "spouse") lines.push("The owners are married or partners");
  if (p.ownerRelation === "family") lines.push("The owners are family");
  if (p.mayAddOwners === "yes") lines.push("Someone may join as a co-owner later");
  if (p.mayAddOwners === "no") lines.push("No co-owners planned");
  const category = categoryFor(p.category);
  if (category && category.id !== "other") lines.push(`Selling: ${category.label.toLowerCase()}`);
  if (p.stage === "registered" && p.registeredAs && p.registeredAs !== "unsure") lines.push(`Already registered as: ${STRUCTURE_LABELS[p.registeredAs]}`);
  const { strong, moderate } = signalsFor(p);
  lines.push(...strong, ...moderate);
  if (p.takesOnDebt === "no") lines.push("No lease, loan or credit planned");
  if (p.goals.includes("test_idea")) lines.push("You want to test your idea with little risk for now");
  if (p.goals.includes("grow")) lines.push("You hope to grow it bigger");
  if (p.goals.includes("full_time")) lines.push("You hope to make it your full-time work");
  return lines;
}

export function nameNeed(p: BusinessProfile, option: BusinessStructure): PathSuggestion["name"] {
  const company = option === "llc" || option === "corporation";
  if (p.alreadyHave.includes("business_name")) {
    // A DBA registered as a sole proprietor or partners isn't a company's own registered name
    return company
      ? { status: "maybe", text: "You said you already registered a business name. A company’s name is a separate registration from a DBA, so check which one you have.", fact: "names_independent" }
      : { status: "done", text: "You said you already registered a business name." };
  }
  if (p.name === null) {
    return {
      status: "unknown",
      text: "You haven’t picked a name yet. If you sell under one that isn’t your legal name, most states require registering it.",
      fact: "dba_no_protection",
    };
  }
  const name = `“${p.name}”`;
  if (company) {
    return {
      status: "maybe",
      text: `A company’s registered name is how the state knows it. Selling under a different name than the one you register, like ${name} if it differs, usually means a DBA too.`,
      fact: "dba_different_identity",
    };
  }
  if (p.owners.count === 1 && p.nameIsLegalName === "yes") {
    return { status: "not_needed", text: `${name} is your own legal name, so the SBA says no name registration is needed.`, fact: "legal_name_no_registration" };
  }
  if (p.owners.count === 1 && p.nameIsLegalName === "no") {
    return { status: "likely", text: `${name} isn’t your legal name, and most states require registering a name like that as a DBA.`, fact: "dba_no_protection" };
  }
  return { status: "maybe", text: `If ${name} isn’t your own legal name, you’ll likely need to register it as a DBA.`, fact: "dba_where" };
}

export function taxFor(option: BusinessStructure, owners: number): PathSuggestion["tax"] {
  switch (option) {
    case "sole_proprietorship":
      return { text: "Business profit goes on your own tax return, on Schedule C.", fact: "sp_schedule_c" };
    case "partnership":
      return { text: "The partnership files a yearly information return, and each partner reports their share.", fact: "partnership_return" };
    case "llc":
      return owners > 1
        ? { text: "By default, the IRS treats an LLC with two or more owners as a partnership.", fact: "llc_multi_tax" }
        : { text: "By default, a one-owner LLC goes on your own tax return.", fact: "llc_single_tax" };
    case "corporation":
      return { text: "A corporation pays income tax on its own profits.", fact: "corp_tax" };
  }
}

const unsure = (value: string | null) => value === null || value === "unsure";

export function suggestPath(p: BusinessProfile): PathSuggestion {
  const owners = p.owners.count;
  const { strong, moderate } = signalsFor(p);
  const signals = [...strong, ...moderate];
  const growing = p.goals.includes("grow") || p.goals.includes("full_time");
  const assumptions: string[] = [];
  const wouldChange: string[] = [];
  const askAProfessional: string[] = [];

  if (unsure(p.takesOnDebt)) {
    assumptions.push("We don’t know yet whether you’ll sign a lease or loan.");
    wouldChange.push("Signing a lease, taking a loan or buying on credit");
  }
  if (p.hiringPlans === null || p.helpKinds.includes("unsure")) wouldChange.push("Hiring employees");
  if (owners === 1 && p.mayAddOwners !== "no") wouldChange.push("Adding a co-owner");
  if (owners > 1) wouldChange.push("One owner leaving, or a new one joining");
  assumptions.push(`${STATE_NAMES[p.location.state]}’s requirements and fees for each structure still need checking against official state pages.`);

  let option: BusinessStructure;
  let keepExisting = false;
  let headline: string;
  const alternatives: PathSuggestion["alternatives"] = [];

  const said = p.stage === "registered" && p.registeredAs && p.registeredAs !== "unsure" ? p.registeredAs : null;
  // Only a structure that fits the number of owners is built on
  const registered = said && fitsOwners(said, owners) ? said : null;
  const mismatch = said && !registered ? said : null;
  if (registered) {
    option = registered;
    keepExisting = true;
    headline = `Keep your ${STRUCTURE_LABELS[registered].replace(/ \(LLC\)$/, "")}, and build the next steps on it`;
    alternatives.push({ option: registered === "llc" ? "corporation" : "llc", why: "You can change structure later, but there may be restrictions where you are.", fact: "convert_later" });
  } else if (owners === 1) {
    // Testing an idea or selling a little: the SBA's own "test your idea" fit for a sole proprietorship
    const small = p.goals.includes("test_idea") || p.firstYearSales === "under_5k";
    const llc = strong.length > 0 || moderate.length >= 3 || (moderate.length >= 2 && !small) || (growing && signals.length > 0);
    option = llc ? "llc" : "sole_proprietorship";
    headline = llc
      ? "Compare a one-owner LLC with a sole proprietorship before you start selling"
      : "Start as a sole proprietorship, and look at an LLC as you grow";
    alternatives.push(
      llc
        ? { option: "sole_proprietorship", why: "Nothing to file, and the SBA calls it a fit for testing an idea first.", fact: "sp_fit" }
        : { option: "llc", why: "A separate company you form with your state, with protection the SBA describes as “in most instances”.", fact: "llc_liability" },
    );
    if (!llc) {
      wouldChange.push("Opening a shop or renting a space");
      // Asked only of makers and shops
      if (p.offeringKinds.some((kind) => kind === "handmade" || kind === "resale")) wouldChange.push("Making items for young children");
      askAProfessional.push("Is my business low-risk enough to start without forming a company?");
    }
  } else {
    const llc = signals.length > 0 || growing;
    option = llc ? "llc" : "partnership";
    headline = llc
      ? "Compare an LLC with a general partnership, and put your agreement in writing either way"
      : "A general partnership with a written agreement, or an LLC if you want a separate company";
    alternatives.push(
      llc
        ? { option: "partnership", why: "Simplest for two or more people, the SBA says, but it lists unlimited personal liability for general partners.", fact: "partnership_liability" }
        : { option: "llc", why: "A separate company you form with your state, with protection the SBA describes as “in most instances”.", fact: "llc_liability" },
    );
    askAProfessional.push("How should we split ownership, work and profits, and what happens if one of us leaves?");
    if (p.ownerRelation === "spouse") askAProfessional.push("If we’re married to each other, can we choose not to be treated as a partnership?");
  }
  if (!registered && growing) alternatives.push({ option: "corporation", why: "Usually for raising money from investors or selling the business later.", fact: "corp_fit" });

  if (option === "llc") askAProfessional.push("What wouldn’t an LLC cover for us, such as a lease or loan signed personally?");
  if (option === "llc" || option === "corporation") askAProfessional.push(`What does ${STATE_NAMES[p.location.state]} charge to form one, and every year after?`);
  // A sole proprietor can't elect S corporation status
  if (option !== "sole_proprietorship" && growing && p.firstYearSales === "over_100k") askAProfessional.push("Would choosing S corporation tax treatment make sense at our income?");
  if (unsure(p.ownerRelation) && owners > 1) assumptions.push("We don’t know how the owners are related; it can matter for taxes.");

  return {
    option,
    keepExisting,
    mismatch,
    headline,
    basedOn: basisLines(p),
    signals,
    assumptions,
    alternatives,
    wouldChange: [...new Set(wouldChange)],
    askAProfessional,
    name: nameNeed(p, option),
    tax: taxFor(option, owners),
  };
}

// Changes to try without touching the saved answers
export interface WhatIf {
  owners?: number;
  takesOnDebt?: "yes" | "no";
  employees?: boolean;
  customersVisit?: "yes" | "no";
}

export function applyWhatIf(p: BusinessProfile, whatIf: WhatIf): BusinessProfile {
  const next: BusinessProfile = structuredClone(p);
  if (whatIf.owners !== undefined) {
    next.owners = { count: whatIf.owners };
    if (whatIf.owners === 1) next.ownerRelation = null;
    else next.mayAddOwners = null;
  }
  if (whatIf.takesOnDebt) next.takesOnDebt = whatIf.takesOnDebt;
  if (whatIf.employees !== undefined) {
    next.helpKinds = whatIf.employees ? [...new Set([...next.helpKinds, "employees" as const])] : next.helpKinds.filter((kind) => kind !== "employees");
    if (whatIf.employees) next.hiringPlans = next.hiringPlans === "right_away" ? "right_away" : "first_year";
    else if (next.hiringPlans === "right_away") next.hiringPlans = "not_now";
  }
  if (whatIf.customersVisit) next.customersVisit = whatIf.customersVisit;
  return next;
}

// A reason behind a recommendation, in the owner's own terms, with its official source where there is one
export interface Reason {
  text: string;
  fact?: FactId;
  // Cuts the other way, or rests on an unanswered question
  caveat?: true;
}

const growingPlans = (p: BusinessProfile) => p.goals.includes("grow") || p.goals.includes("full_time");

// Why the suggested structure fits these answers, for "Explain why"
export function whyRecommended(p: BusinessProfile, path: PathSuggestion = suggestPath(p)): Reason[] {
  const reasons: Reason[] = [];
  const owners = p.owners.count;
  const { strong, moderate } = signalsFor(p);
  if (path.keepExisting) {
    reasons.push({ text: `You said you’re already registered as a ${STRUCTURE_LABELS[path.option].replace(/ \(LLC\)$/, "").toLowerCase()}, so the next steps build on it.` });
    reasons.push({ text: "You can change structure later, but there may be restrictions where you are.", fact: "convert_later" });
    return reasons;
  }
  const quiet = "None of your answers point to more risk, like a lease, a loan, employees or a shop.";
  reasons.push({ text: owners === 1 ? "You’re the only owner, so a partnership isn’t an option." : `There are ${owners} owners, so a sole proprietorship isn’t an option.` });

  if (path.option === "sole_proprietorship" || path.option === "partnership") {
    const solo = path.option === "sole_proprietorship";
    if (p.goals.includes("test_idea")) {
      reasons.push(
        solo
          ? { text: "You want to test your idea with little risk first. The SBA calls a sole proprietorship a good choice for that.", fact: "sp_fit" }
          : { text: "You want to test your idea first. The SBA calls a partnership a good choice for that.", fact: "partnership_fit" },
      );
    } else if (solo && p.firstYearSales === "under_5k") {
      reasons.push({ text: "You expect under $5,000 in sales your first year, so you’re starting small." });
    } else if (!solo) {
      reasons.push({ text: "The SBA calls a partnership the simplest way for two or more people to own a business together.", fact: "partnership_simplest" });
    }
    if (!strong.length && !moderate.length) reasons.push({ text: quiet });
    for (const signal of moderate) reasons.push({ text: `${signal}. That adds some risk, so compare the LLC too.`, caveat: true });
    reasons.push(
      solo
        ? { text: "Nothing to file to start: running a business on your own makes you one automatically.", fact: "sp_automatic" }
        : { text: "No company to form: the IRS treats two or more people doing business together as a partnership.", fact: "partnership_definition" },
    );
    if (!solo) reasons.push({ text: "Whether a partnership registers with the state depends on the state.", fact: "varies_by_state", caveat: true });
  } else {
    for (const signal of strong) reasons.push({ text: `${signal}.` });
    if (strong.length || moderate.length) {
      for (const signal of moderate) reasons.push({ text: `${signal}.` });
      reasons.push({ text: "The SBA calls an LLC a good fit for medium- or higher-risk businesses.", fact: "llc_fit" });
    }
    if (growingPlans(p)) reasons.push({ text: "You hope to grow it, or make it your full-time work." });
    reasons.push({ text: "An LLC protects owners from personal liability “in most instances”, the SBA says.", fact: "llc_liability" });
  }
  if (unsure(p.takesOnDebt)) reasons.push({ text: "You haven’t said yet whether you’ll sign a lease or take a loan. If you will, look at this again.", caveat: true });
  return reasons;
}

export type NamePlan = "register_dba" | "legal_name";
export type TaxPlan = "default" | "s_corp";

export interface Recommendation<T extends string> {
  value: T;
  reasons: Reason[];
}

// Only when the answers make it clear; otherwise "Not sure yet" stays a fair answer
export function recommendedNamePlan(p: BusinessProfile, option: BusinessStructure): Recommendation<NamePlan> | null {
  const need = nameNeed(p, option);
  if (need.status === "likely") {
    return {
      value: "register_dba",
      reasons: [
        { text: need.text, fact: need.fact },
        { text: "Depending on where your business is located, that’s with your state, county or city.", fact: "dba_where" },
        { text: "A DBA is a name, not a company, and doesn’t protect the name by itself.", fact: "dba_no_protection" },
      ],
    };
  }
  if (need.status === "not_needed") return { value: "legal_name", reasons: [{ text: need.text, fact: need.fact }] };
  return null;
}

// S corporation status is the pick for a corporation, and worth knowing about for a company expecting large sales
export function sCorpWorthKnowing(p: BusinessProfile, option: BusinessStructure): boolean {
  return option === "corporation" || (option !== "sole_proprietorship" && growingPlans(p) && p.firstYearSales === "over_100k");
}

export function recommendedTaxPlan(p: BusinessProfile, option: BusinessStructure): Recommendation<TaxPlan> {
  const tax = taxFor(option, p.owners.count);
  if (option === "corporation") {
    return {
      value: "s_corp",
      reasons: [
        { text: tax.text, fact: tax.fact },
        { text: "S corporation status passes its income through to shareholders instead, so it isn’t taxed twice.", fact: "s_corp_pass_through" },
        { text: "You choose it by filing Form 2553, which SnapStart adds to your steps.", fact: "s_corp_election" },
      ],
    };
  }
  // A sole proprietor has no tax status to choose; that takes forming a company first
  if (option !== "sole_proprietorship" && growingPlans(p) && p.firstYearSales === "over_100k") {
    return {
      value: "default",
      reasons: [
        { text: "You expect over $100,000 in sales and hope to grow." },
        { text: "Start with the default. Once your profit, not just your sales, grows large, S corporation status can lower your self-employment tax, and you can switch to it then.", fact: "tax_status" },
      ],
    };
  }
  const reasons: Reason[] = [{ text: tax.text, fact: tax.fact }];
  if (option === "sole_proprietorship") reasons.push({ text: "If you form an LLC later, it can choose another tax status, such as S corp.", fact: "tax_status" });
  if (option === "llc") reasons.push({ text: "Keeping the default needs no election form. Choosing to be taxed as a corporation would take Form 8832.", fact: tax.fact });
  if (p.firstYearSales === null || p.firstYearSales === "unsure") {
    reasons.push({ text: "For a new business, the default is the simple choice. If your profit grows large, you can switch later.", caveat: true });
  } else if (p.firstYearSales === "over_100k") {
    reasons.push({ text: "You expect over $100,000 in sales. If your profit grows large too, S corporation status can lower your self-employment tax, and you can switch to it then.", caveat: true });
  } else {
    reasons.push({ text: "Nothing in your answers, like very high sales, points to choosing another yet." });
  }
  return { value: "default", reasons };
}
