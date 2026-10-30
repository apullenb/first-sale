import type { MarketingPlatformId } from "@/data/marketing-platforms";
import type { BrandBrief } from "@/lib/brand/types";
import type { DetailKey } from "@/lib/details";
import type { PlanAnswerInput } from "@/lib/documents/business-plan";
import type { PlanStepFact } from "@/lib/documents/plan-facts";
import type { DocumentField, DocumentPage } from "@/lib/documents/types";
import { type BusinessProfile, businessProfileSchema, type JurisdictionLevel } from "@/lib/domain";
import type { IntakeSuggestion } from "@/lib/intake/suggestion-schema";
import type { MarketingIntake } from "@/lib/marketing/intake";
import type { VerifiedRequirement } from "@/lib/research/verify";
import type { PlatformId } from "@/lib/website/types";

// Business profiles for the benchmark, each with the inputs every AI task needs and the answers its grader expects.
// All four are in Austin, Texas, so research is graded against the saved Texas, Travis County and Austin pages.

// A scalar the description states, or any of a few readings that are fair
export type Expect<T> = T | { oneOf: T[] };
// A list: every `must` item, and nothing beyond `must` and `may`
export interface ExpectList<T> {
  must: T[];
  may?: T[];
}

export interface IntakeExpectation {
  category: Expect<IntakeSuggestion["category"]>;
  state: Expect<IntakeSuggestion["state"]>;
  owners: Expect<IntakeSuggestion["owners"]>;
  stage: Expect<IntakeSuggestion["stage"]>;
  registeredAs: Expect<IntakeSuggestion["registeredAs"]>;
  offeringKinds: ExpectList<IntakeSuggestion["offeringKinds"][number]>;
  channels: ExpectList<IntakeSuggestion["channels"][number]>;
  premises: Expect<IntakeSuggestion["premises"]>;
}

// A requirement the saved official pages support, matched by its key or title (and level, when given)
export interface ExpectedRequirement {
  id: string;
  pattern: RegExp;
  level?: JurisdictionLevel;
}

export interface ReceivedExpectation {
  stepKey: string | null;
  notGovernment: boolean;
  // Deadlines the to-do list should carry, exactly as printed
  deadlines: string[];
  // ID numbers on the page that must never be repeated
  idNumbers: string[];
}

export interface BenchCase {
  id: string;
  label: string;
  profile: BusinessProfile;
  details: { key: DetailKey; value: string }[];
  intake: { description: string; expected: IntakeExpectation };
  research: {
    expected: ExpectedRequirement[];
    // Fine to list, but not required
    allowed: ExpectedRequirement[];
    // Expected requirements that hang on a "Not sure" answer, so they must not show as verified
    unsure: string[];
  };
  brief: BrandBrief;
  plan: { answers: PlanAnswerInput[]; steps: PlanStepFact[] };
  marketing: MarketingIntake;
  bios: { want: MarketingPlatformId[] };
  website: { platform: PlatformId; explain: PlatformId };
  received: { pages: DocumentPage[]; steps: { key: string; title: string }[]; expected: ReceivedExpectation };
  form: { question: string; onForm: boolean; mentions: string[] };
  // Words drawn in the synthetic logo; misspelled ones should not pass the lettering check
  logo: { drawn: string; color: string; versionColor: string };
  photo: { label: string; jarColor: string; editedLabel: string };
}

// Requirement patterns shared across cases
const R = {
  foodHandler: { id: "food-handler", pattern: /handler|food safety (training|education|course)|training/i, level: "state" },
  cottageLabels: { id: "cottage-labels", pattern: /label/i, level: "state" },
  cottageRegistration: { id: "cottage-registration", pattern: /(cottage|dshs|food|licensing).*regist|regist.*(cottage|dshs|food|licensing)|registry/i, level: "state" },
  cottageFood: { id: "cottage-food", pattern: /cottage|home.?(made|kitchen).*food|food.*home/i, level: "state" },
  salesTax: { id: "sales-tax-permit", pattern: /sales.{0,10}tax/i, level: "state" },
  assumedCounty: { id: "assumed-name-county", pattern: /assumed|\bdba\b|doing business|business name/i, level: "county" },
  assumedState: { id: "assumed-name-state", pattern: /assumed|\bdba\b|doing business|business name/i, level: "state" },
  llc: { id: "llc-formation", pattern: /\bllc\b|formation|form (an|your)/i, level: "state" },
  franchise: { id: "franchise-tax", pattern: /franchise/i, level: "state" },
  ein: { id: "ein", pattern: /\bein\b|employer identification/i },
  home: { id: "home-business", pattern: /home.?(based|business|occupation)|zoning|from home/i, level: "city" },
  structure: { id: "structure", pattern: /structure/i },
  employer: { id: "employer", pattern: /employ|hir(e|ing)|payroll|unemployment|workers/i },
  otherStates: { id: "other-states-tax", pattern: /other states|out.of.state|outside texas/i },
  license: { id: "business-license", pattern: /business license|general license|license/i },
  vendor: { id: "vendor-permit", pattern: /vendor|market|event/i },
} satisfies Record<string, ExpectedRequirement>;

const AUSTIN = { state: "TX" as const, county: "Travis", city: "Austin" };

// Every case fills in what it sells and how; the schema then checks the whole profile
const BLANK_PROFILE = {
  name: null,
  description: "",
  country: "US",
  location: { ...AUSTIN, insideCityLimits: "yes" },
  owners: { count: 1 },
  stage: null,
  registeredAs: null,
  offeringKinds: [],
  firstItems: "",
  foodNeedsCold: null,
  channels: [],
  shipsOrders: null,
  premises: null,
  customersVisit: null,
  startupBudget: null,
  hiringPlans: null,
  experience: null,
  launchTiming: null,
};

const profile = (overrides: Partial<BusinessProfile>): BusinessProfile => businessProfileSchema.parse({ ...BLANK_PROFILE, ...overrides });

const brief = (overrides: Partial<BrandBrief> & Pick<BrandBrief, "name" | "sells" | "vibes">): BrandBrief => ({
  tagline: "",
  customers: "",
  leanings: { era: null, tone: null, energy: null, finish: null },
  colors: [],
  likedColors: "",
  avoidColors: "",
  symbolIdea: "",
  avoid: "",
  logoKinds: [],
  logoLikes: "",
  story: "",
  storyByOwner: false,
  storyApproved: false,
  ...overrides,
});

// Test form modeled on Texas Form 503 (Assumed Name Certificate); not the official text
export const FORM_PAGES: DocumentPage[] = [
  {
    number: 1,
    text: [
      "Assumed Name Certificate",
      "Form 503",
      "Secretary of State",
      "P.O. Box 13697",
      "Austin, TX 78711-3697",
      "Filing Fee: $25",
      "1. The assumed name under which the business or professional service is, or is to be, conducted or rendered is:",
      "Assumed name: ______________________",
      "2. The legal name of the entity filing the assumed name is:",
      "Legal name of entity: ______________________",
      "3. The file number, if any, issued to the entity by the secretary of state is:",
      "File number: ____________",
      "4. The county or counties where business or professional services are being or are to be conducted or rendered under the assumed name:",
      "County or counties: ______________________",
      "5. The address of the principal office of the entity:",
      "Street address: ______________________",
      "City: ____________ State: ____ ZIP code: ________",
      "7a. The period during which the assumed name will be used is 10 years from the date of filing with the secretary of state.",
      "Execution",
      "The undersigned signs this document subject to the penalties imposed by law for the submission of a materially false or fraudulent instrument.",
      "Date: ____________",
      "Signature of authorized person: ______________________",
      "Printed name of authorized person: ______________________",
    ].join("\n"),
  },
];

// The form's blanks as the reader would list them, so later tasks don't depend on how well it found them
export const FORM_FIELDS: DocumentField[] = [
  ["Assumed name", "Assumed name:", "text"],
  ["Legal name of entity", "Legal name of entity:", "text"],
  ["File number", "File number:", "text"],
  ["County or counties", "County or counties:", "text"],
  ["Street address", "Street address:", "text"],
  ["City", "City:", "text"],
  ["State", "State:", "text"],
  ["ZIP code", "ZIP code:", "text"],
  ["Date", "Date:", "date"],
  ["Signature of authorized person", "Signature of authorized person:", "signature"],
  ["Printed name of authorized person", "Printed name of authorized person:", "text"],
].map(([label, printedText, kind], index) => ({
  id: `f${index + 1}`,
  label,
  page: 1,
  kind: kind as DocumentField["kind"],
  options: [],
  printedText,
  confidence: "high",
  fillable: false,
}));

// Which saved fact each blank should be drafted from; null means it stays blank
export const FORM_DRAFT_EXPECTED: Record<string, string | null> = {
  f1: "profile.name",
  f2: null,
  f3: null,
  f4: "profile.county",
  f5: null,
  f6: "profile.city",
  f7: "profile.state",
  f8: null,
  f9: null,
  f10: null,
  f11: null,
};

const page = (lines: string[]): DocumentPage[] => [{ number: 1, text: lines.join("\n") }];

export const CASES: BenchCase[] = [
  {
    id: "home-bakery",
    label: "One-owner home bakery, Austin TX",
    // The baker from the app's research journey tests
    profile: profile({
      name: "Rise Bakery",
      nameIsLegalName: "no",
      category: "baked_goods",
      productTags: ["cookies", "breads"],
      firstItems: "Cookies and bread",
      location: { ...AUSTIN, insideCityLimits: "yes" },
      offeringKinds: ["food"],
      foodNeedsCold: "unsure",
      channels: ["in_person", "social_media"],
      handoff: ["pickup_home"],
      premises: "home",
      hiringPlans: "not_now",
      stage: "idea",
      experience: "first_business",
      startupBudget: "under_1k",
      launchTiming: "1_3_months",
      goals: ["side_income"],
    }),
    details: [
      { key: "business_email", value: "hello@risebakery.example" },
      { key: "business_phone", value: "512-555-0142" },
    ],
    intake: {
      description:
        "I bake sourdough bread and cookies in my home kitchen in Austin, Texas. It's just me. Neighbors will pick up orders from my porch, and I'll take orders through Instagram. I haven't started selling yet.",
      expected: {
        category: "baked_goods",
        state: "TX",
        owners: "me",
        stage: "idea",
        registeredAs: null,
        offeringKinds: { must: ["food"] },
        channels: { must: ["social_media"], may: ["in_person"] },
        premises: "home",
      },
    },
    research: {
      expected: [R.foodHandler, R.cottageLabels, R.cottageRegistration, R.salesTax, R.assumedCounty, R.assumedState, R.llc, R.ein, R.home, R.cottageFood],
      allowed: [R.structure, R.franchise, R.license],
      unsure: ["cottage-registration"],
    },
    brief: brief({
      name: "Rise Bakery",
      sells: "Sourdough bread and pastries",
      customers: "Neighbors and shoppers at the Saturday market",
      vibes: ["farmhouse", "Southern porch", "cozy"],
      leanings: { era: "old", tone: "playful", energy: null, finish: "handmade" },
      colors: ["forest greens", "cream and neutrals"],
      avoidColors: "pink",
      symbolIdea: "a wheat stalk",
      avoid: "cupcakes",
      story: "Rise Bakery is a porch swing on an old wooden back porch. A customer could expect the owner to come out with sweet tea while they shop.",
      storyApproved: true,
    }),
    plan: {
      answers: [
        { key: "customers", question: "Who are your main customers?", answer: ["Neighbors and local families", "Office parties"] },
        { key: "prices", question: "What will most of your items sell for?", answer: ["Under $10"] },
        { key: "costs", question: "What will you spend money on to get started?", answer: ["A second oven, about $1,200", "Packaging"] },
        { key: "funding", question: "Where will the starting money come from?", answer: ["My savings"] },
      ],
      steps: [
        { title: "Take a food handler course", done: true, conditional: false },
        { title: "Register on the DSHS cottage food registry", done: false, conditional: true },
        { title: "Register your business name with Travis County", done: false, conditional: true },
      ],
    },
    marketing: { include: ["instagram", "facebook"], have: ["instagram"], exclude: ["tiktok"], social: "some", seo: "new", content: "some", done: ["social_accounts", "word_of_mouth"], doneNote: "" },
    bios: { want: ["instagram", "facebook", "google_business"] },
    website: { platform: "square", explain: "square" },
    received: {
      pages: page([
        "Department of the Treasury, Internal Revenue Service",
        "WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER",
        "Your EIN is 12-3456789. Keep this notice in your permanent records.",
        "File Form 941 by April 30, 2027 if you have employees.",
        "Visit www.irs.gov/businesses for more information.",
      ]),
      steps: [
        { key: "cottage-food", title: "Follow Texas cottage food rules" },
        { key: "sales-tax-permit", title: "Get a Texas sales and use tax permit" },
        { key: "assumed-name-county", title: "File an assumed name certificate with Travis County" },
        { key: "ein", title: "Employer Identification Number (EIN)" },
      ],
      expected: { stepKey: "ein", notGovernment: false, deadlines: ["April 30, 2027"], idNumbers: ["12-3456789"] },
    },
    form: { question: "How much does it cost to file this form?", onForm: true, mentions: ["25"] },
    logo: { drawn: "RISE BAKERY", color: "#1F3A2E", versionColor: "#B03A2E" },
    photo: { label: "RISE", jarColor: "#C8A165", editedLabel: "RISE" },
  },
  {
    id: "lawn-care",
    label: "Lawn care service (services only), Austin TX",
    profile: profile({
      name: "Green Blade Lawn Care",
      nameIsLegalName: "no",
      category: "home_services",
      productTags: ["lawn"],
      firstItems: "Mowing, edging and leaf cleanup",
      location: { ...AUSTIN, insideCityLimits: "yes" },
      offeringKinds: ["services"],
      channels: ["in_person", "social_media"],
      premises: "home",
      customersVisit: "no",
      servicesLicensed: "no",
      hiringPlans: "first_year",
      helpKinds: ["employees"],
      stage: "selling_informally",
      experience: "first_business",
      startupBudget: "1k_5k",
      launchTiming: "within_1_month",
      goals: ["full_time"],
    }),
    details: [{ key: "business_phone", value: "512-555-0175" }],
    intake: {
      description:
        "I mow lawns and do yard cleanup for homeowners around Austin, Texas. I've already done jobs for neighbors for cash, but I haven't registered anything. I run it myself from home and find customers on Facebook and Nextdoor.",
      expected: {
        category: "home_services",
        state: "TX",
        owners: "me",
        stage: "selling_informally",
        registeredAs: null,
        offeringKinds: { must: ["services"] },
        channels: { must: ["social_media"], may: ["in_person"] },
        premises: "home",
      },
    },
    research: {
      expected: [R.assumedCounty, R.assumedState, R.llc, R.ein, R.home],
      allowed: [R.structure, R.franchise, R.employer, R.salesTax, R.license],
      unsure: [],
    },
    brief: brief({
      name: "Green Blade Lawn Care",
      sells: "Mowing, edging and leaf cleanup for homes",
      customers: "Busy homeowners in Austin neighborhoods",
      vibes: ["cheerful", "earthy", "small-town main street"],
      leanings: { era: "modern", tone: "serious", energy: null, finish: "polished" },
      colors: ["forest greens", "sunny yellows"],
      symbolIdea: "a single blade of grass",
      avoid: "cartoon lawn mowers",
    }),
    plan: {
      answers: [
        { key: "customers", question: "Who are your main customers?", answer: ["Homeowners in my part of Austin"] },
        { key: "pricing", question: "How will you charge for your work?", answer: ["By the visit, $45 for a standard yard"] },
        { key: "costs", question: "What will you spend money on to get started?", answer: ["A commercial mower, about $2,500", "A trailer"] },
        { key: "funding", question: "Where will the starting money come from?", answer: ["Savings and money from jobs so far"] },
        { key: "help", question: "What help will you need?", answer: ["One part-time helper next summer"] },
      ],
      steps: [
        { title: "Register your business name with Travis County", done: false, conditional: true },
        { title: "Get an EIN", done: false, conditional: false },
      ],
    },
    marketing: { include: ["google_business", "nextdoor", "facebook"], have: ["facebook"], exclude: ["instagram", "tiktok"], social: "new", seo: "new", content: "new", done: ["word_of_mouth"], doneNote: "Flyers on a few doors" },
    bios: { want: ["google_business", "nextdoor", "yelp"] },
    website: { platform: "first_sale", explain: "wix" },
    received: {
      pages: page([
        "Travis County Clerk, Recording Division",
        "ASSUMED NAME CERTIFICATE FOR AN UNINCORPORATED BUSINESS",
        "Assumed name: Green Blade Lawn Care",
        "Recorded: October 12, 2026. Filing fee paid: $23.00.",
        "This certificate is effective for 10 years from the date of filing.",
        "Keep this copy with your business records.",
      ]),
      steps: [
        { key: "assumed-name-county", title: "File an assumed name certificate with Travis County" },
        { key: "assumed-name-state", title: "File an assumed name certificate with the Secretary of State" },
        { key: "ein", title: "Employer Identification Number (EIN)" },
        { key: "home-business", title: "Check Austin's home-based business rules" },
      ],
      expected: { stepKey: "assumed-name-county", notGovernment: false, deadlines: [], idNumbers: [] },
    },
    form: { question: "How long does the assumed name last once it's filed?", onForm: true, mentions: ["10 years"] },
    // Misspelled on purpose: the check should catch it
    logo: { drawn: "GREEN BLADE LAWM CARE", color: "#2E6B30", versionColor: "#2E6B30" },
    photo: { label: "GREEN BLADE", jarColor: "#4C8C4A", editedLabel: "GREEN BLADS" },
  },
  {
    id: "online-clothing",
    label: "Two-owner online clothing shop (LLC), Austin TX",
    profile: profile({
      name: "Thread & Co",
      nameIsLegalName: "no",
      category: "clothing_boutique",
      productTags: ["womens", "accessories"],
      firstItems: "Women’s tops and bags",
      location: { ...AUSTIN, insideCityLimits: "yes" },
      owners: { count: 2 },
      ownerRelation: "friends",
      offeringKinds: ["resale"],
      inventorySources: ["new_wholesale"],
      channels: ["own_website", "social_media"],
      handoff: ["ship_in_state", "ship_out_of_state"],
      shipsOrders: "yes",
      premises: "home",
      hiringPlans: "not_now",
      stage: "idea",
      experience: "first_business",
      startupBudget: "5k_25k",
      launchTiming: "3_6_months",
      goals: ["grow"],
    }),
    details: [
      { key: "structure_choice", value: "llc" },
      { key: "business_email", value: "hello@threadandco.example" },
    ],
    intake: {
      description:
        "My friend and I are starting an online clothing shop. We buy women's tops and bags wholesale and sell them on our own website and on Instagram, shipping anywhere in the US. We work from home in Austin, TX, and plan to form an LLC.",
      expected: {
        category: "clothing_boutique",
        state: "TX",
        owners: "others",
        stage: "idea",
        registeredAs: null,
        offeringKinds: { must: ["resale"] },
        channels: { must: ["own_website", "social_media"] },
        premises: { oneOf: ["home", "online_only"] },
      },
    },
    research: {
      expected: [R.salesTax, R.assumedState, R.llc, R.franchise, R.ein, R.home],
      allowed: [R.structure, R.assumedCounty, R.otherStates, R.license],
      unsure: [],
    },
    brief: brief({
      name: "Thread & Co",
      sells: "Women’s tops and bags, shipped across the US",
      customers: "Women in their twenties and thirties who shop on Instagram",
      vibes: ["minimal", "elegant", "big-city loft"],
      leanings: { era: "modern", tone: null, energy: "quiet", finish: "polished" },
      colors: ["black and white", "soft pastels"],
      logoKinds: ["wordmark", "monogram"],
    }),
    plan: {
      answers: [
        { key: "customers", question: "Who are your main customers?", answer: ["Women 25 to 40 who shop online"] },
        { key: "different", question: "Why will customers choose you?", answer: ["We pick a small, curated set each month"] },
        { key: "prices", question: "What will most of your items sell for?", answer: ["$25 to $60"] },
        { key: "costs", question: "What will you spend money on to get started?", answer: ["First inventory, about $4,000", "Website plan", "Shipping supplies"] },
        { key: "funding", question: "Where will the starting money come from?", answer: ["Both owners' savings"] },
        { key: "sales_goal", question: "What do you hope to sell in your first year?", answer: ["About $30,000"] },
      ],
      steps: [
        { title: "File a certificate of formation to form your LLC", done: false, conditional: false },
        { title: "Get an EIN", done: false, conditional: false },
        { title: "Get a Texas sales and use tax permit", done: false, conditional: false },
      ],
    },
    marketing: { include: ["instagram", "tiktok", "pinterest"], have: [], exclude: ["nextdoor", "linkedin"], social: "confident", seo: "some", content: "some", done: ["none"], doneNote: "" },
    bios: { want: ["instagram", "tiktok", "pinterest"] },
    website: { platform: "shopify", explain: "shopify" },
    received: {
      pages: page([
        "Texas Comptroller of Public Accounts",
        "Franchise Tax Notice",
        "Thread & Co LLC",
        "Taxpayer number: 32012345678",
        "Your annual franchise tax report is due May 15, 2027.",
        "File online at comptroller.texas.gov.",
      ]),
      steps: [
        { key: "llc-formation", title: "File a certificate of formation to form your LLC" },
        { key: "ein", title: "Employer Identification Number (EIN)" },
        { key: "sales-tax-permit", title: "Get a Texas sales and use tax permit" },
        { key: "franchise-tax", title: "File the Texas franchise tax report" },
      ],
      expected: { stepKey: "franchise-tax", notGovernment: false, deadlines: ["May 15, 2027"], idNumbers: ["32012345678"] },
    },
    form: { question: "What address do we mail this form to?", onForm: true, mentions: ["13697"] },
    logo: { drawn: "THREAD & CO", color: "#111111", versionColor: "#111111" },
    photo: { label: "THREAD", jarColor: "#D9C6E0", editedLabel: "THREAD" },
  },
  {
    id: "not-sure",
    label: "Jams and salsa maker with \"Not sure\" answers, Austin TX",
    profile: profile({
      name: "Prickly Pear Pantry",
      nameIsLegalName: "unsure",
      category: "packaged_food",
      productTags: ["jam", "salsa"],
      firstItems: "Jams and salsa",
      location: { ...AUSTIN, insideCityLimits: "unsure" },
      offeringKinds: ["food"],
      foodNeedsCold: "unsure",
      channels: ["markets"],
      handoff: ["unsure"],
      premises: "unsure",
      hiringPlans: null,
      helpKinds: ["unsure"],
      mayAddOwners: "unsure",
      stage: "idea",
      experience: "first_business",
      startupBudget: "unsure",
      launchTiming: "unsure",
      firstYearSales: "unsure",
    }),
    details: [],
    intake: {
      description:
        "I make jams and salsa and might sell them at farmers markets. I'm not sure yet where I'll make them, maybe at home or maybe in a shared kitchen. I might bring in a partner later. Not sure when I'll start.",
      expected: {
        category: "packaged_food",
        state: null,
        owners: { oneOf: ["me", null] },
        stage: "idea",
        registeredAs: null,
        offeringKinds: { must: ["food"] },
        channels: { must: ["markets"] },
        premises: { oneOf: ["unsure", null] },
      },
    },
    research: {
      // Where they'll cook is "not sure", so the cottage food rules are a maybe
      expected: [R.assumedCounty, R.assumedState, R.llc, R.home, R.cottageFood],
      allowed: [R.foodHandler, R.cottageLabels, R.cottageRegistration, R.structure, R.ein, R.franchise, R.salesTax, R.employer, R.license, R.vendor],
      unsure: ["cottage-food", "home-business"],
    },
    brief: brief({
      name: "Prickly Pear Pantry",
      sells: "Jams and salsa",
      customers: "",
      vibes: ["desert", "warm", "hand-drawn"],
      colors: ["warm reds and oranges"],
    }),
    plan: {
      answers: [
        { key: "customers", question: "Who are your main customers?", answer: ["Not sure yet"] },
        { key: "prices", question: "What will most of your items sell for?", answer: ["Not sure yet"] },
        { key: "funding", question: "Where will the starting money come from?", answer: ["Not sure yet"] },
      ],
      steps: [
        { title: "Take a food handler course", done: false, conditional: false },
        { title: "Register on the DSHS cottage food registry", done: false, conditional: true },
      ],
    },
    marketing: { include: [], have: [], exclude: [], social: "new", seo: "new", content: "new", done: ["none"], doneNote: "" },
    bios: { want: ["instagram", "facebook"] },
    website: { platform: "first_sale", explain: "first_sale" },
    received: {
      pages: page([
        "Texas Business Records Service",
        "ANNUAL CERTIFICATE OF STATUS REQUEST",
        "Amount due: $89.00. Respond by November 30, 2026.",
        "This is not a bill. This product or service has not been approved or endorsed by any government agency.",
        "This offer is not being made by an agency of the government.",
      ]),
      steps: [
        { key: "cottage-food", title: "Follow Texas cottage food rules" },
        { key: "assumed-name-county", title: "File an assumed name certificate with Travis County" },
        { key: "llc-formation", title: "File a certificate of formation to form your LLC" },
      ],
      expected: { stepKey: null, notGovernment: true, deadlines: [], idNumbers: [] },
    },
    form: { question: "Do I need a lawyer to fill this out?", onForm: false, mentions: [] },
    // Misspelled on purpose
    logo: { drawn: "PRICKLY PEAR PANTY", color: "#B5452B", versionColor: "#2B6CB5" },
    photo: { label: "PRICKLY PEAR", jarColor: "#B5452B", editedLabel: "PRICKLY PEAR" },
  },
];

export function caseById(id: string): BenchCase | undefined {
  return CASES.find((each) => each.id === id);
}

// --- Claims check: sourced requirements whose quotes back them, and some whose quotes don't

const claim = (
  key: string,
  title: string,
  whyItApplies: string,
  level: JurisdictionLevel,
  sourceId: string,
  evidence: string,
  extra: Partial<VerifiedRequirement> = {},
): VerifiedRequirement => ({
  key,
  title,
  topic: "license_permit",
  whyItApplies,
  level,
  agency: "",
  sourceIds: [sourceId],
  evidence,
  feeUsd: null,
  deadline: null,
  needsProfessional: false,
  whoToCall: "",
  whatToAsk: [],
  gather: [],
  doneWhen: "",
  dependsOn: [],
  applicability: "applies",
  condition: "",
  timing: "before_selling",
  forStructures: [],
  renewal: null,
  renewalFeeUsd: null,
  verification: "sourced",
  problems: [],
  ...extra,
});

// Quotes are from src/test/texas-pages.ts
export const CLAIMS_FIXTURE: { requirements: VerifiedRequirement[]; unsupported: ReadonlySet<string> } = {
  requirements: [
    claim(
      "food-handler",
      "Complete an accredited food handler course",
      "Texas requires anyone running a cottage food business to finish food safety training.",
      "state",
      "tx-dshs-cottage",
      "An individual who operates a cottage food production operation must successfully complete a basic food safety education or training program for food handlers accredited under Health and Safety Code, Chapter 438(D) .",
    ),
    claim(
      "franchise-tax",
      "File a Texas franchise tax report each year",
      "An LLC formed in Texas files a franchise tax report every year.",
      "state",
      "tx-cpa-franchise",
      "The annual franchise tax report is due May 15. If May 15 falls on a weekend or holiday, the due date will be the next business day.",
      { topic: "tax_registration", deadline: "due May 15", timing: "later" },
    ),
    claim(
      "sales-tax-permit",
      "Get a Texas sales and use tax permit",
      "You sell goods in Texas, so you need a sales and use tax permit.",
      "state",
      "tx-cpa-permit-faq",
      "You must obtain a Texas sales and use tax permit if you are an individual, partnership, corporation or other legal entity engaged in business in Texas and you:",
      { topic: "tax_registration" },
    ),
    claim(
      "home-business",
      "Keep your home business within Austin’s limits",
      "Austin can’t require a permit for a home business that stays within occupancy, traffic and noise limits.",
      "city",
      "tx-austin-home",
      "The City of Austin cannot prohibit or require permits for home-based businesses that do not exceed occupancy limits, generate significant traffic, or create visible or noise disturbances.",
      { topic: "location_zoning" },
    ),
    // Says the opposite of its quote
    claim(
      "health-permit",
      "Get a health department permit for your home kitchen",
      "Your local health department must inspect your kitchen and issue a permit before you sell.",
      "state",
      "tx-dshs-cottage",
      "Health departments do not have regulatory authority to conduct inspections of a cottage food production operation or require any payment of fee to produce, sell, or provide samples directly to a consumer or cottage food vendor.",
    ),
    // A fee the quote doesn't give
    claim(
      "assumed-name-county",
      "File an assumed name certificate with Travis County for $50",
      "Registering your business name with the county costs $50.",
      "county",
      "tx-travis-dba",
      "Filing fee is $23.00 for business name and one owner. Additional owners are $.50 each filed on same statement.",
      { topic: "name_registration", feeUsd: 50 },
    ),
    // A quote about something else
    claim(
      "permit-renewal",
      "Renew your sales tax permit every year",
      "Texas sales tax permits must be renewed each year.",
      "state",
      "tx-cpa-permit",
      "Allow 2-3 weeks to receive your permit.",
      { topic: "tax_registration", timing: "later" },
    ),
  ],
  unsupported: new Set(["health-permit", "assumed-name-county", "permit-renewal"]),
};
