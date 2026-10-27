import type { Actor, PlanTopic } from "./domain";

// Every multi-step job First Sale runs for an owner: who does it, what it's for, and how long it may take.
// Pages read this to offer the right help on each step and to show a job that's still running.

export interface Workflow {
  title: string;
  // Owner-facing, one sentence
  summary: string;
  actor: Extract<Actor, "ai" | "rule">;
  // Counts toward the owner's AI limit
  usesAi: boolean;
  // A "running" record older than this was cut off by the server's time limit; longer than the job's own timeouts
  timeLimitMs: number;
  // Plan topics where a step's page offers it
  offeredFor: readonly PlanTopic[];
}

const MINUTE = 60_000;

export const WORKFLOWS = {
  research: {
    title: "Find my requirements",
    summary: "Searches official government sites for your place, reads them, and builds your startup plan.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  read_document: {
    title: "Read a document",
    summary: "Pulls the text and the blanks to fill in out of a form, photo or scan.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  explain_document: {
    title: "Explain a form",
    summary: "Says what the form is for, what each part asks, and what to gather first.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: ["name_registration", "tax_registration", "license_permit", "location_zoning", "employer", "structure", "other"],
  },
  ask_document: {
    title: "Ask about a form",
    summary: "Answers a question about a field or term, pointing to where the form says it.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  draft_answers: {
    title: "Draft answers",
    summary: "Matches the form’s blanks to details you’ve confirmed. Blanks it can’t match stay empty for you.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  fill_form: {
    title: "Make a filled copy",
    summary: "Puts your approved answers into a copy of the form for you to check, sign and file yourself.",
    actor: "rule",
    usesAi: false,
    timeLimitMs: MINUTE,
    offeredFor: [],
  },
  business_plan: {
    title: "Draft a business plan",
    summary: "Writes a first draft from your answers and plan. Numbers you didn’t give are left for you to fill in.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: ["structure"],
  },
  photo_check: {
    title: "Check a product photo",
    summary: "Looks for anything that would stop an accurate edit, and notes the details the edit must keep.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 2 * MINUTE,
    offeredFor: [],
  },
  photo_edit: {
    title: "Make a store-ready photo",
    summary: "Edits your photo into a polished product photo from your own picture, then checks it against the original.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 5 * MINUTE,
    offeredFor: [],
  },
} as const satisfies Record<string, Workflow>;

export type WorkflowId = keyof typeof WORKFLOWS;

export function workflowsFor(topic: PlanTopic): WorkflowId[] {
  return (Object.keys(WORKFLOWS) as WorkflowId[]).filter((id) => (WORKFLOWS[id].offeredFor as readonly PlanTopic[]).includes(topic));
}
