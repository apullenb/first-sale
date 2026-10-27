import "server-only";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandAssets, brandConcepts, brandKits, brandRounds, businesses } from "@/db/schema";
import { brandFileUrl } from "@/lib/brand/files";
import type { NewBrandAsset, Room } from "@/lib/brand/generate";
import {
  type AssetCheck,
  type AssetKind,
  type BrandBrief,
  type BrandFile,
  type BrandImageKind,
  type BrandKit,
  type BrandPicks,
  type ConceptReply,
  IMAGE_KINDS,
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
  conceptId: string;
  sourceId: string | null;
  change: string | null;
  model: string;
  simulated: boolean;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  check: AssetCheck | null;
  createdAt: Date;
}

export interface BrandState {
  brief: BrandBrief | null;
  chosenLogoId: string | null;
  picks: BrandPicks;
  rounds: RoundSummary[];
  assets: AssetSummary[];
}

const assetColumns = {
  id: brandAssets.id,
  kind: brandAssets.kind,
  conceptId: brandAssets.conceptId,
  sourceId: brandAssets.sourceId,
  change: brandAssets.change,
  model: brandAssets.model,
  simulated: brandAssets.simulated,
  mimeType: brandAssets.mimeType,
  byteSize: brandAssets.byteSize,
  width: brandAssets.width,
  height: brandAssets.height,
  check: brandAssets.check,
  createdAt: brandAssets.createdAt,
};

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
    const [concept] = await tx
      .select({ id: brandConcepts.id })
      .from(brandConcepts)
      .where(and(eq(brandConcepts.id, input.conceptId), eq(brandConcepts.businessId, businessId)));
    if (!concept) return { ok: false, reason: "not_found" };

    // Id made here, so the insert doesn't send the file back
    const id = crypto.randomUUID();
    await tx.insert(brandAssets).values({
      id,
      businessId,
      kind: input.kind,
      conceptId: input.conceptId,
      sourceId: input.sourceId,
      change: input.change,
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

// roundSimulated: the idea itself was a practice placeholder
export async function getAssetForOwner(
  db: Db,
  ownerId: string,
  assetId: string,
): Promise<(AssetSummary & { concept: ConceptReply; brief: BrandBrief; roundSimulated: boolean }) | null> {
  const [row] = await db
    .select({ ...assetColumns, concept: brandConcepts.concept, brief: brandRounds.brief, roundSimulated: brandRounds.simulated })
    .from(brandAssets)
    .innerJoin(businesses, eq(businesses.id, brandAssets.businessId))
    .innerJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .innerJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandAssets.id, assetId)));
  return row ? { ...row, brief: readBrief(row.brief) } : null;
}

export async function getAssetFileForOwner(db: Db, ownerId: string, assetId: string) {
  const [row] = await db
    .select({ kind: brandAssets.kind, mimeType: brandAssets.mimeType, data: brandAssets.data, simulated: brandAssets.simulated, brief: brandRounds.brief })
    .from(brandAssets)
    .innerJoin(businesses, eq(businesses.id, brandAssets.businessId))
    .innerJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .innerJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
    .where(and(eq(businesses.ownerId, ownerId), eq(brandAssets.id, assetId)));
  return row ? { kind: row.kind, mimeType: row.mimeType, simulated: row.simulated, name: readBrief(row.brief).name, data: new Uint8Array(row.data) } : null;
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

async function kitOf(db: Db | Tx, businessId: string) {
  const [kit] = await db.select().from(brandKits).where(eq(brandKits.businessId, businessId));
  return kit ?? null;
}

// The owner approves the three versions together; each must be made from the chosen logo
export async function approveVersionsForOwner(db: Db, ownerId: string, ids: Record<VersionKind, string>, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    const kit = businessId ? await kitOf(tx, businessId) : null;
    if (!businessId || !kit?.chosenLogoId) return false;
    const rows = await tx
      .select({ id: brandAssets.id, kind: brandAssets.kind, sourceId: brandAssets.sourceId })
      .from(brandAssets)
      .where(and(eq(brandAssets.businessId, businessId), inArray(brandAssets.id, Object.values(ids))));
    const valid = VERSION_KINDS.every((kind) => rows.some((row) => row.id === ids[kind] && row.kind === kind && row.sourceId === kit.chosenLogoId));
    if (!valid) return false;
    await upsertKit(tx, businessId, { picks: { ...kit.picks, ...ids } }, now);
    return true;
  });
}

export async function pickImageForOwner(db: Db, ownerId: string, assetId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (!(await businessOf(tx, ownerId, true))) return false;
    const asset = await ownedAsset(tx, ownerId, assetId);
    const kit = asset ? await kitOf(tx, asset.businessId) : null;
    if (!asset || !kit?.chosenLogoId || asset.sourceId !== kit.chosenLogoId || !(IMAGE_KINDS as readonly string[]).includes(asset.kind)) return false;
    await upsertKit(tx, asset.businessId, { picks: { ...kit.picks, [asset.kind]: asset.id } }, now);
    return true;
  });
}

export async function unpickImageForOwner(db: Db, ownerId: string, kind: BrandImageKind, now = new Date()): Promise<boolean> {
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
  const businessId = await businessOf(db, ownerId);
  const kit = businessId ? await kitOf(db, businessId) : null;
  if (!businessId || !kit?.chosenLogoId) return null;
  const ids = [kit.chosenLogoId, ...Object.values(kit.picks).filter((id): id is string => Boolean(id))];
  const rows = await db
    .select({ ...assetColumns, concept: brandConcepts.concept, brief: brandRounds.brief, roundSimulated: brandRounds.simulated })
    .from(brandAssets)
    .innerJoin(brandConcepts, eq(brandConcepts.id, brandAssets.conceptId))
    .innerJoin(brandRounds, eq(brandRounds.id, brandConcepts.roundId))
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
  const result: BrandKit = {
    businessName: readBrief(primary.brief).name,
    colors: primary.concept.palette,
    logos: { primary: toFile(primary), stacked: file("stacked"), profile: file("profile"), solid: file("solid") },
    images: { websiteHero: file("website_hero"), facebookCover: file("facebook_cover"), youtubeBanner: file("youtube_banner"), linkPreview: file("link_preview") },
    simulated: false,
  };
  // Practice placeholders count too: their colors and lettering weren't written for this business
  result.simulated = used.some((row) => row.simulated || row.roundSimulated);
  return result;
}

function toFile(row: { id: string; width: number; height: number }): BrandFile {
  return { url: brandFileUrl(row.id), width: row.width, height: row.height };
}
