import { beforeEach, describe, expect, it } from "vitest";
import type { NewBrandAsset } from "@/lib/brand/generate";
import { testBrief, testConcept } from "@/lib/brand/test-fixtures";
import type { AssetKind } from "@/lib/brand/types";
import { pngBytes } from "@/lib/photos/test-images";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import {
  addAssetForOwner,
  approveVersionsForOwner,
  assetRoomForOwner,
  BRAND_LIMITS,
  chooseLogoForOwner,
  clearIdeasForOwner,
  createRoundForOwner,
  findAssetByRequestForOwner,
  findRoundByRequestForOwner,
  getAssetFileForOwner,
  getAssetForOwner,
  getBrandForOwner,
  getBrandKitForOwner,
  getConceptForOwner,
  getRoundForOwner,
  pickImageForOwner,
  saveBriefForOwner,
  setAssetCheckForOwner,
  unpickImageForOwner,
} from "./brand";

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
});

async function round(ownerId = "owner-a", requestKey: string = crypto.randomUUID()) {
  const created = await createRoundForOwner(db, ownerId, {
    requestKey,
    basedOnConceptId: null,
    brief: testBrief(),
    model: "test",
    simulated: false,
    concepts: [testConcept({ title: "One" }), testConcept({ title: "Two" })],
  });
  if (!created.ok) throw new Error(created.reason);
  return (await getRoundForOwner(db, ownerId, created.id))!;
}

function asset(conceptId: string, overrides: Partial<NewBrandAsset> = {}): NewBrandAsset {
  return {
    kind: "logo",
    conceptId,
    sourceId: null,
    change: null,
    prompt: "x",
    model: "test-image",
    simulated: false,
    requestKey: crypto.randomUUID(),
    mimeType: "image/png",
    data: pngBytes(1536, 1024, 9),
    width: 1536,
    height: 1024,
    ...overrides,
  };
}

async function add(conceptId: string, overrides: Partial<NewBrandAsset> = {}, ownerId = "owner-a") {
  const added = await addAssetForOwner(db, ownerId, asset(conceptId, overrides));
  if (!added.ok) throw new Error(added.reason);
  return added.id;
}

// A chosen logo with all three versions approved
async function approvedKit() {
  const { concepts } = await round();
  const logo = await add(concepts[0].id);
  expect(await chooseLogoForOwner(db, "owner-a", logo)).toBe(true);
  const version = (kind: AssetKind) => add(concepts[0].id, { kind, sourceId: logo, width: 1024, height: 1024 });
  const ids = { stacked: await version("stacked"), profile: await version("profile"), solid: await version("solid") };
  expect(await approveVersionsForOwner(db, "owner-a", ids)).toBe(true);
  return { concepts, logo, ids };
}

describe("brand files belong to their owner", () => {
  it("never shows, changes or uses another owner's brief, ideas or files", async () => {
    await saveBriefForOwner(db, "owner-a", testBrief());
    const { id: roundId, concepts } = await round("owner-a", "key-1");
    const logo = await add(concepts[0].id, { requestKey: "draw-1" });

    expect(await getBrandForOwner(db, "owner-b")).toMatchObject({ brief: null, rounds: [], assets: [] });
    expect(await getRoundForOwner(db, "owner-b", roundId)).toBeNull();
    expect(await getConceptForOwner(db, "owner-b", concepts[0].id)).toBeNull();
    expect(await findRoundByRequestForOwner(db, "owner-b", "key-1")).toBeNull();
    expect(await findAssetByRequestForOwner(db, "owner-b", "draw-1")).toBeNull();
    expect(await getAssetForOwner(db, "owner-b", logo)).toBeNull();
    expect(await getAssetFileForOwner(db, "owner-b", logo)).toBeNull();
    expect(await setAssetCheckForOwner(db, "owner-b", logo, { checkedAt: "", method: "ai", lettering: null, drift: [] })).toBe(false);
    expect(await chooseLogoForOwner(db, "owner-b", logo)).toBe(false);
    expect(await pickImageForOwner(db, "owner-b", logo)).toBe(false);
    expect(await getBrandKitForOwner(db, "owner-b")).toBeNull();
    // A file can't be added to another owner's idea
    expect(await addAssetForOwner(db, "owner-b", asset(concepts[0].id))).toEqual({ ok: false, reason: "not_found" });
    expect(await clearIdeasForOwner(db, "owner-b")).toBe(0);
    expect((await getBrandForOwner(db, "owner-a"))!.assets).toHaveLength(1);
  });

  it("has no brand without a business", async () => {
    expect(await getBrandForOwner(db, "nobody")).toBeNull();
    expect(await saveBriefForOwner(db, "nobody", testBrief())).toBe(false);
    expect(await assetRoomForOwner(db, "nobody", 1)).toBe("not_found");
  });
});

describe("request keys", () => {
  it("return the round already written instead of saving another", async () => {
    const first = await round("owner-a", "same");
    const again = await round("owner-a", "same");
    expect(again.id).toBe(first.id);
    expect((await getBrandForOwner(db, "owner-a"))!.rounds).toHaveLength(1);
  });

  it("return the file already saved instead of saving another", async () => {
    const { concepts } = await round();
    const id = await add(concepts[0].id, { requestKey: "draw:x" });
    expect(await add(concepts[0].id, { requestKey: "draw:x" })).toBe(id);
    expect(await findAssetByRequestForOwner(db, "owner-a", "draw:x")).toBe(id);
    expect((await getBrandForOwner(db, "owner-a"))!.assets).toHaveLength(1);
  });

  it("stores the bytes exactly as given, with what made them", async () => {
    const { concepts } = await round();
    const data = pngBytes(1536, 1024, 77);
    const id = await add(concepts[0].id, { data, simulated: true });
    expect(await getAssetFileForOwner(db, "owner-a", id)).toEqual({ kind: "logo", mimeType: "image/png", simulated: true, name: "Rise Bakery", data });
  });
});

describe("limits", () => {
  it("refuse more rounds than the limit", async () => {
    for (let i = 0; i < BRAND_LIMITS.rounds; i++) await round();
    const over = await createRoundForOwner(db, "owner-a", { requestKey: "over", basedOnConceptId: null, brief: testBrief(), model: "m", simulated: false, concepts: [testConcept()] });
    expect(over).toEqual({ ok: false, reason: "too_many" });
  });

  it("say before paying whether new files fit", async () => {
    expect(await assetRoomForOwner(db, "owner-a", 5)).toBe("ok");
    expect(await assetRoomForOwner(db, "owner-a", BRAND_LIMITS.assets + 1)).toBe("too_many");
  });
});

describe("the brand kit", () => {
  it("is null until a logo is chosen, then follows the owner's approvals", async () => {
    expect(await getBrandKitForOwner(db, "owner-a")).toBeNull();
    const { concepts, logo, ids } = await approvedKit();
    const hero = await add(concepts[0].id, { kind: "website_hero", sourceId: logo, width: 1920, height: 1080 });
    expect(await pickImageForOwner(db, "owner-a", hero)).toBe(true);

    expect(await getBrandKitForOwner(db, "owner-a")).toEqual({
      businessName: "Rise Bakery",
      colors: testConcept().palette,
      logos: {
        primary: { url: `/brand/files/${logo}?view=1`, width: 1536, height: 1024 },
        stacked: { url: `/brand/files/${ids.stacked}?view=1`, width: 1024, height: 1024 },
        profile: { url: `/brand/files/${ids.profile}?view=1`, width: 1024, height: 1024 },
        solid: { url: `/brand/files/${ids.solid}?view=1`, width: 1024, height: 1024 },
      },
      images: { websiteHero: { url: `/brand/files/${hero}?view=1`, width: 1920, height: 1080 }, facebookCover: null, youtubeBanner: null, linkPreview: null },
      simulated: false,
    });

    expect(await unpickImageForOwner(db, "owner-a", "website_hero")).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.images.websiteHero).toBeNull();
  });

  it("is marked practice when any file in it is a practice preview", async () => {
    const { concepts } = await round();
    const logo = await add(concepts[0].id, { simulated: true, mimeType: "image/svg+xml" });
    await chooseLogoForOwner(db, "owner-a", logo);
    expect((await getBrandKitForOwner(db, "owner-a"))!.simulated).toBe(true);
  });

  it("is marked practice when its idea was a practice placeholder, even if Muse drew it", async () => {
    const created = await createRoundForOwner(db, "owner-a", { requestKey: "p", basedOnConceptId: null, brief: testBrief(), model: "mock", simulated: true, concepts: [testConcept()] });
    if (!created.ok) throw new Error(created.reason);
    const practiceRound = (await getRoundForOwner(db, "owner-a", created.id))!;
    expect(practiceRound.simulated).toBe(true);
    const logo = await add(practiceRound.concepts[0].id);
    expect((await getAssetForOwner(db, "owner-a", logo))!.roundSimulated).toBe(true);
    await chooseLogoForOwner(db, "owner-a", logo);
    expect((await getBrandKitForOwner(db, "owner-a"))!.simulated).toBe(true);
  });

  it("clears versions and pictures when the owner chooses a different logo", async () => {
    const { concepts } = await approvedKit();
    const other = await add(concepts[1].id);
    expect(await chooseLogoForOwner(db, "owner-a", other)).toBe(true);
    const kit = (await getBrandKitForOwner(db, "owner-a"))!;
    expect(kit.logos).toMatchObject({ stacked: null, profile: null, solid: null });
    expect(kit.logos.primary?.url).toContain(other);
  });

  it("only takes versions and pictures made from the chosen logo", async () => {
    const { concepts, logo, ids } = await approvedKit();
    const otherLogo = await add(concepts[1].id);
    const stray = await add(concepts[1].id, { kind: "stacked", sourceId: otherLogo });
    expect(await approveVersionsForOwner(db, "owner-a", { ...ids, stacked: stray })).toBe(false);
    // Wrong kind in a slot
    expect(await approveVersionsForOwner(db, "owner-a", { ...ids, stacked: ids.solid })).toBe(false);
    const strayImage = await add(concepts[1].id, { kind: "facebook_cover", sourceId: otherLogo });
    expect(await pickImageForOwner(db, "owner-a", strayImage)).toBe(false);
    // A logo is never a brand picture
    expect(await pickImageForOwner(db, "owner-a", logo)).toBe(false);
    expect(await chooseLogoForOwner(db, "owner-a", ids.stacked)).toBe(false);
  });
});

describe("removing ideas", () => {
  it("keeps the round with the chosen logo and removes the rest with their files", async () => {
    const kept = await round();
    const logo = await add(kept.concepts[0].id);
    await chooseLogoForOwner(db, "owner-a", logo);
    const gone = await round();
    await add(gone.concepts[0].id);

    expect(await clearIdeasForOwner(db, "owner-a")).toBe(1);
    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(state.rounds.map((r) => r.id)).toEqual([kept.id]);
    expect(state.assets.map((a) => a.id)).toEqual([logo]);
    expect(await getBrandKitForOwner(db, "owner-a")).not.toBeNull();
  });
});
