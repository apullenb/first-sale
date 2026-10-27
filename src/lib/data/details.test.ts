import { beforeEach, describe, expect, it } from "vitest";
import { businessDetails } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { listHistoryForOwner } from "./business-history";
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

describe("decision history", () => {
  const basis = { profileKey: "key-1", answers: ["You’re the only owner"], suggested: "sole_proprietorship" };

  it("records each changed decision with what it replaced and the answers behind it", async () => {
    const first = new Date("2026-10-27T12:00:00Z");
    const second = new Date("2026-10-28T12:00:00Z");
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "sole_proprietorship" }], OWNER, first, basis);
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "llc" }], OWNER, second, basis);

    const events = await listHistoryForOwner(db, "owner-a", { kind: "decision" });
    expect(events.map((event) => [event.before, event.after, event.summary[0]])).toEqual([
      ["sole_proprietorship", "llc", "Business structure you chose: Sole proprietorship → Limited liability company (LLC)"],
      [null, "sole_proprietorship", "Business structure you chose: Not decided → Sole proprietorship"],
    ]);
    expect(events[0].basis).toEqual(basis);
    expect(await listHistoryForOwner(db, "owner-b")).toEqual([]);
  });

  it("records a decision kept as it was when the owner re-confirms it with new answers", async () => {
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "llc" }], OWNER, new Date("2026-10-27T12:00:00Z"), basis);
    const newer = { ...basis, profileKey: "key-2" };
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "llc" }], OWNER, new Date("2026-10-28T12:00:00Z"), newer, true);
    const [latest] = await listHistoryForOwner(db, "owner-a", { kind: "decision" });
    expect(latest).toMatchObject({ before: "llc", after: "llc", basis: newer });
    expect(latest.summary[0]).toMatch(/kept Limited liability company/);
  });

  it("adds nothing when a decision is saved unchanged, or for ordinary details", async () => {
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "llc" }], OWNER);
    await saveDetailsForOwner(db, "owner-a", [{ key: "structure_choice", value: "llc" }], OWNER);
    await saveDetailsForOwner(db, "owner-a", [{ key: "owner_names", value: "Jo Baker" }], OWNER);
    expect(await listHistoryForOwner(db, "owner-a")).toHaveLength(1);
  });
});
