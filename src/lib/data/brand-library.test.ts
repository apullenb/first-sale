import { beforeEach, describe, expect, it } from "vitest";
import { pngBytes } from "@/lib/photos/test-images";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import {
  addLibraryFileForOwner,
  deleteLibraryFileForOwner,
  getLibraryFileForOwner,
  LIBRARY_LIMITS,
  libraryUsageForOwner,
  listLibraryFilesForOwner,
  type NewLibraryFile,
} from "./brand-library";
import { productValues } from "@/lib/products/test-values";
import { createProductForOwner, listProductsForOwner } from "./products";

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
});

function file(overrides: Partial<NewLibraryFile> = {}): NewLibraryFile {
  return { group: "other", title: "Our stall", mimeType: "image/png", sha256: "abc", width: 64, height: 64, data: pngBytes(64, 64, 90), ...overrides };
}

async function add(overrides: Partial<NewLibraryFile> = {}, ownerId = "owner-a") {
  const added = await addLibraryFileForOwner(db, ownerId, file(overrides));
  if (!added.ok) throw new Error(added.reason);
  return added.id;
}

describe("the Brand Library", () => {
  it("keeps each picture byte for byte, newest first, for its owner only", async () => {
    const data = pngBytes(64, 64, 12);
    const first = await add({ data, group: "logos", title: "Old logo" });
    const second = await add({ group: "product_photos", title: "Loaf" });
    expect((await listLibraryFilesForOwner(db, "owner-a")).map((each) => [each.id, each.group, each.title])).toEqual([
      [second, "product_photos", "Loaf"],
      [first, "logos", "Old logo"],
    ]);
    expect(await getLibraryFileForOwner(db, "owner-a", first)).toEqual({ title: "Old logo", mimeType: "image/png", data });
    expect(await getLibraryFileForOwner(db, "owner-b", first)).toBeNull();
    expect(await listLibraryFilesForOwner(db, "owner-b")).toEqual([]);
    expect(await libraryUsageForOwner(db, "owner-a")).toEqual({ count: 2, bytes: data.byteLength + pngBytes(64, 64, 90).byteLength });
  });

  it("refuses more pictures than the limit, and needs a business", async () => {
    for (let i = 0; i < LIBRARY_LIMITS.files; i++) await add({ data: new Uint8Array([i]) });
    expect(await addLibraryFileForOwner(db, "owner-a", file())).toEqual({ ok: false, reason: "too_many" });
    expect(await addLibraryFileForOwner(db, "owner-b", file())).toMatchObject({ ok: true });
    expect(await addLibraryFileForOwner(db, "nobody", file())).toEqual({ ok: false, reason: "no_business" });
  });

  it("deletes only the owner's own uploads, and products showing one go back to no photo", async () => {
    const id = await add();
    const made = await createProductForOwner(db, "owner-a", productValues({ name: "Loaf", photo: { source: "library", fileId: id } }));
    expect(made.ok).toBe(true);
    expect(await deleteLibraryFileForOwner(db, "owner-b", id)).toBe(false);
    expect(await deleteLibraryFileForOwner(db, "owner-a", id)).toBe(true);
    expect(await deleteLibraryFileForOwner(db, "owner-a", id)).toBe(false);
    expect(await listLibraryFilesForOwner(db, "owner-a")).toEqual([]);
    expect((await listProductsForOwner(db, "owner-a"))[0].photo).toBeNull();
  });
});
