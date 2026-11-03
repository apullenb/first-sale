import "server-only";
import { parse } from "node-html-parser";
import { getDb } from "@/db/client";
import { getModel } from "@/lib/ai";
import { getBusinessForOwner } from "@/lib/data/businesses";
import {
  claimMessageForOwner,
  completeMessageForOwner,
  connectionForOwner,
  failMessageForOwner,
  fetchedMessageForOwner,
  ignoreIncomingForOwner,
} from "@/lib/data/customer-messages";
import {
  createDocumentForOwner,
  getDocumentFileForOwner,
} from "@/lib/data/documents";
import { readDocument } from "@/lib/documents/read";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { emailApi, emailConfig, emailMessageSchema } from "@/lib/email/client";
import { extractRequest } from "./extract";

export function plainEmail(html: string) {
  const root = parse(html);
  root
    .querySelectorAll("script,style,iframe,object")
    .forEach((element) => element.remove());
  root.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  root
    .querySelectorAll("p,div,tr")
    .forEach((element) => element.insertAdjacentHTML("beforeend", "\n"));
  return root.textContent.replace(/\n{3,}/g, "\n\n").slice(0, 30_000);
}
async function readAttachment(
  ownerId: string,
  grantId: string,
  messageId: string,
  attachment: { id: string; filename?: string; size?: number },
  userKey: string,
) {
  if ((attachment.size ?? MAX_UPLOAD_BYTES + 1) > MAX_UPLOAD_BYTES)
    return "[Attachment exceeds the 4 MB reading limit; review it in your inbox.]";
  const config = emailConfig();
  const response = await fetch(
    `${config.base}/v3/grants/${encodeURIComponent(grantId)}/attachments/${encodeURIComponent(attachment.id)}/download?message_id=${encodeURIComponent(messageId)}`,
    {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );
  if (!response.ok || !response.body) throw new Error("attachment unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new Error("attachment too large");
    }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  const checked = checkUpload(bytes, attachment.filename || "Attachment");
  if (!checked.ok)
    return "[Attachment type could not be read; review it in your inbox.]";
  const content = await readDocument(
    getModel(),
    { type: checked.type, data: bytes, findBlanks: false },
    new Date(),
    userKey,
  );
  const saved = await createDocumentForOwner(getDb(), ownerId, {
    title: checked.title,
    origin: "upload",
    mimeType: checked.type,
    data: bytes,
    sha256: checked.sha256,
    role: "supporting",
    content,
    requestKey: `email-attachment:${grantId}:${messageId}:${attachment.id}`,
  });
  if (!saved.ok) throw new Error("attachment storage limit");
  return `<attachment document="${saved.id}">\n${content.pages.map((page) => page.text).join("\n")}\n</attachment>`;
}
export async function processCustomerMessage(ownerId: string, id: string) {
  const db = getDb(),
    message = await claimMessageForOwner(db, ownerId, id);
  if (!message) return { orderId: null };
  try {
    const business = await getBusinessForOwner(db, ownerId);
    if (!business || business.isDemo) throw new Error("business unavailable");
    const model = getModel(),
      userKey = `customer:${business.id}`;
    let body = message.body;
    if (message.providerMessageId && message.connectionId) {
      const connection = await connectionForOwner(db, ownerId);
      if (
        !connection ||
        connection.id !== message.connectionId ||
        connection.paused
      )
        throw new Error("connection unavailable");
      const result = await emailApi(
        `/grants/${encodeURIComponent(connection.grantId)}/messages/${encodeURIComponent(message.providerMessageId)}`,
      );
      const incoming = emailMessageSchema.parse(result.data);
      // Only the owner's own mail is skipped; customers reach them by Cc, alias or forward too
      if (
        incoming.from.some(
          (person) =>
            person.email.toLowerCase() === connection.email.toLowerCase(),
        )
      ) {
        await ignoreIncomingForOwner(db, ownerId, id, message.leaseUntil!);
        return { orderId: null };
      }
      await fetchedMessageForOwner(db, ownerId, id, {
        sender: incoming.from[0]?.email ?? "",
        subject: incoming.subject.slice(0, 1000),
        threadId: incoming.thread_id ?? null,
      });
      body = `Subject: ${incoming.subject}\nFrom: ${incoming.from[0]?.email ?? ""}\n${plainEmail(incoming.body)}`;
      const supported = incoming.attachments.filter(
        (file) =>
          file.content_type === "application/pdf" ||
          file.content_type?.startsWith("image/"),
      );
      const attachments = await Promise.all(
        supported
          .slice(0, 3)
          .map((attachment) =>
            readAttachment(
              ownerId,
              connection.grantId,
              incoming.id,
              attachment,
              userKey,
            ),
          ),
      );
      body += `\n${attachments.join("\n")}`;
      if (supported.length > 3)
        body += "\n[Additional attachments need review in your inbox.]";
    } else if (message.documentId) {
      const file = await getDocumentFileForOwner(
        db,
        ownerId,
        message.documentId,
      );
      if (!file) throw new Error("file unavailable");
      const checked = checkUpload(file.data, message.subject);
      if (!checked.ok) throw new Error("file invalid");
      const reading = await readDocument(
        model,
        { type: checked.type, data: file.data, findBlanks: false },
        new Date(),
        userKey,
      );
      body = reading.pages.map((page) => page.text).join("\n");
      if (!body.trim()) throw new Error("file unreadable");
    }
    const extraction = await extractRequest(
      model,
      body,
      business.profile.name ?? "",
      userKey,
    );
    return {
      orderId: await completeMessageForOwner(
        db,
        ownerId,
        id,
        extraction,
        model.simulated,
        body,
        message.attempts,
        message.leaseUntil ?? undefined,
      ),
    };
  } catch (error) {
    await failMessageForOwner(
      db,
      ownerId,
      id,
      message.attempts,
      message.leaseUntil ?? undefined,
    );
    throw error;
  }
}
