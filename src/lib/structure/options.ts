import type { BusinessStructure } from "@/lib/domain";
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
}

export type AreaId = "ownership" | "name" | "tax" | "licenses";

export interface Area {
  id: AreaId;
  title: string;
  what: string;
  examples: string;
  where: string;
  fact: FactId;
}

export const AREAS: readonly Area[] = [
  {
    id: "ownership",
    title: "Ownership structure",
    what: "Who owns the business, and whether it’s a company separate from you.",
    examples: "Sole proprietorship, partnership, LLC, corporation",
    where: "Companies such as LLCs are formed with your state. A sole proprietorship or partnership can start without forming anything.",
    fact: "varies_by_state",
  },
  {
    id: "name",
    title: "Business name registration",
    what: "Registering the name you sell under. A DBA (“doing business as”) is a name, not a structure: it doesn’t create a company.",
    examples: "DBA, trade name, assumed name, fictitious name",
    where: "Your state, county or city, depending on where you are.",
    fact: "dba_no_protection",
  },
  {
    id: "tax",
    title: "Tax treatment",
    what: "How the IRS treats the business for income tax. Each structure has a default, and some can choose another, such as an S corporation.",
    examples: "Reported on your own return, partnership return, S corp or C corp",
    where: "The IRS, plus your state’s tax agency.",
    fact: "tax_status",
  },
  {
    id: "licenses",
    title: "Licenses and permits",
    what: "Permission to do your kind of work in your place, such as a food permit or a home business permit.",
    examples: "Sales tax permit, health permit, business license, zoning approval",
    where: "Whichever agencies cover your activity and place. Needed whichever structure you choose.",
    fact: "licenses_separate",
  },
];

export interface StructureOption {
  id: BusinessStructure;
  label: string;
  // Who it can fit
  owners: "one" | "several" | "any";
  meaning: Line;
  why: Line[];
  setup: Line[];
  ongoing: (owners: number) => Line[];
  pros: Line[];
  cons: Line[];
}

export const STRUCTURE_OPTIONS: readonly StructureOption[] = [
  {
    id: "sole_proprietorship",
    label: "Sole proprietorship",
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
    pros: [{ text: "Simple to start and run, with no company to keep up.", fact: "sp_easy" }],
    cons: [
      { text: "There’s no separate company, so business debts are your own.", fact: "sp_not_separate" },
      { text: "It can be harder to borrow money or bring in investors.", fact: "sp_money" },
    ],
  },
  {
    id: "partnership",
    label: "General partnership",
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
    pros: [{ text: "Simple to start together.", fact: "partnership_simplest" }],
    cons: [{ text: "The SBA lists unlimited personal liability for general partners.", fact: "partnership_liability" }],
  },
  {
    id: "llc",
    label: "Limited liability company (LLC)",
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
    pros: [{ text: "Separate from you on paper, with protection in most instances.", fact: "llc_liability" }],
    cons: [
      { text: "State filing fees and ongoing paperwork.", stateRule: true },
      { text: "If an owner joins or leaves, some states may require re-forming it unless your agreement covers that.", fact: "llc_membership_change" },
    ],
  },
  {
    id: "corporation",
    label: "Corporation",
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
    pros: [{ text: "Can sell shares to raise money.", fact: "corp_fit" }],
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
