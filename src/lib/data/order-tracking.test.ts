import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { productValues } from "@/lib/products/test-values";
import {
  createProductForOwner,
  getProductForOwner,
  updateProductForOwner,
} from "./products";
import {
  cancelOrderForOwner,
  listOrdersForOwner,
  paymentForOwner,
  progressOrderForOwner,
  recordOrderForOwner,
  setOrderTotalForOwner,
} from "./orders";
import {
  addMessageForOwner,
  claimMessageForOwner,
  completeMessageForOwner,
  connectEmailForOwner,
  emailStateForOwner,
  messageForOwner,
  reserveReplyForOwner,
  connectionForOwner,
  finishReplyForOwner,
} from "./customer-messages";
import type { ExtractedRequest } from "@/lib/orders/extract";
let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  await seedOwners(db);
});
const extraction = (reference = ""): ExtractedRequest => ({
  category: "order",
  customerName: "Sam",
  customerEmail: "sam@example.test",
  title: "Candle",
  requestedDate: "2026-11-07",
  jobTime: "",
  location: "",
  totalCents: 1200,
  reference,
  items: [],
  evidence: {},
  warnings: [],
});

const claimedAt = async (id: string) =>
  (await messageForOwner(db, "owner-a", id))!.updatedAt;

describe("customer intake", () => {
  it("creates one review record per event and does not trust invoice payments or prices", async () => {
    const input = {
      source: "invoice" as const,
      sourceKey: "invoice:one",
      subject: "Paid invoice",
      body: "Total $12.00. Paid.",
    };
    const id = (await addMessageForOwner(db, "owner-a", input))!;
    expect(await addMessageForOwner(db, "owner-a", input)).toBe(id);
    expect(await claimMessageForOwner(db, "owner-b", id)).toBeNull();
    expect(await claimMessageForOwner(db, "owner-a", id)).not.toBeNull();
    expect(await claimMessageForOwner(db, "owner-a", id)).toBeNull();
    expect(
      await completeMessageForOwner(
        db,
        "owner-a",
        id,
        extraction(),
        false,
        input.body,
        new Date(0),
      ),
    ).toBeNull();
    const orderId = await completeMessageForOwner(
      db,
      "owner-a",
      id,
      extraction(),
      false,
      input.body,
      await claimedAt(id),
    );
    expect(orderId).toBeTruthy();
    expect(
      await completeMessageForOwner(
        db,
        "owner-a",
        id,
        extraction(),
        false,
        input.body,
        await claimedAt(id),
      ),
    ).toBeNull();
    const [saved] = (await listOrdersForOwner(db, "owner-a")).filter(
      (order) => order.id === orderId,
    );
    expect(saved).toMatchObject({
      status: "needs_review",
      totalCents: null,
      payments: [],
    });
    expect(await listOrdersForOwner(db, "owner-b")).toEqual([]);
    expect(
      await progressOrderForOwner(db, "owner-a", saved.id, "confirmed"),
    ).toBe(false);
  });
  it("links repeated invoice references for the same customer without creating a duplicate", async () => {
    const ids = [];
    for (const key of ["one", "two"]) {
      const id = (await addMessageForOwner(db, "owner-a", {
        source: "email",
        sourceKey: `reference:${key}`,
        subject: "Invoice 44",
      }))!;
      await claimMessageForOwner(db, "owner-a", id);
      ids.push(
        await completeMessageForOwner(
          db,
          "owner-a",
          id,
          extraction("INV-44"),
          false,
          "invoice",
          await claimedAt(id),
        ),
      );
    }
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  });
  it("prevents real confirmation of simulated imports", async () => {
    const id = (await addMessageForOwner(db, "owner-a", {
      source: "email",
      sourceKey: "practice",
      subject: "Sample",
    }))!;
    await claimMessageForOwner(db, "owner-a", id);
    const orderId = (await completeMessageForOwner(
      db,
      "owner-a",
      id,
      extraction(),
      true,
      "sample",
      await claimedAt(id),
    ))!;
    expect(
      await recordOrderForOwner(db, "owner-a", {
        id: orderId,
        requestKey: randomUUID(),
        customerName: "Sam",
        title: "Sample",
        fulfillment: "pickup",
        requestedDate: null,
        notes: "",
        totalCents: 1200,
        lines: [],
      }),
    ).toMatchObject({ ok: false });
  });
});
describe("orders, stock and payments", () => {
  it("confirms imported catalog items once, freezes names, and keeps cancellation separate from refunds", async () => {
    const made = await createProductForOwner(
      db,
      "owner-a",
      productValues({ name: "Candle", priceCents: 1200, quantity: 3 }),
    );
    if (!made.ok) throw new Error("product failed");
    const id = (await addMessageForOwner(db, "owner-a", {
      source: "email",
      sourceKey: "confirm-stock",
      subject: "Order",
    }))!;
    await claimMessageForOwner(db, "owner-a", id);
    const orderId = (await completeMessageForOwner(
      db,
      "owner-a",
      id,
      extraction(),
      false,
      "Order",
      await claimedAt(id),
    ))!;
    const input = {
      id: orderId,
      requestKey: randomUUID(),
      customerName: "Sam",
      title: "Candle order",
      fulfillment: "pickup" as const,
      requestedDate: null,
      notes: "",
      lines: [{ productId: made.id, values: [], quantity: 2 }],
      totalCents: 1,
    };
    expect(await recordOrderForOwner(db, "owner-b", input)).toMatchObject({
      ok: false,
    });
    expect(await recordOrderForOwner(db, "owner-a", input)).toMatchObject({
      ok: true,
      id: orderId,
    });
    expect(await recordOrderForOwner(db, "owner-a", input)).toMatchObject({
      ok: true,
      id: orderId,
    });
    expect((await getProductForOwner(db, "owner-a", made.id))?.quantity).toBe(
      1,
    );
    const payment = {
      orderId,
      requestKey: randomUUID(),
      amountCents: 1000,
      kind: "payment" as const,
      paidOn: "2026-11-03",
      note: "Deposit",
    };
    expect(await paymentForOwner(db, "owner-b", payment)).toBe(false);
    expect(await paymentForOwner(db, "owner-a", payment)).toBe(true);
    expect(await paymentForOwner(db, "owner-a", payment)).toBe(true);
    expect(await setOrderTotalForOwner(db, "owner-a", orderId, 1)).toBe(false);
    await updateProductForOwner(
      db,
      "owner-a",
      made.id,
      productValues({ name: "Renamed", priceCents: 1200, quantity: 1 }),
    );
    const saved = (await listOrdersForOwner(db, "owner-a")).find(
      (order) => order.id === orderId,
    )!;
    expect(saved.totalCents).toBe(2400);
    expect(saved.lines[0].name).toBe("Candle");
    expect(saved.payments).toHaveLength(1);
    expect(await cancelOrderForOwner(db, "owner-a", orderId)).toBe("cancelled");
    expect(await cancelOrderForOwner(db, "owner-a", orderId)).toBe(
      "already_cancelled",
    );
    expect((await getProductForOwner(db, "owner-a", made.id))?.quantity).toBe(
      3,
    );
    expect(
      await paymentForOwner(db, "owner-a", {
        ...payment,
        requestKey: randomUUID(),
        kind: "refund",
      }),
    ).toBe(true);
  });
  it("supports custom jobs, later totals, deposits and completion without changing payments", async () => {
    const result = await recordOrderForOwner(db, "owner-a", {
      customerName: "Jo",
      title: "Clean home",
      workType: "services",
      fulfillment: "pickup",
      requestedDate: "2026-11-05",
      notes: "",
      lines: [],
      totalCents: null,
    });
    if (!result.ok) throw new Error("job failed");
    expect(await setOrderTotalForOwner(db, "owner-a", result.id, 50000)).toBe(
      true,
    );
    const entry = {
      orderId: result.id,
      requestKey: randomUUID(),
      amountCents: 10000,
      kind: "payment" as const,
      paidOn: "2026-11-03",
      note: "Deposit",
    };
    expect(await paymentForOwner(db, "owner-a", entry)).toBe(true);
    expect(await setOrderTotalForOwner(db, "owner-a", result.id, 1)).toBe(
      false,
    );
    expect(
      await progressOrderForOwner(db, "owner-a", result.id, "shipped"),
    ).toBe(false);
    expect(
      await progressOrderForOwner(db, "owner-a", result.id, "fulfilled"),
    ).toBe(true);
    expect(await cancelOrderForOwner(db, "owner-a", result.id)).toBe(
      "completed",
    );
    const saved = (await listOrdersForOwner(db, "owner-a")).find(
      (order) => order.id === result.id,
    )!;
    expect(saved.status).toBe("fulfilled");
    expect(saved.payments).toHaveLength(1);
  });
});

describe("reviewed sending", () => {
  it("reserves only one exact reply, isolates owners and blocks retries after uncertainty", async () => {
    await connectEmailForOwner(db, "owner-a", "grant-a", "owner@example.test");
    const connection = (await connectionForOwner(db, "owner-a"))!;
    const id = (await addMessageForOwner(db, "owner-a", {
      source: "email",
      sourceKey: "send-once",
      subject: "A question",
      sender: "sam@example.test",
      connectionId: connection.id,
      providerMessageId: "mail-send",
      threadId: "send-thread",
    }))!;
    await claimMessageForOwner(db, "owner-a", id);
    await completeMessageForOwner(
      db,
      "owner-a",
      id,
      { ...extraction(), category: "question" },
      false,
      "question",
      await claimedAt(id),
    );
    expect(await reserveReplyForOwner(db, "owner-b", id, "Hello")).toBeNull();
    const reserved = await reserveReplyForOwner(
      db,
      "owner-a",
      id,
      "Approved exact words",
    );
    expect(reserved?.message.sender).toBe("sam@example.test");
    expect(
      await reserveReplyForOwner(db, "owner-a", id, "Duplicate"),
    ).toBeNull();
    await finishReplyForOwner(db, "owner-a", id, "uncertain");
    expect(await reserveReplyForOwner(db, "owner-a", id, "Retry")).toBeNull();
    const saved = (await emailStateForOwner(db, "owner-a")).messages.find(
      (message) => message.id === id,
    )!;
    expect(saved.reply).toBe("Approved exact words");
    expect(saved.sendState).toBe("uncertain");
  });
  it("blocks an old reply when a newer message arrived in the same thread", async () => {
    const connection = (await connectionForOwner(db, "owner-a"))!;
    const first = (await addMessageForOwner(db, "owner-a", {
      source: "email",
      sourceKey: "old-reply",
      subject: "Question",
      sender: "sam@example.test",
      connectionId: connection.id,
      threadId: "changed-thread",
    }))!;
    await claimMessageForOwner(db, "owner-a", first);
    await completeMessageForOwner(
      db,
      "owner-a",
      first,
      { ...extraction(), category: "question" },
      false,
      "first",
      await claimedAt(first),
    );
    await addMessageForOwner(db, "owner-a", {
      source: "email",
      sourceKey: "new-reply",
      subject: "Changed question",
      sender: "sam@example.test",
      connectionId: connection.id,
      threadId: "changed-thread",
    });
    expect(
      await reserveReplyForOwner(db, "owner-a", first, "Old reply"),
    ).toBeNull();
  });
});
