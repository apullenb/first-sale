import { type ActionStep, nextActions } from "./next-action";
import { neededBeforeSelling } from "./progress";

// Plain code: whether each step in the sidebar is done, waiting on someone else, or still the owner's to do

export type PartState = "done" | "waiting" | "todo";

export interface PartStatus {
  state: PartState;
  // Plan steps the owner can do now, and their time; zero elsewhere
  count: number;
  minutes: number;
}

export interface JourneyFacts {
  // Saved answers that still fit the questions
  business: boolean;
  research: "none" | "stale" | "current";
  structureChosen: boolean;
  // Startup plan steps needed before selling: ready for the owner now, all not started (with their time), and sent in
  plan: { exists: boolean; proposal: boolean; ready: number; left: number; minutes: number; waiting: number };
  // Library documents with answers for the owner to check or facts that changed
  libraryToCheck: number;
  logoChosen: boolean;
  logoVersionsApproved: boolean;
  websiteLive: boolean;
  products: number;
  marketingApproved: boolean;
  // Accounts the owner picked in their marketing plan, and the ones they already have
  socialPlatforms: readonly string[];
  socialHave: readonly string[];
  // "I already have this" marks by key
  marks: ReadonlySet<string>;
}

export type SidebarStatus = Record<string, PartStatus>;

// Brand steps the owner can mark "I already have this"; social accounts add their platform, like "social:instagram"
export const MARK_KEYS = ["logo", "brand", "website", "products", "marketing", "social"] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

const DONE: PartStatus = { state: "done", count: 0, minutes: 0 };
const TODO: PartStatus = { state: "todo", count: 0, minutes: 0 };
const either = (done: boolean) => (done ? DONE : TODO);

export function sidebarStatus(facts: JourneyFacts): SidebarStatus {
  const marked = (key: string) => facts.marks.has(key);
  const { plan } = facts;
  return {
    "/business": either(facts.business),
    "/requirements": either(facts.research === "current"),
    "/structure": either(facts.structureChosen),
    "/checklist":
      !plan.exists || plan.proposal || plan.ready
        ? { state: "todo", count: plan.left, minutes: plan.minutes }
        : plan.waiting || plan.left
          ? { state: "waiting", count: 0, minutes: 0 }
          : DONE,
    // Not a step: just a count of documents to check
    "/documents": { state: facts.libraryToCheck ? "todo" : "done", count: facts.libraryToCheck, minutes: 0 },
    "/logo": either(facts.logoChosen || marked("logo")),
    "/brand": either(facts.logoVersionsApproved || marked("brand")),
    "/website": either(facts.websiteLive || marked("website")),
    "/products": either(facts.products > 0 || marked("products")),
    "/marketing": either(facts.marketingApproved || marked("marketing")),
    "/social": either(
      marked("social") ||
        (facts.socialPlatforms.length > 0 && facts.socialPlatforms.every((platform) => facts.socialHave.includes(platform) || marked(`social:${platform}`))),
    ),
  };
}

// A section is done once nothing in it is left for the owner; it's waiting if any step still is
export function sectionState(status: SidebarStatus, hrefs: readonly string[]): PartState {
  const states = hrefs.flatMap((href) => status[href]?.state ?? []);
  if (!states.length || states.includes("todo")) return "todo";
  return states.includes("waiting") ? "waiting" : "done";
}

// Plan steps the owner can start now: ready ones, plus any unstarted step that holds up a needed one,
// even if it's optional or for later. Only steps held up by something sent in are truly waiting.
export function readyPlanSteps(steps: readonly ActionStep[]): number {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const { now, decide, waiting } = nextActions(steps);
  const ready = new Set([...now, ...decide].map((step) => step.key));
  const seen = new Set<string>();
  const visit = (step: ActionStep) => {
    if (seen.has(step.key)) return;
    seen.add(step.key);
    const open = step.prerequisites.flatMap((key) => byKey.get(key) ?? []).filter((prerequisite) => prerequisite.status !== "done");
    if (!open.length) {
      if (step.status === "todo") ready.add(step.key);
      return;
    }
    for (const prerequisite of open) if (prerequisite.status === "todo") visit(prerequisite);
  };
  for (const { step } of waiting) if (neededBeforeSelling(step)) visit(step);
  return ready.size;
}
