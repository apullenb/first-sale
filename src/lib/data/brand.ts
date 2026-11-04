import "server-only";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandAssets, brandConcepts, brandKits, brandRounds, businesses } from "@/db/schema";
import { brandFileUrl } from "@/lib/brand/files";
import type { NewBrandAsset, Room } from "@/lib/brand/generate";
import { ruleMedium } from "@/lib/brand/image-style";
import { applyDesign } from "@/lib/brand/refine";
import { EXAMPLE_IMAGE } from "@/lib/brand/slots";
import {
  type AssetCheck,
  type AssetKind,
  type AssetOrigin,
  type BrandBrief,
  type BrandDesign,
  type BrandFile,
  type BrandImageKind,
  type BrandKit,
  type BrandPicks,
  type ConceptReply,
  IMAGE_KINDS,
  type ImageMedium,
  type ImageScenes,
  type PaletteColor,
  readBrief,
  VERSION_KINDS,
  type VersionKind,
} from "@/lib/brand/types";

// Owner-scoped like product-photos.ts. Bytes are only read by getAssetFileForOwner.

export const BRAND_LIMITS = { rounds: 20, assets: 120, totalBytes: 250_000_000 } as const;
// Checked before paying: a returned file is no bigger than this
const TYPICAL_ASSET_BYTES = 5_000_000;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface ConceptRow {
  id: string;
  roundId: string;
  position: number;
  concept: ConceptReply;
}

export interface RoundSummary {
  id: string;
  basedOnConceptId: string | null;
  brief: BrandBrief;
  model: string;
  simulated: boolean;
  createdAt: Date;
  concepts: ConceptRow[];
}

export interface AssetSummary {
  id: string;
  kind: AssetKind;
  origin: AssetOrigin;
  // Null for an uploaded logo and the files made from it
  conceptId: string | null;
  sourceId: string | null;
  change: string | null;
  design: BrandDesign | null;
  model: string;
  simulated: boolean;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  check: AssetCheck | null;
  // Uploads only
  title: string | null;
  words: string | null;
  createdAt: Date;
}

export interface BrandState {
  brief: BrandBrief | null;
  chosenLogoId: string | null;
  picks: BrandPicks;
  // The owner's Photo / Illustration switch; null leaves it to the rule
  imageMedium: ImageMedium | null;
  imageScenes: ImageScenes;
  rounds: RoundSummary[];
  assets: AssetSummary[];
}

const assetColumns = {
  id: brandAssets.id,
  kind: brandAssets.kind,
  origin: brandAssets.origin,
  conceptId: brandAssets.conceptId,
  sourceId: brandAssets.sourceId,
  change: brandAssets.change,
  design: brandAssets.design,
  model: brandAssets.model,
  simulated: brandAssets.simulated,
  mimeType: brandAssets.mimeType,
  byteSize: brandAssets.byteSize,
  width: brandAssets.width,
  height: brandAssets.height,
  check: brandAssets.check,
  title: brandAssets.title,
  words: brandAssets.words,
  createdAt: brandAssets.createdAt,
};

// The business name in the saved answers, for files with no brief of their own
function profileName(profile: unknown): string {
  const name = profile && typeof profile === "object" && "name" in profile ? (profile as { name: unknown }).name : null;
  return typeof name === "string" ? name : "";
}

async function businessOf(db: Db | Tx, ownerId: string, lock = false): Promise<string | null> {
  const query = db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

// Null when the owner has no business yet
export async function getBrandForOwner(db: Db, ownerId: string): Promise<BrandState | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [[kit], rounds, concepts, assets] = await Promise.all([
    db.select().from(brandKits).where(eq(brandKits.businessId, businessId)),
    db.select().from(brandRounds).where(eq(brandRounds.businessId, businessId)).orderBy(desc(brandRounds.createdAt)),
    db.select().from(brandConcepts).where(eq(brandConcepts.businessId, businessId)).orderBy(asc(brandConcepts.position)),
    db.select(assetColumns).from(brandAssets).where(eq(brandAssets.businessId, businessId)).orderBy(asc(brandAssets.createdAt)),
  ]);
  return {
    brief: kit?.brief ? readBrief(kit.brief) : null,
    chosenLogoId: kit?.chosenLogoId ?? null,
    picks: kit?.picks ?? {},
    imageMedium: kit?.imageMedium ?? null,
    imageScenes: kit?.imageScenes ?? {},
    rounds: rounds.map((round) => ({
      id: round.id,
      basedOnConceptId: round.basedOnConceptId,
      brief: readBrief(round.brief),
      model: round.model,
      simulated: round.simulated,
      createdAt: round.createdAt,
      concepts: concepts
        .filter((concept) => concept.roundId === round.id)
        .map((concept) => ({ id: concept.id, roundId: concept.roundId, position: concept.position, concept: concept.concept })),
    })),
    assets,
  };
}

async function upsertKit(db: Db | Tx, businessId: string, values: Partial<typeof brandKits.$inferInsert>, now: Date) {
  await db
    .insert(brandKits)
    .values({ businessId, ...values, updatedAt: now })
    .onConflictDoUpdate({ target: brandKits.businessId, set: { ...values, updatedAt: now } });
}

export async function saveBriefForOwner(db: Db, ownerId: string, brief: BrandBrief, now = new Date()): Promise<boolean> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return false;
  await upsertKit(db, businessId, { brief }, now);
  return true;
}

export interface NewRound {
  requestKey: string;
  basedOnConceptId: string | null;
  brief: BrandBrief;
  model: string;
  simulated: boolean;
  concepts: ConceptReply[];
}

export type CreateRoundOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "not_found" };

// Locked per business; a repeated request key returns the round already saved
export async function createRoundForOwner(db: Db, ownerId: string, input: NewRound, now = new Date()): Promise<CreateRoundOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "no_business" };
    const [existing] = await tx
      .select({ id: brandRounds.id })
      .from(brandRounds)
      .where(and(eq(brandRounds.businessId, businessId), eq(brandRounds.requestKey, input.requestKey)));
    if (existing) return { ok: true, id: existing.id };
    if (input.basedOnConceptId) {
      const [based] = await tx
        .select({ id: brandConcepts.id })
        .from(brandConcepts)
        .where(and(eq(brandConcepts.id, input.basedOnConceptId), eq(brandConcepts.businessId, businessId)));
      if (!based) return { ok: false, reason: "not_found" };
    }
    const [count] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(brandRounds)
      .where(eq(brandRounds.businessId, businessId));
    if (count.count >= BRAND_LIMITS.rounds) return { ok: false, reason: "too_many" };

    const id = crypto.randomUUID();
    await tx.insert(brandRounds).values({
      id,
      businessId,
      requestKey: input.requestKey,
      basedOnConceptId: input.basedOnConceptId,
      brief: input.brief,
      model: input.model,
      simulated: input.simulated,
      createdAt: now,
    });
    await tx.insert(brandConcepts).values(input.concepts.map((concept, position) => ({ roundId: id, businessId, position, concept, createdAt: now })));
    return { ok: true, id };
  });
}

export async function findRoundByRequestForOwner(db: Db, ownerId: string, requestKey: string): Promise<string | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [row] = await db
    .select({ id: brandRounds.id })
    .from(brandRounds)
    .where(and(eq(brandRounds.businessId, businessId), eq(brandRounds.requestKey, requestKey)));
  return row?.id ?? null;
}

export async function getRoundForOwner(db: Db, ownerId: string, roundId: string): Promise<{ id: string; brief: BrandBrief; simulated: boolean; concepts: ConceptRow[] } | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [round] = await db
    .select({ id: brandRounds.id, brief: brandRounds.brief, simulated: brandRounds.simulated })
    .from(brandRounds)
    .where(and(eq(brandRounds.id, roundId), eq(brandRounds.businessId, businessId)));
  if (!round) return null;
  const concepts = await db
    .select({ id: brandConcepts.id, roundId: brandConcepts.roundId, position: brandConcepts.position, concept: brandConcepts.concept })
    .from(brandConcepts)
    .where(eq(brandConcepts.roundId, round.id))
    .orderBy(asc(brandConcepts.position));
  return { ...round, brief: readBrief(round.brief), concepts };
}

export async function getConceptForOwner(db: Db, ownerId: string, conceptId: string): Promise<{ id: string; roundId: string; concept: ConceptReply; brief: BrandBrief } | null> {
  const [row] = await db
    .select({ id: brandConcepts.id, roundId: brandConcepts.roundId, concept: brandConcepts.concept, brief: brandRounds.brief })
    .from(brandConcepts)
    .innerJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .innerJoin(businesses, eq(businesses.id, brandConcepts.businessId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandConcepts.id, conceptId)));
  return row ? { ...row, brief: readBrief(row.brief) } : null;
}

export async function findAssetByRequestForOwner(db: Db, ownerId: string, requestKey: string): Promise<string | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [row] = await db
    .select({ id: brandAssets.id })
    .from(brandAssets)
    .where(and(eq(brandAssets.businessId, businessId), eq(brandAssets.requestKey, requestKey)));
  return row?.id ?? null;
}

async function usage(db: Db | Tx, businessId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number), bytes: sql<number>`coalesce(sum(${brandAssets.byteSize}), 0)`.mapWith(Number) })
    .from(brandAssets)
    .where(eq(brandAssets.businessId, businessId));
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}

// Before paying for `adding` new files
export async function assetRoomForOwner(db: Db, ownerId: string, adding: number): Promise<Room | "not_found"> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return "not_found";
  const used = await usage(db, businessId);
  if (used.count + adding > BRAND_LIMITS.assets) return "too_many";
  if (used.bytes + adding * TYPICAL_ASSET_BYTES > BRAND_LIMITS.totalBytes) return "too_large";
  return "ok";
}

// A repeated request key returns the file already saved. Limits were checked before paying, so a paid file is never refused.
export async function addAssetForOwner(db: Db, ownerId: string, input: NewBrandAsset, now = new Date()): Promise<{ ok: true; id: string } | { ok: false; reason: "not_found" }> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "not_found" };
    const [existing] = await tx
      .select({ id: brandAssets.id })
      .from(brandAssets)
      .where(and(eq(brandAssets.businessId, businessId), eq(brandAssets.requestKey, input.requestKey)));
    if (existing) return { ok: true, id: existing.id };
    if (input.conceptId) {
      const [concept] = await tx
        .select({ id: brandConcepts.id })
        .from(brandConcepts)
        .where(and(eq(brandConcepts.id, input.conceptId), eq(brandConcepts.businessId, businessId)));
      if (!concept) return { ok: false, reason: "not_found" };
    } else {
      // Without an idea, it must be made from the owner's own logo: their upload or an edit of it
      const [source] = input.sourceId
        ? await tx
            .select({ id: brandAssets.id })
            .from(brandAssets)
            .where(and(eq(brandAssets.id, input.sourceId), eq(brandAssets.businessId, businessId), eq(brandAssets.kind, "logo"), isNull(brandAssets.conceptId)))
        : [];
      if (!source) return { ok: false, reason: "not_found" };
    }

    // Id made here, so the insert doesn't send the file back
    const id = crypto.randomUUID();
    await tx.insert(brandAssets).values({
      id,
      businessId,
      kind: input.kind,
      conceptId: input.conceptId,
      sourceId: input.sourceId,
      change: input.change,
      design: input.design,
      words: input.words ?? null,
      prompt: input.prompt,
      model: input.model,
      simulated: input.simulated,
      requestKey: input.requestKey,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      width: input.width,
      height: input.height,
      data: input.data,
      createdAt: now,
    });
    return { ok: true, id };
  });
}

async function ownedAsset(db: Db | Tx, ownerId: string, assetId: string) {
  const [row] = await db
    .select({ ...assetColumns, businessId: brandAssets.businessId })
    .from(brandAssets)
    .innerJoin(businesses, eq(businesses.id, brandAssets.businessId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandAssets.id, assetId)));
  return row ?? null;
}

export async function setAssetCheckForOwner(db: Db, ownerId: string, assetId: string, check: AssetCheck): Promise<boolean> {
  const asset = await ownedAsset(db, ownerId, assetId);
  if (!asset) return false;
  await db.update(brandAssets).set({ check }).where(eq(brandAssets.id, asset.id));
  return true;
}

// concept and brief are null for an uploaded logo and the files made from it; roundSimulated: the idea itself was a practice placeholder
export async function getAssetForOwner(
  db: Db,
  ownerId: string,
  assetId: string,
): Promise<(AssetSummary & { concept: ConceptReply | null; brief: BrandBrief | null; roundSimulated: boolean }) | null> {
  const [row] = await db
    .select({ ...assetColumns, concept: brandConcepts.concept, brief: brandRounds.brief, roundSimulated: brandRounds.simulated })
    .from(brandAssets)
    .innerJoin(businesses, eq(businesses.id, brandAssets.businessId))
    .leftJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .leftJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandAssets.id, assetId)));
  return row ? { ...row, brief: row.brief ? readBrief(row.brief) : null, roundSimulated: row.roundSimulated ?? false } : null;
}

export async function getAssetFileForOwner(db: Db, ownerId: string, assetId: string) {
  const [row] = await db
    .select({
      kind: brandAssets.kind,
      origin: brandAssets.origin,
      title: brandAssets.title,
      mimeType: brandAssets.mimeType,
      data: brandAssets.data,
      simulated: brandAssets.simulated,
      brief: brandRounds.brief,
      profile: businesses.profile,
    })
    .from(brandAssets)
    .innerJoin(businesses, eq(businesses.id, brandAssets.businessId))
    .leftJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .leftJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandAssets.id, assetId)));
  if (!row) return null;
  const name = (row.brief ? readBrief(row.brief).name : "") || profileName(row.profile);
  return { kind: row.kind, origin: row.origin, title: row.title, mimeType: row.mimeType, simulated: row.simulated, name, data: new Uint8Array(row.data) };
}

// Versions and brand images were made from the old pick, so choosing again clears them
export async function chooseLogoForOwner(db: Db, ownerId: string, assetId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Locked like every change to the picks, so two tabs can't overwrite each other
    if (!(await businessOf(tx, ownerId, true))) return false;
    const asset = await ownedAsset(tx, ownerId, assetId);
    if (!asset || asset.kind !== "logo") return false;
    await upsertKit(tx, asset.businessId, { chosenLogoId: asset.id, picks: {} }, now);
    return true;
  });
}

// The owner stops using their logo; drawn ideas stay with the ideas, and files made from it leave the kit
export async function unchooseLogoForOwner(db: Db, ownerId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    await upsertKit(tx, businessId, { chosenLogoId: null, picks: {} }, now);
    return true;
  });
}

async function kitOf(db: Db | Tx, businessId: string) {
  const [kit] = await db.select().from(brandKits).where(eq(brandKits.businessId, businessId));
  return kit ?? null;
}

const PICKABLE: readonly string[] = [...VERSION_KINDS, ...IMAGE_KINDS];

// The owner picks one version or brand image to use; it must be made from the chosen logo
export async function pickFileForOwner(db: Db, ownerId: string, assetId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await businessOf(tx, ownerId, true))) return false;
    const asset = await ownedAsset(tx, ownerId, assetId);
    const kit = asset ? await kitOf(tx, asset.businessId) : null;
    if (!asset || !kit?.chosenLogoId || asset.sourceId !== kit.chosenLogoId || !PICKABLE.includes(asset.kind)) return false;
    await upsertKit(tx, asset.businessId, { picks: { ...kit.picks, [asset.kind]: asset.id } }, now);
    return true;
  });
}

// Photo or illustration for the chosen logo's brand images: the owner's switch, else the rule on the brief the images use
export function brandImageMedium(state: BrandState): { medium: ImageMedium; by: "owner" | "rules" } {
  if (state.imageMedium) return { medium: state.imageMedium, by: "owner" };
  const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId);
  const brief = chosen?.conceptId ? state.rounds.find((round) => round.concepts.some((concept) => concept.id === chosen.conceptId))?.brief : state.brief;
  return { medium: brief ? ruleMedium(brief) : "photo", by: "rules" };
}

// The owner's Photo / Illustration switch. A new style needs a new example, so its approval is cleared and the other images wait.
export async function setImageMediumForOwner(db: Db, ownerId: string, medium: ImageMedium, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const kit = await kitOf(tx, businessId);
    if (kit?.imageMedium === medium) return true;
    const picks = { ...kit?.picks };
    delete picks[EXAMPLE_IMAGE];
    await upsertKit(tx, businessId, { imageMedium: medium, picks }, now);
    return true;
  });
}

// Merged into the saved plan, so planning one kind never drops another's scene
export async function setImageScenesForOwner(db: Db, ownerId: string, scenes: ImageScenes, now = new Date()): Promise<boolean> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return false;
  await db
    .insert(brandKits)
    .values({ businessId, imageScenes: scenes, updatedAt: now })
    .onConflictDoUpdate({ target: brandKits.businessId, set: { imageScenes: sql`${brandKits.imageScenes} || ${JSON.stringify(scenes)}::jsonb`, updatedAt: now } });
  return true;
}

export async function unpickFileForOwner(db: Db, ownerId: string, kind: VersionKind | BrandImageKind, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    const kit = businessId ? await kitOf(tx, businessId) : null;
    if (!businessId || !kit) return false;
    const picks = { ...kit.picks };
    delete picks[kind];
    await upsertKit(tx, businessId, { picks }, now);
    return true;
  });
}

// Removes every round of ideas except the one holding the chosen logo, with their files
export async function clearIdeasForOwner(db: Db, ownerId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return 0;
    const kit = await kitOf(tx, businessId);
    let keep: string | null = null;
    if (kit?.chosenLogoId) {
      const [row] = await tx
        .select({ roundId: brandConcepts.roundId })
        .from(brandAssets)
        .innerJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
        .where(and(eq(brandAssets.id, kit.chosenLogoId), eq(brandAssets.businessId, businessId)));
      keep = row?.roundId ?? null;
    }
    const removed = await tx
      .delete(brandRounds)
      .where(and(eq(brandRounds.businessId, businessId), keep ? notInArray(brandRounds.id, [keep]) : undefined))
      .returning();
    return removed.length;
  });
}

// What other sections use: the chosen logo, the approved versions and images, and the palette
export async function getBrandKitForOwner(db: Db, ownerId: string): Promise<BrandKit | null> {
  const [business] = await db.select({ id: businesses.id, profile: businesses.profile }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const businessId = business?.id ?? null;
  const kit = businessId ? await kitOf(db, businessId) : null;
  if (!businessId || !kit?.chosenLogoId) return null;
  const ids = [kit.chosenLogoId, ...Object.values(kit.picks).filter((id): id is string => Boolean(id))];
  const rows = await db
    .select({ ...assetColumns, concept: brandConcepts.concept, brief: brandRounds.brief, roundSimulated: brandRounds.simulated })
    .from(brandAssets)
    .leftJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .leftJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .where(and(eq(brandAssets.businessId, businessId), inArray(brandAssets.id, ids)));
  const primary = rows.find((row) => row.id === kit.chosenLogoId);
  if (!primary) return null;

  const used: typeof rows = [primary];
  const file = (kind: VersionKind | BrandImageKind): BrandFile | null => {
    const row = rows.find((candidate) => candidate.id === kit.picks[kind] && candidate.kind === kind && candidate.sourceId === primary.id);
    if (!row) return null;
    used.push(row);
    return toFile(row);
  };
  // The logo as drawn, with any one-click changes to its colors, lettering or tagline
  const drawn = primary.concept && primary.brief ? applyDesign(primary.concept, readBrief(primary.brief), primary.design) : null;
  // An uploaded logo: the owner's colors, and nothing claimed about its lettering or tagline
  const name = drawn ? drawn.brief.name : readBrief(kit.brief).name.trim() || profileName(business?.profile);
  const result: BrandKit = {
    businessName: name,
    tagline: drawn ? drawn.brief.tagline.trim() : "",
    colors: drawn ? drawn.concept.palette : (primary.design?.palette ?? []),
    lettering: drawn ? drawn.concept.typography : "",
    logos: { primary: toFile(primary), stacked: file("stacked"), profile: file("profile"), solid: file("solid") },
    images: {
      websiteHero: file("website_hero"),
      facebookCover: file("facebook_cover"),
      youtubeBanner: file("youtube_banner"),
      linkPreview: file("link_preview"),
      instagramPost: file("instagram_post"),
      instagramStory: file("instagram_story"),
      adSquare: file("ad_square"),
      flyer: file("flyer"),
      productScene: file("product_scene"),
    },
    simulated: false,
    // Uploaded, or an edit of an upload: no idea behind it
    uploaded: primary.conceptId === null,
  };
  // Practice placeholders count too: their colors and lettering weren't written for this business
  result.simulated = used.some((row) => row.simulated || Boolean(row.roundSimulated));
  return result;
}

function toFile(row: { id: string; width: number; height: number }): BrandFile {
  return { url: brandFileUrl(row.id), width: row.width, height: row.height };
}

// --- The owner's own logo

export interface NewUploadedLogo {
  requestKey: string;
  title: string;
  words: string;
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
  data: Uint8Array;
}

export type UploadLogoOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "too_large" };

// Stored byte for byte and chosen at once; versions and pictures from the old pick are cleared, as with any new choice
export async function addUploadedLogoForOwner(db: Db, ownerId: string, input: NewUploadedLogo, now = new Date()): Promise<UploadLogoOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "no_business" };
    const [existing] = await tx
      .select({ id: brandAssets.id })
      .from(brandAssets)
      .where(and(eq(brandAssets.businessId, businessId), eq(brandAssets.requestKey, input.requestKey)));
    if (existing) return { ok: true, id: existing.id };
    const used = await usage(tx, businessId);
    if (used.count + 1 > BRAND_LIMITS.assets) return { ok: false, reason: "too_many" };
    if (used.bytes + input.data.byteLength > BRAND_LIMITS.totalBytes) return { ok: false, reason: "too_large" };

    const id = crypto.randomUUID();
    await tx.insert(brandAssets).values({
      id,
      businessId,
      kind: "logo",
      origin: "uploaded",
      conceptId: null,
      sourceId: null,
      change: null,
      design: null,
      prompt: "",
      model: "",
      simulated: false,
      requestKey: input.requestKey,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      width: input.width,
      height: input.height,
      data: input.data,
      title: input.title,
      words: input.words,
      sha256: input.sha256,
      createdAt: now,
    });
    await upsertKit(tx, businessId, { chosenLogoId: id, picks: {} }, now);
    return { ok: true, id };
  });
}

// The owner's own logo: uploaded, or an edit of an upload
const isOwnLogo = (asset: { kind: string; conceptId: string | null }) => asset.kind === "logo" && asset.conceptId === null;

// The owner's colors for their own logo; the file itself never changes
export async function setOwnLogoColorsForOwner(db: Db, ownerId: string, assetId: string, palette: PaletteColor[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await businessOf(tx, ownerId, true))) return false;
    const asset = await ownedAsset(tx, ownerId, assetId);
    if (!asset || !isOwnLogo(asset)) return false;
    await tx
      .update(brandAssets)
      .set({ design: { ...(asset.design ?? {}), palette } })
      .where(eq(brandAssets.id, asset.id));
    return true;
  });
}

// Removes the owner's own logo with everything made from it, edits included; drawn ideas go with their rounds
export async function deleteOwnLogoForOwner(db: Db, ownerId: string, assetId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const asset = await ownedAsset(tx, ownerId, assetId);
    if (!asset || !isOwnLogo(asset)) return false;
    const gone = [asset.id];
    for (let next = [asset.id]; next.length; ) {
      const made = await tx
        .select({ id: brandAssets.id })
        .from(brandAssets)
        .where(and(eq(brandAssets.businessId, businessId), inArray(brandAssets.sourceId, next)));
      next = made.map((row) => row.id).filter((id) => !gone.includes(id));
      gone.push(...next);
    }
    await tx.delete(brandAssets).where(and(eq(brandAssets.businessId, businessId), inArray(brandAssets.id, gone)));
    const kit = await kitOf(tx, businessId);
    if (kit?.chosenLogoId && gone.includes(kit.chosenLogoId)) await upsertKit(tx, businessId, { chosenLogoId: null, picks: {} }, now);
    return true;
  });
}
