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
    summary: "Searches official government sites for your place, reads them, and lists the licenses and registrations you need.",
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
  explain_received: {
    title: "Explain a document",
    summary: "Says what a letter or document you have is, who sent it, what it means, and anything you need to do.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
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
  website_copy: {
    title: "Write my website",
    summary: "Drafts the words for each page of your site from your answers. Facts you haven’t given are left for you to fill in.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  brand_story: {
    title: "Describe my brand",
    summary: "Turns the words you picked into a short picture of how your business feels, for you to approve or rewrite.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 3 * MINUTE,
    offeredFor: [],
  },
  brand_ideas: {
    title: "Get logo ideas",
    summary: "A creative director turns your brand brief into distinct logo ideas, each with its own symbol, lettering and colors.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 4 * MINUTE,
    offeredFor: [],
  },
  brand_draw: {
    title: "Draw logo ideas",
    summary: "Draws each idea as a logo, then checks the lettering against your exact business name.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 5 * MINUTE,
    offeredFor: [],
  },
  brand_refine: {
    title: "Change a logo",
    summary: "Redraws a logo with the change you asked for, then checks the lettering again.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 5 * MINUTE,
    offeredFor: [],
  },
  brand_versions: {
    title: "Make logo versions",
    summary: "Makes stacked, profile-picture and one-color versions from your chosen logo, then compares each with it.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 5 * MINUTE,
    offeredFor: [],
  },
  brand_images: {
    title: "Make brand images",
    summary: "Makes pictures for your Facebook cover, YouTube banner, website and link previews in your logo’s colors and style.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 5 * MINUTE,
    offeredFor: [],
  },
  website_options: {
    title: "Find more website options",
    summary: "Searches the web for other website builders, with their prices, pros and cons.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  website_explain: {
    title: "Explain a website option",
    summary: "Explains one option for your business, from its checked facts.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  insights: {
    title: "Get business insights",
    summary: "Reads what you’ve told First Sale and writes encouraging feedback: what’s strong, what to keep an eye on, tips and ideas.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  marketing_plan: {
    title: "Write my marketing plan",
    summary: "Reviews everything you’ve told First Sale and drafts a marketing plan: goals, who to reach, where, what to post and what to do first.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 6 * MINUTE,
    offeredFor: [],
  },
  social_bios: {
    title: "Draft my bios",
    summary: "Drafts a short bio for each account you’re setting up, within each platform’s limits, for you to edit and approve.",
    actor: "ai",
    usesAi: true,
    timeLimitMs: 3 * MINUTE,
    offeredFor: [],
  },
  website_publish: {
    title: "Publish my website",
    summary: "Checks your site is ready, then puts it online on the host you connected. Without one, it’s a practice run.",
    actor: "rule",
    usesAi: false,
    timeLimitMs: 2 * MINUTE,
    offeredFor: [],
  },
  official_form: {
    title: "Get the official form",
    summary: "Downloads the form from the agency’s own site, checks it’s the right one, keeps it unchanged, and fills in what your details answer.",
    actor: "rule",
    usesAi: false,
    timeLimitMs: 2 * MINUTE,
    offeredFor: [],
  },
} as const satisfies Record<string, Workflow>;

export type WorkflowId = keyof typeof WORKFLOWS;

export function workflowsFor(topic: PlanTopic): WorkflowId[] {
  return (Object.keys(WORKFLOWS) as WorkflowId[]).filter((id) => (WORKFLOWS[id].offeredFor as readonly PlanTopic[]).includes(topic));
}
