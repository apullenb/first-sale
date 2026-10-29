"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getImageModel, getModel, type ImageModel } from "@/lib/ai";
import { briefDefaults, ideasProblem as storyProblem } from "@/lib/brand/brief";
import { colorName, HEX } from "@/lib/brand/colors";
import { writeConcepts } from "@/lib/brand/concepts";
import { logoGuidePdf } from "@/lib/brand/guide";
import { type AssetStore, type BatchResult, drawConcepts, type LogoRef, makeBrandImages, makeVersions, refineLogo, UPLOAD_UNCHANGED } from "@/lib/brand/generate";
import { MAX_CHANGE } from "@/lib/brand/prompts";
import { applyDesign, planRefinement, refinementSchema } from "@/lib/brand/refine";
import { writeStory } from "@/lib/brand/story";
import { type BrandBrief, brandBriefSchema, IMAGE_KINDS, VERSION_KINDS } from "@/lib/brand/types";
import { BRAND_LIMITS } from "@/lib/data/brand";
import {
  addMyBrandAsset,
  approveMyLogoVersions,
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
  listMyDocuments,
  myAiKey,
  myBrandAssetRoom,
  pickMyBrandImage,
  saveMyBrandBrief,
  setMyBrandAssetCheck,
  setMyUploadedLogoColors,
  unpickMyBrandImage,
  updateMyDocument,
} from "@/lib/data/my-business";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { OwnerFacingError } from "@/lib/errors";
import { ownerText } from "@/lib/photos/instructions";
import { runWorkflow } from "@/lib/workflow-runner";

const NOT_FOUND = "That wasn’t found. It may have been removed. Reload the page and try again.";
const OFF = "Logo drawing isn’t turned on for First Sale yet.";
const PRACTICE_FILE = "This is a practice preview, not a logo Muse drew. Choose one of the logos Muse made.";
const PRACTICE_IDEAS = "These ideas are practice placeholders, not written for your business. Choose “Get new logo ideas” to have Muse write real ones.";
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

// --- The brief

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

export async function saveBriefAction(input: unknown): Promise<ActionResult> {
  const checked = briefFrom(input);
  if (!checked.ok) return checked;
  if (!(await saveMyBrandBrief(checked.brief))) return { ok: false, message: "Tell us about your business first." };
  refresh();
  return { ok: true, value: null };
}

// --- The brand picture

// Written from the picks, not yet approved; the value is the picture and whether it's a practice stand-in
export async function describeBrandAction(input: unknown): Promise<ActionResult<{ story: string; simulated: boolean }>> {
  const checked = briefFrom({ ...(typeof input === "object" && input ? input : {}), story: "", storyByOwner: false, storyApproved: false });
  if (!checked.ok) return checked;
  const result = await runWorkflow("brand_story", null, async () => {
    const model = getModel();
    const story = await writeStory(model, checked.brief, await myAiKey());
    if (!(await saveMyBrandBrief({ ...checked.brief, story, storyByOwner: false, storyApproved: false }))) throw new OwnerFacingError("Tell us about your business first.");
    return { story, simulated: model.simulated };
  });
  return result;
}

// --- Ideas

const ROUND_MESSAGES = {
  no_business: "Tell us about your business first.",
  too_many: "You’ve asked for as many rounds of ideas as First Sale keeps. Remove ideas you don’t need, then try again.",
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

const ideasSchema = z.object({ requestKey: z.uuid(), brief: z.unknown() });

// Saves the brief, then writes the first round of ideas; the page draws them next
export async function getIdeasAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = ideasSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const checked = briefFrom(parsed.data.brief);
  if (!checked.ok) return checked;
  const unready = storyProblem(checked.brief);
  if (unready) return { ok: false, message: unready };
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
  const parsed = moreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  const existing = await findMyBrandRoundByRequest(parsed.data.requestKey);
  if (existing) return { ok: true, value: existing };
  const concept = await getMyBrandConcept(parsed.data.conceptId);
  if (!concept) return { ok: false, message: NOT_FOUND };
  const problem = await ideasProblem();
  if (problem) return { ok: false, message: problem };
  const state = await getMyBrandState();

  return writeRound(parsed.data.requestKey, state?.brief ?? concept.brief, { id: concept.id, concept: concept.concept });
}

function batchResult(result: { ok: true; value: BatchResult } | { ok: false; message: string }): ActionResult<string | null> {
  return result.ok ? { ok: true, value: result.value.failed } : result;
}

// Draws every idea in a round that hasn't been drawn yet; the value says if some didn't come back
export async function drawRoundAction(roundId: unknown): Promise<ActionResult<string | null>> {
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
  if (asset.origin === "uploaded") {
    // The brief adds what they sell and how it should feel; the logo's words are only what the owner typed
    const [business, state] = await Promise.all([getMyBusiness(), getMyBrandState()]);
    const brief = { ...briefDefaults(business?.profile ?? null, state?.brief ?? null), tagline: "" };
    return { id: null, concept: null, brief, logoId: asset.id, logo, design: asset.design, words: asset.words ?? "" };
  }
  if (!asset.concept || !asset.brief) return NOT_FOUND;
  if (asset.simulated && !image.simulated) return PRACTICE_FILE;
  if (asset.roundSimulated && !image.simulated) return PRACTICE_IDEAS;
  // Versions, pictures and further changes start from the logo as drawn
  return { id: asset.conceptId, ...applyDesign(asset.concept, asset.brief, asset.design), logoId: asset.id, logo, design: asset.design };
}

// A change in the owner's words, or a one-click change that code writes
const refineSchema = z.union([
  z.object({ assetId: id, requestKey: z.uuid(), change: z.string().max(MAX_CHANGE * 2) }),
  z.object({ assetId: id, requestKey: z.uuid(), refinement: refinementSchema }),
]);

export async function refineLogoAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = refineSchema.safeParse(input);
  if (!parsed.success) {
    const oneClick = typeof input === "object" && input !== null && "refinement" in input;
    return { ok: false, message: oneClick ? "That change isn’t available. Reload the page and try again." : `Describe the change in up to ${MAX_CHANGE} characters.` };
  }
  const words = "change" in parsed.data ? ownerText(parsed.data.change, MAX_CHANGE) : null;
  if (words !== null && words.length < 3) return { ok: false, message: "Say what you’d like changed, such as “Make the letters thicker”." };
  const existing = await findMyBrandAssetByRequest(parsed.data.requestKey);
  if (existing) return { ok: true, value: existing };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const found = await logoRef(parsed.data.assetId, image);
  if (typeof found === "string") return { ok: false, message: found };
  if (!found.concept) return { ok: false, message: UPLOAD_UNCHANGED };
  const logo = { ...found, concept: found.concept };
  const plan = "refinement" in parsed.data ? planRefinement(parsed.data.refinement, logo) : null;
  if (plan && !plan.ok) return { ok: false, message: plan.message };
  const change = plan?.ok ? plan.label : (words ?? "");
  const oneClick = plan?.ok ? { lines: plan.lines, design: plan.design } : undefined;

  const result = await runWorkflow("brand_refine", logo.logoId, async () =>
    refineLogo({ image, vision: getModel() }, store, { logo, change, oneClick, requestKey: parsed.data.requestKey, userKey: await myAiKey(), now: new Date() }),
  );
  refresh();
  return result;
}

export async function chooseLogoAction(assetId: unknown): Promise<ActionResult> {
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

async function chosenLogo(image: ImageModel): Promise<LogoRef | string> {
  const state = await getMyBrandState();
  if (!state?.chosenLogoId) return "Choose a logo first.";
  return logoRef(state.chosenLogoId, image);
}

// --- Versions

const versionsSchema = z.object({ requestKey: z.uuid(), kinds: z.array(z.enum(VERSION_KINDS)).min(1).max(3) });

export async function makeVersionsAction(input: unknown): Promise<ActionResult<string | null>> {
  const parsed = versionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await chosenLogo(image);
  if (typeof logo === "string") return { ok: false, message: logo };

  const result = await runWorkflow("brand_versions", logo.logoId, async () =>
    makeVersions({ image, vision: getModel() }, store, {
      logo,
      kinds: [...new Set(parsed.data.kinds)],
      requestKey: parsed.data.requestKey,
      userKey: await myAiKey(),
      now: new Date(),
    }),
  );
  refresh();
  return batchResult(result);
}

const approveSchema = z.object({ stacked: id, profile: id, solid: id, confirmed: z.literal(true) });

export async function approveVersionsAction(input: unknown): Promise<ActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "First confirm that you checked the spelling and that each version matches your logo." };
  const { stacked, profile, solid } = parsed.data;
  if (!(await approveMyLogoVersions({ stacked, profile, solid }))) {
    return { ok: false, message: "These versions weren’t made from your chosen logo. Reload the page and try again." };
  }
  refresh();
  return { ok: true, value: null };
}

// --- Brand images

const imagesSchema = z.object({
  requestKey: z.uuid(),
  kinds: z.array(z.enum(IMAGE_KINDS)).min(1).max(IMAGE_KINDS.length),
  change: z.string().max(MAX_CHANGE * 2).nullable(),
});

export async function makeImagesAction(input: unknown): Promise<ActionResult<string | null>> {
  const parsed = imagesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Describe the change in up to ${MAX_CHANGE} characters.` };
  const image = imageModel();
  if (!image) return { ok: false, message: OFF };
  const logo = await chosenLogo(image);
  if (typeof logo === "string") return { ok: false, message: logo };
  const change = parsed.data.change ? ownerText(parsed.data.change, MAX_CHANGE) || null : null;

  const result = await runWorkflow("brand_images", logo.logoId, async () =>
    makeBrandImages({ image, vision: getModel() }, store, {
      logo,
      kinds: [...new Set(parsed.data.kinds)],
      change,
      requestKey: parsed.data.requestKey,
      userKey: await myAiKey(),
      now: new Date(),
    }),
  );
  refresh();
  return batchResult(result);
}

export async function pickImageAction(assetId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(assetId);
  if (!parsed.success || !(await pickMyBrandImage(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function unpickImageAction(kind: unknown): Promise<ActionResult> {
  const parsed = z.enum(IMAGE_KINDS).safeParse(kind);
  if (!parsed.success || !(await unpickMyBrandImage(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function clearIdeasAction(): Promise<ActionResult> {
  await clearMyBrandIdeas();
  refresh();
  return { ok: true, value: null };
}

// --- An uploaded logo's colors

const colorsSchema = z.object({ assetId: id, hexes: z.array(z.string().regex(HEX)).max(3) });

// The owner's own picks, named by code; the file itself never changes
export async function setLogoColorsAction(input: unknown): Promise<ActionResult> {
  const parsed = colorsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick up to 3 colors." };
  const hexes = [...new Set(parsed.data.hexes.map((hex) => hex.toUpperCase()))];
  if (!(await setMyUploadedLogoColors(parsed.data.assetId, hexes.map((hex) => ({ hex, name: colorName(hex) }))))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

// --- Logo guide

// One page from the approved logo, kept in Documents and replaced when saved again
export async function saveLogoGuideAction(): Promise<ActionResult<string>> {
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
