import type { OfficialForm } from "@/lib/documents/form-catalog";

// Plain code: whether a filing's instructions are confirmed, kept apart from whether anything has to come first.
// A filing is ready only with an application (or a confirmed page to get it from) and a way to submit it.

export type Gap = "application" | "route";

export interface Readiness {
  verified: boolean;
  // What no official page confirmed
  missing: Gap[];
  // A fee from an official page; unknown fees are warned about, never guessed
  feeKnown: boolean;
}

export const GAP_WORDS: Record<Gap, string> = {
  application: "the application form",
  route: "how to submit it",
};

export function filingReadiness(input: {
  form: Pick<OfficialForm, "pdfUrl" | "onlineUrl" | "selfDownload" | "submit" | "fee"> | null;
  links: readonly { confirms: boolean }[];
  feeCents: number | null;
}): Readiness {
  const { form } = input;
  const application = Boolean(form) || input.links.some((link) => link.confirms);
  const route = Boolean(form && (form.submit.length || form.onlineUrl));
  const missing: Gap[] = [...(application ? [] : ["application" as const]), ...(route ? [] : ["route" as const])];
  return { verified: missing.length === 0, missing, feeKnown: input.feeCents !== null || Boolean(form?.fee) };
}

export const NEEDS_CONFIRMATION = "Needs confirmation";
