import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { type DetailKey, DETAILS, displayDetail, looksLikeIdNumber } from "@/lib/details";
import { STAGE_LABELS, YES_NO_LABELS } from "@/lib/intake/options";
import { type Place, placeOf, type StructureDecision, structureOf } from "@/lib/research/applicability";
import { type Fact, factsFor, mustFillYourself } from "./companion";
import type { DocumentField, DraftAnswer, DraftAnswers } from "./types";

// Fills a known official form from confirmed facts in code, never model output.
// Each answer names the fact it came from, so a later change to that fact flags the draft as outdated.

export interface AutofillContext {
  facts: ReadonlyMap<string, Fact>;
  profile: BusinessProfile;
  structure: BusinessStructure | null;
  place: Place;
}

// One rule's answer: a value from facts, something still needed, or a blank only the owner can answer
export type Filled =
  | { value: string; from: string[]; sure: boolean; note?: string }
  | { missing: string }
  | { owner: string; from?: string[] };

export interface FieldRule {
  // PDF field name, or a question id for an online application
  fieldId: string;
  // Where it is on the form, such as "Line 1"
  line: string;
  label: string;
  // A box to tick, answered "Yes" or "No"
  kind?: "checkbox";
  answer: (ctx: AutofillContext) => Filled;
}

// Facts plus values derived from them, each with an id the draft can point back to
export function autofillFacts(profile: BusinessProfile, details: readonly { key: DetailKey; value: string }[]): Fact[] {
  const facts = factsFor(profile, details);
  const place = placeOf(profile);
  const decision = structureOf(profile, details);
  if (place.county) facts.push({ id: "derived.county_state", label: "County and state", value: `${place.county} County, ${place.stateName}` });
  if (decision.structure) {
    facts.push({ id: "derived.structure", label: "Business structure", value: displayDetail("structure_choice", decision.structure) });
  }
  // Answers some rules read to decide a blank, kept as facts so a change flags the draft
  if (profile.nameIsLegalName) {
    facts.push({ id: "derived.name_is_legal_name", label: "Sells under your own legal name", value: YES_NO_LABELS[profile.nameIsLegalName] });
  }
  if (profile.stage) facts.push({ id: "derived.stage", label: "Where you are now", value: STAGE_LABELS[profile.stage] });
  return facts;
}

export function autofillContext(profile: BusinessProfile, details: readonly { key: DetailKey; value: string }[]): AutofillContext {
  const decision: StructureDecision = structureOf(profile, details);
  return {
    facts: new Map(autofillFacts(profile, details).map((fact) => [fact.id, fact])),
    profile,
    structure: decision.structure,
    place: placeOf(profile),
  };
}

// Helpers for rules
// `also`: other facts the rule read to pick this one, such as the structure, so changing them flags the answer
export function fact(ctx: AutofillContext, id: string, options: { sure?: boolean; note?: string; missing?: string; also?: string[] } = {}): Filled {
  const found = ctx.facts.get(id);
  if (!found) return { missing: options.missing ?? `Add ${labelFor(id)} to your business details.` };
  return { value: found.value, from: [id, ...(options.also ?? [])], sure: options.sure ?? true, note: options.note };
}

// The street, or "City, ST 12345", from an address saved on two lines or one
export function addressPart(ctx: AutofillContext, id: string, part: "street" | "rest"): Filled {
  const found = ctx.facts.get(id);
  if (!found) return { missing: `Add ${labelFor(id)} to your business details.` };
  const value = found.value.trim();
  const lines = value.split("\n").map((line) => line.trim()).filter(Boolean);
  const oneLine = value.match(/^(.+?),\s*([^,]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)$/);
  const [street, rest] = lines.length >= 2 ? [lines[0], lines.slice(1).join(", ")] : oneLine ? [oneLine[1], oneLine[2]] : [null, null];
  if (!street || !rest) return { missing: `Put ${labelFor(id)} on two lines: the street, then the city, state and ZIP code.` };
  return { value: part === "street" ? street : rest, from: [id], sure: true };
}

// One part of "City, ST 12345" from a saved address
export function addressPiece(ctx: AutofillContext, id: string, piece: "city" | "state" | "zip"): Filled {
  const rest = addressPart(ctx, id, "rest");
  if (!("value" in rest)) return rest;
  const match = rest.value.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!match) return { missing: `Put the city, state and ZIP code of ${labelFor(id)} as “City, ST 12345”.` };
  return { value: piece === "city" ? match[1] : piece === "state" ? match[2] : match[3], from: [id], sure: true };
}

export function tick(ctx: AutofillContext, when: readonly BusinessStructure[], note?: string): Filled {
  if (!ctx.structure) return { missing: "Decide your business structure first." };
  return { value: when.includes(ctx.structure) ? "Yes" : "No", from: ["derived.structure"], sure: true, note };
}

function labelFor(id: string): string {
  const key = id.replace(/^detail\./, "");
  return key in DETAILS ? `your ${DETAILS[key as DetailKey].label.toLowerCase()}` : "this";
}

export interface AutofillResult {
  answers: DraftAnswers;
  // Fact id -> value, for spotting outdated drafts later
  used: Record<string, string>;
  missing: { fieldId: string; label: string; need: string }[];
}

// Rules fill blanks the owner hasn't confirmed or typed; sensitive blanks always stay with the owner
export function autofillAnswers(
  fields: readonly DocumentField[],
  rules: readonly FieldRule[],
  ctx: AutofillContext,
  previous: DraftAnswers = {},
): AutofillResult {
  const byId = new Map(rules.map((rule) => [rule.fieldId, rule]));
  const answers: DraftAnswers = {};
  const used: Record<string, string> = {};
  const missing: AutofillResult["missing"] = [];

  for (const field of fields) {
    const kept = previous[field.id];
    if (mustFillYourself(field)) {
      answers[field.id] = { value: "", source: "", state: "fill_yourself", note: "SnapStart never fills in ID numbers, signatures or sworn statements. Fill this in yourself." };
      continue;
    }
    const rule = byId.get(field.id);
    if (kept && (kept.state === "confirmed" || kept.source === "owner")) {
      answers[field.id] = kept;
      continue;
    }
    if (!rule) {
      answers[field.id] = kept ?? { value: "", source: "", state: "unanswered", note: "" };
      continue;
    }
    const filled = rule.answer(ctx);
    // A fact missing now is kept as "", so it appearing later flags the draft too
    const record = (ids: readonly string[]) => ids.forEach((id) => (used[id] = ctx.facts.get(id)?.value ?? ""));
    if ("owner" in filled) {
      answers[field.id] = { value: "", source: "", state: "unanswered", note: filled.owner };
      record(filled.from ?? []);
    } else if ("missing" in filled) {
      answers[field.id] = { value: "", source: "", state: "unanswered", note: filled.missing };
      missing.push({ fieldId: field.id, label: rule.label, need: filled.missing });
    } else {
      answers[field.id] = suggested(field, filled);
      record(filled.from);
    }
  }
  return { answers, used, missing };
}

function suggested(field: DocumentField, filled: Extract<Filled, { value: string }>): DraftAnswer {
  const note = filled.note ?? (filled.sure ? "" : "Check this one: it may need different wording.");
  const empty: DraftAnswer = { value: "", source: "", state: "unanswered", note: "SnapStart couldn’t fill this one safely." };
  if (looksLikeIdNumber(filled.value)) return empty;
  if (field.kind === "checkbox" && filled.value !== "Yes" && filled.value !== "No") return empty;
  if (field.kind === "choice" && field.options.length && !field.options.includes(filled.value)) return empty;
  const alsoFrom = filled.from.slice(1);
  return { value: filled.value, source: filled.from[0] ?? "", ...(alsoFrom.length ? { alsoFrom } : {}), state: "suggested", note };
}

// Every fact an answer rests on
export function sourcesOf(answer: DraftAnswer): string[] {
  return [answer.source, ...(answer.alsoFrom ?? [])].filter(Boolean);
}

export interface OutdatedFact {
  id: string;
  label: string;
  before: string;
  now: string | null;
}

// Facts a draft used that have since changed or been removed
export function outdatedFacts(used: Record<string, string> | null | undefined, current: readonly Fact[]): OutdatedFact[] {
  if (!used) return [];
  const now = new Map(current.map((each) => [each.id, each]));
  return Object.entries(used).flatMap(([id, before]) => {
    const fresh = now.get(id);
    if ((fresh?.value ?? "") === before) return [];
    return [{ id, label: fresh?.label ?? labelFor(id), before, now: fresh?.value ?? null }];
  });
}

// Drops answers that rest on changed facts, so autofill drafts them again from the new values
export function withoutOutdated(answers: DraftAnswers, outdated: readonly OutdatedFact[]): { answers: DraftAnswers; changed: string[] } {
  const ids = new Set(outdated.map((each) => each.id));
  const changed = Object.entries(answers)
    .filter(([, answer]) => answer.state !== "fill_yourself" && sourcesOf(answer).some((id) => ids.has(id)))
    .map(([fieldId]) => fieldId);
  return { answers: Object.fromEntries(Object.entries(answers).filter(([fieldId]) => !changed.includes(fieldId))), changed };
}
