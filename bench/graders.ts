import type { MarketingPlatformId } from "@/data/marketing-platforms";
import { PROFILE_FACTS } from "@/data/social-profiles";
import type { AssetCheck, BrandBrief, ConceptReply } from "@/lib/brand/types";
import type { DocumentContent, DocumentField, DocumentGuide, DocumentQuestion, DraftAnswers, PlanSection } from "@/lib/documents/types";
import type { SavedInsights } from "@/lib/insights/types";
import type { IntakeSuggestion } from "@/lib/intake/suggestion-schema";
import type { MarketingIntake } from "@/lib/marketing/intake";
import type { MarketingPlan, MarketingPlanReply } from "@/lib/marketing/types";
import type { PhotoCheck, PhotoReview } from "@/lib/photos/types";
import type { ResearchedRequirement } from "@/lib/research/requirements";
import type { VerifiedRequirement } from "@/lib/research/verify";
import { bioLimit, charCount } from "@/lib/rules/social";
import type { DraftedBio } from "@/lib/social/bios";
import { hasMoney } from "@/lib/website/options";
import { copyTexts } from "@/lib/website/words";
import type { WebsiteContent } from "@/lib/website/types";
import type { Expect, ExpectedRequirement, ExpectList, IntakeExpectation, ReceivedExpectation } from "./cases";

// Quality graders: plain code over each task's output, using the app's own checks where they exist. No model grades.

export interface Grade {
  // 0 to 1; null when there's no grader or the model wasn't asked
  score: number | null;
  checks: Record<string, number | boolean | string | null>;
  note?: string;
}

const share = (passed: number, total: number) => (total ? passed / total : null);

// Average of the checks that apply; booleans count 1 or 0, fractions as they are
export function scoreOf(checks: Record<string, number | boolean | null>): number | null {
  const values = Object.values(checks).filter((value): value is number | boolean => value !== null);
  if (!values.length) return null;
  return values.reduce<number>((sum, value) => sum + (typeof value === "boolean" ? Number(value) : value), 0) / values.length;
}

export const ungraded = (note: string, checks: Grade["checks"] = {}): Grade => ({ score: null, checks, note });

// --- Intake suggestions

function matches<T>(value: T, expected: Expect<T>): boolean {
  return typeof expected === "object" && expected !== null && "oneOf" in expected ? expected.oneOf.includes(value) : value === expected;
}

function listMatches<T>(values: readonly T[], expected: ExpectList<T>): boolean {
  const allowed = new Set([...expected.must, ...(expected.may ?? [])]);
  return expected.must.every((each) => values.includes(each)) && values.every((each) => allowed.has(each));
}

// Each answer must be what the description states, and null where it says nothing
export function gradeIntake(suggestion: IntakeSuggestion, expected: IntakeExpectation): Grade {
  const checks = {
    category: matches(suggestion.category, expected.category),
    state: matches(suggestion.state, expected.state),
    owners: matches(suggestion.owners, expected.owners),
    stage: matches(suggestion.stage, expected.stage),
    registeredAs: matches(suggestion.registeredAs, expected.registeredAs),
    offeringKinds: listMatches(suggestion.offeringKinds, expected.offeringKinds),
    channels: listMatches(suggestion.channels, expected.channels),
    premises: matches(suggestion.premises, expected.premises),
  };
  return { score: scoreOf(checks), checks };
}

// --- Requirements research

const CLAIMS_PROBLEM = "The quote doesn’t show this requirement";
const INVENTED = /was not retrieved|not on an approved official site/;

function fits(requirement: Pick<ResearchedRequirement, "key" | "title" | "level">, expected: ExpectedRequirement): boolean {
  return expected.pattern.test(`${requirement.key} ${requirement.title}`) && (!expected.level || requirement.level === expected.level);
}

// Pairs each expected requirement with at most one listed requirement, in the order expected
export function matchRequirements<R extends Pick<ResearchedRequirement, "key" | "title" | "level">>(
  requirements: readonly R[],
  expected: readonly ExpectedRequirement[],
): Map<string, R> {
  const used = new Set<R>();
  const found = new Map<string, R>();
  for (const each of expected) {
    const hit = requirements.find((requirement) => !used.has(requirement) && fits(requirement, each));
    if (hit) {
      used.add(hit);
      found.set(each.id, hit);
    }
  }
  return found;
}

export function gradeResearch(
  requirements: readonly ResearchedRequirement[],
  expectation: { expected: ExpectedRequirement[]; allowed: ExpectedRequirement[]; unsure: string[] },
): Grade {
  const found = matchRequirements(requirements, [...expectation.expected, ...expectation.allowed]);
  const expectedIds = new Set(expectation.expected.map((each) => each.id));
  const foundExpected = [...found].filter(([id]) => expectedIds.has(id));
  const sourcedExpected = foundExpected.filter(([, requirement]) => requirement.verification === "sourced");
  const sourced = requirements.filter((requirement) => requirement.verification === "sourced");
  const known = new Set(found.values());
  const cited = requirements.filter((requirement) => requirement.sourceIds.length > 0);
  // Passed verify.ts; the separate claims check may still have marked it "to confirm"
  const quotedRight = cited.filter((requirement) => requirement.problems.every((problem) => problem.startsWith(CLAIMS_PROBLEM)));
  const invented = requirements.reduce((sum, requirement) => sum + requirement.problems.filter((problem) => INVENTED.test(problem)).length, 0);
  const unsure = expectation.unsure.flatMap((id) => (found.has(id) ? [found.get(id)!] : []));

  const checks = {
    recall: share(sourcedExpected.length, expectation.expected.length),
    precision: share(sourced.filter((requirement) => known.has(requirement)).length, sourced.length),
    citationAccuracy: share(quotedRight.length, cited.length),
    noInventedSources: invented === 0,
    unsureKeptOpen: share(unsure.filter((requirement) => requirement.status !== "verified").length, unsure.length),
  };
  return {
    score: scoreOf(checks),
    checks: {
      ...checks,
      foundAnyRecall: share(foundExpected.length, expectation.expected.length),
      requirements: requirements.length,
      sourced: sourced.length,
      claimsDemoted: requirements.filter((requirement) => requirement.problems.some((problem) => problem.startsWith(CLAIMS_PROBLEM))).length,
      inventedSources: invented,
      missing: expectation.expected.filter((each) => !sourcedExpected.some(([id]) => id === each.id)).map((each) => each.id).join(", ") || null,
    },
  };
}

// --- Claims check

export function gradeClaims(output: readonly VerifiedRequirement[], unsupported: ReadonlySet<string>, checked: boolean): Grade {
  if (!checked) return { score: 0, checks: { checked: false }, note: "The claims call failed, so code checks stood alone" };
  let right = 0;
  let missed = 0;
  let wronglyFlagged = 0;
  for (const requirement of output) {
    const flagged = requirement.problems.some((problem) => problem.startsWith(CLAIMS_PROBLEM));
    if (flagged === unsupported.has(requirement.key)) right++;
    else if (flagged) wronglyFlagged++;
    else missed++;
  }
  return { score: share(right, output.length), checks: { right, missed, wronglyFlagged } };
}

// --- Brand

const CLAIM_WORDS = /\b(best|finest|award|organic|healthy|guarantee[d]?|cheapest|#1|number one|world-class)\b/i;

export function gradeStory(story: string, brief: Pick<BrandBrief, "name" | "tagline">): Grade {
  const words = story.split(/\s+/).filter(Boolean).length;
  const sentences = story.split(/(?<=[.!?])\s+/).filter((each) => each.trim()).length;
  const checks = {
    startsWithName: story.trim().toLowerCase().startsWith(`${brief.name.toLowerCase()} is`),
    within70Words: words <= 70,
    twoOrThreeSentences: sentences >= 2 && sentences <= 3,
    noTagline: !brief.tagline.trim() || !story.toLowerCase().includes(brief.tagline.trim().toLowerCase()),
    noClaims: !CLAIM_WORDS.test(story),
  };
  return { score: scoreOf(checks), checks: { ...checks, words } };
}

export function gradeConcepts(concepts: readonly ConceptReply[], brief: Pick<BrandBrief, "logoKinds" | "symbolIdea" | "avoid">, asked: number): Grade {
  const kinds = concepts.map((concept) => concept.kind);
  const symbolWord = brief.symbolIdea.toLowerCase().replace(/^(a|an|the)\s+/, "").split(/\s+/).at(-1) ?? "";
  const avoidWord = brief.avoid.toLowerCase().replace(/s$/, "").trim();
  const withSymbol = concepts.filter((concept) => concept.symbol);
  const checks = {
    asManyAsAsked: concepts.length === asked,
    kindsAsAsked: brief.logoKinds.length ? kinds.every((kind) => brief.logoKinds.includes(kind)) : new Set(kinds).size === kinds.length,
    wordmarksHaveNoSymbol: concepts.every((concept) => concept.kind !== "wordmark" || concept.symbol === null),
    usesSymbolIdea: symbolWord ? withSymbol.filter((concept) => concept.symbol!.toLowerCase().includes(symbolWord)).length >= Math.min(2, withSymbol.length) : null,
    respectsAvoid: avoidWord ? concepts.every((concept) => !JSON.stringify(concept).toLowerCase().includes(avoidWord)) : null,
  };
  return { score: scoreOf(checks), checks };
}

// Share of suggested taglines that pass the app's tagline rules (cleanTaglines)
export function gradeTaglines(raw: readonly string[], kept: readonly string[]): Grade {
  return { score: share(Math.min(kept.length, raw.length), raw.length), checks: { suggested: raw.length, passedRules: kept.length, atLeastThree: kept.length >= 3 } };
}

export function gradeLettering(check: AssetCheck, spelledRight: boolean): Grade {
  if (check.method !== "ai" || !check.lettering) return ungraded(`Lettering check ${check.method}`, { method: check.method });
  const matched = check.lettering.status === "matches";
  return { score: Number(matched === spelledRight), checks: { status: check.lettering.status, spelledRight, read: check.lettering.read.join(" | ") } };
}

export function gradeVersionCheck(check: AssetCheck, expectColorFlag: boolean): Grade {
  if (check.method !== "ai") return ungraded(`Version check ${check.method}`);
  const color = check.drift.some((flag) => flag.kind === "color");
  return { score: Number(expectColorFlag ? color : check.drift.length === 0), checks: { expectColorFlag, colorFlag: color, flags: check.drift.length } };
}

// --- Insights, plans and writing

// Share of insight items that survive the app's checkInsights
export function gradeInsights(insights: Pick<SavedInsights, "items" | "removed">): Grade {
  const kept = insights.items.length;
  return { score: share(kept, kept + insights.removed), checks: { kept, removed: insights.removed } };
}

export function gradeMarketing(plan: MarketingPlan, raw: MarketingPlanReply | null, intake: MarketingIntake): Grade {
  const platforms = raw?.platforms.map((entry) => entry.platform) ?? [];
  const checks = {
    noRuledOutPlatforms: raw ? !platforms.some((id) => intake.exclude.includes(id)) : null,
    everyPickGotARole: raw ? intake.include.every((id) => platforms.includes(id)) : null,
    noUnbackedMoney: plan.flags.length === 0,
    firstActionsTwoToFive: plan.firstActions.length >= 2 && plan.firstActions.length <= 5,
  };
  return { score: scoreOf(checks), checks: { ...checks, moneyFlags: plan.flags.length } };
}

// A bio counts when the model's draft is used as written: nothing removed or shortened, within the platform limit
export function gradeBios(drafted: Partial<Record<MarketingPlatformId, DraftedBio>>, want: readonly MarketingPlatformId[]): Grade {
  let clean = 0;
  let replaced = 0;
  let trimmed = 0;
  for (const id of want) {
    const bio = drafted[id];
    const rule = PROFILE_FACTS[id]?.bio;
    if (!bio || !rule) continue;
    if (bio.by === "rule") replaced++;
    else if (bio.notes.length) trimmed++;
    else if (charCount(bio.bio) <= bioLimit(rule)) clean++;
  }
  return { score: share(clean, want.length), checks: { clean, cleanerChanged: trimmed, replacedByRule: replaced } };
}

export function gradeBusinessPlan(sections: readonly PlanSection[], expectedSections: number): Grade {
  const flagged = sections.filter((section) => section.flags.length > 0).length;
  const checks = {
    sectionsWritten: share(sections.length, expectedSections),
    sectionsWithoutUnknownNumbers: share(sections.length - flagged, sections.length),
  };
  return { score: scoreOf(checks), checks: { ...checks, unknownNumbers: sections.reduce((sum, section) => sum + section.flags.length, 0) } };
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

export function gradeWebsite(content: WebsiteContent, contactFacts: readonly string[]): Grade {
  const text = copyTexts(content).join("\n");
  const known = contactFacts.join(" ");
  const contacts = [...(text.match(EMAIL) ?? []), ...(text.match(PHONE) ?? [])];
  const checks = {
    noUnknownNumbers: content.flags.length === 0,
    faqThreeToSix: content.faq.length >= 3 && content.faq.length <= 6,
    seoDescriptionFits: content.seoDescription.length <= 155,
    noInventedContact: contacts.every((each) => known.includes(each)),
  };
  return { score: scoreOf(checks), checks: { ...checks, flags: content.flags.length } };
}

// "Explain more" must never give money: the raw reply is checked before the app's cleaner drops sentences
export function gradeExplain(rawTexts: readonly string[], flags: readonly string[]): Grade {
  const withMoney = rawTexts.filter((text) => hasMoney(text)).length;
  const checks = { noMoneyInReply: withMoney === 0, noUnknownNumbers: flags.length === 0 };
  return { score: scoreOf(checks), checks: { ...checks, partsWithMoney: withMoney } };
}

export function gradeOptions(suggested: number, kept: number): Grade {
  return { score: share(kept, suggested), checks: { suggested, keptByChecks: kept } };
}

// --- Documents

export function gradeReceived(guide: DocumentGuide, expected: ReceivedExpectation): Grade {
  const received = guide.received;
  if (!received) return { score: 0, checks: { explained: false } };
  const shown = JSON.stringify(received);
  const deadlines = received.todo.map((entry) => entry.deadline ?? "");
  const checks = {
    quotedWhatItIs: received.whatItIsAnchor !== null,
    rightStep: received.stepKey === expected.stepKey,
    notGovernmentSpotted: (received.notGovernment !== null) === expected.notGovernment,
    deadlinesKept: expected.deadlines.length ? share(expected.deadlines.filter((each) => deadlines.includes(each)).length, expected.deadlines.length) : null,
    noIdNumbers: expected.idNumbers.every((id) => !shown.includes(id)),
    noUnbackedAmounts: (guide.flags ?? []).length === 0,
  };
  return { score: scoreOf(checks), checks: { ...checks, flags: (guide.flags ?? []).length } };
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function gradeFormFields(content: DocumentContent, expected: readonly DocumentField[]): Grade {
  const printed = content.fields.map((field) => plain(field.printedText));
  const found = expected.filter((field) => printed.some((text) => text.includes(plain(field.printedText)) || plain(field.printedText).includes(text) && text.length >= 4));
  const signature = content.fields.find((field) => /signature/i.test(field.printedText));
  const checks = {
    blanksFound: share(found.length, expected.length),
    signatureMarked: signature ? signature.kind === "signature" : false,
    highConfidence: share(content.fields.filter((field) => field.confidence === "high").length, content.fields.length),
  };
  return { score: scoreOf(checks), checks: { ...checks, fieldsListed: content.fields.length } };
}

export function gradeFormExplain(guide: DocumentGuide, fields: readonly DocumentField[]): Grade {
  const helped = new Set(guide.fieldHelp.map((help) => help.fieldId));
  const checks = {
    purposeQuoted: guide.purposeAnchor !== null,
    everyBlankExplained: share(fields.filter((field) => helped.has(field.id)).length, fields.length),
    noUnknownNumbers: (guide.flags ?? []).length === 0,
  };
  return { score: scoreOf(checks), checks };
}

export function gradeFormAsk(answer: DocumentQuestion, expected: { onForm: boolean; mentions: string[] }): Grade {
  const onForm = answer.anchor !== null;
  const checks = {
    onFormAsExpected: onForm === expected.onForm,
    mentionsAnswer: expected.mentions.length ? expected.mentions.every((each) => answer.answer.toLowerCase().includes(each.toLowerCase())) : null,
    noUnknownNumbers: (answer.flags ?? []).length === 0,
  };
  return { score: scoreOf(checks), checks };
}

// Each blank drafted from the expected fact, or left for the owner
export function gradeFormDraft(answers: DraftAnswers, expected: Readonly<Record<string, string | null>>): Grade {
  const ids = Object.keys(expected);
  const right = ids.filter((id) => (answers[id]?.source || null) === expected[id]);
  const wrongFills = ids.filter((id) => answers[id]?.source && answers[id].source !== expected[id]);
  return { score: share(right.length, ids.length), checks: { right: right.length, wrongFills: wrongFills.length, missed: ids.length - right.length - wrongFills.length } };
}

export function gradeDocumentRead(content: DocumentContent, lines: readonly string[]): Grade {
  if (content.readMethod !== "ai_reading") return ungraded(`Not read by the model (${content.readMethod})`);
  const read = ` ${plain(content.pages.map((page) => page.text).join(" "))} `;
  const words = [...new Set(lines.flatMap((line) => plain(line).split(" ")).filter((word) => word.length >= 3))];
  const recall = share(words.filter((word) => read.includes(` ${word} `)).length, words.length);
  return { score: recall, checks: { wordRecall: recall, unclear: content.unclear.length } };
}

// --- Photos

export function gradePhotoCheck(check: PhotoCheck, label: string): Grade {
  if (check.method !== "ai") return ungraded(`Photo check ${check.method}`);
  const lettering = check.keep.textAndLogos.join(" ").toLowerCase();
  const checks = {
    usable: check.usable,
    keepsLabel: label.split(/\s+/).every((word) => lettering.includes(word.toLowerCase())),
    namesTheProduct: check.objects.length >= 1,
  };
  return { score: scoreOf(checks), checks };
}

export function gradePhotoCompare(review: PhotoReview, expectTextFlag: boolean): Grade {
  if (review.method !== "ai") return ungraded(`Comparison ${review.method}`);
  const text = review.flags.some((flag) => flag.kind === "text_or_logo");
  return { score: Number(expectTextFlag ? text : review.flags.length === 0), checks: { expectTextFlag, textFlag: text, flags: review.flags.length } };
}
