import { BUSINESS_STRUCTURES, type BusinessProfile, type BusinessStructure, type JurisdictionLevel, type PlanTopic, type RequirementDraft, type UsStateCode, type VerificationState } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";

// Plain rules over a checked requirement and the owner's confirmed answers: does it apply, and on what.
// "Unsure" and unanswered are unknowns, never "no". The owner's place comes from their answers, never a ZIP code.

export const REQUIREMENT_STATUSES = ["verified", "conditional", "optional", "needs_confirmation", "outside_coverage"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  verified: "Applies to you",
  conditional: "Depends on something",
  optional: "Your choice",
  needs_confirmation: "To confirm",
  outside_coverage: "Outside what we check",
};

export const STATUS_HELP: Record<RequirementStatus, string> = {
  verified: "An official page confirms this, and it fits your answers.",
  conditional: "It applies only if something is true. Each one says what.",
  optional: "Not required, but worth knowing about.",
  needs_confirmation: "No official page confirmed it yet. That doesn’t mean it doesn’t apply.",
  outside_coverage: "First Sale doesn’t research this kind of rule. Each one links to who does.",
};

export interface Place {
  state: UsStateCode;
  stateName: string;
  // Without "County"; null when the owner hasn't said
  county: string | null;
  city: string | null;
  insideCity: "yes" | "no" | "unknown";
}

export function placeOf(profile: BusinessProfile): Place {
  const county = profile.location.county.trim().replace(/\s+(county|parish|borough)$/i, "");
  const city = profile.location.city.trim();
  const inside = profile.location.insideCityLimits;
  return {
    state: profile.location.state,
    stateName: STATE_NAMES[profile.location.state],
    county: county || null,
    city: city || null,
    insideCity: inside === "yes" || inside === "no" ? inside : "unknown",
  };
}

// Whose rule it is, in the owner's own place names rather than the registry's office names
export function jurisdictionName(level: JurisdictionLevel, place: Place): string {
  if (level === "federal") return "United States";
  if (level === "state") return place.stateName;
  if (level === "county") return place.county ? `${place.county} County` : "Your county";
  return place.city ?? "Your city";
}

export function placeLabel(place: Place): string {
  return [place.city, place.county ? `${place.county} County` : null, place.stateName].filter(Boolean).join(", ");
}

export interface StructureDecision {
  // Null while undecided
  structure: BusinessStructure | null;
  // "registered": the owner said they already registered as this
  from: "decision" | "registered" | null;
}

const isStructure = (value: unknown): value is BusinessStructure => (BUSINESS_STRUCTURES as readonly unknown[]).includes(value);

// The owner's saved choice wins; an existing registration counts when they haven't chosen
export function structureOf(profile: BusinessProfile, details: readonly { key: string; value: string }[]): StructureDecision {
  const choice = details.find((detail) => detail.key === "structure_choice")?.value;
  if (isStructure(choice)) return { structure: choice, from: "decision" };
  if (profile.stage === "registered" && isStructure(profile.registeredAs)) return { structure: profile.registeredAs, from: "registered" };
  return { structure: null, from: null };
}

export const STRUCTURE_NAMES: Record<BusinessStructure, string> = {
  sole_proprietorship: "a sole proprietorship",
  llc: "an LLC",
  partnership: "a partnership",
  corporation: "a corporation",
};

type Checked = Pick<RequirementDraft, "key" | "title" | "topic" | "level" | "applicability" | "condition" | "forStructures"> & {
  verification: VerificationState;
};

// The owner's answer to "does this apply to you?"; "unsure" is an answer, kept as an open question
export const CONDITION_ANSWERS = ["yes", "no", "unsure"] as const;
export type ConditionAnswer = (typeof CONDITION_ANSWERS)[number];

export interface Classified {
  status: RequirementStatus;
  // Plain sentences: what it depends on, the model's and the rules' together
  conditions: string[];
  // False when the owner's decided structure rules it out; kept as a record, left out of the plan
  fitsStructure: boolean;
  // The owner said they already have this
  alreadyHave: string | null;
  // The model's condition, asked of the owner; null when it doesn't depend on one
  question: string | null;
  answer: ConditionAnswer | null;
}

// What a government requires is for First Sale to confirm with the office, never a question for the owner
const ABOUT_RULES = /\b(require[sd]?|requiring|allows?|allowed|prohibits?|bans?)\b/i;
export const asksAboutRules = (condition: string) => ABOUT_RULES.test(condition);

// Conditional with no reason given is still a question, never a "yes"
export function questionOf(requirement: Pick<Checked, "applicability" | "condition">): string | null {
  if (requirement.applicability !== "conditional") return null;
  const condition = requirement.condition.trim();
  if (condition && asksAboutRules(condition)) return null;
  return condition || "Whether this applies depends on something First Sale couldn’t tell from your answers.";
}

// Conditions the rules write (structure and place), as opposed to the model's own
export const RULE_CONDITION = /^(Only if you set up as |Which county you’re in decides|City rules apply only inside|Applies only if your address is inside|You said you’re outside)/;

// "yes" settles the model's condition; "no" and "unsure" leave it open, and the rules' conditions stay either way
export function classify(requirement: Checked, profile: BusinessProfile, place: Place, decision: StructureDecision, answer: ConditionAnswer | null = null): Classified {
  const conditions: string[] = [];
  const question = questionOf(requirement);
  const answered = question ? answer : null;
  if (question && answered !== "yes") conditions.push(question);

  let fitsStructure = true;
  if (requirement.forStructures.length) {
    const names = new Intl.ListFormat("en-US", { type: "disjunction" }).format(requirement.forStructures.map((each) => STRUCTURE_NAMES[each]));
    if (!decision.structure) conditions.push(`Only if you set up as ${names}. Decide your business structure first.`);
    else if (!requirement.forStructures.includes(decision.structure)) fitsStructure = false;
  }
  conditions.push(...placeConditions(requirement.level, place));

  const status: RequirementStatus =
    requirement.applicability === "outside_coverage"
      ? "outside_coverage"
      : requirement.applicability === "optional"
        ? "optional"
        : conditions.length
          ? "conditional"
          : requirement.verification === "sourced"
            ? "verified"
            : "needs_confirmation";
  return { status, conditions, fitsStructure, alreadyHave: alreadyHave(requirement, profile), question, answer: answered };
}

// City rules apply only inside city limits, and county rules need the county
export function placeConditions(level: JurisdictionLevel, place: Place): string[] {
  if (level === "county" && !place.county) return ["Which county you’re in decides this. Add your county to your answers."];
  if (level !== "city") return [];
  if (!place.city) return ["City rules apply only inside a city’s limits. Add your city to your answers."];
  if (place.insideCity === "unknown") {
    return [`Applies only if your address is inside ${place.city} city limits, which you haven’t confirmed yet. A mailing address can name a city you’re not in.`];
  }
  if (place.insideCity === "no") {
    return [`You said you’re outside ${place.city} city limits, so ${place.city}’s rules may not apply. Your township or village may have its own.`];
  }
  return [];
}

// What's missing about the owner's place for a rule at this level: the fix, and a written question for whoever can tell them
export function placeGap(level: JurisdictionLevel, place: Place): { action: string; question: string; office: string } | null {
  const county = place.county ? `${place.county} County` : "county";
  if (level === "county" && !place.county) {
    return { action: "Add your county to your answers", question: "My business address is [your address]. Which county is it in?", office: "your county’s property tax office" };
  }
  if (level !== "city") return null;
  if (!place.city) {
    return {
      action: "Add your city to your answers",
      question: "My business address is [your address]. Is it inside a city’s limits, and which city?",
      office: `the ${county} planning office`,
    };
  }
  if (place.insideCity === "unknown") {
    return {
      action: `Confirm whether you’re inside ${place.city} city limits`,
      question: `My business address is [your address]. Is it inside the city limits of ${place.city}?`,
      office: `the ${county} property or planning office`,
    };
  }
  return null;
}

const ALREADY: { have: BusinessProfile["alreadyHave"][number]; topics: PlanTopic[]; pattern: RegExp; label: string }[] = [
  { have: "ein", topics: ["tax_registration", "employer"], pattern: /\bein\b|employer identification/i, label: "an EIN" },
  { have: "sales_tax", topics: ["tax_registration", "license_permit"], pattern: /sales tax|vendor/i, label: "a sales tax permit" },
  { have: "business_name", topics: ["name_registration"], pattern: /./, label: "a registered business name" },
  { have: "health_permit", topics: ["license_permit"], pattern: /health|food|bakery|kitchen/i, label: "a health or food permit" },
  { have: "local_license", topics: ["license_permit"], pattern: /business license|city|county/i, label: "a city or county business license" },
];

function alreadyHave(requirement: Pick<Checked, "key" | "title" | "topic">, profile: BusinessProfile): string | null {
  const text = `${requirement.key} ${requirement.title}`;
  const match = ALREADY.find((rule) => profile.alreadyHave.includes(rule.have) && rule.topics.includes(requirement.topic) && rule.pattern.test(text));
  return match ? `You told us you already have ${match.label}. If this is it, mark the step done once you’ve checked it’s current.` : null;
}
