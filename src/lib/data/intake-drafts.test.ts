import { beforeEach, describe, expect, it } from "vitest";
import { businesses, users } from "@/db/schema";
import { EMPTY_ANSWERS } from "@/lib/intake/answers";
import type { IntakeDraftInput } from "@/lib/intake/draft-schema";
import { createTestDb } from "@/test/db";
import { seedOwners, testProfile } from "@/test/fixtures";
import { createBusinessWithHistoryForOwner, listHistoryForOwner, updateProfileWithHistoryForOwner } from "./business-history";
import { currentKey, deleteIntakeDraftForOwner, getIntakeDraftForOwner, saveIntakeDraftForOwner } from "./intake-drafts";

let db: Awaited<ReturnType<typeof createTestDb>>;

const draft = (overrides: Partial<IntakeDraftInput> = {}): IntakeDraftInput => ({
  mode: "create",
  answers: { ...EMPTY_ANSWERS, category: "baked_goods", productTags: ["cookies"], state: "OH" },
  marks: { foodNeedsCold: "default" },
  step: "owners",
  practice: false,
  baseKey: null,
  ...overrides,
});

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "new-a", name: "New A", email: "new-a@example.test" },
    { id: "new-b", name: "New B", email: "new-b@example.test" },
  ]);
});

describe("intake drafts", () => {
  it("let a returning owner continue where they left off, and only that owner", async () => {
    const now = new Date("2026-10-27T15:00:00Z");
    expect(await saveIntakeDraftForOwner(db, "new-a", draft(), now)).toBe(true);
    expect(await getIntakeDraftForOwner(db, "new-a")).toEqual({ ...draft(), updatedAt: now });
    expect(await getIntakeDraftForOwner(db, "new-b")).toBeNull();
  });

  it("keep one draft per owner, replaced by each save", async () => {
    await saveIntakeDraftForOwner(db, "new-a", draft());
    await saveIntakeDraftForOwner(db, "new-a", draft({ step: "money" }));
    expect((await getIntakeDraftForOwner(db, "new-a"))?.step).toBe("money");
  });

  it("are cleared in the same save that creates the business, with a history entry", async () => {
    await saveIntakeDraftForOwner(db, "new-a", draft());
    const business = await createBusinessWithHistoryForOwner(db, "new-a", testProfile());
    expect(business).not.toBeNull();
    expect(await getIntakeDraftForOwner(db, "new-a")).toBeNull();
    const [event] = await listHistoryForOwner(db, "new-a");
    expect(event).toMatchObject({ kind: "profile", before: null, summary: ["Answered the intake questions"] });
    // A late autosave can't bring the create draft back
    expect(await saveIntakeDraftForOwner(db, "new-a", draft())).toBe(false);
    expect(await createBusinessWithHistoryForOwner(db, "new-a", testProfile())).toBeNull();
  });

  it("drop an edit draft once the saved answers change elsewhere", async () => {
    await createBusinessWithHistoryForOwner(db, "new-a", testProfile());
    const baseKey = await currentKey(db, "new-a");
    expect(await saveIntakeDraftForOwner(db, "new-a", draft({ mode: "edit", baseKey }))).toBe(true);
    expect((await getIntakeDraftForOwner(db, "new-a"))?.mode).toBe("edit");
    // Saved in another tab: this draft started from answers that no longer exist
    await db.update(businesses).set({ profile: testProfile({ name: "Other tab" }) });
    expect(await getIntakeDraftForOwner(db, "new-a")).toBeNull();
    // and the old tab's next autosave is refused rather than stamped with the new answers
    expect(await saveIntakeDraftForOwner(db, "new-a", draft({ mode: "edit", baseKey }))).toBe(false);
  });

  it("refuse an edit draft before the business exists", async () => {
    expect(await saveIntakeDraftForOwner(db, "new-a", draft({ mode: "edit", baseKey: "anything" }))).toBe(false);
  });

  it("can be discarded", async () => {
    await saveIntakeDraftForOwner(db, "new-a", draft());
    await deleteIntakeDraftForOwner(db, "new-a");
    expect(await getIntakeDraftForOwner(db, "new-a")).toBeNull();
  });
});

describe("answer history", () => {
  beforeEach(async () => {
    await seedOwners(db);
  });

  it("records each confirmed change with the answers before and after, for the owner only", async () => {
    const after = testProfile({ location: { state: "OH", county: "Franklin", city: "Columbus" } });
    const row = await updateProfileWithHistoryForOwner(db, "owner-a", after, ["Where: Ohio → Columbus, Franklin County, Ohio"]);
    expect(row?.profile).toEqual(after);
    const [event] = await listHistoryForOwner(db, "owner-a", { kind: "profile" });
    expect(event).toMatchObject({ kind: "profile", before: testProfile(), after, summary: ["Where: Ohio → Columbus, Franklin County, Ohio"] });
    expect(await listHistoryForOwner(db, "owner-b")).toEqual([]);
  });

  it("returns null with no business", async () => {
    expect(await updateProfileWithHistoryForOwner(db, "new-b", testProfile(), [])).toBeNull();
  });
});
