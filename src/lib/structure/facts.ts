// Federal facts behind the structure explanations, each with a word-for-word quote from an official page.
// Quotes were checked against the pages on CHECKED_ON (facts.test.ts re-checks saved copies of the page text).
// State rules and fees never come from here: they come from the owner's own research, or say they need confirming.

export const CHECKED_ON = "2026-10-27";

export interface FactSource {
  title: string;
  url: string;
}

export const FACT_SOURCES = {
  "sba-business-structure": { title: "SBA: Choose a business structure", url: "https://www.sba.gov/counseling/launch-your-business/#business-structure" },
  "sba-business-name": { title: "SBA: Choose your business name", url: "https://www.sba.gov/counseling/launch-your-business/#business-name" },
  "sba-register-business": { title: "SBA: Register your business", url: "https://www.sba.gov/counseling/launch-your-business/#register-business" },
  "sba-tax-ids": { title: "SBA: Get federal and state tax ID numbers", url: "https://www.sba.gov/counseling/launch-your-business/#tax-ids" },
  "irs-llc": { title: "IRS: Limited liability company (LLC)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc" },
  "irs-sole-prop": { title: "IRS: Sole proprietorships", url: "https://www.irs.gov/businesses/small-businesses-self-employed/sole-proprietorships" },
  "irs-partnerships": { title: "IRS: Partnerships", url: "https://www.irs.gov/businesses/partnerships" },
  "irs-s-corp": { title: "IRS: S corporations", url: "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporations" },
  "irs-ein": { title: "IRS: Get an employer identification number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number" },
} as const satisfies Record<string, FactSource>;

export type FactSourceId = keyof typeof FACT_SOURCES;

export interface Fact {
  source: FactSourceId;
  quote: string;
}

export const FACTS = {
  sp_automatic: {
    source: "sba-business-structure",
    quote: "You’re automatically considered to be a sole proprietorship if you do business activities but don’t register as any other kind of business.",
  },
  sp_not_separate: {
    source: "sba-business-structure",
    quote: "Sole proprietorships do not produce a separate business entity. This means your business assets and liabilities are not separate from your personal assets and liabilities.",
  },
  sp_easy: { source: "sba-business-structure", quote: "A sole proprietorship is easy to form and gives you complete control of your business." },
  sp_money: {
    source: "sba-business-structure",
    quote: "It can also be hard to raise money because you can’t sell stock, and banks are hesitant to lend to sole proprietorships.",
  },
  sp_schedule_se: { source: "irs-sole-prop", quote: "Schedule SE (Form 1040), Self-Employment Tax" },
  sp_trade_name: { source: "sba-business-structure", quote: "Sole proprietors are still able to get a trade name." },
  sp_fit: {
    source: "sba-business-structure",
    quote: "Sole proprietorships can be a good choice for low-risk businesses and owners who want to test their business idea before forming a more formal business.",
  },
  sp_definition: { source: "irs-sole-prop", quote: "A sole proprietor is someone who owns an unincorporated business by themselves." },
  sp_schedule_c: { source: "irs-sole-prop", quote: "Schedule C (Form 1040 or 1040-SR), Profit or Loss from Business" },
  partnership_simplest: {
    source: "sba-business-structure",
    quote: "Partnerships are the simplest structure for two or more people to own a business together.",
  },
  partnership_fit: {
    source: "sba-business-structure",
    quote: "Partnerships can be a good choice for businesses with multiple owners, professional groups (like attorneys), and groups who want to test their business idea before forming a more formal business.",
  },
  partnership_definition: { source: "irs-partnerships", quote: "A partnership is the relationship between two or more people to do trade or business." },
  partnership_return: {
    source: "irs-partnerships",
    quote: "A partnership must file an annual information return to report the income, deductions, gains, losses, etc., from its operations, but it does not pay income tax.",
  },
  partnership_share: {
    source: "irs-partnerships",
    quote: "Each partner reports their share of the partnership's income or loss on their personal tax return.",
  },
  partnership_liability: { source: "sba-business-structure", quote: "Unlimited personal liability unless structured as a limited partnership" },
  ein_partnership: { source: "irs-ein", quote: "Operate a partnership or corporation" },
  married_couples: { source: "irs-partnerships", quote: "Married couples may choose not to be a partnership" },
  llc_state_law: { source: "irs-llc", quote: "A Limited Liability Company (LLC) is a business structure allowed by state statute." },
  llc_liability: { source: "sba-business-structure", quote: "LLCs protect you from personal liability in most instances" },
  llc_self_employment: {
    source: "sba-business-structure",
    quote: "However, members of an LLC are considered self-employed and must pay self-employment tax contributions towards Medicare and Social Security.",
  },
  llc_membership_change: {
    source: "sba-business-structure",
    quote: "When a member joins or leaves an LLC, some states may require the LLC to be dissolved and re-formed with new membership — unless there’s already an agreement in place within the LLC for buying, selling, and transferring ownership.",
  },
  llc_fit: {
    source: "sba-business-structure",
    quote: "LLCs can be a good choice for medium- or higher-risk businesses, owners with significant personal assets they want protected, and owners who want to pay a lower tax rate than they would with a corporation.",
  },
  llc_single_tax: {
    source: "irs-llc",
    quote: "For income tax purposes, an LLC with only one member is treated as an entity disregarded as separate from its owner, unless it files Form 8832 and elects to be treated as a corporation.",
  },
  llc_multi_tax: {
    source: "irs-llc",
    quote: "a domestic LLC with at least two members is classified as a partnership for federal income tax purposes unless it files Form 8832 and affirmatively elects to be treated as a corporation.",
  },
  llc_articles: { source: "sba-register-business", quote: "Articles of organization is a simple document that describes the basics of your LLC." },
  operating_agreement: {
    source: "sba-register-business",
    quote: "An operating agreement describes the structure of your company’s financial and functional decisions.",
  },
  registered_agent: {
    source: "sba-register-business",
    quote: "If your business is an LLC, corporation, partnership, or nonprofit corporation, you’ll need a registered agent in your state before you file.",
  },
  early_reports: {
    source: "sba-register-business",
    quote: "Some states require you to provide reports soon after registering depending on your business structure.",
  },
  legal_name_no_registration: {
    source: "sba-register-business",
    quote: "If you conduct business as yourself using your legal name, you won’t need to register anywhere.",
  },
  corp_records: {
    source: "sba-business-structure",
    quote: "Corporations also require more extensive record-keeping, operational processes, and reporting.",
  },
  corp_articles: {
    source: "sba-register-business",
    quote: "The articles of incorporation — or a certificate of incorporation — is a comprehensive legal document that lays out the basic outline of your business.",
  },
  corp_tax: { source: "sba-business-structure", quote: "Unlike sole proprietors, partnerships, and LLCs, corporations pay income tax on their profits." },
  corp_fit: {
    source: "sba-business-structure",
    quote: "Corporations can be a good choice for medium- or higher-risk businesses, those that need to raise money, and businesses that plan to “go public” or eventually be sold.",
  },
  tax_status: {
    source: "sba-business-structure",
    quote: "Designations like S corp and nonprofit aren’t strictly business structures — they can also be understood as a tax status. It’s possible for an LLC to be taxed as a C corp, S corp, or a nonprofit.",
  },
  s_corp_election: {
    source: "irs-s-corp",
    quote: "In order to become an S corporation, the corporation must submit Form 2553, Election by a Small Business Corporation signed by all the shareholders.",
  },
  convert_later: {
    source: "sba-business-structure",
    quote: "While you may convert to a different business structure in the future, there may be restrictions based on your location.",
  },
  varies_by_state: {
    source: "sba-business-structure",
    quote: "ownership rules, liability, taxes, and filing requirements for each business structure can vary by state",
  },
  dba_no_protection: {
    source: "sba-business-name",
    quote: "Registering your DBA name doesn’t provide legal protection by itself, but most states require you to register your DBA if you use one.",
  },
  dba_where: {
    source: "sba-business-name",
    quote: "You might need to register your DBA — also known as a trade name, fictitious name, or assumed name — with the state, county, or city your business is located in.",
  },
  names_independent: { source: "sba-business-name", quote: "Each of these name registrations are legally independent." },
  entity_name: { source: "sba-business-name", quote: "Your entity name is how the state identifies your business." },
  ein_free: { source: "irs-ein", quote: "You never have to pay a fee for an EIN." },
  ein_after_forming: {
    source: "irs-ein",
    quote: "If you are creating a corporation or LLC, form your entity through the secretary of state before you apply for an EIN.",
  },
  sba_counseling: {
    source: "sba-business-structure",
    quote: "the U.S. Small Business Administration (SBA) provides counseling services through our resource partner network.",
  },
  licenses_separate: {
    source: "sba-business-structure",
    quote: "Most businesses will also need to get a tax ID number and file for the appropriate licenses and permits.",
  },
} as const satisfies Record<string, Fact>;

export type FactId = keyof typeof FACTS;

export function factSource(id: FactId): FactSource & { id: FactSourceId } {
  const source = FACTS[id].source;
  return { id: source, ...FACT_SOURCES[source] };
}
