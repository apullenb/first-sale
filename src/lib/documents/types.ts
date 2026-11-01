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
  // "catalog": an online application's questions, from SnapStart's checked list
  readMethod: "pdf_text" | "pdf_form" | "ai_reading" | "pasted" | "catalog" | "none";
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
  // Set for a letter or record the owner received, instead of a form to fill in
  received?: ReceivedGuide;
}

// What a letter, notice or record says, from its own text
export interface ReceivedGuide {
  whatItIs: string;
  whatItIsAnchor: Anchor | null;
  // As the document names them
  from: string;
  meaning: string;
  // A deadline or amount is kept only when it's in the quote from the document
  todo: { text: string; deadline: string | null; amount: string | null; anchor: Anchor | null }[];
  // Plan step it's the record of, by key
  stepKey: string | null;
  // The document's own words saying it isn't from a government office
  notGovernment: Anchor | null;
  // Web addresses printed on it; government is set only for sites in the official .gov registry
  sites: { host: string; government: string | null }[];
}

export const ANSWER_STATES = ["suggested", "confirmed", "unanswered", "fill_yourself"] as const;
export type AnswerState = (typeof ANSWER_STATES)[number];

export interface DraftAnswer {
  // Practice mode drafted it with word matching
  simulated?: boolean;
  value: string;
  // "profile.name", "detail.principal_address", "owner", or "" when unanswered
  source: string;
  // Other facts the answer depends on, such as the business structure that decided it
  alsoFrom?: string[];
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
  // When the owner approved it; a business plan's is when it was last saved as a PDF
  approvedAt: string | null;
  simulated: boolean;
  // Business plan: when this draft was written, so the editor starts fresh for each one
  draftedAt?: string;
  // Business plan: the owner's picks and their plan-only edits to known facts
  answers?: {
    picks: Record<string, { picks: string[]; other: string | null }>;
    overrides: Record<string, string>;
    // The saved value each edit replaced, so a later change at the source wins
    was?: Record<string, string>;
  };
}
