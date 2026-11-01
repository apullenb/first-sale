import type { BusinessStructure } from "@/lib/domain";
import { STRUCTURE_NAMES } from "@/lib/research/applicability";
import { getSection } from "@/lib/sections";
import { progressLabel } from "@/lib/progress-labels";
import { PAPERWORK_PLACEHOLDER } from "./section-status";

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
  // recorded: the owner answered on Business structure, even "Not sure yet"
  structure: { structure: BusinessStructure | null; from: "decision" | "registered" | null; recorded: boolean };
  // Quick questions and place answers still open on What applies to you
  questions: number;
  plan: {
    // Paperwork tasks that apply
    steps: number;
    // Required before selling; later ones left out
    beforeSelling: { total: number; done: number };
    // later: it comes after the first sale
    first: { id: string; title: string; later: boolean; group: { name: string; href: string } } | null;
    // Filings that can't start until a structure is chosen
    waitsOnStructure: boolean;
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
  // Set when the next move is a task
  stepId: string | null;
  // The stage it belongs to
  stage: string;
}

const PAPERWORK = "/start";

// Ready means nothing is left before the first sale: no question, review or structure-dependent filing either
export function readyForFirstSale(input: JourneyInput): boolean {
  const { plan } = input;
  return (
    input.business === "done" &&
    input.researched &&
    !input.answersChanged &&
    !input.questions &&
    !plan.waitsOnStructure &&
    plan.steps > 0 &&
    plan.beforeSelling.done === plan.beforeSelling.total
  );
}

export function journeyStages(input: JourneyInput): Stage[] {
  const stage = (href: string, state: StageState, detail: string, title = getSection(href).title): Stage => ({ href, title, state, detail });
  const { plan, structure, documents } = input;
  const ready = plan.beforeSelling.done === plan.beforeSelling.total && !plan.waitsOnStructure;
  const paperwork = (state: StageState, detail: string) => stage(PAPERWORK, state, detail, PAPERWORK_PLACEHOLDER.title);

  const stages = [
    input.business === "done"
      ? stage("/business", "done", input.businessSummary || "Your answers are saved.")
      : input.business === "update"
        ? stage("/business", "check", "Some answers need a quick update.")
        : stage("/business", "todo", "Where you are, what you sell, and who owns it."),
    structure.structure
      ? stage("/structure", "done", `${structure.from === "registered" ? "Already registered as" : "You chose"} ${STRUCTURE_NAMES[structure.structure]}.`)
      : structure.recorded
        ? stage("/structure", "todo", "You’re not sure yet. Filings that depend on it wait until you choose.")
        : stage("/structure", "todo", "Compare a sole proprietorship, an LLC and more, then choose."),
    !input.researched
      ? stage("/requirements", "todo", "Not checked yet. SnapStart checks official government sites for you.")
      : input.answersChanged
        ? stage("/requirements", "check", "Your answers changed, so SnapStart updates what applies when you open it.")
        : input.questions
            ? stage("/requirements", "todo", `${input.questions} quick ${input.questions === 1 ? "question" : "questions"} left to answer.`)
            : stage("/requirements", "done", "Checked on official government sites, and every question answered."),
    !plan.steps
      ? paperwork("todo", input.researched ? (plan.waitsOnStructure ? "Your filings wait on your business structure." : "Nothing to file has turned up yet.") : "Shows up once you find what applies to you.")
      : plan.waitsOnStructure && plan.beforeSelling.done === plan.beforeSelling.total
        ? paperwork("todo", "Some filings wait on your business structure.")
        : ready
        ? paperwork("done", plan.beforeSelling.total ? `Launch requirements: all ${plan.beforeSelling.total} tasks before your first sale are done.` : "Nothing has to come before your first sale.")
        : paperwork("todo", `${progressLabel("launch", plan.beforeSelling.done, plan.beforeSelling.total)} done before your first sale.`),
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

// Your business, then the structure ("Not sure yet" counts), then the check and its questions, then the paperwork
export function nextMove(input: JourneyInput): NextMove {
  const move = (title: string, why: string, href: string, action: string): NextMove => ({
    title,
    why,
    href,
    action,
    stepId: null,
    stage: href.startsWith("/business") ? "/business" : href.startsWith("/requirements") ? "/requirements" : href.startsWith("/start") ? PAPERWORK : href,
  });
  const { plan } = input;
  if (input.business === "none") {
    return move("Tell us about your business", "Your answers decide which registrations, licenses and permits apply to you.", "/business/new", "Start here");
  }
  if (input.business === "update") {
    return move("Update your business answers", "Some questions changed since you answered them. Your answers decide what applies to you.", "/business/edit", "Update your answers");
  }
  if (!input.structure.structure && !input.structure.recorded) {
    return move(
      "Choose how to set up your business",
      "Your structure decides which filings you need. “Not sure yet” is a fine answer for now.",
      "/structure",
      "Compare your options",
    );
  }
  if (!input.researched) {
    return move(
      "Find out what applies to you",
      "SnapStart checks official government sites and works out the rules that fit your business.",
      "/requirements",
      "Find what applies to me",
    );
  }
  if (input.answersChanged) {
    return move("Update what applies to you", "You changed some answers, so SnapStart checks again and updates your steps.", "/requirements", "Update my steps");
  }
  if (input.questions) {
    return move(
      `Answer ${input.questions === 1 ? "a quick question" : `${input.questions} quick questions`}`,
      "Each one is about your own plans, so SnapStart can tell you exactly what applies.",
      "/requirements#questions",
      "Answer the questions",
    );
  }
  if (plan.first) {
    const why = !plan.first.later
      ? `Next in ${plan.first.group.name}.`
      : plan.beforeSelling.done === plan.beforeSelling.total
        ? "Everything you need before your first sale is done. This one comes later."
        : "Your other steps are waiting to hear back or on another step. You can start this one, for later, in the meantime.";
    return { title: plan.first.title, why, href: `/checklist/${plan.first.id}`, action: "Open this step", stepId: plan.first.id, stage: PAPERWORK };
  }
  if (!input.structure.structure && plan.waitsOnStructure) {
    return move("Choose your business structure", "Your next filings depend on it, so they wait until you choose.", "/structure", "Compare your options");
  }
  if (!plan.steps) {
    return move("Check what applies again", "Your last check didn’t turn up anything to file.", "/requirements", "Check again");
  }
  if (plan.beforeSelling.done === plan.beforeSelling.total) {
    return move("You’re ready for your first sale", "Every step you need before selling is done. Steps for later stay on your list.", PAPERWORK, "See every step");
  }
  // Only steps that are submitted or waiting on another step are left
  return move("Wait to hear back", "Your next steps start once the ones you submitted are approved. Mark each one when you hear back.", PAPERWORK, "See every step");
}
