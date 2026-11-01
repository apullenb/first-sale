import { OWNER_ACTIONS, type PlanTopic } from "@/lib/domain";
import type { RequirementStatus } from "@/lib/research/applicability";
import { choosesStructure } from "./plan";

// Plain code: what kind of thing a step asks of the owner, which decides its wording and how it's marked done.
// Only a filing is sent to an office; only a filing or a question to an office waits to hear back.

export const STEP_KINDS = OWNER_ACTIONS;
export type StepKind = (typeof STEP_KINDS)[number];

export interface KindInput {
  title: string;
  topic?: PlanTopic;
  forStructures?: readonly string[] | null;
  feeCents?: number | null;
  requirementStatus?: RequirementStatus;
  // The research model's read; missing on steps saved before it was asked
  ownerAction?: StepKind | null;
}

// Sends or registers something with an office
const FILES = /\b(file|filing|register|registration|apply|application|submit|obtain|renew|form (an?|your)|incorporat\w*|permit|licen[cs]e|certificate of|ein|employer identification|tax id)\b/i;
const DECIDES = /^(operate|run|stay|remain|continue|keep operating)\b.*\bas\b|^(choose|decide)\b/i;
// A check the owner does on their own
const SELF_CHECK = /^check (that|whether|if)\b/i;
const CONTACTS = /^(ask|contact|confirm|call|email|write to|check with|find out|verify)\b/i;
const TRAINS = /\b(training|course|class|food (handler|manager)|handler(’s|'s)? card|exam)\b/i;
const FOLLOWS = /^(follow|comply|label|keep|display|post|maintain|meet|use|track|store|limit|check (that|whether|your))\b|\brules?\b|\blabel(s|ing)?\b/i;

export function stepKindOf(step: KindInput, options: { confirm?: boolean; hasForm?: boolean } = {}): StepKind {
  if (choosesStructure(step)) return "decision";
  if (options.confirm || step.requirementStatus === "to_find_out") return "contact";
  if (options.hasForm) return "filing";
  // A fee means something is paid to an office
  if (step.ownerAction && (!step.feeCents || step.ownerAction === "filing")) return step.ownerAction;
  const title = step.title.trim();
  // "Operate as a sole proprietorship": a structure with nothing to send is a choice
  if (DECIDES.test(title) && !step.feeCents) return "decision";
  if (step.topic === "structure" && !step.feeCents && !FILES.test(title)) return "decision";
  if (SELF_CHECK.test(title)) return "compliance";
  if (CONTACTS.test(title)) return "contact";
  if (TRAINS.test(title)) return "training";
  if (FOLLOWS.test(title) && !FILES.test(title.replace(/\brules?\b/gi, ""))) return "compliance";
  return "filing";
}

// Whether marking it done can mean "sent, waiting to hear back"
export const waitsOnOffice = (kind: StepKind) => kind === "filing" || kind === "contact";

// A short tag for lists; filings are the usual case and go untagged
export const KIND_TAGS: Record<StepKind, string | null> = {
  decision: "A decision",
  training: "Training",
  compliance: "A rule to follow",
  filing: null,
  contact: "Ask the office",
};
