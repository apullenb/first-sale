import { beforeAll, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { addMessageForOwner, emailStateForOwner } from "@/lib/data/customer-messages";
import { listOrdersForOwner } from "@/lib/data/orders";

const state = vi.hoisted(() => ({
  db: null as unknown as Db,
  user: { id: "owner-a", demo: false },
}));
vi.mock("@/db/client", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: async () => state.user }));
const { readMyNewEmail, markMyReplySent } = await import("@/lib/data/my-business");
const { READS_PER_PRESS } = await import("./read");

const order = "Subject: Customer order\nFrom: sam@example.test\n\nOrder\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two cakes\nDate: 2026-12-01\nTotal: $80.00";

beforeAll(async () => {
  state.db = await createTestDb();
  await seedOwners(state.db);
});

it("reads waiting forwarded emails into review orders, a batch per press", async () => {
  for (let index = 0; index <= READS_PER_PRESS; index++)
    await addMessageForOwner(state.db, "owner-a", {
      source: "email",
      sourceKey: `inbound:mail-${index}`,
      sender: "sam@example.test",
      subject: "Customer order",
      body: order,
      threadId: `sam@example.test:order ${index}`,
    });
  // A pasted email isn't part of the waiting count
  await addMessageForOwner(state.db, "owner-a", { source: "email", sourceKey: "paste:x", subject: "Pasted", body: order });
  expect((await emailStateForOwner(state.db, "owner-a")).waiting).toBe(READS_PER_PRESS + 1);

  const first = await readMyNewEmail();
  expect(first).toMatchObject({ ok: true, value: { read: READS_PER_PRESS, failed: 0, remaining: 1 } });
  expect(await readMyNewEmail()).toMatchObject({ ok: true, value: { read: 1, remaining: 0 } });
  expect(await readMyNewEmail()).toMatchObject({ ok: true, value: { read: 0, remaining: 0 } });

  const inbox = await emailStateForOwner(state.db, "owner-a");
  const read = inbox.messages.find((message) => message.sourceKey === "inbound:mail-0")!;
  expect(read).toMatchObject({ state: "ready", simulated: true, sendState: "draft" });
  expect(read.reply).not.toBe("");
  const orders = await listOrdersForOwner(state.db, "owner-a");
  expect(orders).toHaveLength(READS_PER_PRESS + 1);
  expect(orders[0]).toMatchObject({ customerName: "Sam", status: "needs_review", payments: [] });
  expect(await listOrdersForOwner(state.db, "owner-b")).toEqual([]);

  expect(await markMyReplySent(read.id, "Thanks, Sam!")).toBe(true);
});

it("refuses the demo", async () => {
  state.user = { id: "owner-a", demo: true };
  await expect(readMyNewEmail()).rejects.toThrow();
  await expect(markMyReplySent("x", "y")).rejects.toThrow();
  state.user = { id: "owner-a", demo: false };
});
