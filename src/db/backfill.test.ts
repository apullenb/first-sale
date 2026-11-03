import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { checklistTasks, requirements, researchSnapshots } from "./schema";

// The question backfill in 0015 and the repair in 0017, run again over plans saved the old way

const statement = (file: string) => {
  const text = readFileSync(fileURLToPath(new URL(`../../drizzle/${file}`, import.meta.url)), "utf8");
  return text.split("--> statement-breakpoint").at(-1)!;
};
const BACKFILL = statement("0015_condition_answers.sql");
const REPAIR = statement("0017_repair_questions.sql");

const TAXED = "Only if you sell anything Texas taxes.";
const NEW = "Only if you sell taxable food.";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;
let businessB: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA, businessB } = await seedOwners(db));
});

const snapshot = (businessId: string, reviewed: boolean) =>
  db.insert(researchSnapshots).values({
    businessId,
    checkedAt: new Date("2026-10-26T15:00:00Z"),
    profileKey: "key",
    model: "Mock",
    unreadSources: [],
    planReviewedAt: reviewed ? new Date("2026-10-26T15:00:00Z") : null,
  });

const requirement = (businessId: string, key: string, condition: string, applicability: "applies" | "conditional" = "conditional") =>
  db.insert(requirements).values({
    businessId,
    key,
    title: key,
    whyItApplies: "Why",
    level: "state",
    sourceIds: [],
    verification: "sourced",
    checkedAt: new Date("2026-10-26T15:00:00Z"),
    applicability,
    condition,
  });

const task = (businessId: string, key: string, requirementStatus: "verified" | "conditional", conditions: string[], question = "") =>
  db.insert(checklistTasks).values({ businessId, key, title: key, requirementStatus, conditions, question });

const questionOf = async (businessId: string, key: string) =>
  (await db.select({ question: checklistTasks.question }).from(checklistTasks).where(and(eq(checklistTasks.businessId, businessId), eq(checklistTasks.key, key))))[0]
    ?.question;

describe("0015 question backfill", () => {
  it("copies the condition a step already carries, from the run its plan came from", async () => {
    await snapshot(businessA, true);
    await requirement(businessA, "sales-tax-permit", ` ${TAXED}\n`);
    await task(businessA, "sales-tax-permit", "conditional", [TAXED]);
    await db.execute(sql.raw(BACKFILL));
    expect(await questionOf(businessA, "sales-tax-permit")).toBe(TAXED);
  });

  it("leaves a step alone while a re-check waits for review, so it never drops off unreviewed", async () => {
    await snapshot(businessB, false);
    await requirement(businessB, "sales-tax-permit", NEW);
    await task(businessB, "sales-tax-permit", "verified", []);
    await db.execute(sql.raw(BACKFILL));
    expect(await questionOf(businessB, "sales-tax-permit")).toBe("");
  });

  it("skips a key two requirements share, and a condition the step doesn't carry", async () => {
    await snapshot(businessA, true);
    await requirement(businessA, "permit", TAXED);
    await requirement(businessA, "Permit!", NEW);
    await task(businessA, "permit", "conditional", [TAXED]);
    await requirement(businessA, "vendor", NEW);
    await task(businessA, "vendor", "conditional", ["Only if you set up as an LLC. Decide your business structure first."]);
    await db.execute(sql.raw(BACKFILL));
    expect(await questionOf(businessA, "permit")).toBe("");
    expect(await questionOf(businessA, "vendor")).toBe("");
  });
});

describe("0017 question repair", () => {
  it("clears a question the step doesn't carry, and keeps the ones it does", async () => {
    await task(businessA, "verified-step", "verified", [], NEW);
    await task(businessA, "conditional-step", "conditional", [TAXED], TAXED);
    await task(businessA, "wrong-twin", "conditional", [TAXED], NEW);
    await db.execute(sql.raw(REPAIR));
    expect(await questionOf(businessA, "verified-step")).toBe("");
    expect(await questionOf(businessA, "conditional-step")).toBe(TAXED);
    expect(await questionOf(businessA, "wrong-twin")).toBe("");
  });
});
