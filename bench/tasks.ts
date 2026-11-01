import { PLATFORM_DATA } from "@/data/website-platforms";
import type { ImageModel, ModelProvider } from "@/lib/ai";
import { checkLogo, checkVersion, normalize } from "@/lib/brand/checks";
import { writeConcepts } from "@/lib/brand/concepts";
import { IDEAS } from "@/lib/brand/cost";
import { type AssetStore, drawConcepts } from "@/lib/brand/generate";
import { writeStory } from "@/lib/brand/story";
import { suggestTaglines, TAGLINES_SCHEMA_NAME } from "@/lib/brand/tagline";
import type { AssetCheck, ConceptReply } from "@/lib/brand/types";
import { DETAILS } from "@/lib/details";
import { draftBusinessPlan, SECTION_KEYS } from "@/lib/documents/business-plan";
import { askAboutForm, draftAnswers, explainForm, factsFor } from "@/lib/documents/companion";
import { knownFacts, sellsOf } from "@/lib/documents/plan-facts";
import { readDocument } from "@/lib/documents/read";
import { explainReceived } from "@/lib/documents/received";
import { buildInputs } from "@/lib/insights/facts";
import { writeInsights } from "@/lib/insights/generate";
import { suggestIntakeAnswers } from "@/lib/intake/suggest";
import { draftMarketingPlan, MARKETING_PLAN_SCHEMA_NAME } from "@/lib/marketing/plan";
import { marketingPlanReplySchema } from "@/lib/marketing/types";
import { checkPhoto, compareVersion } from "@/lib/photos/check";
import { makePhotoVersion, type VersionStore } from "@/lib/photos/edit";
import { DEFAULT_CROP, DEFAULT_LOOK } from "@/lib/photos/looks";
import type { PhotoReview } from "@/lib/photos/types";
import { CLAIMS_SCHEMA_NAME, checkClaims } from "@/lib/research/claims";
import { researchRequirements } from "@/lib/research/requirements";
import { bioFacts, draftBios } from "@/lib/social/bios";
import { draftWebsite } from "@/lib/website/content";
import { EXPLAIN_SCHEMA_NAME as WEBSITE_EXPLAIN_SCHEMA_NAME, explainOption, findMoreOptions, OPTIONS_SCHEMA_NAME, platformFacts } from "@/lib/website/options";
import { type BenchCase, CLAIMS_FIXTURE, FORM_DRAFT_EXPECTED, FORM_FIELDS, FORM_PAGES } from "./cases";
import {
  type Grade,
  gradeBios,
  gradeBusinessPlan,
  gradeClaims,
  gradeConcepts,
  gradeDocumentRead,
  gradeExplain,
  gradeFormAsk,
  gradeFormDraft,
  gradeFormExplain,
  gradeFormFields,
  gradeInsights,
  gradeIntake,
  gradeLettering,
  gradeMarketing,
  gradeOptions,
  gradePhotoCheck,
  gradePhotoCompare,
  gradeReceived,
  gradeResearch,
  gradeStory,
  gradeTaglines,
  gradeVersionCheck,
  gradeWebsite,
  ungraded,
} from "./graders";
import { documentImage, logoImage, productPhoto } from "./images";
import { savedPages } from "./pages";

// One benchmark task per AI feature. Each calls the app's own function, the one its server action calls, then grades the output in code.

export interface TaskContext {
  model: ModelProvider;
  image: ImageModel | null;
  now: Date;
  // Raw replies for a schema in this run, in memory only
  replies(name: string): string[];
  // A reply for this schema passed its check in this run
  succeeded(name: string): boolean;
}

export interface TaskResult {
  grade: Grade;
  // The model wasn't asked, and why
  skipped?: string;
  // Rules or a fixture stood in for the model's answer
  fallback?: string | null;
}

export interface Task {
  id: string;
  title: string;
  // "vision" sends pictures; "search" uses web search; "image" makes pictures, billed per picture
  kind: "text" | "vision" | "search" | "image";
  // Same input for every case, so it runs once per repeat
  shared?: boolean;
  run(ctx: TaskContext, c: BenchCase): Promise<TaskResult>;
}

const lastJson = (texts: string[]): unknown => {
  const text = texts.at(-1);
  if (!text) return null;
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
};

const planInputs = (c: BenchCase) => Object.fromEntries(c.plan.answers.map((answer) => [answer.key, answer.answer.join("; ")]));
// The app skips these checks when the model can't see images, so the benchmark does too
const NO_VISION = "This provider can't see images";
const noVision = (ctx: TaskContext): TaskResult | null => (ctx.model.capabilities.vision ? null : { grade: ungraded(NO_VISION), skipped: NO_VISION });
const file = (picture: { mimeType: string; data: Uint8Array }) => ({ mimeType: picture.mimeType, data: picture.data });

export const TASKS: Task[] = [
  {
    id: "intake",
    title: "Intake suggestions",
    kind: "text",
    async run(ctx, c) {
      const suggestion = await suggestIntakeAnswers(ctx.model, c.intake.description);
      return { grade: gradeIntake(suggestion, c.intake.expected) };
    },
  },
  {
    id: "research",
    title: "Requirements research (search, research, claims)",
    kind: "text",
    async run(ctx, c) {
      const result = await researchRequirements(ctx.model, c.profile, { fetchImpl: savedPages, now: ctx.now, details: c.details });
      const grade = gradeResearch(result.requirements, c.research);
      grade.note = "Reads saved copies of the official pages; pages found by search that aren't saved come back unread";
      const discovered = result.pages.filter((page) => page.discovered).length;
      // The claims check runs whenever code checks left something sourced
      const sourced = result.requirements.some((requirement) => requirement.verification === "sourced" || requirement.problems.some((problem) => problem.startsWith("The quote doesn")));
      grade.checks.discoveredPagesRead = discovered;
      // Found by search ("state-name-1" and the like) but not among the saved pages
      grade.checks.discoveredPagesUnsaved = result.unread.filter((source) => /^(state|county|city)-/.test(source.id)).length;
      return { grade, fallback: sourced && !ctx.succeeded(CLAIMS_SCHEMA_NAME) ? "Claims check skipped; code checks stood alone" : null };
    },
  },
  {
    id: "claims",
    title: "Claims check (research quotes)",
    kind: "text",
    shared: true,
    async run(ctx) {
      const result = await checkClaims(ctx.model, CLAIMS_FIXTURE.requirements);
      return { grade: gradeClaims(result.requirements, CLAIMS_FIXTURE.unsupported, result.checked), fallback: result.checked ? null : "Claims check failed" };
    },
  },
  {
    id: "brand-story",
    title: "Brand picture",
    kind: "text",
    async run(ctx, c) {
      return { grade: gradeStory(await writeStory(ctx.model, c.brief), c.brief) };
    },
  },
  {
    id: "brand-concepts",
    title: "Logo concepts",
    kind: "text",
    async run(ctx, c) {
      const concepts = await writeConcepts(ctx.model, { brief: c.brief, basedOn: null });
      return { grade: gradeConcepts(concepts, c.brief, IDEAS.first) };
    },
  },
  {
    id: "taglines",
    title: "Taglines",
    kind: "text",
    async run(ctx, c) {
      const kept = await suggestTaglines(ctx.model, c.brief);
      const raw = (lastJson(ctx.replies(TAGLINES_SCHEMA_NAME)) as { taglines?: string[] } | null)?.taglines ?? [];
      return { grade: gradeTaglines(raw, kept) };
    },
  },
  {
    id: "insights",
    title: "Insights",
    kind: "text",
    async run(ctx, c) {
      const inputs = buildInputs({
        profile: c.profile,
        details: c.details,
        research: null,
        steps: [],
        planInputs: planInputs(c),
        brand: { brief: c.brief, chosenLogoId: null },
        brandColors: [],
        website: null,
        approvedPhotos: 0,
      });
      return { grade: gradeInsights(await writeInsights(ctx.model, { inputs, feedback: {} }, ctx.now)) };
    },
  },
  {
    id: "marketing-plan",
    title: "Marketing plan",
    kind: "text",
    async run(ctx, c) {
      const plan = await draftMarketingPlan(
        ctx.model,
        {
          profile: c.profile,
          intake: c.marketing,
          planAnswers: planInputs(c),
          brand: { tagline: c.brief.tagline, feel: c.brief.vibes, story: c.brief.storyApproved ? c.brief.story : "", customers: c.brief.customers, hasLogo: false },
          website: null,
          approvedPhotos: 0,
          startup: null,
        },
        ctx.now,
      );
      const raw = marketingPlanReplySchema.safeParse(lastJson(ctx.replies(MARKETING_PLAN_SCHEMA_NAME)));
      return { grade: gradeMarketing(plan, raw.success ? raw.data : null, c.marketing) };
    },
  },
  {
    id: "social-bios",
    title: "Social bios",
    kind: "text",
    async run(ctx, c) {
      const drafted = await draftBios(ctx.model, bioFacts(c.profile, c.brief), c.bios.want, c.marketing.exclude);
      const replaced = Object.values(drafted).filter((bio) => bio?.by === "rule").length;
      return { grade: gradeBios(drafted, c.bios.want), fallback: replaced ? `${replaced} bio(s) replaced by a plain one from rules` : null };
    },
  },
  {
    id: "business-plan",
    title: "Business plan",
    kind: "text",
    async run(ctx, c) {
      const structure = c.details.find((detail) => detail.key === "structure_choice");
      const facts = knownFacts({
        profile: c.profile,
        structure: structure ? { name: structure.value === "llc" ? "LLC" : structure.value, from: "decision" } : null,
        products: [],
        brand: { customers: c.brief.customers, tagline: c.brief.tagline, story: c.brief.storyApproved ? c.brief.story : "" },
        marketing: null,
        fees: null,
        steps: c.plan.steps,
        progress: null,
        purpose: null,
      }).map(({ key, label, value }) => ({ key, label, value }));
      const sections = await draftBusinessPlan(ctx.model, { facts, answers: c.plan.answers, steps: c.plan.steps, sells: sellsOf(c.profile) });
      return { grade: gradeBusinessPlan(sections, SECTION_KEYS.length) };
    },
  },
  {
    id: "website-copy",
    title: "Website copy",
    kind: "text",
    async run(ctx, c) {
      const contact = c.details.filter((detail) => detail.key === "business_email" || detail.key === "business_phone");
      const content = await draftWebsite(
        ctx.model,
        { profile: c.profile, platform: c.website.platform, details: contact.map((detail) => ({ label: DETAILS[detail.key].label, value: detail.value })), planAnswers: planInputs(c) },
        ctx.now,
      );
      return { grade: gradeWebsite(content, contact.map((detail) => detail.value)) };
    },
  },
  {
    id: "website-explain",
    title: "Website \"Explain more\"",
    kind: "text",
    async run(ctx, c) {
      const info = PLATFORM_DATA[c.website.explain];
      const explanation = await explainOption(ctx.model, { profile: c.profile, name: info.name, facts: platformFacts(info) }, ctx.now);
      const raw = lastJson(ctx.replies(WEBSITE_EXPLAIN_SCHEMA_NAME)) as Record<string, string | string[]> | null;
      const texts = raw ? Object.values(raw).flat().filter((each): each is string => typeof each === "string") : [];
      return { grade: gradeExplain(texts, explanation.flags) };
    },
  },
  {
    id: "website-options",
    title: "More website options (search)",
    kind: "search",
    async run(ctx, c) {
      if (!ctx.model.webSearch) return { grade: ungraded("Needs web search"), skipped: "Needs web search, which only Muse has" };
      const found = await findMoreOptions(ctx.model, { profile: c.profile, exclude: ["SnapStart", "Square", "Wix", "Shopify"] }, ctx.now);
      const raw = (lastJson(ctx.replies(OPTIONS_SCHEMA_NAME)) as { options?: unknown[] } | null)?.options ?? [];
      return { grade: gradeOptions(raw.length, found.options.length) };
    },
  },
  {
    id: "received-docs",
    title: "Received documents",
    kind: "text",
    async run(ctx, c) {
      const guide = await explainReceived(ctx.model, { pages: c.received.pages, steps: c.received.steps }, ctx.now);
      return { grade: gradeReceived(guide, c.received.expected) };
    },
  },
  {
    id: "form-fields",
    title: "Form blanks (pasted form)",
    kind: "text",
    shared: true,
    async run(ctx) {
      const content = await readDocument(ctx.model, { type: "text/plain", text: FORM_PAGES[0].text }, ctx.now);
      return { grade: gradeFormFields(content, FORM_FIELDS) };
    },
  },
  {
    id: "form-explain",
    title: "Form explanation",
    kind: "text",
    shared: true,
    async run(ctx) {
      const guide = await explainForm(ctx.model, { pages: FORM_PAGES, fields: FORM_FIELDS, guidance: [] }, ctx.now);
      return { grade: gradeFormExplain(guide, FORM_FIELDS) };
    },
  },
  {
    id: "form-ask",
    title: "Question about a form",
    kind: "text",
    async run(ctx, c) {
      const answer = await askAboutForm(ctx.model, { pages: FORM_PAGES, fields: FORM_FIELDS, question: c.form.question, fieldId: null }, ctx.now);
      return { grade: gradeFormAsk(answer, c.form) };
    },
  },
  {
    id: "form-draft",
    title: "Drafted form answers",
    kind: "text",
    async run(ctx, c) {
      const answers = await draftAnswers(ctx.model, { fields: FORM_FIELDS, facts: factsFor(c.profile, c.details), previous: {} });
      return { grade: gradeFormDraft(answers, FORM_DRAFT_EXPECTED) };
    },
  },
  {
    id: "document-read",
    title: "Reading a photographed document",
    kind: "vision",
    async run(ctx, c) {
      const lines = c.received.pages[0].text.split("\n");
      const picture = documentImage(lines);
      const content = await readDocument(ctx.model, { type: "image/png", data: picture.data, findBlanks: false }, ctx.now);
      if (content.readMethod === "none") return { grade: ungraded(NO_VISION), skipped: `${NO_VISION}, so the app couldn't read it` };
      return { grade: gradeDocumentRead(content, lines) };
    },
  },
  {
    id: "photo-check",
    title: "Product photo check",
    kind: "vision",
    async run(ctx, c) {
      const photo = productPhoto(c.photo.label, c.photo.jarColor);
      const check = await checkPhoto(ctx.model, photo, ctx.now);
      if (check.method === "skipped") return { grade: ungraded(NO_VISION), skipped: `${NO_VISION}, so the app skipped the check` };
      return { grade: gradePhotoCheck(check, c.photo.label) };
    },
  },
  {
    id: "photo-compare",
    title: "Edited photo comparison",
    kind: "vision",
    async run(ctx, c) {
      const skip = noVision(ctx);
      if (skip) return skip;
      const original = productPhoto(c.photo.label, c.photo.jarColor);
      const edited = productPhoto(c.photo.editedLabel, c.photo.jarColor, "#FFFFFF");
      const review = await compareVersion(ctx.model, file(original), file(edited), ctx.now);
      return { grade: gradePhotoCompare(review, c.photo.label !== c.photo.editedLabel) };
    },
  },
  {
    id: "lettering-check",
    title: "Logo lettering check",
    kind: "vision",
    async run(ctx, c) {
      const skip = noVision(ctx);
      if (skip) return skip;
      const check = await checkLogo(ctx.model, file(logoImage(c.logo.drawn, c.logo.color)), { name: c.brief.name, tagline: "", marks: "none" }, ctx.now);
      return { grade: gradeLettering(check, normalize(c.logo.drawn) === normalize(c.brief.name)) };
    },
  },
  {
    id: "version-check",
    title: "Logo version check",
    kind: "vision",
    async run(ctx, c) {
      const skip = noVision(ctx);
      if (skip) return skip;
      const logo = file(logoImage(c.logo.drawn, c.logo.color));
      const version = file(logoImage(c.logo.drawn, c.logo.versionColor));
      const check = await checkVersion(ctx.model, logo, version, "stacked", { name: c.logo.drawn, tagline: "", marks: "none" }, ctx.now);
      return { grade: gradeVersionCheck(check, c.logo.color !== c.logo.versionColor) };
    },
  },
  {
    id: "logo-draw",
    title: "Logo drawing (image), with its lettering check",
    kind: "image",
    async run(ctx, c) {
      const store = memoryAssets();
      const concept: ConceptReply = {
        kind: "wordmark",
        title: "Plain wordmark",
        idea: `The name ${c.brief.name} in clean lettering.`,
        symbol: null,
        typography: "simple bold sans serif, all capitals",
        palette: [{ hex: c.logo.color, name: "Main" }],
        rationale: "Easy to read at any size.",
      };
      const result = await drawConcepts({ image: ctx.image!, vision: ctx.model }, store, { concepts: [{ id: `bench-${c.id}`, concept, brief: c.brief }], now: ctx.now });
      const check = result.ids.map((id) => store.checks.get(id)).find(Boolean);
      if (!check) return { grade: ungraded("No picture came back"), fallback: result.failed };
      return { grade: gradeLettering(check, true), fallback: result.failed };
    },
  },
  {
    id: "photo-edit",
    title: "Product photo edit (image), with its comparison",
    kind: "image",
    async run(ctx, c) {
      const store = memoryVersions();
      const photo = productPhoto(c.photo.label, c.photo.jarColor);
      await makePhotoVersion({ image: ctx.image!, vision: ctx.model }, store, {
        requestKey: `bench-${c.id}-${ctx.now.getTime()}`,
        original: file(photo),
        photo: { category: "food", check: null, forSale: ["jar"], answer: null },
        look: DEFAULT_LOOK,
        crop: DEFAULT_CROP,
        parent: null,
        refinement: null,
        now: ctx.now,
      });
      const review = store.review;
      // No known right answer for a fresh edit: valid output only
      return { grade: ungraded("No grader: valid output only", { review: review?.method ?? null, flags: review?.flags.length ?? null }) };
    },
  },
];

// Saved files and checks kept in memory; nothing reaches the app's database
function memoryAssets(): AssetStore & { checks: Map<string, AssetCheck> } {
  const checks = new Map<string, AssetCheck>();
  let next = 0;
  return {
    checks,
    findByRequest: async () => null,
    room: async () => "ok",
    add: async () => ({ ok: true, id: `asset-${++next}` }),
    setCheck: async (id, check) => {
      checks.set(id, check);
    },
  };
}

function memoryVersions(): VersionStore & { review: PhotoReview | null } {
  const store: VersionStore & { review: PhotoReview | null } = {
    review: null,
    findByRequest: async () => null,
    room: async () => "ok",
    add: async () => ({ ok: true, id: "version-1" }),
    setReview: async (_id, review) => {
      store.review = review;
    },
  };
  return store;
}

export function taskById(id: string): Task | undefined {
  return TASKS.find((task) => task.id === id);
}
