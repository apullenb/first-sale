import { z } from "zod";
import { BUSINESS_STRUCTURES } from "./domain";

// Business details that forms ask for, beyond the intake answers, and decisions the owner records.
// Never Social Security numbers, tax ids or other identity numbers: forms leave those for the owner to fill in.

export interface DetailSpec {
  label: string;
  // Explains the term for someone new to business paperwork
  help: string;
  kind: "text" | "multiline" | "choice";
  options?: readonly (readonly [string, string])[];
  maxLength: number;
  decision?: boolean;
}

export const STRUCTURE_LABELS: Record<(typeof BUSINESS_STRUCTURES)[number] | "undecided", string> = {
  sole_proprietorship: "Sole proprietorship",
  llc: "Limited liability company (LLC)",
  partnership: "Partnership",
  corporation: "Corporation",
  undecided: "Not sure yet",
};

export const DETAILS = {
  structure_choice: {
    label: "Business structure you chose",
    help: "How your business is owned and set up legally. The SBA says it affects your taxes, your paperwork and your personal liability.",
    kind: "choice",
    options: Object.entries(STRUCTURE_LABELS),
    maxLength: 40,
    decision: true,
  },
  name_registration_plan: {
    label: "Business name plan",
    help: "Whether you’ll register a name to sell under (a DBA). It’s separate from your business structure.",
    kind: "choice",
    options: [
      ["register_dba", "Register a name to sell under (DBA)"],
      ["legal_name", "Sell under my legal name or the company’s registered name"],
      ["undecided", "Not sure yet"],
    ],
    maxLength: 40,
    decision: true,
  },
  tax_classification_plan: {
    label: "Tax treatment plan",
    help: "How the IRS treats your business for income tax. Every structure has a default; some can choose another.",
    kind: "choice",
    options: [
      ["default", "Keep the default for my structure"],
      ["s_corp", "Choose S corporation status"],
      ["undecided", "Not sure yet"],
    ],
    maxLength: 40,
    decision: true,
  },
  owner_names: {
    label: "Owners’ full legal names",
    help: "The names on each owner’s ID, separated by commas.",
    kind: "text",
    maxLength: 300,
  },
  principal_address: {
    label: "Business street address",
    help: "Where the business is run from. For a home business, this is usually your home address.",
    kind: "multiline",
    maxLength: 300,
  },
  mailing_address: {
    label: "Mailing address",
    help: "Where you get mail for the business, if it’s different from the street address.",
    kind: "multiline",
    maxLength: 300,
  },
  business_email: { label: "Business email", help: "An email address forms and customers can reach you at.", kind: "text", maxLength: 200 },
  business_phone: { label: "Business phone", help: "A phone number forms and customers can reach you at.", kind: "text", maxLength: 40 },
  registered_agent: {
    label: "Registered agent (name and address)",
    help: "A person or company named to receive official legal papers for an LLC or corporation. Many states let an owner be their own agent if they have a street address in the state. Your state’s rules say who can serve.",
    kind: "multiline",
    maxLength: 400,
  },
  management: {
    label: "Who runs the LLC",
    help: "Member-managed means the owners (called members) run it day to day. Manager-managed means the owners choose a manager, who can be one of them.",
    kind: "choice",
    options: [
      ["member_managed", "The owners (member-managed)"],
      ["manager_managed", "A chosen manager (manager-managed)"],
    ],
    maxLength: 40,
  },
  business_purpose: {
    label: "What the business does, in one sentence",
    help: "Some forms ask for a short description of the business’s purpose.",
    kind: "text",
    maxLength: 300,
  },
  start_date: {
    label: "Date the business started or will start",
    help: "Forms sometimes ask when you began, or plan to begin, doing business.",
    kind: "text",
    maxLength: 40,
  },
} as const satisfies Record<string, DetailSpec>;

export type DetailKey = keyof typeof DETAILS;
export const DETAIL_KEYS = Object.keys(DETAILS) as DetailKey[];

export const DECISION_KEYS = DETAIL_KEYS.filter((key) => (DETAILS[key] as DetailSpec).decision);

// Decisions are recorded only on /structure, after its confirm step, with the answers behind them
export function isDecisionKey(key: DetailKey): boolean {
  return DECISION_KEYS.includes(key);
}

export function isDetailKey(key: string): key is DetailKey {
  return Object.hasOwn(DETAILS, key);
}

// Checks one value against its spec; null when it's fine
export function detailProblem(key: DetailKey, value: string): string | null {
  const spec: DetailSpec = DETAILS[key];
  const trimmed = value.trim();
  if (!trimmed) return `Enter ${spec.label.toLowerCase()}.`;
  if (trimmed.length > spec.maxLength) return `Keep it under ${spec.maxLength} characters.`;
  if (spec.options && !spec.options.some(([option]) => option === trimmed)) return "Pick one of the options.";
  if (looksLikeIdNumber(trimmed)) return "First Sale doesn’t store Social Security or tax id numbers. Fill those in on the form yourself.";
  return null;
}

// SSN (123-45-6789) or EIN (12-3456789) with dashes, dots, spaces or none; a ZIP+4 (43215-1234) doesn't match
export function looksLikeIdNumber(text: string): boolean {
  const sep = "[-\u2010-\u2015.\\s]";
  return new RegExp(`\\b\\d{3}${sep}\\d{2}${sep}\\d{4}\\b|\\b\\d{2}${sep}\\d{7}\\b|\\b\\d{9}\\b`).test(text);
}

export function displayDetail(key: DetailKey, value: string): string {
  const spec: DetailSpec = DETAILS[key];
  return spec.options?.find(([option]) => option === value)?.[1] ?? value;
}

export const detailInputSchema = z.object({ key: z.string(), value: z.string().max(400) });
