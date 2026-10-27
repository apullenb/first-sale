import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { categoryFor } from "@/lib/intake/catalog";
import { STATE_NAMES } from "@/lib/intake/options";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { FactId } from "./facts";

// A suggested starting point from the owner's confirmed answers: rules, not a legal determination.
// Every suggestion says what it rests on, what it assumes, and what would change it.

export interface PathSuggestion {
  option: BusinessStructure;
  // They already registered this structure, so the path builds on it
  keepExisting: boolean;
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
  if (p.goals.includes("test_idea")) lines.push("You want to test the idea first");
  if (p.goals.includes("grow")) lines.push("You hope to grow it bigger");
  if (p.goals.includes("full_time")) lines.push("You hope to make it your full-time work");
  return lines;
}

export function nameNeed(p: BusinessProfile, option: BusinessStructure): PathSuggestion["name"] {
  if (p.alreadyHave.includes("business_name")) return { status: "done", text: "You said you already registered a business name." };
  if (p.name === null) {
    return {
      status: "unknown",
      text: "You haven’t picked a name yet. If you sell under one that isn’t your legal name, most states require registering it.",
      fact: "dba_no_protection",
    };
  }
  const name = `“${p.name}”`;
  if (option === "llc" || option === "corporation") {
    return {
      status: "maybe",
      text: `A company’s registered name is how the state knows it. Selling under a different name than the one you register, like ${name} if it differs, usually means a DBA too.`,
      fact: "entity_name",
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
      return { text: "A corporation pays income tax on its own profits, unless it chooses S corporation status.", fact: "corp_tax" };
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
  assumptions.push(`${STATE_NAMES[p.location.state]}’s rules and fees for each structure still need checking against official state pages.`);

  let option: BusinessStructure;
  let keepExisting = false;
  let headline: string;
  const alternatives: PathSuggestion["alternatives"] = [];

  const registered = p.stage === "registered" && p.registeredAs && p.registeredAs !== "unsure" ? p.registeredAs : null;
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
      wouldChange.push("Opening a shop or renting a space", "Making items for young children");
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
    if (p.ownerRelation === "spouse") askAProfessional.push("As a married couple, can we choose not to be treated as a partnership?");
  }
  if (!registered && growing) alternatives.push({ option: "corporation", why: "Usually for raising money from investors or selling the business later.", fact: "corp_fit" });

  if (option === "llc") askAProfessional.push("What wouldn’t an LLC cover for us, such as a lease or loan signed personally?");
  if (option === "llc" || option === "corporation") askAProfessional.push(`What does ${STATE_NAMES[p.location.state]} charge to form one, and every year after?`);
  if (growing && p.firstYearSales === "over_100k") askAProfessional.push("Would choosing S corporation tax treatment make sense at our income?");
  if (unsure(p.ownerRelation) && owners > 1) assumptions.push("We don’t know how the owners are related; it can matter for taxes.");

  return {
    option,
    keepExisting,
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
