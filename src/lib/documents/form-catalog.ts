import type { BusinessStructure, JurisdictionLevel, PlanTopic, UsStateCode } from "@/lib/domain";
import type { FieldRule } from "./autofill";

// Hand-checked official forms and online applications (src/data/official-forms).
// Every fee, time and step carries the official words it came from and the day it was checked.

export interface CheckedFact {
  // Owner-facing summary
  text: string;
  // Word for word from the official page
  quote: string;
  sourceTitle: string;
  sourceUrl: string;
  checkedOn: string;
  // Read in a browser: the agency's site refuses automated requests, so the app can't re-check it
  byHand?: true;
}

export interface SubmitMethod {
  kind: "online" | "fax" | "mail" | "in_person";
  how: string;
  url?: string;
  address?: string[];
  timing?: CheckedFact;
}

export interface OfficialForm {
  key: string;
  title: string;
  // Printed form number, when it has one
  formNumber: string | null;
  // Revision printed on the form, checked against the download
  revision: string | null;
  agency: string;
  level: JurisdictionLevel;
  // Null for federal forms
  state: UsStateCode | null;
  // A county's own form, by name without "County"
  county?: string;
  // Only for these structures, such as an entity's assumed name; undecided owners see every fitting form
  forStructures?: BusinessStructure[];
  // Says who it's for when several forms fit one step
  whoFor?: string;
  // The .gov site the form must come from, as the registry names it
  domain: string;
  // Official PDF the app downloads; null for online-only applications
  pdfUrl: string | null;
  // Online application, when there is one
  onlineUrl: string | null;
  // An official PDF the agency's site won't let the app download: the owner gets it and uploads it
  selfDownload: { url: string; label: string } | null;
  // The official page that explains it
  pageUrl: string;
  pageTitle: string;
  // Words the downloaded PDF must contain to count as this exact, current form
  mustContain: string[];
  fits: { topics: PlanTopic[]; pattern: RegExp };
  fee: (CheckedFact & { cents: number }) | null;
  renewal: (CheckedFact & { cents: number | null; every: "year" }) | null;
  deadline: CheckedFact | null;
  // What must happen first, in the official words
  before: CheckedFact[];
  submit: SubmitMethod[];
  signature: CheckedFact | null;
  afterward: CheckedFact[];
  // Where the receipt or confirmation comes from
  receipt: string;
  // Blanks the app fills by rule; others are left for the owner or the model's matching
  fields: FieldRule[];
  // The online application's questions, when they aren't the PDF's blanks
  guide?: FieldRule[];
  checkedOn: string;
  // Practical notes, such as a site that refuses automated downloads
  notes: string[];
  // Links checked in a browser on checkedOn, because their sites refuse automated requests
  handChecked?: string[];
}

// Forms that fit a plan step in the owner's place and, once decided, their structure
export function formsFor(
  catalog: readonly OfficialForm[],
  step: { topic: PlanTopic; key: string; title: string; level: JurisdictionLevel; forStructures?: readonly BusinessStructure[] },
  where: { state: UsStateCode; county: string | null },
  structure: BusinessStructure | null = null,
): OfficialForm[] {
  const bare = (name: string) => name.trim().toLowerCase().replace(/\s+(county|parish|borough)$/, "");
  // A step for some structures only gets forms for those structures
  const stepFits = (form: OfficialForm) => !form.forStructures || !step.forStructures?.length || form.forStructures.some((each) => step.forStructures!.includes(each));
  return catalog.filter(
    (form) =>
      (form.state === null || form.state === where.state) &&
      (!form.county || (where.county !== null && bare(form.county) === bare(where.county))) &&
      (!form.forStructures || !structure || form.forStructures.includes(structure)) &&
      stepFits(form) &&
      form.level === step.level &&
      form.fits.topics.includes(step.topic) &&
      form.fits.pattern.test(`${step.key} ${step.title}`),
  );
}
