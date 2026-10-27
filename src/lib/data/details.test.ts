import { beforeEach, describe, expect, it } from "vitest";
import { businessDetails } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { deleteDetailForOwner, getDetailsForOwner, saveDetailsForOwner } from "./details";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA } = await seedOwners(db));
});

const OWNER = { source: "owner", documentId: null } as const;

describe("details data access", () => {
  it("saves trimmed details for the owner's business only", async () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(
      await saveDetailsForOwner(
        db,
        "owner-a",
        [
          { key: "business_email", value: "  jo@example.test " },
          { key: "structure_choice", value: "llc" },
        ],
        OWNER,
        now,
      ),
    ).toBe(true);

    expect(await getDetailsForOwner(db, "owner-a")).toEqual(
      expect.arrayContaining([
        { key: "business_email", value: "jo@example.test", source: "owner", documentId: null, updatedAt: now },
        { key: "structure_choice", value: "llc", source: "owner", documentId: null, updatedAt: now },
      ]),
    );
    expect(await getDetailsForOwner(db, "owner-b")).toEqual([]);
  });

  it("replaces a detail instead of adding a second one", async () => {
    await saveDetailsForOwner(db, "owner-a", [{ key: "business_phone", value: "614-555-0100" }], OWNER);
    const later = new Date("2026-10-28T12:00:00Z");
    await saveDetailsForOwner(db, "owner-a", [{ key: "business_phone", value: "614-555-0199" }], OWNER, later);

    expect(await getDetailsForOwner(db, "owner-a")).toEqual([
      { key: "business_phone", value: "614-555-0199", source: "owner", documentId: null, updatedAt: later },
    ]);
  });

  it("keeps each owner's details apart, even for the same key", async () => {
    await saveDetailsForOwner(db, "owner-a", [{ key: "owner_names", value: "Jo Baker" }], OWNER);
    await saveDetailsForOwner(db, "owner-b", [{ key: "owner_names", value: "Sam Smith" }], OWNER);
    expect((await getDetailsForOwner(db, "owner-a")).map((detail) => detail.value)).toEqual(["Jo Baker"]);
    expect((await getDetailsForOwner(db, "owner-b")).map((detail) => detail.value)).toEqual(["Sam Smith"]);
  });

  it("deletes only the owner's own detail", async () => {
    await saveDetailsForOwner(db, "owner-a", [{ key: "owner_names", value: "Jo Baker" }], OWNER);
    await saveDetailsForOwner(db, "owner-b", [{ key: "owner_names", value: "Sam Smith" }], OWNER);

    expect(await deleteDetailForOwner(db, "owner-b", "owner_names")).toBe(true);
    expect(await getDetailsForOwner(db, "owner-b")).toEqual([]);
    expect((await getDetailsForOwner(db, "owner-a")).map((detail) => detail.value)).toEqual(["Jo Baker"]);
  });

  it("does nothing for an owner without a business", async () => {
    expect(await saveDetailsForOwner(db, "nobody", [{ key: "owner_names", value: "X" }], OWNER)).toBe(false);
    expect(await deleteDetailForOwner(db, "nobody", "owner_names")).toBe(false);
  });

  it("skips stored keys it no longer knows", async () => {
    await db.insert(businessDetails).values({ businessId: businessA, key: "retired_key", value: "x" });
    await saveDetailsForOwner(db, "owner-a", [{ key: "business_purpose", value: "We bake bread." }], OWNER);
    expect((await getDetailsForOwner(db, "owner-a")).map((detail) => detail.key)).toEqual(["business_purpose"]);
  });
});
