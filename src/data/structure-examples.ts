import type { BusinessStructure } from "@/lib/domain";
import type { FactId } from "@/lib/structure/facts";

// Made-up businesses for "Show me examples": first names only, no fees or deadlines.
// Every claim rests on the listed facts, or is written generally ("with their state").

export type ExampleTopic = "ownership" | "name" | "tax";
export type ExampleKind = "food" | "handmade" | "services" | "resale";
// The name situation a name example shows
export type NameCase = "legal_name" | "dba" | "entity_dba";

export interface StructureExample {
  id: string;
  topic: ExampleTopic;
  structure: BusinessStructure;
  owners: "one" | "several";
  kind: ExampleKind;
  nameCase?: NameCase;
  // Only shown when the owner should ask about another tax status
  otherTaxStatus?: true;
  people: string[];
  title: string;
  story: string[];
  takeaway: string;
  facts: FactId[];
}

export const STRUCTURE_EXAMPLES: readonly StructureExample[] = [
  {
    id: "sp-baker",
    topic: "ownership",
    structure: "sole_proprietorship",
    owners: "one",
    kind: "food",
    people: ["Dana"],
    title: "Dana bakes for a Saturday market",
    story: [
      "Dana bakes cookies and bread and sells them at a weekend farmers market.",
      "She’s the only owner, has no lease or loan, and wants to see what sells first.",
      "She doesn’t form a company: running the business on her own makes her a sole proprietor.",
      "She still checks which food permits apply. That’s a separate step.",
    ],
    takeaway: "Dana can be held personally liable for the business’s debts. She plans to look at an LLC if she signs a lease or hires help.",
    facts: ["sp_automatic", "licenses_separate", "sp_personally_liable", "sp_fit"],
  },
  {
    id: "sp-dog-walker",
    topic: "ownership",
    structure: "sole_proprietorship",
    owners: "one",
    kind: "services",
    people: ["Theo"],
    title: "Theo walks dogs after work",
    story: [
      "Theo walks dogs for neighbors in the evenings and on weekends.",
      "He works alone, with no employees, no shop and no loan.",
      "He doesn’t form a company, and reports his profit on his own tax return, on Schedule C.",
    ],
    takeaway: "It’s simple to run, but Theo can be held personally liable for the business’s debts.",
    facts: ["sp_automatic", "sp_schedule_c", "sp_personally_liable"],
  },
  {
    id: "llc-caterer",
    topic: "ownership",
    structure: "llc",
    owners: "one",
    kind: "food",
    people: ["Priya"],
    title: "Priya caters from a rented kitchen",
    story: [
      "Priya caters office lunches and is signing a lease on a commercial kitchen.",
      "She plans to hire a helper, so she forms an LLC with her state and pays its fee.",
      "She names a registered agent before filing, and applies for a free EIN after the LLC is formed.",
      "With one owner, the LLC’s profit goes on her own tax return by default.",
    ],
    takeaway: "The SBA says an LLC protects owners “in most instances”, so she asks a lawyer what it wouldn’t cover.",
    facts: ["llc_fit", "llc_articles", "registered_agent", "ein_after_forming", "ein_free", "llc_single_tax", "llc_liability"],
  },
  {
    id: "llc-woodworker",
    topic: "ownership",
    structure: "llc",
    owners: "one",
    kind: "handmade",
    people: ["Marcus"],
    title: "Marcus builds furniture in a rented shop",
    story: [
      "Marcus builds tables to order, rents a workshop and buys lumber on credit.",
      "He forms an LLC with his state, and writes a short operating agreement on how money and decisions work.",
      "As an LLC member, he still pays self-employment tax.",
    ],
    takeaway: "His state may ask for reports soon after he registers, so he checks its rules before filing.",
    facts: ["llc_fit", "llc_articles", "operating_agreement", "llc_self_employment", "early_reports"],
  },
  {
    id: "partnership-lawn-care",
    topic: "ownership",
    structure: "partnership",
    owners: "several",
    kind: "services",
    people: ["Jordan", "Sam"],
    title: "Jordan and Sam start a lawn care business",
    story: [
      "Two friends, Jordan and Sam, each bring a mower and split the work and the profit.",
      "They don’t form a company, so the IRS treats them as a partnership. Whether they register it depends on their state.",
      "They get a free EIN, and write down who does what and what happens if one of them leaves.",
    ],
    takeaway:
      "They weighed an LLC too. The SBA lists unlimited personal liability for general partners, so they plan to form an LLC before they buy a truck on credit, and to ask a lawyer what it wouldn’t cover.",
    facts: ["partnership_contributes", "partnership_definition", "varies_by_state", "ein_partnership", "ein_free", "partnership_liability"],
  },
  {
    id: "llc-food-truck",
    topic: "ownership",
    structure: "llc",
    owners: "several",
    kind: "food",
    people: ["Lena", "Rosa"],
    title: "Lena and Rosa buy a food truck",
    story: [
      "Sisters Lena and Rosa buy a used food truck with a loan and plan to hire weekend help.",
      "They form an LLC with their state, name a registered agent, and write an operating agreement.",
      "The agreement covers buying out an owner who wants to leave.",
    ],
    takeaway: "Without that agreement, some states may require an LLC to be dissolved and re-formed when an owner leaves.",
    facts: ["llc_fit", "llc_articles", "registered_agent", "operating_agreement", "llc_membership_change"],
  },
  {
    id: "llc-cleaning",
    topic: "ownership",
    structure: "llc",
    owners: "several",
    kind: "services",
    people: ["Ana", "Luis"],
    title: "Ana and Luis sign a lease for a cleaning business",
    story: [
      "Ana and Luis are starting a cleaning business together and will sign a lease on a small office.",
      "They form an LLC with their state rather than run as a partnership.",
      "By default, the IRS still treats their two-owner LLC as a partnership for income tax.",
    ],
    takeaway: "The SBA says an LLC protects owners “in most instances”. It doesn’t change how they’re taxed by default.",
    facts: ["llc_articles", "llc_multi_tax", "llc_liability"],
  },
  {
    id: "corp-investors",
    topic: "ownership",
    structure: "corporation",
    owners: "several",
    kind: "food",
    people: ["Kai", "June"],
    title: "Kai and June plan to raise money from investors",
    story: [
      "Kai and June make packaged snacks and want investors to fund a bigger kitchen.",
      "They file articles of incorporation with their state and name a registered agent.",
      "The corporation pays income tax on its own profits.",
    ],
    takeaway: "It means more record-keeping and reporting than the other structures.",
    facts: ["corp_fit", "corp_articles", "registered_agent", "corp_tax", "corp_records"],
  },
  {
    id: "corp-solo",
    topic: "ownership",
    structure: "corporation",
    owners: "one",
    kind: "handmade",
    people: ["Nora"],
    title: "Nora plans to sell shares to investors",
    story: [
      "Nora makes a line of skin care products and is the only owner.",
      "She wants to raise money by selling shares, so she files articles of incorporation with her state.",
      "She names a registered agent before filing. The corporation pays income tax on its own profits.",
    ],
    takeaway: "It means more record-keeping and reporting than the other structures.",
    facts: ["corp_fit", "corp_articles", "registered_agent", "corp_tax", "corp_records"],
  },
  {
    id: "name-dba-candles",
    topic: "name",
    structure: "sole_proprietorship",
    owners: "one",
    kind: "handmade",
    nameCase: "dba",
    people: ["Maria"],
    title: "Maria sells candles as “Quiet Hour Candles”",
    story: [
      "Maria makes candles and sells them at craft fairs under the name “Quiet Hour Candles”.",
      "That isn’t her legal name, so she registers it as a DBA, also called an assumed or trade name.",
      "Depending on where her business is located, that’s with her state, county or city.",
      "The DBA doesn’t create a company. She’s still a sole proprietor.",
    ],
    takeaway: "A DBA doesn’t protect the name by itself. With a DBA and an EIN, she can open a business bank account.",
    facts: ["dba_where", "sp_trade_name", "dba_no_protection", "dba_bank_account"],
  },
  {
    id: "name-dba-partners",
    topic: "name",
    structure: "partnership",
    owners: "several",
    kind: "services",
    nameCase: "dba",
    people: ["Jordan", "Sam"],
    title: "Jordan and Sam work as “Green Corner Lawn Care”",
    story: [
      "Jordan and Sam want customers to see one business name, not their own two names.",
      "That name isn’t either owner’s legal name, so it’s a DBA. Most states require registering one.",
      "Depending on where their business is located, that’s with their state, county or city.",
    ],
    takeaway: "Registering the name doesn’t protect it by itself, and it doesn’t create a company.",
    facts: ["dba_no_protection", "dba_where"],
  },
  {
    id: "name-legal",
    topic: "name",
    structure: "sole_proprietorship",
    owners: "one",
    kind: "services",
    nameCase: "legal_name",
    people: ["Theo"],
    title: "Theo uses his own name",
    story: [
      "Theo puts his own first and last name on his flyers and invoices.",
      "He does business as himself, under his legal name, so he doesn’t need to register a name.",
    ],
    takeaway: "If he starts calling it “Evening Dog Walks”, that’s a different name, and most states require registering it as a DBA.",
    facts: ["legal_name_no_registration", "dba_no_protection"],
  },
  {
    id: "name-entity-dba",
    topic: "name",
    structure: "llc",
    owners: "one",
    kind: "food",
    nameCase: "entity_dba",
    people: ["Priya"],
    title: "Priya’s LLC sells under a second name",
    story: [
      "Priya’s company is registered with her state as “Northside Kitchen LLC”. That’s how the state knows it.",
      "She wants to cater weddings as “Saffron Table”, so she registers that as a DBA for the LLC.",
    ],
    takeaway: "Each name registration is legally separate, the SBA says. The DBA doesn’t create a second company.",
    facts: ["entity_name", "dba_different_identity", "names_independent"],
  },
  {
    id: "tax-sp",
    topic: "tax",
    structure: "sole_proprietorship",
    owners: "one",
    kind: "food",
    people: ["Dana"],
    title: "Dana’s taxes as a sole proprietor",
    story: [
      "Dana reports her market profit on her own tax return, on Schedule C.",
      "Self-employment tax, if she owes it, goes on Schedule SE.",
    ],
    takeaway: "If she forms an LLC later, it can choose another tax status, such as S corp.",
    facts: ["sp_schedule_c", "sp_schedule_se", "tax_status"],
  },
  {
    id: "tax-llc-one",
    topic: "tax",
    structure: "llc",
    owners: "one",
    kind: "handmade",
    people: ["Marcus"],
    title: "Marcus keeps his LLC’s default",
    story: [
      "With one owner, Marcus’s LLC goes on his own tax return by default.",
      "He pays self-employment tax as a member.",
      "He could ask the IRS to tax it as a corporation with Form 8832, but he keeps the default.",
    ],
    takeaway: "Keeping the default means no Form 8832 to file.",
    facts: ["llc_single_tax", "llc_self_employment"],
  },
  {
    id: "tax-partners",
    topic: "tax",
    structure: "partnership",
    owners: "several",
    kind: "services",
    people: ["Jordan", "Sam"],
    title: "Jordan and Sam file a partnership return",
    story: [
      "Each year their partnership files an information return, but it doesn’t pay income tax itself.",
      "Jordan and Sam each report their share of the profit on their own tax returns.",
    ],
    takeaway: "If they form an LLC later, the IRS treats a two-owner LLC as a partnership by default too.",
    facts: ["partnership_return", "partnership_share", "llc_multi_tax"],
  },
  {
    id: "tax-llc-several",
    topic: "tax",
    structure: "llc",
    owners: "several",
    kind: "food",
    people: ["Lena", "Rosa"],
    title: "Lena and Rosa’s LLC is taxed like a partnership",
    story: [
      "By default, the IRS treats Lena and Rosa’s two-owner LLC as a partnership.",
      "Each of them reports a share of the profit on her own tax return.",
    ],
    takeaway: "They could choose to be taxed as a corporation instead, which takes Form 8832.",
    facts: ["llc_multi_tax", "partnership_share"],
  },
  {
    id: "tax-s-corp",
    topic: "tax",
    structure: "llc",
    owners: "one",
    kind: "food",
    otherTaxStatus: true,
    people: ["Priya"],
    title: "Priya asks about S corporation status",
    story: [
      "Two years in, Priya’s catering sales have grown a lot.",
      "She asks a tax professional whether her LLC should be taxed as an S corporation.",
    ],
    takeaway: "The SBA calls S corp a tax status, not strictly a structure. Her company would stay an LLC.",
    facts: ["tax_status"],
  },
  {
    id: "tax-s-corp-partners",
    topic: "tax",
    structure: "llc",
    owners: "several",
    kind: "food",
    otherTaxStatus: true,
    people: ["Lena", "Rosa"],
    title: "Lena and Rosa ask about S corporation status",
    story: [
      "Their food truck’s sales have grown a lot since they formed their LLC.",
      "Lena and Rosa ask a tax professional whether the LLC should be taxed as an S corporation.",
    ],
    takeaway: "The SBA calls S corp a tax status, not strictly a structure. Their company would stay an LLC.",
    facts: ["tax_status"],
  },
];
