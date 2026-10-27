// Stored shapes for the document workspace. Plain types, so the schema can import them.

export const FIELD_KINDS = ["text", "checkbox", "choice", "signature", "date"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export interface DocumentPage {
  number: number;
  text: string;
}

export interface DocumentField {
  // PDF field name for fillable forms, otherwise "f1", "f2"…
  id: string;
  label: string;
  page: number;
  kind: FieldKind;
  options: string[];
  // Text printed next to the field on the form, when we could find it
  printedText: string;
  // Low when the field was read from a photo or scan and may be wrong
  confidence: "high" | "low";
  // Fillable PDFs: where the field sits, for filling a copy
  fillable: boolean;
}

export interface DocumentContent {
  readMethod: "pdf_text" | "pdf_form" | "ai_reading" | "pasted" | "none";
  pages: DocumentPage[];
  fields: DocumentField[];
  // Parts we couldn't read clearly; the owner is asked about each one
  unclear: { page: number; where: string; why: string }[];
  readAt: string | null;
  simulated: boolean;
}

export const EMPTY_CONTENT: DocumentContent = {
  readMethod: "none",
  pages: [],
  fields: [],
  unclear: [],
  readAt: null,
  simulated: false,
};

// A quote from the form, checked against its text in code
export interface Anchor {
  page: number;
  excerpt: string;
  // Field it points at, when there is one
  fieldId: string | null;
}

// Guidance from a researched official page rather than from the form itself
export interface Guidance {
  text: string;
  sourceTitle: string;
  sourceUrl: string;
}

export interface FieldHelp {
  fieldId: string;
  label: string;
  explanation: string;
  anchor: Anchor | null;
}

export interface DocumentGuide {
  // Numbers the explanation gives that aren't on the form
  flags?: string[];
  purpose: string;
  purposeAnchor: Anchor | null;
  whoFilesIt: string;
  gather: { item: string; anchor: Anchor | null }[];
  fieldHelp: FieldHelp[];
  guidance: Guidance[];
  createdAt: string;
  simulated: boolean;
}

export const ANSWER_STATES = ["suggested", "confirmed", "unanswered", "fill_yourself"] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];

export interface DraftAnswer {
  // Practice mode drafted it with word matching
  simulated?: boolean;
  value: string;
  // "profile.name", "detail.principal_address", "owner", or "" when unanswered
  source: string;
  state: AnswerState;
  // Why a field is left for the owner, such as a signature
  note: string;
}

export type DraftAnswers = Record<string, DraftAnswer>;

export interface DocumentQuestion {
  question: string;
  answer: string;
  flags?: string[];
  anchor: Anchor | null;
  guidance: Guidance | null;
  askedAt: string;
  simulated: boolean;
}

// Business plan drafts and other generated documents keep their editable text here
export interface PlanSection {
  key: string;
  heading: string;
  body: string;
  // Numbers or claims the owner didn't give us, for them to check
  flags: string[];
}

export interface GeneratedContent {
  sections: PlanSection[];
  inputs: Record<string, string>;
  approvedAt: string | null;
  simulated: boolean;
}
