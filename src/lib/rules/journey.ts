import type { BusinessStructure } from "@/lib/domain";
import { STRUCTURE_NAMES } from "@/lib/research/applicability";
import { getSection } from "@/lib/sections";

// Plain code: how far the owner is through starting the business, and the one thing to do next.

// "check": something changed and waits for the owner; "anytime": no done state, like the library
export type StageState = "done" | "now" | "check" | "todo" | "anytime";

export interface JourneyInput {
  // "update": saved answers no longer match the questions and need re-answering
  business: "none" | "update" | "done";
  businessSummary: string | null;
  researched: boolean;
  // Answers changed since the requirements were checked
  answersChanged: boolean;
  structure: { structure: BusinessStructure | null; from: "decision" | "registered" | null };
  plan: {
    steps: number;
    proposal: boolean;
    // Required before selling; optional steps and later ones left out
    beforeSelling: { total: number; done: number };
    // later: it comes after the first sale; structure: it's the step that chooses one
    first: { id: string; title: string; later: boolean; structure: boolean } | null;
  };
  documents: { total: number; waiting: number };
}

export interface Stage {
  href: string;
  title: string;
  state: StageState;
  detail: string;
}

export interface NextMove {
  title: string;
  why: string;
  href: string;
  action: string;
  // Set when the next move is a step in the plan
  stepId: string | null;
  // The stage it belongs to, by section
  stage: string;
}

export function journeyStages(input: JourneyInput): Stage[] {
  const stage = (href: string, state: StageState, detail: string): Stage => ({ href, title: getSection(href).title, state, detail });
  const { plan, structure, documents } = input;
  const ready = plan.beforeSelling.done === plan.beforeSelling.total;

  const stages = [
    input.business === "done"
      ? stage("/business", "done", input.businessSummary || "Your answers are saved.")
      : input.business === "update"
        ? stage("/business", "check", "Some answers need a quick update.")
        : stage("/business", "todo", "Where you are, what you sell, and who owns it."),
    !input.researched
      ? stage("/requirements", "todo", "Not checked yet. First Sale checks official government sites for you.")
      : input.answersChanged
        ? stage("/requirements", "check", "Your answers changed since they were checked.")
        : stage("/requirements", "done", "Checked on official government sites."),
    structure.structure
      ? stage("/structure", "done", `${structure.from === "registered" ? "Already registered as" : "You chose"} ${STRUCTURE_NAMES[structure.structure]}.`)
      : stage("/structure", "todo", "Compare a sole proprietorship, an LLC and more, then choose."),
    plan.proposal
      ? stage("/checklist", "check", "Changes to your plan are waiting for your review.")
      : !plan.steps
        ? stage("/checklist", "todo", input.researched ? "Your last check didn’t turn up any steps." : "Built from your requirements once they’re checked.")
        : ready
          ? stage("/checklist", "done", plan.beforeSelling.total ? `All ${plan.beforeSelling.total} steps before your first sale are done.` : "Nothing in your plan has to come before your first sale.")
          : stage("/checklist", "todo", `${plan.beforeSelling.done} of ${plan.beforeSelling.total} steps done before your first sale.`),
    documents.waiting
      ? stage("/documents", "check", `${documents.waiting === 1 ? "A form needs" : `${documents.waiting} forms need`} your review.`)
      : stage(
          "/documents",
          "anytime",
          documents.total
            ? `${documents.total} ${documents.total === 1 ? "document" : "documents"}. Add papers you already have any time.`
            : "Upload papers you already have, or get help with a form.",
        ),
  ];
  // Up next is wherever "Do this next" points, so the two never disagree
  const { stage: current } = nextMove(input);
  return stages.map((each) => (each.href === current && each.state === "todo" ? { ...each, state: "now" } : each));
}

export function nextMove(input: JourneyInput): NextMove {
  const move = (title: string, why: string, href: string, action: string): NextMove => ({
    title,
    why,
    href,
    action,
    stepId: null,
    stage: href.startsWith("/business") ? "/business" : href,
  });
  const { plan } = input;
  if (input.business === "none") {
    return move("Tell us about your business", "Your answers decide which registrations, licenses and permits apply to you.", "/business/new", "Start here");
  }
  if (input.business === "update") {
    return move("Update your business answers", "Some questions changed since you answered them. Your answers decide what applies to you.", "/business/edit", "Update your answers");
  }
  if (plan.proposal) {
    return move("Review the changes to your licenses and registrations", "Some steps changed. Nothing in your plan changes until you OK it.", "/checklist", "Review the changes");
  }
  if (!input.researched) {
    return move(
      "Find out what you need to open",
      "First Sale checks official government sites for what applies to you, then puts what you need to file in order.",
      "/requirements",
      "Find my requirements",
    );
  }
  if (input.answersChanged) {
    return move("See what your new answers change", "You changed some answers since your requirements were checked.", "/requirements", "See what changed");
  }
  if (plan.first) {
    const why = !plan.first.later
      ? "This is your next step before your first sale."
      : plan.beforeSelling.done === plan.beforeSelling.total
        ? "Everything you need before your first sale is done. This one comes later."
        : "Your other steps are waiting to hear back or on another step. You can start this one, for later, in the meantime.";
    // Choosing a structure happens on its own page, step 3
    if (plan.first.structure) return { title: plan.first.title, why, href: "/structure", action: "Compare your options", stepId: null, stage: "/structure" };
    return { title: plan.first.title, why, href: `/checklist/${plan.first.id}`, action: "Open this step", stepId: plan.first.id, stage: "/checklist" };
  }
  if (!plan.steps) {
    return move("Check your requirements again", "Your last check didn’t turn up any steps.", "/requirements", "Check again");
  }
  if (!input.structure.structure) {
    return move("Choose how to set up your business", "Your structure decides which formation steps you need.", "/structure", "Compare your options");
  }
  if (plan.beforeSelling.done === plan.beforeSelling.total) {
    return move("You’re ready for your first sale", "Every step you need before selling is done. Steps for later stay in your plan.", "/checklist", "See your plan");
  }
  // Only steps that are submitted or waiting on another step are left
  return move("Wait to hear back", "Your next steps start once the ones you submitted are approved. Mark each one when you hear back.", "/checklist", "See your plan");
}
