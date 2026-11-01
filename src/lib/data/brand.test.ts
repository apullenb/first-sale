import { beforeEach, describe, expect, it } from "vitest";
import type { NewBrandAsset } from "@/lib/brand/generate";
import { testBrief, testConcept } from "@/lib/brand/test-fixtures";
import type { AssetKind } from "@/lib/brand/types";
import { pngBytes } from "@/lib/photos/test-images";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import {
  addAssetForOwner,
  addUploadedLogoForOwner,
  deleteOwnLogoForOwner,
  type NewUploadedLogo,
  setOwnLogoColorsForOwner,
  assetRoomForOwner,
  BRAND_LIMITS,
  chooseLogoForOwner,
  clearIdeasForOwner,
  createRoundForOwner,
  findAssetByRequestForOwner,
  findRoundByRequestForOwner,
  brandImageMedium,
  getAssetFileForOwner,
  getAssetForOwner,
  getBrandForOwner,
  getBrandKitForOwner,
  getConceptForOwner,
  getRoundForOwner,
  pickFileForOwner,
  saveBriefForOwner,
  setAssetCheckForOwner,
  setImageMediumForOwner,
  unchooseLogoForOwner,
  unpickFileForOwner,
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
    design: null,
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

// A chosen logo with all three versions picked, one at a time
async function approvedKit() {
  const { concepts } = await round();
  const logo = await add(concepts[0].id);
  expect(await chooseLogoForOwner(db, "owner-a", logo)).toBe(true);
  const version = (kind: AssetKind) => add(concepts[0].id, { kind, sourceId: logo, width: 1024, height: 1024 });
  const ids = { stacked: await version("stacked"), profile: await version("profile"), solid: await version("solid") };
  for (const id of Object.values(ids)) expect(await pickFileForOwner(db, "owner-a", id)).toBe(true);
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
    expect(await pickFileForOwner(db, "owner-b", logo)).toBe(false);
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
    expect(await getAssetFileForOwner(db, "owner-a", id)).toEqual({ kind: "logo", origin: "generated", title: null, mimeType: "image/png", simulated: true, name: "Rise Bakery", data });
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
    expect(await pickFileForOwner(db, "owner-a", hero)).toBe(true);

    expect(await getBrandKitForOwner(db, "owner-a")).toEqual({
      businessName: "Rise Bakery",
      tagline: "",
      colors: testConcept().palette,
      lettering: testConcept().typography,
      logos: {
        primary: { url: `/brand/files/${logo}?view=1`, width: 1536, height: 1024 },
        stacked: { url: `/brand/files/${ids.stacked}?view=1`, width: 1024, height: 1024 },
        profile: { url: `/brand/files/${ids.profile}?view=1`, width: 1024, height: 1024 },
        solid: { url: `/brand/files/${ids.solid}?view=1`, width: 1024, height: 1024 },
      },
      images: { websiteHero: { url: `/brand/files/${hero}?view=1`, width: 1920, height: 1080 }, facebookCover: null, youtubeBanner: null, linkPreview: null },
      simulated: false,
      uploaded: false,
    });

    expect(await unpickFileForOwner(db, "owner-a", "website_hero")).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.images.websiteHero).toBeNull();
  });

  it("follows a one-click change to the chosen logo's colors, lettering and tagline", async () => {
    const { concepts } = await round();
    const palette = [{ hex: "#5B2A86", name: "Purple" }];
    const logo = await add(concepts[0].id, { design: { palette, typography: "bold, chunky display lettering", tagline: "Sourdough daily", preset: "colors" } });
    expect((await getAssetForOwner(db, "owner-a", logo))!.design).toMatchObject({ palette, preset: "colors" });
    await chooseLogoForOwner(db, "owner-a", logo);
    expect(await getBrandKitForOwner(db, "owner-a")).toMatchObject({ colors: palette, lettering: "bold, chunky display lettering", tagline: "Sourdough daily" });
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

  it("uses each version only once the owner picks it, and a newer pick replaces the older one", async () => {
    const { concepts } = await round();
    const logo = await add(concepts[0].id);
    await chooseLogoForOwner(db, "owner-a", logo);
    const first = await add(concepts[0].id, { kind: "stacked", sourceId: logo, width: 1024, height: 1024 });
    const second = await add(concepts[0].id, { kind: "stacked", sourceId: logo, width: 1024, height: 1024 });
    expect((await getBrandKitForOwner(db, "owner-a"))!.logos.stacked).toBeNull();
    expect(await pickFileForOwner(db, "owner-a", first)).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.logos.stacked?.url).toContain(first);
    expect(await pickFileForOwner(db, "owner-a", second)).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.logos.stacked?.url).toContain(second);
    expect(await unpickFileForOwner(db, "owner-a", "stacked")).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.logos.stacked).toBeNull();
  });

  it("only takes versions and pictures made from the chosen logo", async () => {
    const { concepts, logo, ids } = await approvedKit();
    const otherLogo = await add(concepts[1].id);
    const stray = await add(concepts[1].id, { kind: "stacked", sourceId: otherLogo });
    expect(await pickFileForOwner(db, "owner-a", stray)).toBe(false);
    expect((await getBrandKitForOwner(db, "owner-a"))!.logos.stacked?.url).toContain(ids.stacked);
    const strayImage = await add(concepts[1].id, { kind: "facebook_cover", sourceId: otherLogo });
    expect(await pickFileForOwner(db, "owner-a", strayImage)).toBe(false);
    // A logo is never a version or brand picture
    expect(await pickFileForOwner(db, "owner-a", logo)).toBe(false);
    expect(await chooseLogoForOwner(db, "owner-a", ids.stacked)).toBe(false);
  });
});

describe("the Photo / Illustration switch", () => {
  it("starts with the rule on the chosen logo's brief, then follows the owner", async () => {
    const { concepts, logo } = await approvedKit();
    expect(brandImageMedium((await getBrandForOwner(db, "owner-a"))!)).toEqual({ medium: "photo", by: "rules" });
    const example = await add(concepts[0].id, { kind: "website_hero", sourceId: logo });
    const cover = await add(concepts[0].id, { kind: "facebook_cover", sourceId: logo });
    await pickFileForOwner(db, "owner-a", example);
    await pickFileForOwner(db, "owner-a", cover);

    expect(await setImageMediumForOwner(db, "owner-a", "illustration")).toBe(true);
    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(brandImageMedium(state)).toEqual({ medium: "illustration", by: "owner" });
    // A new style needs a new example: its approval clears, and the file stays as an earlier one
    expect(state.picks.website_hero).toBeUndefined();
    expect(state.picks.facebook_cover).toBe(cover);
    expect(state.assets.some((asset) => asset.id === example)).toBe(true);
    expect(await setImageMediumForOwner(db, "nobody", "photo")).toBe(false);
    expect((await getBrandForOwner(db, "owner-b"))?.imageMedium ?? null).toBeNull();
  });
});

describe("stopping using a logo", () => {
  it("clears the pick and the files in use, and keeps the drawn idea", async () => {
    const { logo } = await approvedKit();
    expect(await unchooseLogoForOwner(db, "owner-a")).toBe(true);
    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(state).toMatchObject({ chosenLogoId: null, picks: {} });
    expect(state.assets.some((asset) => asset.id === logo)).toBe(true);
    expect(await getBrandKitForOwner(db, "owner-a")).toBeNull();
    expect(await unchooseLogoForOwner(db, "nobody")).toBe(false);
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

describe("an uploaded logo", () => {
  function upload(overrides: Partial<NewUploadedLogo> = {}): NewUploadedLogo {
    const data = pngBytes(800, 400, 30);
    return { requestKey: `upload:${crypto.randomUUID()}`, title: "Rise logo", words: "Rise", mimeType: "image/png", sha256: "abc", width: 800, height: 400, data, ...overrides };
  }

  it("is stored byte for byte and chosen at once, clearing versions from the old pick", async () => {
    const { logo } = await approvedKit();
    const input = upload();
    const added = await addUploadedLogoForOwner(db, "owner-a", input);
    if (!added.ok) throw new Error(added.reason);
    expect(await addUploadedLogoForOwner(db, "owner-a", input)).toEqual({ ok: true, id: added.id });

    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(state.chosenLogoId).toBe(added.id);
    expect(state.chosenLogoId).not.toBe(logo);
    expect(state.picks).toEqual({});
    expect(state.assets.find((asset) => asset.id === added.id)).toMatchObject({ origin: "uploaded", conceptId: null, title: "Rise logo", words: "Rise", simulated: false });
    expect(await getAssetFileForOwner(db, "owner-a", added.id)).toMatchObject({ origin: "uploaded", title: "Rise logo", name: "Rise Bakery", data: input.data });
    expect(await getAssetForOwner(db, "owner-a", added.id)).toMatchObject({ concept: null, brief: null, roundSimulated: false });
  });

  it("makes a kit with the owner's colors and nothing claimed about its lettering", async () => {
    await saveBriefForOwner(db, "owner-a", testBrief({ tagline: "Baked at dawn" }));
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    expect(await getBrandKitForOwner(db, "owner-a")).toMatchObject({ businessName: "Rise Bakery", tagline: "", colors: [], lettering: "", uploaded: true, simulated: false });

    const palette = [{ hex: "#1F3A2E", name: "Dark green" }];
    expect(await setOwnLogoColorsForOwner(db, "owner-a", added.id, palette)).toBe(true);
    expect((await getBrandKitForOwner(db, "owner-a"))!.colors).toEqual(palette);
    expect(await getAssetFileForOwner(db, "owner-a", added.id)).toMatchObject({ data: upload().data });
  });

  it("takes versions made from it, but not files from another owner's logo or with no source", async () => {
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    const made = await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "stacked", sourceId: added.id }));
    expect(made.ok).toBe(true);
    expect(await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "stacked", sourceId: null }))).toEqual({ ok: false, reason: "not_found" });
    expect(await addAssetForOwner(db, "owner-b", asset("", { conceptId: null, kind: "stacked", sourceId: added.id }))).toEqual({ ok: false, reason: "not_found" });
  });

  it("only changes colors on uploads, and another owner can't touch it", async () => {
    const { logo } = await approvedKit();
    expect(await setOwnLogoColorsForOwner(db, "owner-a", logo, [])).toBe(false);
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    expect(await setOwnLogoColorsForOwner(db, "owner-b", added.id, [])).toBe(false);
    expect(await deleteOwnLogoForOwner(db, "owner-b", added.id)).toBe(false);
    expect(await deleteOwnLogoForOwner(db, "owner-a", logo)).toBe(false);
  });

  it("is removed with the files made from it, and the pick is cleared", async () => {
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "profile", sourceId: added.id }));
    expect(await deleteOwnLogoForOwner(db, "owner-a", added.id)).toBe(true);
    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(state.assets).toEqual([]);
    expect(state.chosenLogoId).toBeNull();
    expect(await getBrandKitForOwner(db, "owner-a")).toBeNull();
  });

  it("takes an edited copy as a new file that keeps the owner's words, and versions made from that copy", async () => {
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    const edit = await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "logo", sourceId: added.id, change: "Thicker letters", words: "Rise" }));
    if (!edit.ok) throw new Error(edit.reason);
    expect(await getAssetForOwner(db, "owner-a", edit.id)).toMatchObject({ origin: "generated", conceptId: null, sourceId: added.id, words: "Rise", change: "Thicker letters" });
    expect(await getAssetFileForOwner(db, "owner-a", added.id)).toMatchObject({ data: upload().data });

    expect(await chooseLogoForOwner(db, "owner-a", edit.id)).toBe(true);
    const version = await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "stacked", sourceId: edit.id }));
    expect(version.ok).toBe(true);
    expect(await setOwnLogoColorsForOwner(db, "owner-a", edit.id, [{ hex: "#1F3A2E", name: "Dark green" }])).toBe(true);
    expect(await getBrandKitForOwner(db, "owner-a")).toMatchObject({ uploaded: true, lettering: "", colors: [{ hex: "#1F3A2E", name: "Dark green" }] });
  });

  it("is removed with its edits and everything made from them", async () => {
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    const edit = await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "logo", sourceId: added.id }));
    if (!edit.ok) throw new Error(edit.reason);
    await chooseLogoForOwner(db, "owner-a", edit.id);
    await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "profile", sourceId: edit.id }));
    expect(await deleteOwnLogoForOwner(db, "owner-a", added.id)).toBe(true);
    expect((await getBrandForOwner(db, "owner-a"))!).toMatchObject({ assets: [], chosenLogoId: null });
  });

  it("removes only an edited copy when that's what's asked, keeping the upload", async () => {
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    const edit = await addAssetForOwner(db, "owner-a", asset("", { conceptId: null, kind: "logo", sourceId: added.id }));
    if (!edit.ok) throw new Error(edit.reason);
    expect(await deleteOwnLogoForOwner(db, "owner-a", edit.id)).toBe(true);
    expect((await getBrandForOwner(db, "owner-a"))!.assets.map((each) => each.id)).toEqual([added.id]);
  });

  it("survives removing every idea", async () => {
    await approvedKit();
    const added = await addUploadedLogoForOwner(db, "owner-a", upload());
    if (!added.ok) throw new Error(added.reason);
    await clearIdeasForOwner(db, "owner-a");
    const state = (await getBrandForOwner(db, "owner-a"))!;
    expect(state.rounds).toEqual([]);
    expect(state.assets.map((each) => each.id)).toEqual([added.id]);
  });

  it("needs a business", async () => {
    expect(await addUploadedLogoForOwner(db, "nobody", upload())).toEqual({ ok: false, reason: "no_business" });
  });
});
