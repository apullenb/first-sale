import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { defaultOperation } from "@/lib/rules/operations";
import { listOperationSetupsForOwner, pauseOperationSetupForOwner, saveOperationSetupForOwner } from "./operations";

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeEach(async () => { db = await createTestDb(); await seedOwners(db); });
const email = { ...defaultOperation("email"), email: "hello@example.com" };

describe("owner workflow setups", () => {
  it("persists separate workflows and updates without duplicate records", async () => {
    expect(await saveOperationSetupForOwner(db, "owner-a", email)).toBe(true);
    await saveOperationSetupForOwner(db, "owner-a", { ...defaultOperation("requests"), source: "Website" });
    await saveOperationSetupForOwner(db, "owner-a", { ...email, reminder: "7" });
    const setups = await listOperationSetupsForOwner(db, "owner-a");
    expect(setups).toHaveLength(2);
    expect(setups.find((setup) => setup.kind === "email")?.config.reminder).toBe("7");
    expect(await listOperationSetupsForOwner(db, "owner-b")).toEqual([]);
  });

  it("cannot read or pause another business's setup", async () => {
    await saveOperationSetupForOwner(db, "owner-a", email);
    expect(await pauseOperationSetupForOwner(db, "owner-b", "email", true)).toBe(false);
    expect(await pauseOperationSetupForOwner(db, "owner-a", "email", true)).toBe(true);
    expect((await listOperationSetupsForOwner(db, "owner-a"))[0].paused).toBe(true);
    expect(await pauseOperationSetupForOwner(db, "owner-a", "email", false)).toBe(true);
    expect((await listOperationSetupsForOwner(db, "owner-a"))[0].paused).toBe(false);
    expect(await saveOperationSetupForOwner(db, "missing", email)).toBe(false);
  });

  it("validates data before saving even outside an action", async () => {
    await expect(saveOperationSetupForOwner(db, "owner-a", { ...email, source: "Unknown" })).rejects.toThrow();
    expect(await listOperationSetupsForOwner(db, "owner-a")).toEqual([]);
  });
});
