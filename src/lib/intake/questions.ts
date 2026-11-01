import type { PREMISES } from "@/lib/domain";
import { asks, kindsOf, OPTIONAL_FIELDS, type FollowUp, type IntakeAnswers, type StepId } from "./answers";
import {
  BUDGET_LABELS,
  CHANNEL_LABELS,
  entries,
  EXISTING_SETUP_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  HANDOFF_LABELS,
  HELP_KIND_LABELS,
  HIRING_LABELS,
  INVENTORY_SOURCE_LABELS,
  LAUNCH_TIMING_LABELS,
  OWNER_RELATION_LABELS,
  PREMISES_LABELS,
  REGISTERED_AS_HELP,
  REGISTERED_AS_LABELS,
  SALES_LABELS,
  STAGE_LABELS,
  YES_NO_LABELS,
} from "./options";

// Click-to-answer questions the wizard draws the same way. Each says why it's asked,
// and "Not sure" opens help to answer it rather than counting as "no".

export type QuestionField =
  | "insideCityLimits"
  | "ownerRelation"
  | "mayAddOwners"
  | "nameIsLegalName"
  | "stage"
  | "registeredAs"
  | "alreadyHave"
  | "channels"
  | "handoff"
  | "shipsOrders"
  | "foodNeedsCold"
  | "makesForKids"
  | "foodContact"
  | "inventorySources"
  | "servicesLicensed"
  | "premises"
  | "customersVisit"
  | "startupBudget"
  | "firstYearSales"
  | "takesOnDebt"
  | "hiringPlans"
  | "helpKinds"
  | "launchTiming"
  | "experience"
  | "goals";

export interface QuestionSpec {
  field: QuestionField;
  step: StepId;
  title: (a: IntakeAnswers) => string;
  why: string;
  options: (a: IntakeAnswers) => [string, string][];
  descriptions?: Record<string, string>;
  multiple?: boolean;
  // Big buttons with room for a description, instead of chips
  cards?: boolean;
  // Picking this clears the others, and picking another clears it
  exclusive?: string;
  // Shown when "Not sure" is picked, or opened with "Help me answer"
  unsure?: { explain: string; tips: string[] };
  // Unfamiliar words in the question or its options
  terms?: [string, string][];
  asks: (a: IntakeAnswers) => boolean;
}

// Shown as "Optional" next to the question
export const isOptional = (spec: Pick<QuestionSpec, "field">) => OPTIONAL_FIELDS.includes(spec.field);

const always = () => true;
const followUp = (field: FollowUp) => (a: IntakeAnswers) => asks(field, a);
const yesNo = () => entries(YES_NO_LABELS);

const DBA: [string, string] = [
  "DBA (“doing business as”)",
  "A registered name you sell under. It’s a name registration, not a business structure, and it doesn’t create a separate company.",
];

function premisesLabels(a: IntakeAnswers): Record<(typeof PREMISES)[number], string> {
  const kinds = kindsOf(a);
  if (kinds.length === 1 && kinds[0] === "food") {
    return { ...PREMISES_LABELS, home: "My home kitchen", shared_kitchen: "A shared or commercial kitchen", rented_space: "A kitchen or shop I rent" };
  }
  if (kinds.length === 1 && kinds[0] === "services") {
    return { ...PREMISES_LABELS, online_only: "At customers’ places or online", shared_kitchen: "A shared space or salon", rented_space: "A space I rent" };
  }
  if (kinds.includes("handmade")) return { ...PREMISES_LABELS, home: "At home or in my garage", shared_kitchen: "A shared studio or workshop" };
  return PREMISES_LABELS;
}

function premisesTitle(a: IntakeAnswers): string {
  const kinds = kindsOf(a);
  if (kinds.length === 1 && kinds[0] === "food") return "Where will you make your food?";
  if (kinds.length === 1 && kinds[0] === "services") return "Where will you do the work?";
  if (kinds.length === 1 && kinds[0] === "resale") return "Where will you keep your stock and meet customers?";
  return "Where will you make things and keep your stock?";
}

export const QUESTIONS: readonly QuestionSpec[] = [
  {
    field: "insideCityLimits",
    step: "place",
    title: (a) => `Is your address inside the city limits of ${a.city.trim()}?`,
    why: "City rules apply only inside city limits, and a mailing address can name a city you’re not actually in.",
    options: yesNo,
    unsure: {
      explain: "Lots of people don’t know this one. Ways to check:",
      tips: [
        "Your property tax bill or lease often names the city when you’re inside it.",
        "Your county’s property search website shows the city for your address.",
        "We’ll keep it as an open question and check both city and county rules.",
      ],
    },
    asks: followUp("insideCityLimits"),
  },
  {
    field: "ownerRelation",
    step: "owners",
    title: () => "Who are the other owners?",
    why: "Family and married co-owners face some different choices, like how to split the work and what happens if someone steps away.",
    options: () => entries(OWNER_RELATION_LABELS),
    asks: followUp("ownerRelation"),
  },
  {
    field: "mayAddOwners",
    step: "owners",
    title: () => "Might someone join as a co-owner later?",
    why: "Adding an owner later can change which structure fits and what you’d file.",
    options: yesNo,
    unsure: { explain: "That’s fine. Your structure page shows how the options compare either way.", tips: [] },
    asks: followUp("mayAddOwners"),
  },
  {
    field: "nameIsLegalName",
    step: "name",
    title: (a) => `Is “${a.name.trim()}” just your own legal name, like “Maria Lopez”?`,
    why: "Selling under a name that isn’t your own legal name often means registering it as a DBA.",
    options: yesNo,
    unsure: {
      explain: "Compare it with the name on your ID:",
      tips: ["“Maria Lopez” is just a legal name.", "“Maria Lopez Baking” or “Sunrise Bakes” adds words, so it’s a different name."],
    },
    terms: [DBA],
    asks: followUp("nameIsLegalName"),
  },
  {
    field: "stage",
    step: "status",
    title: () => "Where are you now?",
    why: "So we can skip steps you’ve already done.",
    options: () => entries(STAGE_LABELS),
    cards: true,
    asks: always,
  },
  {
    field: "registeredAs",
    step: "status",
    title: () => "What kind of business did you register?",
    why: "Each kind comes with its own next steps.",
    options: () => entries(REGISTERED_AS_LABELS),
    descriptions: REGISTERED_AS_HELP,
    cards: true,
    asks: followUp("registeredAs"),
  },
  {
    field: "alreadyHave",
    step: "status",
    title: () => "Which of these do you already have?",
    why: "We’ll mark these as done instead of asking you to do them again.",
    options: () => entries(EXISTING_SETUP_LABELS),
    multiple: true,
    exclusive: "none",
    unsure: {
      explain: "Pick the ones you’re sure of. We treat the rest as unknown, not as missing. To check:",
      tips: [
        "Search your email for “EIN”, “assumed name”, “trade name” or “sales tax”.",
        "Your state’s business name search lists registered names.",
      ],
    },
    terms: [
      DBA,
      ["EIN", "A free federal tax ID number for a business, from the IRS."],
      ["Sales tax permit", "Lets you collect sales tax from customers. States call it different names."],
    ],
    asks: followUp("alreadyHave"),
  },
  {
    field: "channels",
    step: "channels",
    title: () => "How will you sell?",
    why: "Markets, storefronts and online sales each come with their own permits and tax rules.",
    options: () => entries(CHANNEL_LABELS),
    multiple: true,
    asks: always,
  },
  {
    field: "handoff",
    step: "channels",
    title: () => "How will customers get what they buy?",
    why: "Pickup at home, delivery and shipping can each change which rules apply, especially for food.",
    options: () => entries(HANDOFF_LABELS),
    multiple: true,
    unsure: {
      explain: "Pick what you’d try first. You can change it later.",
      tips: ["Not sure about shipping? Many people start with pickup and add shipping later."],
    },
    asks: followUp("handoff"),
  },
  {
    field: "shipsOrders",
    step: "channels",
    title: () => "Will you ship orders?",
    why: "Shipping can add sales tax and labeling questions.",
    options: yesNo,
    asks: followUp("shipsOrders"),
  },
  {
    field: "foodNeedsCold",
    step: "details",
    title: () => "Does any of it need to be kept cold, like cheesecake, cream pies or meat fillings?",
    why: "Rules for food made at home often depend on whether it needs a fridge to stay safe.",
    options: yesNo,
    unsure: {
      explain: "A quick way to tell:",
      tips: [
        "Would it be unsafe left on the counter overnight? Then it likely needs to be kept cold.",
        "Cream cheese, custard, cream fillings and meat usually do.",
        "Most cookies, breads and fruit pies don’t.",
      ],
    },
    asks: followUp("foodNeedsCold"),
  },
  {
    field: "makesForKids",
    step: "details",
    title: () => "Will any items be made mainly for children 12 and under?",
    why: "Products made for young children can have extra safety rules, so we’ll check.",
    options: yesNo,
    unsure: {
      explain: "Think about who it’s for:",
      tips: ["Toys, baby items, kids’ clothing and kids’ jewelry count.", "Things for the whole household, like a cutting board, usually don’t."],
    },
    asks: followUp("makesForKids"),
  },
  {
    field: "foodContact",
    step: "details",
    title: () => "Will any items touch food, like cutting boards, bowls or mugs?",
    why: "Finishes and materials on things that touch food can have their own rules, so we’ll look into it.",
    options: yesNo,
    unsure: { explain: "Will someone eat off it, drink from it, or prepare food on it? Then pick Yes.", tips: [] },
    asks: followUp("foodContact"),
  },
  {
    field: "inventorySources",
    step: "details",
    title: () => "Where will your stock come from?",
    why: "Buying wholesale, reselling used items and selling for others can each come with different registrations.",
    options: () => entries(INVENTORY_SOURCE_LABELS),
    multiple: true,
    unsure: { explain: "Pick where you’d start. You can add more later.", tips: [] },
    terms: [["Consignment", "People leave items with you, and you pay them a share when one sells."]],
    asks: followUp("inventorySources"),
  },
  {
    field: "servicesLicensed",
    step: "details",
    title: () => "Does your kind of work usually need a personal license, like a cosmetology, childcare or contractor license?",
    why: "Some services need a license for the person doing the work, separate from any business license.",
    options: yesNo,
    unsure: {
      explain: "We’ll check this in your requirements either way. Meanwhile:",
      tips: ["Ask someone who does this work near you what license they hold."],
    },
    asks: followUp("servicesLicensed"),
  },
  {
    field: "premises",
    step: "premises",
    title: premisesTitle,
    why: "Working from home can need zoning approval. A rented space has to be approved for your kind of business.",
    options: (a) => entries(premisesLabels(a)),
    cards: true,
    asks: always,
  },
  {
    field: "customersVisit",
    step: "premises",
    title: () => "Will customers come to your home, for pickups or appointments?",
    why: "Rules for home businesses often limit customer visits, parking or signs.",
    options: yesNo,
    unsure: { explain: "If you might offer pickup at home, pick Yes for now. You can change it later.", tips: [] },
    asks: followUp("customersVisit"),
  },
  {
    field: "startupBudget",
    step: "money",
    title: () => "About how much can you spend getting started?",
    why: "We’ll show what each step costs and put the steps you need first.",
    options: () => entries(BUDGET_LABELS),
    asks: always,
  },
  {
    field: "firstYearSales",
    step: "money",
    title: () => "About how much do you hope to sell in your first year?",
    why: "Some rules and limits depend on how much you sell. A rough guess is fine.",
    options: () => entries(SALES_LABELS),
    unsure: { explain: "A guess helps:", tips: ["$100 a week is about $5,000 a year.", "$500 a week is about $25,000 a year."] },
    asks: always,
  },
  {
    field: "takesOnDebt",
    step: "money",
    title: () => "Will the business sign a lease, take out a loan, or buy on credit?",
    why: "What the business could owe is one of the things that shapes which structure fits.",
    options: yesNo,
    unsure: {
      explain: "Think about the next year:",
      tips: ["Renting a space by the month or year means signing a lease.", "Paying a market booth fee for one day doesn’t."],
    },
    asks: always,
  },
  {
    field: "hiringPlans",
    step: "help",
    title: () => "Will anyone work for you, like an employee, a contractor or a family member who helps?",
    why: "Paying people adds employer steps to your plan, usually later.",
    options: () => entries(HIRING_LABELS),
    asks: always,
  },
  {
    field: "helpKinds",
    step: "help",
    title: () => "What kind of help?",
    why: "Employees, contractors and family helpers are handled differently for taxes and paperwork.",
    options: () => entries(HELP_KIND_LABELS),
    multiple: true,
    unsure: { explain: "That’s fine. We’ll explain the difference when you get there.", tips: [] },
    terms: [
      ["Employee", "Someone you pay to work on your schedule, the way you direct."],
      ["Contractor", "Someone running their own business who does a job for you."],
    ],
    asks: followUp("helpKinds"),
  },
  {
    field: "launchTiming",
    step: "timing",
    title: () => "When do you hope to start selling?",
    why: "It helps us order your steps.",
    options: () => entries(LAUNCH_TIMING_LABELS),
    // Older answers only: the wizard now asks for a date
    asks: () => false,
  },
  {
    field: "experience",
    step: "timing",
    title: () => "Have you run a business before?",
    why: "We’ll explain more where you’re new.",
    options: () => entries(EXPERIENCE_LABELS),
    asks: always,
  },
  {
    field: "goals",
    step: "timing",
    title: () => "What are your current goals for your business?",
    why: "Your goals shape which structure and next steps we suggest.",
    options: () => entries(GOAL_LABELS),
    multiple: true,
    asks: always,
  },
];

export function questionsFor(step: StepId, a: IntakeAnswers): QuestionSpec[] {
  return QUESTIONS.filter((question) => question.step === step && question.asks(a));
}

// Every question asked for these answers, in order: special steps by their own ids
export function questionPath(a: IntakeAnswers, steps: readonly StepId[]): string[] {
  const special: Partial<Record<StepId, string[]>> = {
    sell: ["category", "productTags", "firstItems"],
    place: ["state", "county", "city"],
    owners: ["owners"],
    name: ["name"],
    timing: ["launchDate"],
  };
  return steps.flatMap((step) => [...(special[step] ?? []), ...questionsFor(step, a).map((question) => question.field)]);
}
