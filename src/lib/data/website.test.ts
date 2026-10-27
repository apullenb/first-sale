import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { getWebsitePlanForOwner, saveWebsitePlanForOwner, updateWebsitePlanForOwner } from "./website";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

describe("website plan data access", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await seedOwners(db);
  });

  it("creates the plan on first save, then updates only what changed", async () => {
    expect(await getWebsitePlanForOwner(db, "owner-a")).toBeNull();
    expect(await saveWebsitePlanForOwner(db, "owner-a", { platform: "square" })).toBe(true);
    expect(await saveWebsitePlanForOwner(db, "owner-a", { domain: "risebakery.com" })).toBe(true);
    expect(await getWebsitePlanForOwner(db, "owner-a")).toMatchObject({ platform: "square", domain: "risebakery.com", setupDone: [], explanations: {} });
  });

  it("merges updates made at the same time", async () => {
    await Promise.all(
      ["a", "b", "c"].map((key) =>
        updateWebsitePlanForOwner(db, "owner-a", (plan) => ({ setupDone: [...(plan?.setupDone ?? []), key] })),
      ),
    );
    expect((await getWebsitePlanForOwner(db, "owner-a"))?.setupDone.toSorted()).toEqual(["a", "b", "c"]);
  });

  it("leaves the plan alone when the update says so", async () => {
    await saveWebsitePlanForOwner(db, "owner-a", { platform: "wix" });
    expect(await updateWebsitePlanForOwner(db, "owner-a", () => null)).toBe("unchanged");
    expect(await updateWebsitePlanForOwner(db, "nobody", () => ({ platform: "wix" }))).toBe("no_business");
    expect((await getWebsitePlanForOwner(db, "owner-a"))?.platform).toBe("wix");
  });

  it("keeps each owner's plan to themselves", async () => {
    await saveWebsitePlanForOwner(db, "owner-a", { platform: "wix" });
    expect(await getWebsitePlanForOwner(db, "owner-b")).toBeNull();
    expect(await saveWebsitePlanForOwner(db, "nobody", { platform: "wix" })).toBe(false);
  });
});
