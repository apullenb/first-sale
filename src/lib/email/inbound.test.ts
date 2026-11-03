import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db/client";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { emailStateForOwner } from "@/lib/data/customer-messages";
import { listDocumentsForOwner } from "@/lib/data/documents";
import { ensureInboxForOwner, inboxForToken, newInboxToken, TOKEN_PATTERN } from "@/lib/data/email-inbox";

const state = vi.hoisted(() => ({ db: null as unknown as Db }));
vi.mock("@/db/client", () => ({ getDb: () => state.db }));
const { HOURLY_LIMIT, inboundAddress, postmarkSchema, receiveInbound, tokenOf, webhookAuthorized } = await import("./inbound");
const { POST } = await import("@/app/api/email/inbound/route");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
let token = "";
function payload(overrides: Record<string, unknown> = {}) {
  return postmarkSchema.parse({
    From: "Sam Lee <sam@example.test>",
    FromFull: { Email: "sam@example.test", Name: "Sam Lee" },
    To: `abc123+${token}@inbound.postmarkapp.com`,
    ToFull: [{ Email: `abc123+${token}@inbound.postmarkapp.com`, Name: "" }],
    Subject: "Order for Friday",
    TextBody: "Order\nCustomer: Sam\nEmail: sam@example.test\nDescription: Two cakes\nDate: 2026-12-01\nTotal: $80.00",
    HtmlBody: "",
    MessageID: crypto.randomUUID(),
    Date: "Mon, 2 Nov 2026 09:14:00 -0600",
    MailboxHash: token,
    Headers: [{ Name: "Received-SPF", Value: "Pass (sender SPF authorized)" }],
    Attachments: [],
    ...overrides,
  });
}
const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;
function request(body: unknown, auth = basic("postmark:s3cret-password")) {
  return new Request("http://localhost/api/email/inbound", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  state.db = await createTestDb();
  await seedOwners(state.db);
  token = (await ensureInboxForOwner(state.db, "owner-a"))!;
});
beforeEach(() => {
  vi.stubEnv("POSTMARK_INBOUND_ADDRESS", "abc123@inbound.postmarkapp.com");
  vi.stubEnv("INBOUND_WEBHOOK_USER", "postmark");
  vi.stubEnv("INBOUND_WEBHOOK_PASSWORD", "s3cret-password");
});

describe("forwarding address", () => {
  it("is private to each business, kept, and replaced on request", async () => {
    expect(newInboxToken()).toMatch(TOKEN_PATTERN);
    expect(newInboxToken()).not.toBe(newInboxToken());
    expect(inboundAddress(token)).toBe(`abc123+${token}@inbound.postmarkapp.com`);
    expect(await ensureInboxForOwner(state.db, "owner-a")).toBe(token);
    const other = await ensureInboxForOwner(state.db, "owner-b");
    expect(other).not.toBe(token);
    const rotated = (await ensureInboxForOwner(state.db, "owner-b", true))!;
    expect(rotated).not.toBe(other);
    expect(await inboxForToken(state.db, other!)).toBeNull();
    expect((await inboxForToken(state.db, rotated))?.ownerId).toBe("owner-b");
    expect(await inboxForToken(state.db, "not-a-token")).toBeNull();
  });

  it("isn't offered without the site's inbound address", () => {
    vi.stubEnv("POSTMARK_INBOUND_ADDRESS", "");
    expect(inboundAddress(token)).toBeNull();
  });

  it("finds the token in the mailbox hash or the recipient", () => {
    expect(tokenOf(payload())).toBe(token);
    expect(tokenOf(payload({ MailboxHash: "", OriginalRecipient: `ABC123+${token.toUpperCase()}@inbound.postmarkapp.com` }))).toBe(token);
    expect(tokenOf(payload({ MailboxHash: "", ToFull: [] }))).toBeNull();
  });
});

describe("webhook", () => {
  it("checks the password before reading anything", async () => {
    expect(webhookAuthorized(basic("postmark:s3cret-password"))).toBe(true);
    expect(webhookAuthorized(basic("postmark:wrong"))).toBe(false);
    expect(webhookAuthorized(null)).toBe(false);
    expect((await POST(request(payload(), basic("postmark:wrong")))).status).toBe(401);
    expect((await POST(request("not json at all", "Bearer x"))).status).toBe(401);
    vi.stubEnv("INBOUND_WEBHOOK_PASSWORD", "");
    expect((await POST(request(payload(), basic("postmark:")))).status).toBe(401);
  });

  it("stores an email once and answers the same for unknown addresses", async () => {
    const first = payload();
    expect((await POST(request(first))).status).toBe(200);
    expect((await POST(request(first))).status).toBe(200);
    expect((await POST(request(payload({ MailboxHash: "a".repeat(26), ToFull: [] })))).status).toBe(200);
    expect((await POST(request({ nothing: true }))).status).toBe(400);
    const inbox = await emailStateForOwner(state.db, "owner-a");
    expect(inbox.messages).toHaveLength(1);
    expect(inbox.waiting).toBe(1);
    expect(inbox.messages[0]).toMatchObject({
      sender: "sam@example.test",
      senderName: "Sam Lee",
      forwardedBy: null,
      subject: "Order for Friday",
      state: "pending",
      threadId: "sam@example.test:order for friday",
    });
    expect(inbox.messages[0].body).toContain("Description: Two cakes");
    expect(inbox.inbox?.firstFrom).toBe("sam@example.test");
    expect((await emailStateForOwner(state.db, "owner-b")).messages).toHaveLength(0);
  });

  it("keeps the forwarder apart from the customer", async () => {
    expect(
      await receiveInbound(
        state.db,
        payload({
          From: "Pat <pat@owner.test>",
          FromFull: { Email: "pat@owner.test", Name: "Pat" },
          Subject: "Fwd: Cupcakes",
          TextBody: "---------- Forwarded message ---------\nFrom: Jo Park <jo@example.test>\nDate: Mon, Nov 2, 2026 at 9:14 AM\nSubject: Cupcakes\n\nTwo dozen please",
        }),
      ),
    ).toBe("stored");
    const [latest] = (await emailStateForOwner(state.db, "owner-a")).messages;
    expect(latest).toMatchObject({ sender: "jo@example.test", senderName: "Jo Park", forwardedBy: "pat@owner.test", subject: "Cupcakes" });
  });

  it("saves PDF and photo attachments unchanged and skips others", async () => {
    const before = (await listDocumentsForOwner(state.db, "owner-a")).length;
    expect(
      await receiveInbound(
        state.db,
        payload({
          Attachments: [
            { Name: "photo.png", ContentType: "image/png", Content: PNG.toString("base64"), ContentLength: PNG.length },
            { Name: "fake.pdf", ContentType: "application/pdf", Content: Buffer.from("not a pdf").toString("base64"), ContentLength: 9 },
            { Name: "notes.txt", ContentType: "text/plain", Content: Buffer.from("hi").toString("base64"), ContentLength: 2 },
            { Name: "big.pdf", ContentType: "application/pdf", Content: "", ContentLength: 5_000_000 },
          ],
        }),
      ),
    ).toBe("stored");
    const [latest] = (await emailStateForOwner(state.db, "owner-a")).messages;
    expect(latest.attachmentIds).toHaveLength(1);
    expect(latest.body).toContain("fake.pdf couldn’t be read");
    expect(latest.body).toContain("big.pdf is over 4 MB");
    const documents = await listDocumentsForOwner(state.db, "owner-a");
    expect(documents).toHaveLength(before + 1);
    const { getDocumentFileForOwner } = await import("@/lib/data/documents");
    const file = await getDocumentFileForOwner(state.db, "owner-a", latest.attachmentIds[0]);
    expect(Buffer.from(file!.data).equals(PNG)).toBe(true);
  });

  it("shows a provider's confirmation instead of storing it as a message", async () => {
    const count = (await emailStateForOwner(state.db, "owner-a")).messages.length;
    const confirm = payload({
      From: "Gmail Team <forwarding-noreply@google.com>",
      FromFull: { Email: "forwarding-noreply@google.com", Name: "Gmail Team" },
      Subject: "(#987654321) Gmail Forwarding Confirmation - Receive Mail from pat@gmail.com",
      TextBody: "Confirmation code: 987654321\nhttps://mail-settings.google.com/mail/vf-abc",
    });
    expect(await receiveInbound(state.db, confirm)).toBe("confirmation");
    const after = await emailStateForOwner(state.db, "owner-a");
    expect(after.messages).toHaveLength(count);
    expect(after.inbox?.confirmation).toMatchObject({ provider: "Gmail", code: "987654321", link: "https://mail-settings.google.com/mail/vf-abc" });
    // A sender that failed its SPF check is never shown as a confirmation
    const spoofed = payload({ ...confirm, MessageID: "spoofed", Headers: [{ Name: "Received-SPF", Value: "Fail" }] });
    expect(await receiveInbound(state.db, spoofed)).toBe("stored");
  });

  it("limits how many emails one address takes an hour", async () => {
    const { customerMessages } = await import("@/db/schema");
    const { inboxForToken: lookup } = await import("@/lib/data/email-inbox");
    const inbox = (await lookup(state.db, token))!;
    await state.db.insert(customerMessages).values(
      Array.from({ length: HOURLY_LIMIT }, (_, index) => ({
        businessId: inbox.businessId,
        source: "email" as const,
        sourceKey: `inbound:flood-${index}`,
        subject: "Flood",
      })),
    );
    expect(await receiveInbound(state.db, payload())).toBe("limited");
  });
});
