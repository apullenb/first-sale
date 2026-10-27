import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { businesses, users } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";
import { createTestDb } from "@/test/db";
import { createBusinessForOwner, getBusinessForOwner, updateBusinessProfileForOwner } from "./businesses";

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
  it("returns only the owner's own business", async () => {
    await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") });
    expect(await getBusinessForOwner(db, "owner-a")).toBeNull();

    await createBusinessForOwner(db, "owner-a", { profile: profile("A's bakery") });
    expect((await getBusinessForOwner(db, "owner-a"))?.profile.name).toBe("A's bakery");
  });

  it("updates only the owner's own business", async () => {
    await createBusinessForOwner(db, "owner-a", { profile: profile("A's bakery") });
    await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") });

    await updateBusinessProfileForOwner(db, "owner-a", profile("A's new name"));
    expect((await getBusinessForOwner(db, "owner-a"))?.profile.name).toBe("A's new name");
    expect((await getBusinessForOwner(db, "owner-b"))?.profile.name).toBe("B's shop");
  });

  it("marks demo businesses when asked", async () => {
    const demo = await createBusinessForOwner(db, "owner-a", { profile: profile("Demo"), isDemo: true });
    expect(demo?.isDemo).toBe(true);
  });

  it("refuses a second business, even for creates at the same time", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createBusinessForOwner(db, "owner-a", { profile: profile(`Shop ${i}`) })),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.select().from(businesses).where(eq(businesses.ownerId, "owner-a"))).toHaveLength(1);
    expect(await createBusinessForOwner(db, "owner-b", { profile: profile("B's shop") })).not.toBeNull();
  });

  it("deletes an owner's businesses with their account", async () => {
    await createBusinessForOwner(db, "owner-a", { profile: profile("A's bakery") });
    await db.delete(users).where(eq(users.id, "owner-a"));
    expect(await db.select().from(businesses)).toHaveLength(0);
  });
});
