import { BUSINESS_STRUCTURES, type BusinessProfile, type BusinessStructure, type JurisdictionLevel, type PlanTopic, type RequirementDraft, type UsStateCode, type VerificationState } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";

// Plain rules over a checked requirement and the owner's confirmed answers: does it apply, and on what.
// "Unsure" and unanswered are unknowns, never "no". The owner's place comes from their answers, never a ZIP code.

export const REQUIREMENT_STATUSES = ["verified", "conditional", "optional", "needs_confirmation", "outside_coverage", "not_needed", "to_find_out"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const STATUS_LABELS: Record<RequirementStatus, string> = {
  verified: "Applies to you",
  conditional: "Depends on something",
  optional: "Your choice",
  needs_confirmation: "Applies to you",
  outside_coverage: "Outside what we check",
  not_needed: "Not needed",
  to_find_out: "To find out",
};

export const STATUS_HELP: Record<RequirementStatus, string> = {
  verified: "An official page confirms this, and it fits your answers.",
  conditional: "It applies only if something is true. Each one says what.",
  optional: "Not required, but worth knowing about.",
  needs_confirmation: "Official pages don’t spell this out for your area, so SnapStart decided from how it works for businesses like yours. Each one says why.",
  outside_coverage: "SnapStart doesn’t research this kind of requirement. Each one links to who does.",
  not_needed: "SnapStart looked into it, and it doesn’t apply to a business like yours. Each one says why.",
  to_find_out: "SnapStart searched the office’s own site and still couldn’t say for sure. Each one says how to find out.",
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
  // The deeper look's decision on a rule no official page settled
  verdict?: Verdict | null;
};

export const VERDICTS = ["applies", "not_needed", "unclear"] as const;
export type Verdict = (typeof VERDICTS)[number];

// The owner's answer to a question about their own plans; "unsure" plans on the step, so they're covered
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

// What a government requires is for SnapStart to decide, never a question for the owner: only facts about their own plans are asked
const ABOUT_RULES =
  /\b(require[sd]?|requiring|allows?|allowed|prohibits?|bans?|approv\w*|permits?|permitted|licen[cs]\w*|regist\w*|files?|filing|dba|zon\w*|compl(y|ies|iance)|rules?|regulat\w*|ordinances?|exempt\w*|inspect\w*|county|city)\b/i;
export const asksAboutRules = (condition: string) => ABOUT_RULES.test(condition);

// Conditional with no reason given is still a question, never a "yes"
export function questionOf(requirement: Pick<Checked, "applicability" | "condition">): string | null {
  if (requirement.applicability !== "conditional") return null;
  const condition = requirement.condition.trim();
  if (condition && asksAboutRules(condition)) return null;
  return condition || "Whether this applies depends on something SnapStart couldn’t tell from your answers.";
}

// Conditions the rules write (structure and place), as opposed to the model's own
export const RULE_CONDITION = /^(Only if you set up as |Which county you’re in decides|City requirements apply only inside|Applies only if your address is inside|You said you’re outside)/;

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
    requirement.verdict === "not_needed"
      ? "not_needed"
      : requirement.applicability === "outside_coverage" && !requirement.verdict
        ? "outside_coverage"
        : requirement.applicability === "optional"
          ? "optional"
          : conditions.length
            ? "conditional"
            : requirement.verdict === "unclear"
              ? "to_find_out"
              : requirement.verification === "sourced"
                ? "verified"
                : "needs_confirmation";
  return { status, conditions, fitsStructure, alreadyHave: alreadyHave(requirement, profile), question, answer: answered };
}

// City rules apply only inside city limits, and county rules need the county
export function placeConditions(level: JurisdictionLevel, place: Place): string[] {
  if (level === "county" && !place.county) return ["Which county you’re in decides this. Add your county to your answers."];
  if (level !== "city") return [];
  if (!place.city) return ["City requirements apply only inside a city’s limits. Add your city to your answers."];
  if (place.insideCity === "unknown") {
    return [`Applies only if your address is inside ${place.city} city limits, which you haven’t confirmed yet. A mailing address can name a city you’re not in.`];
  }
  if (place.insideCity === "no") {
    return [`You said you’re outside ${place.city} city limits, so ${place.city}’s requirements may not apply. Your township or village may have its own.`];
  }
  return [];
}

// What's missing about the owner's place for a rule at this level, as the fix in their answers
export function placeGap(level: JurisdictionLevel, place: Place): { action: string } | null {
  if (level === "county" && !place.county) return { action: "Add your county to your answers" };
  if (level !== "city") return null;
  if (!place.city) return { action: "Add your city to your answers" };
  if (place.insideCity === "unknown") return { action: `Confirm whether you’re inside ${place.city} city limits` };
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

const ABOUT_EMPLOYEES = /\b(employ(ee|ees|ing)?|hir(e|es|ed|ing)|staff|workers?|payroll)\b/i;
const ABOUT_CONTRACTORS = /\b(contractors?|freelanc\w*|1099)\b/i;
const LATER_ON = /\b(ever|future|later|eventually|someday|next few years|after (you|your) (open|launch|first sale))\b/i;

export interface IntakeAnswer {
  // Null when the intake answer doesn't settle it
  answer: ConditionAnswer | null;
  // Said before the question when it asks about a different time than the intake did
  note: string | null;
}

// A question the owner's answers about their business already settle, so it isn't asked twice
export function intakeAnswer(question: string, profile: Pick<BusinessProfile, "hiringPlans" | "helpKinds">): IntakeAnswer | null {
  if (!ABOUT_EMPLOYEES.test(question) || ABOUT_CONTRACTORS.test(question) || !profile.hiringPlans || profile.helpKinds.includes("unsure")) return null;
  if (profile.hiringPlans !== "not_now" || profile.helpKinds.includes("employees")) return { answer: "yes", note: null };
  // "Not for now" covers now and the first year, which has its own answer; later on is still asked
  if (LATER_ON.test(question)) return { answer: null, note: "You said you’re not hiring for now. This asks about later on." };
  return { answer: "no", note: null };
}
