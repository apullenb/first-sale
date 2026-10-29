import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import type { FactId } from "./facts";

// The four separate decisions, and the ownership structures explained for a first-time owner.
// Lines about obligations cite a fact, or say they depend on the owner's state and need confirming.

export interface Line {
  text: string;
  fact?: FactId;
  // Depends on the owner's state: shown with their research result, or as needing confirmation
  stateRule?: true;
  // Advice rather than an obligation, such as a written agreement
  tip?: true;
  // Only matters with co-owners now or later
  only?: "co_owners";
}

export type AreaId = "ownership" | "name" | "tax" | "licenses";

export interface Area {
  id: AreaId;
  title: string;
  what: string;
  examples: string;
  where: string;
  fact: FactId;
  // Asked on this page, or handled in a later step
  decided: "here" | "later";
}

export const AREAS: readonly Area[] = [
  {
    id: "ownership",
    title: "Ownership structure",
    what: "Who owns the business, and whether it’s a company separate from you.",
    examples: "Sole proprietorship, partnership, LLC, corporation",
    where: "Companies such as LLCs are formed with your state. A sole proprietorship or partnership can start without forming anything.",
    fact: "varies_by_state",
    decided: "here",
  },
  {
    id: "name",
    title: "Business name registration",
    what: "Registering the name you sell under. A DBA (“doing business as”) is a name, not a structure: it doesn’t create a company.",
    examples: "DBA, trade name, assumed name, fictitious name",
    where: "Your state, county or city, depending on where you are.",
    fact: "dba_no_protection",
    decided: "here",
  },
  {
    id: "tax",
    title: "Tax treatment",
    what: "How the IRS treats the business for income tax. Each structure has a default, and some can choose another, such as an S corporation.",
    examples: "Reported on your own return, partnership return, S corp or C corp",
    where: "The IRS, plus your state’s tax agency.",
    fact: "tax_status",
    decided: "here",
  },
  {
    id: "licenses",
    title: "Licenses and permits",
    what: "Permission to do your kind of work in your place, such as a food permit or a home business permit.",
    examples: "Sales tax permit, health permit, business license, zoning approval",
    where: "Whichever agencies cover your activity and place. Needed whichever structure you choose.",
    fact: "licenses_separate",
    decided: "later",
  },
];

export interface StructureOption {
  id: BusinessStructure;
  label: string;
  // A few words under the name in the question
  short: string;
  // Who it can fit
  owners: "one" | "several" | "any";
  meaning: Line;
  why: Line[];
  setup: Line[];
  ongoing: (owners: number) => Line[];
  cons: Line[];
}

export const STRUCTURE_OPTIONS: readonly StructureOption[] = [
  {
    id: "sole_proprietorship",
    label: "Sole proprietorship",
    short: "Just you, with no company to form",
    owners: "one",
    meaning: {
      text: "You and the business are the same in the eyes of the law. If you run a business alone and don’t form a company, this is what you are automatically.",
      fact: "sp_automatic",
    },
    why: [
      { text: "Easy to start, and you’re in full control.", fact: "sp_easy" },
      { text: "The SBA calls it a good choice for low-risk businesses and for testing an idea first.", fact: "sp_fit" },
    ],
    setup: [
      { text: "Nothing to file to create it.", fact: "sp_automatic" },
      { text: "Selling under a name that isn’t your legal name? Register it as a trade name (DBA).", fact: "sp_trade_name" },
    ],
    ongoing: () => [
      { text: "Report business profit or loss on your own tax return, on Schedule C.", fact: "sp_schedule_c" },
      { text: "Self-employment tax goes on Schedule SE.", fact: "sp_schedule_se" },
    ],
    cons: [
      { text: "There’s no separate company, so business debts are your own.", fact: "sp_personally_liable" },
      { text: "It can be harder to borrow money or bring in investors.", fact: "sp_money" },
    ],
  },
  {
    id: "partnership",
    label: "General partnership",
    short: "Two or more of you, with no company formed",
    owners: "several",
    meaning: {
      text: "Two or more people running a business together. The IRS treats that relationship as a partnership, even without a filing.",
      fact: "partnership_definition",
    },
    why: [
      { text: "The SBA calls it the simplest way for two or more people to own a business together.", fact: "partnership_simplest" },
      { text: "A fit for groups who want to test an idea first, the SBA says.", fact: "partnership_fit" },
    ],
    setup: [
      { text: "Whether a general partnership registers with the state depends on the state.", fact: "varies_by_state", stateRule: true },
      { text: "Get an EIN: the IRS says a partnership generally needs one. It’s free.", fact: "ein_partnership" },
      { text: "Selling under a name other than your own names? You may need a DBA.", fact: "dba_where" },
      { text: "Write down who does what, how money is split, and what happens if someone leaves.", tip: true },
    ],
    ongoing: () => [
      { text: "The partnership files a yearly information return (Form 1065) but doesn’t pay income tax itself.", fact: "partnership_return" },
      { text: "Each partner reports their share on their own tax return.", fact: "partnership_share" },
    ],
    cons: [{ text: "The SBA lists unlimited personal liability for general partners.", fact: "partnership_liability" }],
  },
  {
    id: "llc",
    label: "Limited liability company (LLC)",
    short: "A company you form with your state",
    owners: "any",
    meaning: { text: "A company you form under your state’s law. Its owners are called members.", fact: "llc_state_law" },
    why: [
      { text: "The SBA says an LLC protects owners from personal liability “in most instances”. That’s not every instance, so ask what wouldn’t be covered.", fact: "llc_liability" },
      { text: "The SBA calls it a fit for medium- or higher-risk businesses and owners with savings to protect.", fact: "llc_fit" },
    ],
    setup: [
      { text: "File articles of organization with your state and pay its fee.", fact: "llc_articles", stateRule: true },
      { text: "Name a registered agent in your state before you file.", fact: "registered_agent" },
      { text: "Write an operating agreement on how decisions and money work.", fact: "operating_agreement" },
      { text: "If you need an EIN, apply after the LLC is formed, not before. It’s free.", fact: "ein_after_forming" },
    ],
    ongoing: (owners) => [
      owners > 1
        ? { text: "For income tax, an LLC with two or more owners is treated as a partnership unless it chooses otherwise.", fact: "llc_multi_tax" }
        : { text: "For income tax, a one-owner LLC goes on your own return unless it chooses otherwise.", fact: "llc_single_tax" },
      { text: "Owners pay self-employment tax.", fact: "llc_self_employment" },
      { text: "Some states require reports soon after you register, and yearly fees vary.", fact: "early_reports", stateRule: true },
    ],
    cons: [
      { text: "State filing fees and ongoing paperwork.", stateRule: true },
      { text: "If an owner joins or leaves, some states may require re-forming it unless your agreement covers that.", fact: "llc_membership_change", only: "co_owners" },
    ],
  },
  {
    id: "corporation",
    label: "Corporation",
    short: "A company owned through shares",
    owners: "any",
    meaning: {
      text: "A company owned through shares. It pays income tax on its own profits, unless it chooses S corporation status.",
      fact: "corp_tax",
    },
    why: [{ text: "The SBA calls it a fit for businesses that need to raise money or plan to be sold.", fact: "corp_fit" }],
    setup: [
      { text: "File articles of incorporation with your state and pay its fee.", fact: "corp_articles", stateRule: true },
      { text: "Name a registered agent in your state before you file.", fact: "registered_agent" },
    ],
    ongoing: () => [
      { text: "More record-keeping and reporting than other structures.", fact: "corp_records" },
      { text: "S corporation status takes a separate IRS filing, Form 2553.", fact: "s_corp_election" },
    ],
    cons: [{ text: "More record-keeping and formal steps.", fact: "corp_records" }],
  },
];

export function structureOption(id: BusinessStructure): StructureOption {
  return STRUCTURE_OPTIONS.find((option) => option.id === id)!;
}

// Options that can fit this many owners
export function optionsFor(owners: number): StructureOption[] {
  return STRUCTURE_OPTIONS.filter((option) => option.owners === "any" || (option.owners === "one") === (owners === 1));
}

// Lines that matter for these answers: co-owner lines only with co-owners now, or maybe later
export function relevantLines(lines: readonly Line[], p: Pick<BusinessProfile, "owners" | "mayAddOwners">): Line[] {
  const coOwners = p.owners.count > 1 || p.mayAddOwners !== "no";
  return lines.filter((line) => line.only !== "co_owners" || coOwners);
}

export interface CompareRow {
  label: string;
  cells: Record<BusinessStructure, Line>;
}

// Short side-by-side cells; each option's card holds the detail
export function compareRows(owners: number): CompareRow[] {
  return [
    {
      label: "Who owns it",
      cells: {
        sole_proprietorship: { text: "Just you", fact: "sp_definition" },
        partnership: { text: "Two or more people", fact: "partnership_definition" },
        llc: { text: "One or more members", fact: "llc_members" },
        corporation: { text: "Shareholders" },
      },
    },
    {
      label: "To start it",
      cells: {
        sole_proprietorship: { text: "Nothing to file", fact: "sp_automatic" },
        partnership: { text: "Depends on your state", fact: "varies_by_state", stateRule: true },
        llc: { text: "File with your state and pay its fee", fact: "llc_articles", stateRule: true },
        corporation: { text: "File with your state and pay its fee", fact: "corp_articles", stateRule: true },
      },
    },
    {
      label: "If the business owes money",
      cells: {
        sole_proprietorship: { text: "You’re personally responsible", fact: "sp_personally_liable" },
        partnership: { text: "Unlimited personal liability for general partners", fact: "partnership_liability" },
        llc: { text: "You’re protected “in most instances”", fact: "llc_liability" },
        corporation: { text: "It’s a legal entity separate from its owners", fact: "corp_separate" },
      },
    },
    {
      label: "Income tax",
      cells: {
        sole_proprietorship: { text: "On your own return (Schedule C)", fact: "sp_schedule_c" },
        partnership: { text: "Partnership return; each partner reports a share", fact: "partnership_return" },
        llc: owners > 1 ? { text: "Like a partnership, by default", fact: "llc_multi_tax" } : { text: "On your own return, by default", fact: "llc_single_tax" },
        corporation: { text: "Pays its own, unless it chooses S corp status", fact: "corp_tax" },
      },
    },
    {
      label: "To keep it up",
      cells: {
        sole_proprietorship: { text: "No company to keep up", fact: "sp_not_separate" },
        partnership: { text: "A yearly partnership return", fact: "partnership_return" },
        llc: { text: "State reports and fees vary", fact: "early_reports", stateRule: true },
        corporation: { text: "The most record-keeping and reporting", fact: "corp_records" },
      },
    },
    {
      label: "A good fit for",
      cells: {
        sole_proprietorship: { text: "Low-risk businesses, and testing an idea", fact: "sp_fit" },
        partnership: { text: "Several owners testing an idea", fact: "partnership_fit" },
        llc: { text: "Medium- or higher-risk businesses, and owners with savings to protect", fact: "llc_fit" },
        corporation: { text: "Raising money, or selling the business later", fact: "corp_fit" },
      },
    },
  ];
}

// How business names work, for the name part of the guide
export const NAME_POINTS: readonly Line[] = [
  { text: "Doing business as yourself, under your own legal name? You don’t need to register a name.", fact: "legal_name_no_registration" },
  { text: "Selling under another name? That’s a DBA (“doing business as”), also called a trade, assumed or fictitious name.", fact: "dba_where" },
  { text: "Most states require registering a DBA, with the state, county or city. Registering doesn’t protect the name by itself.", fact: "dba_no_protection" },
  { text: "A company’s registered name is how the state knows it.", fact: "entity_name" },
  { text: "A DBA also lets a company sell under a name other than its registered one.", fact: "dba_different_identity" },
];

// Other tax statuses, folded away unless worth asking about now
export function otherTaxPoints(owners: number): Line[] {
  return [
    { text: "S corp isn’t strictly a structure, the SBA says, but a tax status. An LLC can be taxed as an S corp or a C corp.", fact: "tax_status" },
    { text: "An LLC that wants to be taxed as a corporation files Form 8832 with the IRS.", fact: owners > 1 ? "llc_multi_tax" : "llc_single_tax" },
    { text: "A corporation becomes an S corporation by filing Form 2553, signed by all its shareholders.", fact: "s_corp_election" },
  ];
}

// Self-employment tax for the options shown, and the married couples' choice when it applies
export function taxPoints(options: readonly BusinessStructure[], spouses: boolean): Line[] {
  const lines: Line[] = [];
  if (options.includes("sole_proprietorship")) lines.push({ text: "Sole proprietors who owe self-employment tax file it on Schedule SE.", fact: "sp_schedule_se" });
  if (options.includes("llc")) lines.push({ text: "LLC members pay self-employment tax too, toward Social Security and Medicare.", fact: "llc_self_employment" });
  if (spouses) lines.push({ text: "Married couples may choose not to be treated as a partnership. Ask a tax professional whether that fits you.", fact: "married_couples" });
  return lines;
}
