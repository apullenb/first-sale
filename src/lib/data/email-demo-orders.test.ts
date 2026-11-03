import { beforeEach, describe, expect, it } from "vitest";
import { orders, users } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { addEmailDemoOrderForOwner, clearEmailDemoOrdersForOwner, listEmailDemoSamplesForOwner } from "./email-demo-orders";
import { listOrdersForOwner, paymentForOwner, progressOrderForOwner, recordOrderForOwner } from "./orders";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA } = await seedOwners(db));
});

const added = async (owner: string, id: string) => {
  const result = await addEmailDemoOrderForOwner(db, owner, id);
  if (!result.ok) throw new Error(result.reason);
  return result.id;
};

describe("email demo orders", () => {
  it("turn a sample order into a DEMO custom-work order with no stock, total or invented date", async () => {
    await added("owner-a", "breakfast");
    const [order] = await listOrdersForOwner(db, "owner-a");
    expect(order).toMatchObject({
      isDemo: true,
      emailSample: true,
      source: "email",
      status: "confirmed",
      customerName: "Priya Shah",
      customerEmail: "priya.shah@northwind.example",
      title: "Office breakfast for Northwind",
      fulfillment: "pickup",
      jobTime: "07:30",
      requestedDate: null,
      totalCents: null,
      lines: [],
    });
    expect(order.notes).toContain("3 dozen × Assorted muffins");
    expect(order.notes).toContain("When: Pickup Friday, 7:30 am");
  });

  it("put a quote request in review, and only order or quote samples count", async () => {
    await added("owner-a", "favors");
    const [quote] = await listOrdersForOwner(db, "owner-a");
    expect(quote).toMatchObject({ status: "needs_review", fulfillment: "delivery", location: "Oak Hollow Barn" });
    expect(await addEmailDemoOrderForOwner(db, "owner-a", "vegan")).toEqual({ ok: false, reason: "not_found" });
    expect(await addEmailDemoOrderForOwner(db, "owner-a", "nope")).toEqual({ ok: false, reason: "not_found" });
  });

  it("don't duplicate a sample confirmed twice", async () => {
    const first = await added("owner-a", "cookies");
    expect(await added("owner-a", "cookies")).toBe(first);
    expect(await listOrdersForOwner(db, "owner-a")).toHaveLength(1);
    expect(await listEmailDemoSamplesForOwner(db, "owner-a")).toEqual(["cookies"]);
  });

  it("change progress like real orders, but never record money", async () => {
    const order = await added("owner-a", "cookies");
    expect(await progressOrderForOwner(db, "owner-a", order, "in_progress")).toBe(true);
    expect(await progressOrderForOwner(db, "owner-a", order, "confirmed")).toBe(false);
    const quote = await added("owner-a", "cake");
    expect(await progressOrderForOwner(db, "owner-a", quote, "confirmed")).toBe(true);
    const paid = await paymentForOwner(db, "owner-a", {
      orderId: order,
      requestKey: crypto.randomUUID(),
      amountCents: 500,
      kind: "payment",
      paidOn: "2026-11-03",
      note: "",
    });
    expect(paid).toBe(false);
    const statuses = Object.fromEntries((await listOrdersForOwner(db, "owner-a")).map((row) => [row.id, row.status]));
    expect(statuses).toEqual({ [order]: "in_progress", [quote]: "confirmed" });
  });

  it("start over removes only this demo's orders, never real or other DEMO ones", async () => {
    await added("owner-a", "cookies");
    await added("owner-a", "cake");
    const real = await recordOrderForOwner(db, "owner-a", { customerName: "Jo", fulfillment: "pickup", requestedDate: null, notes: "", lines: [], title: "Real cake" });
    if (!real.ok) throw new Error("not saved");
    await db.insert(orders).values({ businessId: businessA, isDemo: true, source: "email", customerName: "Other sample", fulfillment: "pickup", requestKey: "intake:x" });
    await added("owner-b", "cookies");
    expect(await clearEmailDemoOrdersForOwner(db, "owner-a")).toBe(2);
    expect((await listOrdersForOwner(db, "owner-a")).map((row) => row.customerName).sort()).toEqual(["Jo", "Other sample"]);
    expect(await listEmailDemoSamplesForOwner(db, "owner-a")).toEqual([]);
    expect(await listEmailDemoSamplesForOwner(db, "owner-b")).toEqual(["cookies"]);
  });

  it("stay with their owner", async () => {
    const order = await added("owner-a", "pies");
    expect(await listOrdersForOwner(db, "owner-b")).toEqual([]);
    expect(await progressOrderForOwner(db, "owner-b", order, "in_progress")).toBe(false);
    expect(await clearEmailDemoOrdersForOwner(db, "owner-b")).toBe(0);
    expect(await listOrdersForOwner(db, "owner-a")).toHaveLength(1);
    await db.insert(users).values({ id: "owner-c", name: "C", email: "c@example.test" });
    expect(await addEmailDemoOrderForOwner(db, "owner-c", "pies")).toEqual({ ok: false, reason: "no_business" });
  });
});
