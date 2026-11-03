import { beforeAll, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import {
  connectEmailForOwner,
  emailStateForOwner,
} from "@/lib/data/customer-messages";
import { listOrdersForOwner } from "@/lib/data/orders";
import {
  enqueueEmailEvent,
  pollCustomerEmail,
  workCustomerMessages,
} from "./worker";

const state = vi.hoisted(() => ({ db: null as unknown as Db, api: vi.fn() }));
vi.mock("@/db/client", () => ({ getDb: () => state.db }));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  emailApi: state.api,
}));
vi.mock("@/lib/workflow-runner", () => ({
  runBackgroundWorkflow: async (
    _owner: string,
    _id: string,
    job: () => Promise<unknown>,
  ) => ({ ok: true, value: await job() }),
}));
beforeAll(async () => {
  state.db = await createTestDb();
  await seedOwners(state.db);
  await connectEmailForOwner(
    state.db,
    "owner-a",
    "grant-a",
    "owner@example.test",
  );
});
it("recovers missed mail, deduplicates webhooks and automatically adds a review order", async () => {
  const message = {
    id: "mail-1",
    thread_id: "thread-1",
    from: [{ email: "sam@example.test" }],
    to: [{ email: "owner@example.test" }],
    subject: "Customer order",
    body: "Order\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two cakes\nDate: 2026-12-01\nTotal: $80.00",
  };
  state.api.mockImplementation(async (path: string) =>
    path.includes("/messages?") ? { data: [message] } : { data: message },
  );
  await enqueueEmailEvent({
    type: "message.created",
    data: { object: { id: "mail-1", grant_id: "grant-a" } },
  });
  await enqueueEmailEvent({
    type: "message.created",
    data: { object: { id: "mail-1", grant_id: "grant-a" } },
  });
  await pollCustomerEmail();
  expect((await emailStateForOwner(state.db, "owner-a")).messages).toHaveLength(
    1,
  );
  await workCustomerMessages();
  const inbox = await emailStateForOwner(state.db, "owner-a");
  expect(inbox.messages[0]).toMatchObject({
    state: "ready",
    sender: "sam@example.test",
    threadId: "thread-1",
    simulated: true,
  });
  expect(inbox.messages[0].orderId).toBeTruthy();
  const [order] = await listOrdersForOwner(state.db, "owner-a");
  expect(order).toMatchObject({
    customerName: "Sam",
    title: "Two cakes",
    status: "needs_review",
    totalCents: null,
    payments: [],
  });
  expect(await listOrdersForOwner(state.db, "owner-b")).toEqual([]);
});
