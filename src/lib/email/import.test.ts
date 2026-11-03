import { beforeAll, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import {
  connectEmailForOwner,
  connectionForOwner,
  emailStateForOwner,
} from "@/lib/data/customer-messages";
import { listOrdersForOwner } from "@/lib/data/orders";

const state = vi.hoisted(() => ({
  db: null as unknown as Db,
  api: vi.fn(),
  user: { id: "owner-a", demo: false },
}));
vi.mock("@/db/client", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: async () => state.user }));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  emailApi: state.api,
}));
const { importMyEmail, sendMyCustomerReply } = await import(
  "@/lib/data/my-business"
);

const order = {
  id: "mail-1",
  thread_id: "thread-1",
  from: [{ email: "sam@example.test" }],
  to: [{ email: "owner@example.test" }],
  subject: "Customer order",
  body: "Order\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two cakes\nDate: 2026-12-01\nTotal: $80.00",
};
const own = { ...order, id: "mail-own", from: [{ email: "owner@example.test" }] };
function provider(list: unknown[]) {
  state.api.mockImplementation(async (path: string) =>
    path.includes("/messages?")
      ? { data: list }
      : path.endsWith("/messages/send")
        ? { data: { id: "sent-1" } }
        : { data: order },
  );
}
const listCalls = () =>
  state.api.mock.calls
    .map(([path]) => String(path))
    .filter((path) => path.includes("/messages?"));

beforeAll(async () => {
  state.db = await createTestDb();
  await seedOwners(state.db);
  await connectEmailForOwner(state.db, "owner-a", "grant-a", "owner@example.test");
});

it("imports a week of new mail once, skips the owner's own, and adds a review order", async () => {
  provider([order, own]);
  const first = await importMyEmail();
  expect(first).toMatchObject({ ok: true, value: { added: 1, read: 1, remaining: 0 } });
  const firstParams = new URL(`https://x${listCalls()[0]}`).searchParams;
  expect(firstParams.get("limit")).toBe("25");
  const since = Number(firstParams.get("received_after")) * 1000;
  expect(Date.now() - since).toBeGreaterThan(6.9 * 86_400_000);

  const inbox = await emailStateForOwner(state.db, "owner-a");
  expect(inbox.messages).toHaveLength(1);
  expect(inbox.messages[0]).toMatchObject({
    state: "ready",
    sender: "sam@example.test",
    threadId: "thread-1",
    simulated: true,
  });
  const [made] = await listOrdersForOwner(state.db, "owner-a");
  expect(made).toMatchObject({ customerName: "Sam", status: "needs_review", payments: [] });
  expect(inbox.messages[0].orderId).toBe(made.id);
  expect(await listOrdersForOwner(state.db, "owner-b")).toEqual([]);

  // Next import starts from the last one and skips what's already in
  const imported = (await connectionForOwner(state.db, "owner-a"))!.importedAt!;
  expect(await importMyEmail()).toMatchObject({ ok: true, value: { added: 0, read: 0 } });
  const nextParams = new URL(`https://x${listCalls()[1]}`).searchParams;
  expect(nextParams.get("limit")).toBe("50");
  expect(Number(nextParams.get("received_after")) * 1000).toBeGreaterThan(
    imported.getTime() - 6 * 60_000,
  );
  expect((await emailStateForOwner(state.db, "owner-a")).messages).toHaveLength(1);
  expect(await listOrdersForOwner(state.db, "owner-a")).toHaveLength(1);
});

it("asks to reconnect when the provider no longer accepts the inbox", async () => {
  const { EmailApiError } = await import("./client");
  state.api.mockRejectedValueOnce(new EmailApiError(401));
  expect(await importMyEmail()).toMatchObject({ ok: false, message: expect.stringMatching(/connected again/) });
  expect((await connectionForOwner(state.db, "owner-a"))!.status).toBe("reconnect");
  await connectEmailForOwner(state.db, "owner-a", "grant-a", "owner@example.test");
});

it("sends an approved reply once", async () => {
  const { customerMessages } = await import("@/db/schema");
  const [message] = (await emailStateForOwner(state.db, "owner-a")).messages;
  // Practice replies never send, so this one stands in for a real read
  await state.db.update(customerMessages).set({ simulated: false });
  provider([]);
  state.api.mockClear();
  expect(await sendMyCustomerReply(message.id, "Thanks, Sam!")).toMatchObject({ ok: true });
  expect(await sendMyCustomerReply(message.id, "Thanks again")).toMatchObject({ ok: false });
  const sends = state.api.mock.calls.filter(([path]) => String(path).endsWith("/messages/send"));
  expect(sends).toHaveLength(1);
  expect(JSON.parse(sends[0][1].body)).toMatchObject({
    to: [{ email: "sam@example.test" }],
    body: "Thanks, Sam!",
    reply_to_message_id: "mail-1",
  });
  const saved = (await emailStateForOwner(state.db, "owner-a")).messages[0];
  expect(saved).toMatchObject({ sendState: "sent", reply: "Thanks, Sam!" });
});

it("refuses the demo", async () => {
  state.user = { id: "owner-a", demo: true };
  await expect(importMyEmail()).rejects.toThrow();
  state.user = { id: "owner-a", demo: false };
});
