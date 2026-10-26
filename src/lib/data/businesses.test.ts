import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { businesses, users } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";
import { createTestDb } from "@/test/db";
import { createBusinessForOwner, getBusinessForOwner, listBusinessesForOwner } from "./businesses";

function profile(name: string): BusinessProfile {
  return {
    name,
    description: "",
    location: { state: "OH", county: "", city: "" },
    owners: { count: 1 },
    offeringKinds: ["food"],
    firstItems: "",
    channels: ["markets"],
    premises: null,
    startupBudget: null,
    hiringPlans: null,
  };
}

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "owner-a", name: "Owner A", email: "a@example.test" },
    { id: "owner-b", name: "Owner B", email: "b@example.test" },
  ]);
});

describe("business data access", () => {
  it("lists only the owner's own businesses", async () => {
    await createBusinessForOwner(db, "owner-a", { profile: profile("A's bakery") });
    await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") });

    const mine = await listBusinessesForOwner(db, "owner-a");
    expect(mine.map((b) => b.profile.name)).toEqual(["A's bakery"]);
  });

  it("won't return another owner's business by id", async () => {
    const theirs = await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") });

    expect(await getBusinessForOwner(db, "owner-a", theirs!.id)).toBeNull();
    expect((await getBusinessForOwner(db, "owner-b", theirs!.id))?.profile.name).toBe("B's shop");
  });

  it("marks demo businesses when asked", async () => {
    const demo = await createBusinessForOwner(db, "owner-a", { profile: profile("Demo"), isDemo: true });
    expect(demo?.isDemo).toBe(true);
  });

  it("stops at the owner's limit, even for creates at the same time", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createBusinessForOwner(db, "owner-a", { profile: profile(`Shop ${i}`) }, 3)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await listBusinessesForOwner(db, "owner-a")).toHaveLength(3);
    expect(await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") }, 3)).not.toBeNull();
  });

  it("deletes an owner's businesses with their account", async () => {
    await createBusinessForOwner(db, "owner-a", { profile: profile("A's bakery") });
    await db.delete(users).where(eq(users.id, "owner-a"));
    expect(await db.select().from(businesses)).toHaveLength(0);
  });
});
