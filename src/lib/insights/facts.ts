import { createHash } from "node:crypto";
import { PLATFORM_DATA } from "@/data/website-platforms";
import { DETAILS, type DetailKey, displayDetail } from "@/lib/details";
import { knownNumbers, PLAN_ANSWER_LABELS } from "@/lib/documents/business-plan";
import type { BusinessProfile, TaskStatus } from "@/lib/domain";
import { formatLaunchDate, profileToAnswers, summarize } from "@/lib/intake/answers";
import { STATUS_LABELS, type RequirementStatus } from "@/lib/research/applicability";
import type { PlatformId } from "@/lib/website/types";
import { FACT_AREAS, type FactArea, type InsightFeedback } from "./types";

// Everything SnapStart knows that helps with feedback. Owner names, addresses, emails and phone numbers stay out.

export interface InsightInputs {
  profile: BusinessProfile;
  decisions: { label: string; value: string }[];
  research: { checkedAt: string; requirements: { title: string; status: string; level: string }[]; openQuestions: number } | null;
  // mayApply: a rule still to settle, not a step yet
  steps: { id: string; key: string; title: string; status: TaskStatus; timing: "before_selling" | "later"; optional: boolean; mayApply: boolean }[];
  planAnswers: { question: string; answer: string }[];
  brand: { story: string; feel: string[]; tagline: string; customers: string; logoChosen: boolean; colors: string[] } | null;
  website: { platform: string | null; domain: string | null; words: "not drafted" | "drafted" | "approved"; setupStepsDone: number } | null;
  approvedPhotos: number;
}

// Loose shapes of what the data layer returns, so this stays testable without a database
export interface InsightSources {
  profile: BusinessProfile;
  details: readonly { key: string; value: string }[];
  research: {
    checkedAt: Date;
    openQuestions: readonly unknown[];
    requirements: readonly { title: string; status: RequirementStatus; level: string; fitsStructure: boolean }[];
  } | null;
  steps: readonly {
    id: string;
    key: string;
    title: string;
    status: TaskStatus;
    timing: "before_selling" | "later";
    requirementStatus: string | null;
    retired: boolean;
    mayApply?: boolean;
  }[];
  planInputs: Record<string, string> | null;
  brand: { brief: { story: string; storyApproved: boolean; vibes: readonly string[]; tagline: string; customers: string } | null; chosenLogoId: string | null } | null;
  brandColors: readonly { name: string }[];
  website: { platform: PlatformId | null; domain: string | null; content: unknown; contentApprovedAt: Date | null; setupDone: readonly string[] } | null;
  approvedPhotos: number;
}

export const PICKUP_SAVED = "Saved on Your business";

const DECISION_KEYS: DetailKey[] = ["structure_choice", "name_registration_plan", "tax_classification_plan", "business_purpose"];

export function buildInputs(sources: InsightSources): InsightInputs {
  const brief = sources.brand?.brief ?? null;
  const website = sources.website;
  return {
    profile: sources.profile,
    decisions: [
      ...DECISION_KEYS.flatMap((key) => {
        const value = sources.details.find((detail) => detail.key === key)?.value;
        return value ? [{ label: DETAILS[key].label, value: displayDetail(key, value) }] : [];
      }),
      // Whether it's written down, not the place itself, which may be a home address
      ...(sources.details.some((detail) => detail.key === "pickup_details") ? [{ label: DETAILS.pickup_details.label, value: PICKUP_SAVED }] : []),
    ],
    research: sources.research
      ? {
          checkedAt: sources.research.checkedAt.toISOString(),
          requirements: sources.research.requirements
            .filter((requirement) => requirement.fitsStructure)
            .map((requirement) => ({ title: requirement.title, status: STATUS_LABELS[requirement.status], level: requirement.level })),
          openQuestions: sources.research.openQuestions.length,
        }
      : null,
    steps: sources.steps
      .filter((step) => !step.retired)
      .map((step) => ({
        id: step.id,
        key: step.key,
        title: step.title,
        status: step.status,
        timing: step.timing,
        optional: step.requirementStatus === "optional" || step.requirementStatus === "outside_coverage",
        mayApply: Boolean(step.mayApply),
      })),
    planAnswers: Object.entries(PLAN_ANSWER_LABELS).flatMap(([key, question]) => {
      const answer = sources.planInputs?.[key]?.trim();
      return answer ? [{ question, answer }] : [];
    }),
    brand:
      brief || sources.brand?.chosenLogoId
        ? {
            story: brief?.storyApproved ? brief.story : "",
            feel: [...(brief?.vibes ?? [])],
            tagline: brief?.tagline ?? "",
            customers: brief?.customers ?? "",
            logoChosen: Boolean(sources.brand?.chosenLogoId),
            colors: sources.brandColors.map((color) => color.name),
          }
        : null,
    website: website
      ? {
          platform: website.platform ? PLATFORM_DATA[website.platform].name : null,
          domain: website.domain,
          words: website.contentApprovedAt ? "approved" : website.content ? "drafted" : "not drafted",
          setupStepsDone: website.setupDone.length,
        }
      : null,
    approvedPhotos: sources.approvedPhotos,
  };
}

function areaValues(inputs: InsightInputs): Record<FactArea, unknown> {
  return {
    answers: inputs.profile,
    plan: { research: inputs.research, steps: inputs.steps },
    decisions: inputs.decisions,
    business_plan: inputs.planAnswers,
    brand: inputs.brand,
    website: inputs.website,
    photos: inputs.approvedPhotos,
  };
}

// One hash per area, saved with the insights
export function basisOf(inputs: InsightInputs): Record<FactArea, string> {
  const values = areaValues(inputs);
  return Object.fromEntries(
    FACT_AREAS.map((area) => [area, createHash("sha256").update(JSON.stringify(values[area]) ?? "null").digest("hex").slice(0, 32)]),
  ) as Record<FactArea, string>;
}

// Areas that changed since the insights were written; areas saved before they existed are skipped
export function changedAreas(saved: Partial<Record<FactArea, string>>, current: Record<FactArea, string>): FactArea[] {
  return FACT_AREAS.filter((area) => saved[area] !== undefined && saved[area] !== current[area]);
}

const DAY = 86_400_000;

// Worked out in code, so the model never does date math
export function launchFacts(launchDate: string | null, today: Date): { date: string; daysAway: number } | null {
  if (!launchDate) return null;
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return { date: formatLaunchDate(launchDate), daysAway: Math.round((Date.parse(`${launchDate}T00:00:00Z`) - start) / DAY) };
}

// The name to use in prompts: null when unnamed, or when it's the owner's own name
export function promptName(profile: BusinessProfile): string | null {
  return profile.name && profile.nameIsLegalName !== "yes" ? profile.name : null;
}

function answerRows(profile: BusinessProfile) {
  const hideName = Boolean(profile.name) && !promptName(profile);
  return summarize(profileToAnswers(profile), { followUps: true }).filter(
    (row) => row.value && !(hideName && row.fields.some((field) => field === "name" || field === "nameIsLegalName")),
  );
}

function planCounts(inputs: InsightInputs) {
  const required = inputs.steps.filter((step) => step.timing === "before_selling" && !step.optional && !step.mayApply);
  return { stepsBeforeSelling: required.length, stepsBeforeSellingDone: required.filter((step) => step.status === "done").length };
}

// Counts and dates SnapStart works out itself, which the model may repeat
export function appNumbers(inputs: InsightInputs, today: Date): Set<string> {
  const counts = planCounts(inputs);
  const values = [
    counts.stepsBeforeSelling,
    counts.stepsBeforeSellingDone,
    inputs.steps.length,
    inputs.steps.filter((step) => step.status === "done").length,
    launchFacts(inputs.profile.launchDate, today)?.daysAway,
    inputs.approvedPhotos,
    inputs.research?.requirements.length,
    inputs.research?.openQuestions,
    inputs.website?.setupStepsDone,
  ];
  return new Set(values.flatMap((value) => (typeof value === "number" ? [String(Math.abs(value))] : [])));
}

// Numbers the owner gave, like their budget, launch date or prices; counts SnapStart adds don't count
export function ownerNumbers(inputs: InsightInputs): Set<string> {
  const text = [
    ...answerRows(inputs.profile).map((row) => row.value),
    ...inputs.planAnswers.map((each) => each.answer),
    ...inputs.decisions.map((each) => each.value),
    inputs.brand?.tagline ?? "",
    inputs.brand?.customers ?? "",
  ].join("\n");
  return knownNumbers(text);
}

export function factsMessage(inputs: InsightInputs, feedback: InsightFeedback, today: Date): string {
  const { profile } = inputs;
  const answers = answerRows(profile).map((row) => ({ question: row.label, answer: row.value, ...(row.unsure ? { notSure: true } : {}) }));
  const facts = {
    businessName: promptName(profile) ?? "your business",
    launch: launchFacts(profile.launchDate, today),
    answers,
    decisions: inputs.decisions,
    requirements: inputs.research ? { found: inputs.research.requirements, openQuestions: inputs.research.openQuestions } : "Not checked yet",
    startupPlan: inputs.steps.length
      ? {
          ...planCounts(inputs),
          // Ids stay out: the model names a step by its key
          steps: inputs.steps.map(({ key, title, status, timing, optional, mayApply }) => ({ key, title, status, timing, optional, ...(mayApply ? { mayApply } : {}) })),
        }
      : "No licenses and registrations listed yet",
    businessPlanAnswers: inputs.planAnswers.length ? inputs.planAnswers : "No business plan yet",
    brand: inputs.brand ?? "Not started",
    website: inputs.website ?? "Not started",
    approvedProductPhotos: inputs.approvedPhotos,
  };
  const marked = (mark: "useful" | "dismissed") =>
    Object.values(feedback)
      .filter((entry) => entry.mark === mark)
      .map((entry) => entry.title);
  const reactions = { foundUseful: marked("useful"), dismissed: marked("dismissed") };
  const json = (value: unknown) => JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
  return `<facts>\n${json(facts)}\n</facts>\n\n<feedback>\n${json(reactions)}\n</feedback>`;
}
