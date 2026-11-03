import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { MarketingIntake } from "@/lib/marketing/intake";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { getMarketingForOwner, updateMarketingForOwner } from "./marketing";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const INTAKE: MarketingIntake = { include: ["instagram"], have: [], exclude: ["tiktok"], social: "new", seo: "some", content: "confident", done: ["none"], doneNote: "" };

describe("marketing data access", () => {
  let db: TestDb;
  let businessA: string;
  beforeEach(async () => {
    db = await createTestDb();
    ({ businessA } = await seedOwners(db));
  });

  it("creates the record on first save, then updates only what changed", async () => {
    expect(await getMarketingForOwner(db, "owner-a")).toBeNull();
    expect(await updateMarketingForOwner(db, "owner-a", () => ({ intake: INTAKE }))).toBe("saved");
    expect(await updateMarketingForOwner(db, "owner-a", () => ({ stepsDone: ["look"] }))).toBe("saved");
    expect(await getMarketingForOwner(db, "owner-a")).toMatchObject({ intake: INTAKE, plan: null, approvedAt: null, steps: [], stepsDone: ["look"] });
  });

  it("merges ticks made at the same time", async () => {
    await Promise.all(
      ["a", "b", "c"].map((key) => updateMarketingForOwner(db, "owner-a", (current) => ({ stepsDone: [...(current?.stepsDone ?? []), key] }))),
    );
    expect((await getMarketingForOwner(db, "owner-a"))?.stepsDone.toSorted()).toEqual(["a", "b", "c"]);
  });

  it("keeps each owner's plan to themselves", async () => {
    await updateMarketingForOwner(db, "owner-a", () => ({ intake: INTAKE }));
    expect(await getMarketingForOwner(db, "owner-b")).toBeNull();
    expect(await updateMarketingForOwner(db, "nobody", () => ({ intake: INTAKE }))).toBe("no_business");
    expect(await updateMarketingForOwner(db, "owner-a", () => null)).toBe("unchanged");
  });

  it("keeps social profiles beside the plan, and reads ones it can't parse as empty", async () => {
    const profile = { name: "Rosa’s Bakery", handle: "rosasbakery", bio: "Bread.", bioBy: "owner" as const, notes: [], approvedAt: null };
    await updateMarketingForOwner(db, "owner-a", () => ({ intake: INTAKE, social: { instagram: profile } }));
    await updateMarketingForOwner(db, "owner-a", () => ({ stepsDone: ["look"] }));
    expect((await getMarketingForOwner(db, "owner-a"))?.social).toEqual({ instagram: profile });
    await db.execute(sql`update marketing_plans set social = '"oops"'::jsonb where business_id = ${businessA}`);
    expect((await getMarketingForOwner(db, "owner-a"))?.social).toEqual({});
  });

  it("reads a stored plan it can't parse as no plan", async () => {
    await updateMarketingForOwner(db, "owner-a", () => ({ intake: INTAKE }));
    await db.execute(sql`update marketing_plans set plan = '{"summary": 1}'::jsonb where business_id = ${businessA}`);
    expect(await getMarketingForOwner(db, "owner-a")).toMatchObject({ plan: null, intake: INTAKE });
  });
});
