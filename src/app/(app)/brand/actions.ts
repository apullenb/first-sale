"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getImageModel, getModel, type ImageModel } from "@/lib/ai";
import { briefDefaults, ideasProblem as storyProblem, withBrandAnswers, withLogoChoices } from "@/lib/brand/brief";
import { colorName, HEX } from "@/lib/brand/colors";
import { writeConcepts } from "@/lib/brand/concepts";
import { logoGuidePdf } from "@/lib/brand/guide";
import { type AssetStore, type BatchResult, drawConcepts, editPicture, type LogoRef, makeBrandImages, makeVersions, refineLogo, UPLOAD_ONE_CLICK } from "@/lib/brand/generate";
import { MAX_CHANGE } from "@/lib/brand/prompts";
import { applyDesign, planRefinement, refinementSchema } from "@/lib/brand/refine";
import { approvedExample, EXAMPLE_IMAGE } from "@/lib/brand/slots";
import { writeStory } from "@/lib/brand/story";
import { planScenes } from "@/lib/brand/scenes";
import { suggestTaglines } from "@/lib/brand/tagline";
import { businessSpecifics, type Specifics } from "@/lib/specifics";
import { type BrandBrief, brandBriefSchema, type BrandImageKind, IMAGE_KINDS, type ImageScene, type ImageScenes, IMAGE_MEDIUMS, VERSION_KINDS, type VersionKind } from "@/lib/brand/types";
import { BRAND_LIMITS, brandImageMedium } from "@/lib/data/brand";
import {
  addMyBrandAsset,
  chooseMyLogo,
  clearMyBrandIdeas,
  createMyBrandRound,
  createMyDocument,
  findMyBrandAssetByRequest,
  findMyBrandRoundByRequest,
  getMyBrandAsset,
  getMyBrand,
  getMyBrandAssetFile,
  getMyBrandConcept,
  getMyBrandRound,
  getMyBrandState,
  getMyBusiness,
  listMyProducts,
  listMyDocuments,
  myAiKey,
  myBrandAssetRoom,
  pickMyBrandFile,
  saveMyBrandBrief,
  setMyBrandAssetCheck,
  setMyImageMedium,
  setMyImageScenes,
  deleteMyBrandImage,
  setMyOwnLogoColors,
  unpickMyBrandFile,
  updateMyDocument,
} from "@/lib/data/my-business";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { OwnerFacingError } from "@/lib/errors";
import { ownerText } from "@/lib/photos/instructions";
import { runWorkflow } from "@/lib/workflow-runner";

const NOT_FOUND = "That wasn’t found. It may have been removed. Reload the page and try again.";
const NO_BUSINESS = "Tell us about your business first.";
const OFF = "Logo drawing isn’t turned on for SnapStart yet.";
const PRACTICE_FILE = "This is a practice preview, not a logo drawn by AI. Choose one of the logos AI made.";
const PRACTICE_IDEAS = "These ideas are practice samples, not written for your business. Choose “Generate logo ideas” to have AI write real ones.";
const SAY_CHANGE = "Say what you’d like changed, such as “Make the letters thicker”.";
const LOGO_CHANGED = "Your logo changed. Reload the page.";
const EXAMPLE_FIRST = "First make your website header picture and choose “Use this” on it. Your other brand images are made to match it.";
const id = z.string().min(1).max(60);

function imageModel(): ImageModel | null {
  try {
    return getImageModel();
  } catch {
    return null;
  }
}

const store: AssetStore = {
  findByRequest: (requestKey) => findMyBrandAssetByRequest(requestKey),
  room: (adding) => myBrandAssetRoom(adding),
  add: (asset) => addMyBrandAsset(asset),
  setCheck: async (assetId, check) => {
    await setMyBrandAssetCheck(assetId, check);
  },
};

// The saved brief, with what the business profile fills in; null without a business
async function savedBrief(): Promise<BrandBrief | null> {
  const [business, state] = await Promise.all([getMyBusiness(), getMyBrandState()]);
  return business && state ? briefDefaults(business.profile, state.brief) : null;
}

// What the business is and sells, so drafts name it instead of category words
async function mySpecifics(): Promise<Specifics> {
  const [business, products] = await Promise.all([getMyBusiness(), listMyProducts()]);
  return business?.profile ? businessSpecifics(business.profile, products) : { kind: null, items: [] };
}

// --- Build your brand: the brand answers and description

function briefFrom(input: unknown): { ok: true; brief: BrandBrief } | { ok: false; message: string } {
  const parsed = brandBriefSchema.safeParse(input);
  if (parsed.success) return { ok: true, brief: parsed.data };
  const field = String(parsed.error.issues[0]?.path[0] ?? "");
  const messages: Record<string, string> = {
    name: "Type your business name exactly as it should appear in the logo.",
    sells: "Say what you sell, in a few words.",
    vibes: "Pick 3 to 8 words for how your brand should feel.",
    colors: "Pick up to 3 color families.",
  };
  return { ok: false, message: messages[field] ?? "Some answers are too long. Shorten them and try again." };
}

// The brand page's answers over the saved brief; logo choices stay as saved
async function brandAnswers(input: unknown): Promise<{ ok: true; brief: BrandBrief } | { ok: false; message: string }> {
  const checked = briefFrom(input);
  if (!checked.ok) return checked;
  const saved = await savedBrief();
  if (!saved) return { ok: false, message: NO_BUSINESS };
  return briefFrom(withBrandAnswers(saved, checked.brief));
}

export async function saveBrandAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const checked = await brandAnswers(input);
  if (!checked.ok) return checked;
  if (!(await saveMyBrandBrief(checked.brief))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// Written from the picks, not yet approved; the value is the description and whether it's a practice stand-in
export async function describeBrandAction(input: unknown): Promise<ActionResult<{ story: string; simulated: boolean }>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const checked = await brandAnswers({ ...(typeof input === "object" && input ? input : {}), story: "", storyByOwner: false, storyApproved: false });
  if (!checked.ok) return checked;
  const result = await runWorkflow("brand_story", null, async () => {
    const model = getModel();
    const story = await writeStory(model, checked.brief, await myAiKey(), await mySpecifics());
    if (!(await saveMyBrandBrief({ ...checked.brief, story, storyByOwner: false, storyApproved: false }))) throw new OwnerFacingError(NO_BUSINESS);
    return { story, simulated: model.simulated };
  });
  return result;
}

// --- Create your logo: the logo choices and ideas

const choicesSchema = brandBriefSchema.pick({ name: true, tagline: true, logoKinds: true, symbolIdea: true, logoLikes: true });

function choicesProblem(error: z.ZodError): string {
  const field = String(error.issues[0]?.path[0] ?? "");
  return field === "name" ? "Type your business name exactly as it should appear in the logo." : "Some answers are too long. Shorten them and try again.";
}

const taglineSchema = z.object({ name: z.string().max(200) });

// A few taglines from the brand, cleaned by code; the owner picks or edits one
export async function suggestTaglinesAction(input: unknown): Promise<ActionResult<{ taglines: string[]; simulated: boolean }>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = taglineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const saved = await savedBrief();
  if (!saved) return { ok: false, message: NO_BUSINESS };
  const name = ownerText(parsed.data.name, 60) || saved.name;
  return runWorkflow("brand_tagline", null, async () => {
    const model = getModel();
    const taglines = await suggestTaglines(model, { ...saved, name }, await myAiKey(), await mySpecifics());
    if (!taglines.length) throw new OwnerFacingError("None of the suggestions passed SnapStart’s checks this time. Try again, or type your own.");
    return { taglines, simulated: model.simulated };
  });
}

const ROUND_MESSAGES = {
  no_business: NO_BUSINESS,
  too_many: "You’ve asked for as many rounds of ideas as SnapStart keeps. Remove ideas you don’t need, then try again.",
  not_found: NOT_FOUND,
} as const;

async function writeRound(requestKey: string, brief: BrandBrief, basedOn: { id: string; concept: Parameters<typeof writeConcepts>[1]["basedOn"] } | null) {
  return runWorkflow("brand_ideas", null, async () => {
    const model = getModel();
    const concepts = await writeConcepts(model, { brief, basedOn: basedOn?.concept ?? null }, await myAiKey());
    const created = await createMyBrandRound({ requestKey, basedOnConceptId: basedOn?.id ?? null, brief, model: model.model, simulated: model.simulated, concepts });
    if (!created.ok) throw new OwnerFacingError(ROUND_MESSAGES[created.reason]);
    return created.id;
  });
}

// Checked before asking for ideas, so a written round is never refused
async function ideasProblem(): Promise<string | null> {
  if (!imageModel()?.generate) return OFF;
  const state = await getMyBrandState();
  if (!state) return ROUND_MESSAGES.no_business;
  if (state.rounds.length >= BRAND_LIMITS.rounds) return ROUND_MESSAGES.too_many;
  return null;
}

const ideasSchema = z.object({ requestKey: z.uuid(), choices: z.unknown() });

// Saves the logo choices with the approved brand description, then writes the first round of ideas; the page draws them next
export async function getIdeasAction(input: unknown): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = ideasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const choices = choicesSchema.safeParse(parsed.data.choices);
  if (!choices.success) return { ok: false, message: choicesProblem(choices.error) };
  const saved = await savedBrief();
  if (!saved) return { ok: false, message: NO_BUSINESS };
  const brief = withLogoChoices(saved, choices.data);
  const unready = storyProblem(brief);
  if (unready) return { ok: false, message: unready };
  const checked = briefFrom(brief);
  if (!checked.ok) return checked;
  const existing = await findMyBrandRoundByRequest(parsed.data.requestKey);
  if (existing) return { ok: true, value: existing };
  const problem = await ideasProblem();
  if (problem) return { ok: false, message: problem };
  await saveMyBrandBrief(checked.brief);

  // No refresh here: drawing comes next and refreshes, so the page doesn't offer to draw what's already being drawn
  return writeRound(parsed.data.requestKey, checked.brief, null);
}

const moreSchema = z.object({ conceptId: id, requestKey: z.uuid() });

export async function moreLikeThisAction(input: unknown): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = moreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  const existing = await findMyBrandRoundByRequest(parsed.data.requestKey);
  if (existing) return { ok: true, value: existing };
  const concept = await getMyBrandConcept(parsed.data.conceptId);
  if (!concept) return { ok: false, message: NOT_FOUND };
  // The same check as "Generate logo ideas": new ideas need the approved description
  const saved = await savedBrief();
  if (!saved) return { ok: false, message: NO_BUSINESS };
  const unready = storyProblem(saved);
  if (unready) return { ok: false, message: unready };
  const checked = briefFrom(saved);
  if (!checked.ok) return checked;
  const problem = await ideasProblem();
  if (problem) return { ok: false, message: problem };

  return writeRound(parsed.data.requestKey, checked.brief, { id: concept.id, concept: concept.concept });
}

function batchResult(result: { ok: true; value: BatchResult } | { ok: false; message: string }): ActionResult<string | null> {
  return result.ok ? { ok: true, value: result.value.failed } : result;
}

// Draws every idea in a round that hasn't been drawn yet; the value says if some didn't come back
export async function drawRoundAction(roundId: unknown): Promise<ActionResult<string | null>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = id.safeParse(roundId);
  const image = imageModel();
  if (!image?.generate) return { ok: false, message: OFF };
  const round = parsed.success ? await getMyBrandRound(parsed.data) : null;
  if (!round) return { ok: false, message: NOT_FOUND };
  if (round.simulated && !image.simulated) return { ok: false, message: PRACTICE_IDEAS };

  const result = await runWorkflow("brand_draw", round.id, async () =>
    drawConcepts({ image, vision: getModel() }, store, {
      concepts: round.concepts.map((concept) => ({ id: concept.id, concept: concept.concept, brief: round.brief })),
      userKey: await myAiKey(),
      now: new Date(),
    }),
  );
  refresh();
  return batchResult(result);
}

// --- Logos

async function logoRef(assetId: string, image: ImageModel): Promise<LogoRef | string> {
  const asset = await getMyBrandAsset(assetId);
  const file = asset ? await getMyBrandAssetFile(asset.id) : null;
  if (!asset || !file || asset.kind !== "logo") return NOT_FOUND;
  const logo = { mimeType: file.mimeType, data: file.data };
  if (asset.simulated && !image.simulated) return PRACTICE_FILE;
  if (!asset.conceptId) {
    // The owner's own logo, uploaded or edited: the brief adds what they sell and the feel; its words are only what the owner typed
    const brief = await savedBrief();
    if (!brief) return NOT_FOUND;
    return { id: null, concept: null, brief: { ...brief, tagline: "" }, logoId: asset.id, logo, design: asset.design, words: asset.words ?? "" };
  }
  if (!asset.concept || !asset.brief) return NOT_FOUND;
  if (asset.roundSimulated && !image.simulated) return PRACTICE_IDEAS;
  // Versions, pictures and further changes start from the logo as drawn
  return { id: asset.conceptId, ...applyDesign(asset.concept, asset.brief, asset.design), logoId: asset.id, logo, design: asset.design };
}

// A change in the owner's words, or a one-click change that code writes
const refineSchema = z.union([
  z.object({ assetId: id, requestKey: z.uuid(), change: z.string().max(MAX_CHANGE * 2) }),
  z.object({ assetId: id, requestKey: z.uuid(), refinement: refinementSchema }),
]);

// Every change is a new file; the logo it starts from never changes
export async function refineLogoAction(input: unknown): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = refineSchema.safeParse(input);
  if (!parsed.success) {
    const oneClick = typeof input === "object" && input !== null && "refinement" in input;
    return { ok: false, message: oneClick ? "That change isn’t available. Reload the page and try again." : `Describe the change in up to ${MAX_CHANGE} characters.` };
  }
  const words = "change" in parsed.data ? ownerText(parsed.data.change, MAX_CHANGE) : null;
  if (words !== null && words.length < 3) return { ok: false, message: SAY_CHANGE };
  const existing = await findMyBrandAssetByRequest(parsed.data.requestKey);
  if (existing) return { ok: true, value: existing };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await logoRef(parsed.data.assetId, image);
  if (typeof logo === "string") return { ok: false, message: logo };
  let plan: ReturnType<typeof planRefinement> | null = null;
  if ("refinement" in parsed.data) {
    if (!logo.concept) return { ok: false, message: UPLOAD_ONE_CLICK };
    plan = planRefinement(parsed.data.refinement, { ...logo, concept: logo.concept });
    if (!plan.ok) return { ok: false, message: plan.message };
  }
  const change = plan?.ok ? plan.label : (words ?? "");
  const oneClick = plan?.ok ? { lines: plan.lines, design: plan.design } : undefined;

  const result = await runWorkflow("brand_refine", logo.logoId, async () =>
    refineLogo({ image, vision: getModel() }, store, { logo, change, oneClick, requestKey: parsed.data.requestKey, userKey: await myAiKey(), now: new Date() }),
  );
  refresh();
  return result;
}

export async function chooseLogoAction(assetId: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = id.safeParse(assetId);
  const image = imageModel();
  const asset = parsed.success ? await getMyBrandAsset(parsed.data) : null;
  if (!asset || asset.kind !== "logo") return { ok: false, message: NOT_FOUND };
  if (asset.simulated && image && !image.simulated) return { ok: false, message: PRACTICE_FILE };
  if (asset.roundSimulated && image && !image.simulated) return { ok: false, message: PRACTICE_IDEAS };
  if (!(await chooseMyLogo(asset.id))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

// shownFor: the logo the page showed when the owner asked; a different chosen logo since then is refused
async function chosenLogo(image: ImageModel, shownFor?: string): Promise<LogoRef | string> {
  const state = await getMyBrandState();
  if (!state?.chosenLogoId) return "Choose or upload your logo first.";
  if (shownFor !== undefined && shownFor !== state.chosenLogoId) return LOGO_CHANGED;
  return logoRef(state.chosenLogoId, image);
}

// One job per kind, so making one slot never blocks another
const slotSubject = (logoId: string, kinds: readonly string[]) => (kinds.length === 1 ? `${logoId}:${kinds[0]}` : logoId);

// --- Versions

// redraw: the image model draws it, even when it can be built from the logo in code
const versionsSchema = z.object({ requestKey: z.uuid(), logoId: id, kinds: z.array(z.enum(VERSION_KINDS)).min(1).max(3), redraw: z.boolean().optional() });

export async function makeVersionsAction(input: unknown): Promise<ActionResult<string | null>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = versionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await chosenLogo(image, parsed.data.logoId);
  if (typeof logo === "string") return { ok: false, message: logo };
  const kinds = [...new Set(parsed.data.kinds)];

  const result = await runWorkflow("brand_versions", slotSubject(logo.logoId, kinds), async () =>
    makeVersions({ image, vision: getModel() }, store, { logo, kinds, redraw: parsed.data.redraw, requestKey: parsed.data.requestKey, userKey: await myAiKey(), now: new Date() }),
  );
  refresh();
  return batchResult(result);
}

// --- Brand images

const imagesSchema = z.object({
  requestKey: z.uuid(),
  logoId: id,
  kinds: z.array(z.enum(IMAGE_KINDS)).min(1).max(IMAGE_KINDS.length),
  change: z.string().max(MAX_CHANGE * 2).nullable(),
});

// Each kind keeps its planned scene; one already made from this logo gets a new one, so Regenerate shows something new.
// The first plan covers every kind at once, so they all differ.
async function scenesFor(logo: LogoRef, kinds: readonly BrandImageKind[], state: Awaited<ReturnType<typeof getMyBrandState>>, userKey: string | undefined): Promise<ImageScenes> {
  const saved = state?.imageScenes ?? {};
  const made = new Set(state?.assets.filter((asset) => asset.sourceId === logo.logoId).map((asset) => asset.kind) ?? []);
  const asked = kinds.filter((kind) => !saved[kind] || made.has(kind));
  if (!asked.length) return saved;
  const plan = Object.keys(saved).length ? asked : [...IMAGE_KINDS];
  // Stay clear of the other kinds' scenes and of the one being replaced
  const taken = IMAGE_KINDS.filter((kind) => saved[kind] && (!plan.includes(kind) || made.has(kind))).map((kind) => saved[kind] as ImageScene);
  const fresh = await planScenes(getModel(), { brief: logo.brief, specifics: await mySpecifics(), kinds: plan, taken }, userKey);
  await setMyImageScenes(fresh);
  return { ...saved, ...fresh };
}

export async function makeImagesAction(input: unknown): Promise<ActionResult<string | null>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = imagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Describe the change in up to ${MAX_CHANGE} characters.` };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await chosenLogo(image, parsed.data.logoId);
  if (typeof logo === "string") return { ok: false, message: logo };
  const change = parsed.data.change ? ownerText(parsed.data.change, MAX_CHANGE) || null : null;
  const kinds = [...new Set(parsed.data.kinds)];
  // The others wait for the owner to approve the example, then match it
  const state = await getMyBrandState();
  const approved = state ? approvedExample(state.assets, logo.logoId, state.picks) : null;
  const exampleFile = approved ? await getMyBrandAssetFile(approved.id) : null;
  if (kinds.some((kind) => kind !== EXAMPLE_IMAGE) && !exampleFile) return { ok: false, message: EXAMPLE_FIRST };
  const example = exampleFile ? { mimeType: exampleFile.mimeType, data: exampleFile.data } : null;

  const result = await runWorkflow("brand_images", slotSubject(logo.logoId, kinds), async () => {
    const userKey = await myAiKey();
    const scenes = await scenesFor(logo, kinds, state, userKey);
    return makeBrandImages({ image, vision: getModel() }, store, { logo, kinds, change, example, medium: state?.imageMedium ?? null, scenes, requestKey: parsed.data.requestKey, userKey, now: new Date() });
  });
  refresh();
  return batchResult(result);
}

const mediumSchema = z.object({ logoId: id, medium: z.enum(IMAGE_MEDIUMS) });

// The owner's Photo / Illustration switch. remake: an example exists in the other style, so a new one is needed.
export async function setImageMediumAction(input: unknown): Promise<ActionResult<{ remake: boolean }>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = mediumSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const state = await getMyBrandState();
  if (!state) return { ok: false, message: NO_BUSINESS };
  if (!state.chosenLogoId) return { ok: false, message: "Choose or upload your logo first." };
  if (state.chosenLogoId !== parsed.data.logoId) return { ok: false, message: LOGO_CHANGED };
  if (brandImageMedium(state).medium === parsed.data.medium) return { ok: true, value: { remake: false } };
  if (!(await setMyImageMedium(parsed.data.medium))) return { ok: false, message: NO_BUSINESS };
  const hasExample = state.assets.some((asset) => asset.kind === EXAMPLE_IMAGE && asset.sourceId === state.chosenLogoId);
  refresh();
  return { ok: true, value: { remake: hasExample } };
}

// --- Edits and picks for versions and brand images

const editSchema = z.object({ assetId: id, requestKey: z.uuid(), change: z.string().max(MAX_CHANGE * 2) });
const PICTURE_KINDS: readonly string[] = [...VERSION_KINDS, ...IMAGE_KINDS];

// A new copy of a version or brand image, changed in the owner's words; the one it starts from is kept
export async function editPictureAction(input: unknown): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Describe the change in up to ${MAX_CHANGE} characters.` };
  const change = ownerText(parsed.data.change, MAX_CHANGE);
  if (change.length < 3) return { ok: false, message: SAY_CHANGE };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await chosenLogo(image);
  if (typeof logo === "string") return { ok: false, message: logo };
  const asset = await getMyBrandAsset(parsed.data.assetId);
  const file = asset ? await getMyBrandAssetFile(asset.id) : null;
  if (!asset || !file || !PICTURE_KINDS.includes(asset.kind)) return { ok: false, message: NOT_FOUND };
  if (asset.sourceId !== logo.logoId) return { ok: false, message: LOGO_CHANGED };
  if (asset.simulated && !image.simulated) return { ok: false, message: "This is a practice preview. Make a new one with the button above instead." };
  const kind = asset.kind as VersionKind | BrandImageKind;

  const result = await runWorkflow("brand_edit", asset.id, async () =>
    editPicture({ image, vision: getModel() }, store, {
      logo,
      picture: { kind, file: { mimeType: file.mimeType, data: file.data } },
      change,
      requestKey: parsed.data.requestKey,
      userKey: await myAiKey(),
      now: new Date(),
    }),
  );
  refresh();
  return result;
}

// Using one version or brand image; files made from another logo are refused
export async function pickFileAction(assetId: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = id.safeParse(assetId);
  if (!parsed.success || !(await pickMyBrandFile(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

// The owner's own call from the library; the file is gone for good
export async function removeBrandImageAction(assetId: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = id.safeParse(assetId);
  if (!parsed.success || !(await deleteMyBrandImage(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function unpickFileAction(kind: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.enum([...VERSION_KINDS, ...IMAGE_KINDS]).safeParse(kind);
  if (!parsed.success || !(await unpickMyBrandFile(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function clearIdeasAction(): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  await clearMyBrandIdeas();
  refresh();
  return { ok: true, value: null };
}

// --- The owner's own logo's colors

const colorsSchema = z.object({ assetId: id, hexes: z.array(z.string().regex(HEX)).max(3) });

// The owner's own picks, named by code; the file itself never changes
export async function setLogoColorsAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = colorsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick up to 3 colors." };
  const hexes = [...new Set(parsed.data.hexes.map((hex) => hex.toUpperCase()))];
  if (!(await setMyOwnLogoColors(parsed.data.assetId, hexes.map((hex) => ({ hex, name: colorName(hex) }))))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

// --- Logo guide

// One page from the chosen logo and picked versions, kept in Documents and replaced when saved again
export async function saveLogoGuideAction(): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const [kit, state] = await Promise.all([getMyBrand(), getMyBrandState()]);
  if (!kit || !state?.chosenLogoId) return { ok: false, message: "Choose a logo first." };
  const sources: [string, string | null | undefined][] = [
    ["Main logo", state.chosenLogoId],
    ["Stacked", kit.logos.stacked ? state.picks.stacked : null],
    ["Icon", kit.logos.profile ? state.picks.profile : null],
  ];
  const images = await Promise.all(
    sources.flatMap(([label, assetId]) => (assetId ? [getMyBrandAssetFile(assetId).then((file) => ({ label, file }))] : [])),
  );
  const now = new Date();
  const data = await logoGuidePdf({
    businessName: kit.businessName,
    tagline: kit.tagline,
    colors: kit.colors,
    lettering: kit.lettering,
    simulated: kit.simulated,
    uploaded: kit.uploaded,
    images,
    now,
  });
  const title = `Logo guide${kit.simulated ? " (practice)" : ""}`;

  const existing = (await listMyDocuments()).find((doc) => doc.generatedKind === "logo_guide");
  if (existing) {
    if (!(await updateMyDocument(existing.id, { title, data, mimeType: "application/pdf" }))) return { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
    refresh();
    return { ok: true, value: existing.id };
  }
  const created = await createMyDocument({ title, origin: "generated", generatedKind: "logo_guide", mimeType: "application/pdf", data, sha256: null, content: EMPTY_CONTENT });
  if (!created.ok) {
    return {
      ok: false,
      message:
        created.reason === "too_many" || created.reason === "too_large"
          ? "Your document library is full. Delete a document you don’t need, then try again."
          : "Your business wasn’t found. Reload the page and try again.",
    };
  }
  refresh();
  return { ok: true, value: created.id };
}
