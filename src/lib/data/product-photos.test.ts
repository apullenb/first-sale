import { beforeEach, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import type { NewPhotoVersion } from "@/lib/photos/edit";
import { pngBytes } from "@/lib/photos/test-images";
import { createTestDb } from "@/test/db";
import { testProfile } from "@/test/fixtures";
import { createBusinessForOwner } from "./businesses";
import {
  addPhotoVersionForOwner,
  approvePhotoVersionForOwner,
  createPhotoForOwner,
  deletePhotoForOwner,
  findPhotoVersionByRequestForOwner,
  getPhotoFileForOwner,
  getPhotoForOwner,
  getPhotoVersionFileForOwner,
  listPhotoLibraryForOwner,
  listPhotosForOwner,
  PHOTO_LIMITS,
  photoVersionRoomForOwner,
  setPhotoVersionReviewForOwner,
  updatePhotoForOwner,
} from "./product-photos";
import { finishRun, startRunForOwner } from "./workflow-runs";

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "owner-a", name: "Owner A", email: "a@example.test" },
    { id: "owner-b", name: "Owner B", email: "b@example.test" },
  ]);
  await createBusinessForOwner(db, "owner-a", { profile: testProfile({ name: "A" }) });
  await createBusinessForOwner(db, "owner-b", { profile: testProfile({ name: "B" }) });
});

async function photo(ownerId = "owner-a", data = pngBytes(640, 480)) {
  const created = await createPhotoForOwner(db, ownerId, { title: "Mug", mimeType: "image/png", sha256: "x", width: 640, height: 480, data });
  if (!created.ok) throw new Error(created.reason);
  return created.id;
}

function version(overrides: Partial<NewPhotoVersion> = {}): NewPhotoVersion {
  return {
    requestKey: crypto.randomUUID(),
    parentId: null,
    look: "studio",
    crop: "square",
    refinement: null,
    instruction: "x",
    model: "test-image",
    simulated: false,
    mimeType: "image/png",
    data: pngBytes(1024, 1024, 7),
    width: 1024,
    height: 1024,
    ...overrides,
  };
}

async function addVersion(photoId: string, overrides: Partial<NewPhotoVersion> = {}) {
  const added = await addPhotoVersionForOwner(db, "owner-a", photoId, version(overrides));
  if (!added.ok) throw new Error(added.reason);
  return added.id;
}

describe("photos belong to their owner", () => {
  it("never shows, changes or deletes another owner's photo or versions", async () => {
    const photoId = await photo();
    const versionId = await addVersion(photoId, { requestKey: "k1" });

    expect(await listPhotosForOwner(db, "owner-b")).toEqual([]);
    expect(await getPhotoForOwner(db, "owner-b", photoId)).toBeNull();
    expect(await getPhotoFileForOwner(db, "owner-b", photoId)).toBeNull();
    expect(await getPhotoVersionFileForOwner(db, "owner-b", photoId, versionId)).toBeNull();
    expect(await findPhotoVersionByRequestForOwner(db, "owner-b", photoId, "k1")).toBeNull();
    expect(await updatePhotoForOwner(db, "owner-b", photoId, { look: "white" })).toBe(false);
    expect(await approvePhotoVersionForOwner(db, "owner-b", versionId, true)).toBe(false);
    expect(await setPhotoVersionReviewForOwner(db, "owner-b", versionId, { checkedAt: "", method: "ai", flags: [] })).toBe(false);
    expect(await addPhotoVersionForOwner(db, "owner-b", photoId, version())).toEqual({ ok: false, reason: "not_found" });
    expect(await deletePhotoForOwner(db, "owner-b", photoId)).toBe(false);

    expect(await getPhotoForOwner(db, "owner-a", photoId)).toMatchObject({ photo: { look: "studio" }, versions: [{ approvedAt: null, review: null }] });
  });

  it("keeps the original's bytes exactly as uploaded", async () => {
    const data = pngBytes(640, 480, 33);
    const photoId = await photo("owner-a", data);
    await updatePhotoForOwner(db, "owner-a", photoId, { look: "boutique", crop: "landscape", category: "food", forSale: ["cake"], answer: "Yes" });
    expect((await getPhotoFileForOwner(db, "owner-a", photoId))?.data).toEqual(data);
    expect((await getPhotoForOwner(db, "owner-a", photoId))?.photo).toMatchObject({ look: "boutique", crop: "landscape", category: "food", forSale: ["cake"], answer: "Yes" });
  });
});

describe("version history", () => {
  it("numbers versions per photo and returns the saved one when a request repeats", async () => {
    const photoId = await photo();
    const other = await photo();
    const first = await addVersion(photoId, { requestKey: "same" });
    expect(await addPhotoVersionForOwner(db, "owner-a", photoId, version({ requestKey: "same" }))).toEqual({ ok: true, id: first });
    await addVersion(photoId, { requestKey: "next", parentId: first, refinement: "Remove the props" });
    await addVersion(other, { requestKey: "same" });

    const { versions } = (await getPhotoForOwner(db, "owner-a", photoId))!;
    expect(versions.map((item) => [item.number, item.parentId, item.refinement])).toEqual([
      [1, null, null],
      [2, first, "Remove the props"],
    ]);
    expect((await listPhotosForOwner(db, "owner-a")).find((item) => item.id === photoId)?.versionCount).toBe(2);
  });

  it("only refines a version of the same photo", async () => {
    const photoId = await photo();
    const other = await photo();
    const otherVersion = await addVersion(other);
    expect(await addPhotoVersionForOwner(db, "owner-a", photoId, version({ parentId: otherVersion }))).toEqual({ ok: false, reason: "not_found" });
  });

  it("says when a photo has no room for another version, but never refuses one already paid for", async () => {
    const photoId = await photo();
    for (let index = 0; index < PHOTO_LIMITS.versionsPerPhoto; index++) await addVersion(photoId, { data: pngBytes(300, 300) });
    expect(await photoVersionRoomForOwner(db, "owner-a", photoId)).toBe("too_many");
    expect(await photoVersionRoomForOwner(db, "owner-b", photoId)).toBe("not_found");
    expect((await addPhotoVersionForOwner(db, "owner-a", photoId, version())).ok).toBe(true);
  });

  it("caps photos per business", async () => {
    for (let index = 0; index < PHOTO_LIMITS.photos; index++) await photo("owner-a", pngBytes(300, 300));
    const extra = await createPhotoForOwner(db, "owner-a", { title: "x", mimeType: "image/png", sha256: "x", width: 300, height: 300, data: pngBytes(300, 300) });
    expect(extra).toEqual({ ok: false, reason: "too_many" });
  });
});

describe("the product library", () => {
  it("holds only versions the owner approved, and drops them when removed or deleted", async () => {
    const photoId = await photo();
    const kept = await addVersion(photoId);
    await addVersion(photoId);
    expect(await approvePhotoVersionForOwner(db, "owner-a", kept, true, new Date("2026-10-27T12:00:00Z"))).toBe(true);

    const library = await listPhotoLibraryForOwner(db, "owner-a");
    expect(library.map((item) => [item.id, item.title, item.approvedAt?.toISOString()])).toEqual([[kept, "Mug", "2026-10-27T12:00:00.000Z"]]);
    expect(await listPhotoLibraryForOwner(db, "owner-b")).toEqual([]);

    await approvePhotoVersionForOwner(db, "owner-a", kept, false);
    expect(await listPhotoLibraryForOwner(db, "owner-a")).toEqual([]);

    await approvePhotoVersionForOwner(db, "owner-a", kept, true);
    expect(await deletePhotoForOwner(db, "owner-a", photoId)).toBe(true);
    expect(await listPhotoLibraryForOwner(db, "owner-a")).toEqual([]);
    expect(await getPhotoVersionFileForOwner(db, "owner-a", photoId, kept)).toBeNull();
  });
});

describe("one edit at a time per photo", () => {
  it("refuses a second run on the same photo until the first ends", async () => {
    const photoId = await photo();
    const other = await photo();
    const first = await startRunForOwner(db, "owner-a", "photo_edit", photoId);
    expect(first.ok).toBe(true);
    expect(await startRunForOwner(db, "owner-a", "photo_edit", photoId)).toEqual({ ok: false, reason: "busy" });
    expect((await startRunForOwner(db, "owner-a", "photo_edit", other)).ok).toBe(true);
    if (first.ok) await finishRun(db, first.runId, "failed", "x");
    expect((await startRunForOwner(db, "owner-a", "photo_edit", photoId)).ok).toBe(true);
  });
});
