import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/db/client";
import { addMessageForOwner, INBOUND_PREFIX } from "@/lib/data/customer-messages";
import { createDocumentForOwner } from "@/lib/data/documents";
import {
  inboundCountSince,
  inboundSeenForBusiness,
  inboxForToken,
  markFirstEmailForInbox,
  saveConfirmationForInbox,
  TOKEN_PATTERN,
} from "@/lib/data/email-inbox";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { detectConfirmation } from "./confirmation";
import { parseIncoming, parsePerson, threadKey } from "./forwarded";
import { plainEmail } from "./plain";

// Postmark's inbound address, like abc123@inbound.postmarkapp.com
export function inboundBase() {
  const raw = process.env.POSTMARK_INBOUND_ADDRESS?.trim().toLowerCase() ?? "";
  const match = raw.match(/^([a-z0-9._-]{1,40})@([a-z0-9.-]+\.[a-z]{2,})$/);
  return match ? { local: match[1], domain: match[2] } : null;
}
export function inboundAvailable() {
  return !!inboundBase();
}
export function inboundAddress(token: string) {
  const base = inboundBase();
  return base ? `${base.local}+${token}@${base.domain}` : null;
}

const digest = (value: string) => createHash("sha256").update(value).digest();
// Basic auth from the webhook URL, compared in constant time; refused when unset
export function webhookAuthorized(header: string | null) {
  const user = process.env.INBOUND_WEBHOOK_USER,
    password = process.env.INBOUND_WEBHOOK_PASSWORD;
  if (!user || !password || !header?.startsWith("Basic ")) return false;
  let given: string;
  try {
    given = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  return timingSafeEqual(digest(given), digest(`${user}:${password}`));
}

// Per business, so a flood to one address can't fill the database
export const HOURLY_LIMIT = 60;
export const MAX_ATTACHMENTS = 3;

const person = z
  .object({ Email: z.string().max(320).catch(""), Name: z.string().max(300).catch("") })
  .partial();
export const postmarkSchema = z.object({
  From: z.string().max(1000).catch(""),
  FromFull: person.nullish().catch(null),
  To: z.string().max(5000).catch(""),
  ToFull: z.array(person).max(50).catch([]).default([]),
  CcFull: z.array(person).max(50).catch([]).default([]),
  BccFull: z.array(person).max(50).catch([]).default([]),
  OriginalRecipient: z.string().max(1000).catch("").default(""),
  Subject: z.string().max(5000).catch("").default(""),
  TextBody: z.string().max(2_000_000).catch("").default(""),
  HtmlBody: z.string().max(5_000_000).catch("").default(""),
  MessageID: z.string().min(1).max(300),
  Date: z.string().max(200).catch("").default(""),
  MailboxHash: z.string().max(200).catch("").default(""),
  Headers: z
    .array(z.object({ Name: z.string().max(200), Value: z.string().max(5000) }))
    .max(500)
    .catch([])
    .default([]),
  Attachments: z
    .array(
      z.object({
        Name: z.string().max(300).catch("Attachment"),
        ContentType: z.string().max(200).catch(""),
        Content: z.string().max(8_000_000).catch(""),
        ContentLength: z.number().int().nonnegative().catch(0),
      }),
    )
    .max(50)
    .catch([])
    .default([]),
});
export type PostmarkInbound = z.infer<typeof postmarkSchema>;

// The token after "+" in the address; Postmark sends it as MailboxHash
export function tokenOf(payload: PostmarkInbound) {
  const candidates = [
    payload.MailboxHash,
    ...[
      payload.OriginalRecipient,
      ...[...payload.ToFull, ...payload.CcFull, ...payload.BccFull].map((item) => item.Email ?? ""),
    ].map((address) => address.match(/\+([a-z0-9]+)@/i)?.[1] ?? ""),
  ];
  return candidates.map((item) => item.trim().toLowerCase()).find((item) => TOKEN_PATTERN.test(item)) ?? null;
}

function header(payload: PostmarkInbound, name: string) {
  return payload.Headers.find((item) => item.Name.toLowerCase() === name.toLowerCase())?.Value ?? "";
}

export type InboundOutcome = "unknown" | "duplicate" | "limited" | "confirmation" | "stored" | "ignored";

// Stores one email for the owner to read later; no AI runs here
export async function receiveInbound(db: Db, payload: PostmarkInbound, now = new Date()): Promise<InboundOutcome> {
  const token = tokenOf(payload);
  const inbox = token ? await inboxForToken(db, token) : null;
  if (!inbox) return "unknown";
  const envelope =
    payload.FromFull?.Email ? { name: payload.FromFull.Name ?? "", email: payload.FromFull.Email.toLowerCase() } : parsePerson(payload.From);
  const text = payload.TextBody.trim() ? payload.TextBody : plainEmail(payload.HtmlBody);
  const sent = Date.parse(payload.Date);
  const date = Number.isNaN(sent) ? now : new Date(sent);

  // A provider confirming the address; only when the sender's domain passed its SPF check, if reported
  const spf = header(payload, "Received-SPF").trim().toLowerCase();
  const confirmation =
    envelope && (!spf || spf.startsWith("pass"))
      ? detectConfirmation({ from: envelope.email, subject: payload.Subject, text: `${text}\n${payload.HtmlBody}`, receivedAt: now })
      : null;
  if (confirmation) {
    await saveConfirmationForInbox(db, inbox.id, confirmation);
    return "confirmation";
  }

  const sourceKey = `${INBOUND_PREFIX}${createHash("sha256").update(payload.MessageID).digest("hex").slice(0, 40)}`;
  if (await inboundSeenForBusiness(db, inbox.businessId, sourceKey)) return "duplicate";
  if ((await inboundCountSince(db, inbox.businessId, new Date(now.getTime() - 3_600_000))) >= HOURLY_LIMIT) return "limited";

  const parsed = parseIncoming({ from: envelope, subject: payload.Subject, date, text });
  if (!parsed.from) return "ignored";

  const attachmentIds: string[] = [];
  const notes: string[] = [];
  for (const [index, file] of payload.Attachments.entries()) {
    if (attachmentIds.length >= MAX_ATTACHMENTS) {
      notes.push("[More attachments came with this email; open it in your inbox to see them.]");
      break;
    }
    const pdfOrImage = file.ContentType === "application/pdf" || file.ContentType.startsWith("image/");
    if (!pdfOrImage) continue;
    // Base64 is a third bigger than the file, so this skips oversized files before decoding
    if (file.ContentLength > MAX_UPLOAD_BYTES || file.Content.length > (MAX_UPLOAD_BYTES * 4) / 3 + 4) {
      notes.push(`[${file.Name} is over 4 MB; open it in your inbox.]`);
      continue;
    }
    const bytes = new Uint8Array(Buffer.from(file.Content, "base64"));
    const checked = checkUpload(bytes, file.Name);
    if (!checked.ok) {
      notes.push(`[${file.Name} couldn’t be read as a PDF or photo.]`);
      continue;
    }
    const saved = await createDocumentForOwner(db, inbox.ownerId, {
      title: checked.title,
      origin: "upload",
      mimeType: checked.type,
      data: bytes,
      sha256: checked.sha256,
      role: "supporting",
      content: EMPTY_CONTENT,
      requestKey: `email-attachment:${sourceKey}:${index}`,
    });
    if (saved.ok) attachmentIds.push(saved.id);
    else notes.push(`[${file.Name} couldn’t be saved; your document storage may be full.]`);
  }

  const lines = [
    `Subject: ${parsed.subject}`,
    `From: ${parsed.from.name ? `${parsed.from.name} <${parsed.from.email}>` : parsed.from.email}`,
  ];
  if (parsed.date) lines.push(`Email sent: ${parsed.date.toUTCString()}`);
  if (parsed.forwardedBy && parsed.note)
    lines.push(`Note from ${parsed.forwardedBy.email} when forwarding:`, parsed.note);
  lines.push("", parsed.body, ...notes);
  const id = await addMessageForOwner(db, inbox.ownerId, {
    source: "email",
    sourceKey,
    sender: parsed.from.email,
    senderName: parsed.from.name,
    forwardedBy: parsed.forwardedBy?.email ?? null,
    receivedAt: parsed.date,
    subject: parsed.subject.trim() || "(No subject)",
    body: lines.join("\n").slice(0, 30_000),
    attachmentIds,
    threadId: threadKey(parsed.from.email, parsed.subject),
  });
  if (!id) return "ignored";
  if (!inbox.firstAt && envelope) await markFirstEmailForInbox(db, inbox.id, envelope.email, now);
  return "stored";
}
