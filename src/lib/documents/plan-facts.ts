import type { BusinessProfile, EXPERIENCE_LEVELS, GOALS, HANDOFF_METHODS, PREMISES, SELLING_CHANNELS, BUSINESS_STAGES } from "@/lib/domain";
import { categoryFor, examplesText } from "@/lib/intake/catalog";
import {
  BUDGET_LABELS,
  countyLabel,
  HELP_KIND_LABELS,
  HIRING_LABELS,
  INVENTORY_SOURCE_LABELS,
  LAUNCH_TIMING_LABELS,
  OFFERING_KIND_LABELS,
  SALES_LABELS,
  STATE_NAMES,
} from "@/lib/intake/options";

// What the business plan already knows, and the few questions it still asks. Both are decided here, from the owner's business.

export type Sells = "products" | "services" | "both";

export interface PlanSources {
  profile: BusinessProfile;
  // The decided structure's name, and where the decision was made
  structure: { name: string; from: "decision" | "registered" } | null;
  // price: as customers see it, from rules/products priceLabel
  products: { name: string; priceCents: number | null; price?: string; unitCostCents?: number | null }[];
  brand: { customers: string; tagline: string; story: string } | null;
  // An approved marketing plan
  marketing: { summary: string; audience: string } | null;
  fees: { confirmed: FeeLine[]; maybe: FeeLine[]; unconfirmed: string[] } | null;
  // Required and conditional steps, for the plan's legal section
  steps: PlanStepFact[];
  // Every step that applies, counted as Start your business counts them
  progress: { done: number; total: number } | null;
  // "What the business does, in one sentence", from business details
  purpose: string | null;
}

export interface FeeLine {
  title: string;
  cents: number;
}

export interface PlanStepFact {
  title: string;
  done: boolean;
  // Needed only if a condition turns out true
  conditional: boolean;
}

export const FACT_GROUPS = {
  business: "About the business",
  selling: "What you sell and how",
  money: "Money and timing",
  brand: "Brand and marketing",
} as const;
export type FactGroup = keyof typeof FACT_GROUPS;

const SOURCES = {
  answers: { label: "From your business answers", href: "/business" },
  details: { label: "From your business details", href: "/business" },
  structure: { label: "From Business structure", href: "/structure" },
  products: { label: "From your products", href: "/products" },
  checklist: { label: "From Start your business", href: "/start" },
  brand: { label: "From your brand", href: "/brand" },
  logo: { label: "From your logo", href: "/logo" },
  marketing: { label: "From your marketing plan", href: "/marketing" },
} as const;

export interface KnownFact {
  key: string;
  group: FactGroup;
  label: string;
  value: string;
  source: string;
  href: string;
}

export const MAX_FACT = 600;
export const MAX_OTHER = 300;

// Intake answers as a plan states them
const STAGE_TEXT: Record<(typeof BUSINESS_STAGES)[number], string> = {
  idea: "Planning, not yet selling",
  selling_informally: "Selling on a small scale",
  registered: "Registered",
};
const EXPERIENCE_TEXT: Record<(typeof EXPERIENCE_LEVELS)[number], string> = {
  first_business: "First business",
  some: "Some, such as a side business",
  experienced: "Has run a business before",
};
const GOAL_TEXT: Record<(typeof GOALS)[number], string> = {
  test_idea: "Test the idea with little risk",
  side_income: "Earn extra income on the side",
  full_time: "Make it full-time work",
  grow: "Grow it, with a team or a shop",
};
const CHANNEL_TEXT: Record<(typeof SELLING_CHANNELS)[number], string> = {
  in_person: "In person",
  markets: "Markets and events",
  storefront: "A storefront",
  own_website: "Its own website",
  marketplace: "Online marketplaces such as Etsy",
  social_media: "Social media",
  wholesale: "Wholesale to shops",
};
const HANDOFF_TEXT: Record<Exclude<(typeof HANDOFF_METHODS)[number], "unsure">, string> = {
  in_person_sale: "Handed over at the time of sale",
  pickup_home: "Pickup at the owner’s home",
  pickup_elsewhere: "Pickup at another location",
  local_delivery: "Local delivery",
  ship_in_state: "Shipping within the state",
  ship_out_of_state: "Shipping to other states",
};
const PREMISES_TEXT: Record<Exclude<(typeof PREMISES)[number], "unsure">, string> = {
  home: "Home-based",
  rented_space: "A rented space",
  shared_kitchen: "A shared kitchen or studio",
  online_only: "No dedicated workspace yet",
};
const RELATION_TEXT = { spouse: "spouses or partners", family: "family members", friends: "friends or business partners" } as const;

const list = <K extends string>(labels: Record<K, string>, keys: readonly K[]) => keys.map((key) => labels[key]).join(", ");

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });
}

export function placeText(profile: BusinessProfile): string {
  const { city, county, state } = profile.location;
  return [city, countyLabel(county), STATE_NAMES[state]].filter(Boolean).join(", ");
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function offeringText(profile: BusinessProfile): string {
  const category = categoryFor(profile.category);
  const examples = examplesText(profile.category, profile.productTags);
  const kinds = profile.offeringKinds.filter((kind) => kind !== "other").map((kind) => OFFERING_KIND_LABELS[kind]);
  const base = category && category.id !== "other" ? category.label : kinds.join(", ");
  // Intake fills firstItems from the picked examples; only the owner's own words add anything
  const first = profile.firstItems.trim();
  const extra = !examples ? first : first === examples ? "" : first.startsWith(`${examples}, `) ? first.slice(examples.length + 2) : first;
  const parts = [examples ? `${base}, including ${examples.toLowerCase()}` : base, extra && extra[0].toUpperCase() + extra.slice(1)].filter(Boolean);
  return parts.join(". ");
}

function ownersText(profile: BusinessProfile): string {
  const count = profile.owners.count;
  if (count === 1) return "One owner";
  const relation = profile.ownerRelation && profile.ownerRelation !== "unsure" ? `, ${RELATION_TEXT[profile.ownerRelation]}` : "";
  return `${count} owners${relation}`;
}

function helpText(profile: BusinessProfile): string {
  const hiring = profile.hiringPlans ? `Hiring: ${HIRING_LABELS[profile.hiringPlans].toLowerCase()}` : "";
  const help = profile.helpKinds.filter((kind) => kind !== "unsure");
  return [hiring, help.length ? `Help: ${list(HELP_KIND_LABELS, help).toLowerCase()}` : ""].filter(Boolean).join(". ");
}

function feesText(fees: NonNullable<PlanSources["fees"]>): string {
  const line = (fee: FeeLine) => `${fee.title} (${money(fee.cents)})`;
  const confirmedCents = fees.confirmed.reduce((sum, fee) => sum + fee.cents, 0);
  return [
    fees.confirmed.length ? `Confirmed: ${fees.confirmed.map(line).join("; ")}${fees.confirmed.length > 1 ? `, ${money(confirmedCents)} in all` : ""}` : "No confirmed fees yet",
    fees.maybe.length ? `Only if they apply: ${fees.maybe.map(line).join("; ")}` : "",
    fees.unconfirmed.length ? `Fee not confirmed yet: ${fees.unconfirmed.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

function productsText(products: PlanSources["products"]): string {
  const shown = products.slice(0, 8).map((product) => {
    const price = product.price ?? (product.priceCents === null ? "" : money(product.priceCents));
    return price ? `${product.name}, ${price}` : product.name;
  });
  const more = products.length - shown.length;
  return `${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}`;
}

export function knownFacts(sources: PlanSources): KnownFact[] {
  const { profile } = sources;
  const facts: KnownFact[] = [];
  const add = (key: string, group: FactGroup, label: string, value: string | null | undefined, from: keyof typeof SOURCES) => {
    const text = value?.trim();
    if (text) facts.push({ key, group, label, value: text.slice(0, MAX_FACT), source: SOURCES[from].label, href: SOURCES[from].href });
  };

  add("name", "business", "Business name", profile.name ?? "Not chosen yet", "answers");
  add("place", "business", "Where", placeText(profile), "answers");
  add("description", "business", "About the business", profile.description, "answers");
  add("purpose", "business", "What the business does", sources.purpose, "details");
  add("owners", "business", "Owners", ownersText(profile), "answers");
  add("stage", "business", "Stage", profile.stage ? STAGE_TEXT[profile.stage] : null, "answers");
  add("structure", "business", "Business structure", sources.structure?.name ?? "Not decided yet", sources.structure?.from === "registered" ? "answers" : "structure");
  add("experience", "business", "Business experience", profile.experience ? EXPERIENCE_TEXT[profile.experience] : null, "answers");
  add("help", "business", "Help and hiring", helpText(profile), "answers");
  add("goals", "business", "Goals", list(GOAL_TEXT, profile.goals), "answers");

  add("offering", "selling", "What you sell", offeringText(profile), "answers");
  if (sources.products.length) add("prices", "selling", "Products and prices", productsText(sources.products), "products");
  add("channels", "selling", "Where it sells", list(CHANNEL_TEXT, profile.channels), "answers");
  add("handoff", "selling", "How customers get orders", list(HANDOFF_TEXT, profile.handoff.filter((each) => each !== "unsure")), "answers");
  add("premises", "selling", "Workspace", profile.premises && profile.premises !== "unsure" ? PREMISES_TEXT[profile.premises] : null, "answers");
  add("stock", "selling", "Where your stock comes from", list(INVENTORY_SOURCE_LABELS, profile.inventorySources.filter((each) => each !== "unsure")), "answers");
  if (sources.brand?.customers) add("customers", "selling", "Who buys from you", sources.brand.customers, "brand");
  else if (sources.marketing?.audience) add("customers", "selling", "Who buys from you", sources.marketing.audience, "marketing");

  add("budget", "money", "Starting budget", profile.startupBudget ? BUDGET_LABELS[profile.startupBudget] : null, "answers");
  if (sources.fees) add("fees", "money", "Government fees", feesText(sources.fees), "checklist");
  add("sales_goal", "money", "First-year sales goal", profile.firstYearSales ? SALES_LABELS[profile.firstYearSales] : null, "answers");
  const timing = profile.launchTiming && profile.launchTiming !== "unsure" ? LAUNCH_TIMING_LABELS[profile.launchTiming] : null;
  add("launch", "money", "Goal for first sale", profile.launchDate ? longDate(profile.launchDate) : timing, "answers");
  if (sources.progress?.total) add("progress", "money", "Licenses and registrations", `${sources.progress.done} of ${sources.progress.total} steps done`, "checklist");

  add("tagline", "brand", "Tagline", sources.brand?.tagline, "logo");
  add("story", "brand", "Brand story", sources.brand?.story, "brand");
  add("marketing", "brand", "Marketing plan", sources.marketing?.summary, "marketing");
  return facts;
}

// The owner's edits, for this plan only
export function withOverrides(facts: readonly KnownFact[], overrides: Readonly<Record<string, string>>): (KnownFact & { edited: boolean })[] {
  return facts.map((fact) => {
    const edit = overrides[fact.key]?.trim();
    return edit && edit !== fact.value ? { ...fact, value: edit, edited: true } : { ...fact, edited: false };
  });
}

// --- Questions

export interface PlanAnswer {
  picks: string[];
  // Null unless "Other" is picked
  other: string | null;
}
export type PlanAnswers = Record<string, PlanAnswer>;

export interface PlanQuestion {
  key: string;
  title: string;
  why: string;
  options: [string, string][];
  multiple: boolean;
  // Placeholder for the "Other" box
  otherHint: string;
}

export const UNSURE = "unsure";
const NOT_SURE: [string, string] = [UNSURE, "Not sure yet"];
const PRODUCT_KINDS = new Set(["food", "handmade", "resale"]);

export function sellsOf(profile: BusinessProfile, answers: PlanAnswers = {}): Sells | null {
  const kinds = new Set<string>(profile.offeringKinds);
  const categoryKind = categoryFor(profile.category)?.kind;
  if (categoryKind) kinds.add(categoryKind);
  const products = [...kinds].some((kind) => PRODUCT_KINDS.has(kind));
  const services = kinds.has("services");
  if (products && services) return "both";
  if (products) return "products";
  if (services) return "services";
  const picked = answers.sells?.picks[0];
  return picked === "products" || picked === "services" || picked === "both" ? picked : null;
}

// Everything the questions are chosen from
export interface QuestionBasis {
  profile: BusinessProfile;
  // Keys of facts SnapStart already has
  known: readonly string[];
}

type Options = [string, string][];
const opts = (...groups: (Options | false | null | undefined)[]): Options => groups.flatMap((group) => group || []);

export function planQuestions({ profile, known }: QuestionBasis, answers: PlanAnswers = {}): PlanQuestion[] {
  const has = (key: string) => known.includes(key);
  const category = profile.category;
  const sells = sellsOf(profile, answers);
  const kinds = new Set<string>([...profile.offeringKinds, categoryFor(category)?.kind ?? ""]);
  const food = kinds.has("food");
  const resale = kinds.has("resale");
  const handmade = kinds.has("handmade");
  const products = sells === "products" || sells === "both";
  const services = sells === "services" || sells === "both";
  const tagged = (tag: string) => profile.productTags.includes(tag);
  const markets = profile.channels.includes("markets");
  const online = profile.channels.some((channel) => channel === "own_website" || channel === "marketplace");
  const city = profile.location.city.trim();
  const questions: PlanQuestion[] = [];
  const ask = (question: PlanQuestion) => questions.push(question);

  if (!sellsOf(profile)) {
    ask({
      key: "sells",
      title: "Do you sell products, services or both?",
      why: "It decides how your plan describes what you offer.",
      options: [
        ["products", "Products: things customers buy"],
        ["services", "Services: work you do for customers"],
        ["both", "Both"],
      ],
      multiple: false,
      otherHint: "Say what you offer in a few words",
    });
  }

  if (!has("customers")) {
    ask({
      key: "customers",
      title: "Who are your main customers?",
      why: "The market section of your plan describes who you’ll sell to.",
      options: customerOptions(category, products, services, online),
      multiple: true,
      otherHint: "Describe your customers in your own words",
    });
  }

  ask({
    key: "different",
    title: "Why will customers choose you?",
    why: "Lenders and programs look for what sets a business apart.",
    options: differentOptions(category, { food, resale, handmade, products, services }),
    multiple: true,
    otherHint: "What you do better or differently",
  });

  if (products && !has("prices")) {
    ask({
      key: "prices",
      title: food ? "What will most of your items sell for?" : "What will most of your products sell for?",
      why: "Your plan’s money section uses the prices you give, and only those.",
      options: [["under_10", "Under $10"], ["10_25", "$10 to $25"], ["25_50", "$25 to $50"], ["50_100", "$50 to $100"], ["over_100", "Over $100"], NOT_SURE],
      multiple: false,
      otherHint: "Your items and prices, such as “Sourdough loaf, $9”",
    });
  }

  if (services) {
    ask({
      key: "pricing",
      title: "How will you charge for your work?",
      why: "Your plan explains how the business earns money.",
      options: opts(
        [["per_job", tagged("lawn") ? "A set price per visit" : category === "lessons_care" ? "A set price per lesson or session" : "A set price per job"]],
        category !== "home_services" ? [["hourly", "By the hour"]] : [["hourly", "By the hour"], ["quote", "A quote for each job"]],
        [["recurring", category === "lessons_care" ? "Monthly or weekly packages" : "A regular plan, such as weekly or monthly"]],
        category === "personal_care" ? [["menu", "A menu of services with set prices"]] : null,
        [NOT_SURE],
      ),
      multiple: false,
      otherHint: "Describe how you’ll charge",
    });
    if (sells === "services" && !has("prices")) {
      const unit = category === "lessons_care" ? "lesson or session" : category === "personal_care" ? "appointment" : tagged("lawn") ? "visit" : "job";
      ask({
        key: "prices",
        title: `About what will a typical ${unit} cost a customer?`,
        why: "Your plan’s money section uses the prices you give, and only those.",
        options: [["under_50", "Under $50"], ["50_100", "$50 to $100"], ["100_250", "$100 to $250"], ["over_250", "Over $250"], NOT_SURE],
        multiple: false,
        otherHint: "Your prices, such as “$45 for a weekly mow”",
      });
    }
    ask(serviceAreaQuestion(category, city, profile.location.county));
  }

  if (products && (food || handmade) && !resale) {
    ask({
      key: "supplies",
      title: food ? "Where will you buy your ingredients?" : "Where will you get your materials?",
      why: "The operations section explains how you make what you sell.",
      options: food
        ? [["grocery", "Grocery and warehouse stores"], ["local", "Local farms and growers"], ["wholesale", "Restaurant or wholesale suppliers"], ["online", "Online suppliers"], ["own", "I grow or make some myself"]]
        : [["stores", "Craft and hardware stores"], ["wholesale", "Wholesale suppliers"], ["online", "Online suppliers"], ["reclaimed", "Reclaimed or secondhand materials"], ["local", "Local makers and suppliers"]],
      multiple: true,
      otherHint: food ? "Where your ingredients come from" : "Where your materials come from",
    });
  }

  if (products && resale && !has("stock")) {
    ask({
      key: "supplies",
      title: "Where will your stock come from?",
      why: "The operations section explains how you buy what you sell.",
      options: [["new_wholesale", INVENTORY_SOURCE_LABELS.new_wholesale], ["secondhand", INVENTORY_SOURCE_LABELS.secondhand], ["consignment", INVENTORY_SOURCE_LABELS.consignment], ["own_designs", INVENTORY_SOURCE_LABELS.own_designs]],
      multiple: true,
      otherHint: "Where your stock comes from",
    });
  }

  if (!has("marketing")) {
    ask({
      key: "reach",
      title: "How will people hear about you?",
      why: "The marketing section describes how you’ll find customers.",
      options: opts(
        [["word", "Word of mouth and referrals"], ["social", "Social media"]],
        services && [["neighborhood", "Neighborhood apps like Nextdoor"]],
        category === "home_services" && [["flyers", "Flyers and door hangers"]],
        products && markets && [["markets", "Markets and events"]],
        products && !markets && [["flyers", "Flyers and signs"]],
        food && [["samples", "Free samples"]],
        [["google", "A Google and maps listing"]],
        services && [["reviews", "Online reviews"]],
        (online || products) && [["website", "My own website or online shop"]],
        [["partners", "Partnerships with local businesses"]],
      ),
      multiple: true,
      otherHint: "Other ways people will find you",
    });
  }

  ask({
    key: "costs",
    title: "What will you spend money on to get started?",
    why: "The money section lists your starting costs. Amounts come from your answers, not guesses.",
    options: costOptions(profile, { food, resale, handmade, products, services, markets, online }),
    multiple: true,
    otherHint: "Other starting costs, with amounts if you know them",
  });

  ask({
    key: "funding",
    title: "Where will the starting money come from?",
    why: "Lenders and programs ask how the business is paid for.",
    options: opts(
      [["savings", "My own savings"], ["family", "Family or friends"]],
      profile.takesOnDebt !== "no" && [["loan", "A small business loan"], ["credit", "A credit card"]],
      [["sales", "Early sales"], ["grant", "A grant or local program"], NOT_SURE],
    ),
    multiple: true,
    otherHint: "Where the money will come from",
  });

  if (!has("sales_goal")) {
    ask({
      key: "sales_goal",
      title: "What do you hope to sell in your first year?",
      why: "Your plan states your goal in your words. It won’t add projections of its own.",
      options: [["under_5k", SALES_LABELS.under_5k], ["5k_25k", SALES_LABELS["5k_25k"]], ["25k_100k", SALES_LABELS["25k_100k"]], ["over_100k", SALES_LABELS.over_100k], NOT_SURE],
      multiple: false,
      otherHint: "Your sales goal in your own words",
    });
  }

  if (!has("help")) {
    ask({
      key: "help",
      title: "Will anyone help you run it?",
      why: "The management section says who does the work.",
      options: opts(
        [["alone", "Just me for now"], ["family", "Family helping out"]],
        category === "home_services" ? [["crew", "A crew I hire"]] : [["part_time", "Part-time helpers"]],
        [["contractors", "Freelancers or contractors"], ["employees", "Employees"]],
      ),
      multiple: true,
      otherHint: "Who will help",
    });
  }

  ask({
    key: "background",
    title: "What experience do you bring?",
    why: "The management section describes the skills behind the business.",
    options: backgroundOptions(category, { food, resale, handmade, services }),
    multiple: true,
    otherHint: "Your experience in your own words",
  });

  if (!has("launch")) {
    ask({
      key: "launch",
      title: "When do you plan to make your first sale?",
      why: "Your plan’s milestones start from this.",
      options: [["within_1_month", LAUNCH_TIMING_LABELS.within_1_month], ["1_3_months", LAUNCH_TIMING_LABELS["1_3_months"]], ["3_6_months", LAUNCH_TIMING_LABELS["3_6_months"]], ["later", LAUNCH_TIMING_LABELS.later], NOT_SURE],
      multiple: false,
      otherHint: "A date or month",
    });
  }

  return questions;
}

function customerOptions(category: BusinessProfile["category"], products: boolean, services: boolean, online: boolean): Options {
  switch (category) {
    case "baked_goods":
    case "packaged_food":
      return opts(
        [["neighbors", "Neighbors and local families"], ["market", "Shoppers at farmers markets and fairs"], ["parties", "People ordering for parties and celebrations"]],
        [["offices", "Offices and workplaces"], ["gifts", "Gift buyers, especially at holidays"], ["shops", "Cafés and shops that resell"]],
        online && [["online", "Online shoppers"]],
      );
    case "prepared_food":
      return [["families", "Busy families who want ready meals"], ["events", "Event hosts who need catering"], ["offices", "Office lunches and meetings"], ["market", "People at markets and events"]];
    case "woodworking":
    case "crafts":
      return opts(
        [["gifts", "Gift shoppers"], ["home", "People decorating their homes"], ["fairs", "Shoppers at craft fairs and markets"]],
        [["online", "Online shoppers, such as on Etsy"], ["shops", "Shops that carry local makers"]],
      );
    case "clothing_boutique":
    case "resale_shop":
      return [["local", "Local shoppers"], ["gifts", "Gift shoppers"], ["bargain", "Bargain and vintage hunters"], ["online", "Online shoppers"], ["visitors", "Visitors and tourists"]];
    case "personal_care":
      return [["regulars", "Regular local clients"], ["events", "Brides and event parties"], ["professionals", "Busy professionals"], ["students", "Students and young adults"]];
    case "home_services":
      return [["homeowners", "Homeowners nearby"], ["renters", "Renters and apartment residents"], ["families", "Busy families"], ["older", "Older adults who want help at home"], ["landlords", "Landlords and property managers"], ["offices", "Small businesses and offices"]];
    case "lessons_care":
      return [["parents", "Parents of school-age children"], ["adults", "Adults learning for fun"], ["students", "Students preparing for tests"], ["groups", "Schools, clubs and community groups"]];
    case "creative_services":
      return [["small_business", "Small businesses"], ["individuals", "Families and individuals"], ["events", "Event hosts and couples"], ["nonprofits", "Nonprofits and community groups"]];
    default:
      return opts(
        [["local", products ? "Local shoppers" : "Local households"]],
        products && [["gifts", "Gift shoppers"], ["market", "Shoppers at markets and events"]],
        (products && online) || (!products && !services) ? [["online", "Online shoppers"]] : null,
        services && [["small_business", "Small businesses"], ["professionals", "Busy professionals"]],
      );
  }
}

interface Kinds {
  food: boolean;
  resale: boolean;
  handmade: boolean;
  products: boolean;
  services: boolean;
}

function differentOptions(category: BusinessProfile["category"], kinds: Kinds): Options {
  if (kinds.resale && !kinds.services) {
    return [["curated", "A carefully chosen selection"], ["unique", "Pieces you can’t find elsewhere"], ["price", "Better prices"], ["personal", "Friendly, personal service"], ["local", "Local and community-minded"]];
  }
  return opts(
    kinds.food && [["fresh", "Fresh, quality ingredients"], ["small_batch", "Made by hand in small batches"], ["recipes", "Family or original recipes"], ["diets", "Options for special diets"]],
    kinds.handmade && [["quality", "Quality materials and careful work"], ["handmade", "Handmade, one of a kind"], ["designs", "Original designs"]],
    kinds.products && [["custom", "Custom orders made to request"]],
    kinds.services && [["reliable", "Reliable and on time"], ["personal", "Personal attention"], ["flexible", "Flexible scheduling"]],
    kinds.services && category === "home_services" && [["eco", "Eco-friendly methods"]],
    kinds.services && category === "lessons_care" && [["tailored", "Lessons tailored to each person"]],
    kinds.services && [["experience", "Experience or training"]],
    [["fair_price", "Fair, clear prices"], ["local", "Local and personal"]],
    kinds.products && [["convenient", "Easy pickup or delivery"]],
  );
}

function serviceAreaQuestion(category: BusinessProfile["category"], city: string, county: string): PlanQuestion {
  if (category === "home_services") {
    return {
      key: "service_area",
      title: "Where will you take jobs?",
      why: "The operations section says where you work.",
      options: opts(
        [["nearby", "My neighborhood and nearby"]],
        [["city", city ? `All of ${city}` : "My whole town or city"], ["region", city ? `${city} and nearby towns` : "My town and nearby towns"]],
        county.trim() ? [["county", `Across ${countyLabel(county)}`]] : null,
      ),
      multiple: false,
      otherHint: "The area you’ll serve",
    };
  }
  return {
    key: "service_area",
    title: "Where will you work with customers?",
    why: "The operations section says where you work.",
    options: [["their_place", "At their home or business"], ["my_place", "At my place"], ["studio", "At a rented space or studio"], ["online", "Online or by phone"]],
    multiple: true,
    otherHint: "Where you’ll work with customers",
  };
}

function costOptions(profile: BusinessProfile, kinds: Kinds & { markets: boolean; online: boolean }): Options {
  const tagged = (tag: string) => profile.productTags.includes(tag);
  const space = profile.premises === "rented_space" || profile.channels.includes("storefront");
  const booth = kinds.products && kinds.markets ? ([["booth", "Market booth fees, a tent and a table"]] as Options) : null;
  const shop = (kinds.online || profile.channels.includes("social_media")) && kinds.products ? ([["website", "Website or online shop fees"]] as Options) : null;
  const permits: Options = [["permits", "Permits and licenses"]];
  switch (profile.category) {
    case "baked_goods":
    case "packaged_food":
    case "prepared_food":
      return opts(
        [["equipment", profile.category === "baked_goods" ? "Baking equipment and pans" : "Kitchen equipment"], ["ingredients", "First batch of ingredients"], ["packaging", "Packaging and labels"]],
        booth,
        space && [["rent", "Kitchen rent and deposit"]],
        permits,
        [["training", "Food handler training"]],
        shop,
      );
    case "woodworking":
    case "crafts":
      return opts([["tools", "Tools and equipment"], ["materials", "First materials"], ["packaging", "Packaging and shipping supplies"]], booth, shop, permits);
    case "clothing_boutique":
    case "resale_shop":
      return opts(
        [["inventory", "First stock"]],
        space && [["fixtures", "Racks, shelves and displays"], ["rent", "Rent and deposit for a space"]],
        [["card_reader", "A card reader or point-of-sale system"]],
        booth,
        shop,
        permits,
      );
    case "home_services":
      return opts(
        [["equipment", tagged("lawn") ? "Mower, trimmer and blower" : tagged("cleaning") ? "Cleaning equipment" : "Tools and equipment"]],
        [["supplies", tagged("lawn") ? "Fuel, blades and supplies" : "Supplies"], ["vehicle", tagged("lawn") || tagged("moving") ? "A truck or trailer" : "A vehicle or travel costs"]],
        [["insurance", "Insurance"], ["advertising", "Advertising"]],
        permits,
      );
    case "personal_care":
      return opts([["equipment", "Chairs, tools and equipment"], ["supplies", "Products and supplies"], ["space", "Booth or suite rent"], ["license", "License fees and training"], ["insurance", "Insurance"]]);
    case "lessons_care":
      return opts([["materials", "Books and teaching materials"], ["equipment", "Instruments or equipment"], ["space", "Space rental"], ["training", "Training or certification"], ["insurance", "Insurance"], ["advertising", "Advertising"]]);
    case "creative_services":
      return opts([["equipment", "Camera, computer or other equipment"], ["software", "Software subscriptions"], ["website", "A website"], ["insurance", "Insurance"], ["advertising", "Advertising"]]);
    default:
      return opts(
        [["equipment", "Tools and equipment"]],
        kinds.products && [["materials", "Materials or first stock"], ["packaging", "Packaging"]],
        kinds.services && [["supplies", "Supplies"], ["insurance", "Insurance"]],
        booth,
        shop ?? [["website", "A website"]],
        [["advertising", "Advertising"]],
        permits,
      );
  }
}

function backgroundOptions(category: BusinessProfile["category"], kinds: Omit<Kinds, "products">): Options {
  const craft = category === "baked_goods" ? "baking" : kinds.food ? "cooking" : "making these";
  return opts(
    kinds.food && [["hobby", `Years of ${craft} for family and friends`], ["work", "Work in a restaurant, bakery or café"], ["training", "Culinary or food safety training"]],
    kinds.handmade && [["hobby", "Years of making these as a hobby"], ["training", "Classes or training in the craft"]],
    kinds.resale && [["retail", "Work in retail"], ["eye", "A good eye for style or finds"]],
    kinds.services && [["work", "Paid work in this field"], ["training", "Training, a license or a certificate"], ["informal", "Doing this for friends and neighbors"]],
    [["business", "Business or management experience"]],
  ).filter(([value], index, all) => all.findIndex(([other]) => other === value) === index);
}

// Picks that fit the question, one for pick-one questions, and "Not sure yet" on its own
export function cleanAnswer(question: PlanQuestion, raw: PlanAnswer | undefined): PlanAnswer | null {
  if (!raw) return null;
  const allowed = new Set(question.options.map(([value]) => value));
  let picks = [...new Set(raw.picks.filter((pick) => allowed.has(pick)))];
  if (picks.includes(UNSURE)) picks = [UNSURE];
  if (!question.multiple) picks = picks.slice(0, 1);
  const other = raw.other === null ? null : raw.other.replace(/\s+/g, " ").trim().slice(0, MAX_OTHER);
  // A pick-one question takes either a pick or "Other"
  if (!question.multiple && picks.length && other !== null) return { picks, other: null };
  if (!picks.length && !other) return null;
  return { picks, other: other || null };
}

export function answerItems(question: PlanQuestion, answer: PlanAnswer): string[] {
  const labels = new Map(question.options);
  return [...answer.picks.map((pick) => labels.get(pick) ?? ""), answer.other ?? ""].filter(Boolean);
}

export function answerText(question: PlanQuestion, answer: PlanAnswer): string {
  return answerItems(question, answer).join("; ");
}

export function isUnsure(answer: PlanAnswer | undefined): boolean {
  return Boolean(answer?.picks.includes(UNSURE));
}

// Saved picks and edits that still fit the business. A pick whose wording changed, such as after the owner
// changed what they sell, is dropped; so is an edit to a fact that has since changed at its source.
export function restoreAnswers(
  basis: QuestionBasis,
  facts: readonly KnownFact[],
  saved: { picks: PlanAnswers; overrides: Record<string, string>; was?: Record<string, string> } | undefined,
  inputs: Readonly<Record<string, string>>,
): { picks: PlanAnswers; overrides: Record<string, string> } {
  if (!saved) return { picks: {}, overrides: {} };
  const overrides = Object.fromEntries(
    facts.flatMap((fact) => {
      const value = saved.overrides[fact.key];
      return value && (saved.was?.[fact.key] ?? fact.value) === fact.value ? [[fact.key, value]] : [];
    }),
  );
  const picks: PlanAnswers = {};
  for (const question of planQuestions(basis, saved.picks)) {
    const answer = cleanAnswer(question, saved.picks[question.key]);
    if (answer && answerText(question, answer) === inputs[question.key]) picks[question.key] = answer;
  }
  return { picks, overrides };
}
