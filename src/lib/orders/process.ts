import "server-only";
import { getDb } from "@/db/client";
import { getModel, type ModelProvider } from "@/lib/ai";
import { getBusinessForOwner } from "@/lib/data/businesses";
import {
  claimMessageForOwner,
  completeMessageForOwner,
  failMessageForOwner,
} from "@/lib/data/customer-messages";
import { getDocumentFileForOwner } from "@/lib/data/documents";
import { readDocument } from "@/lib/documents/read";
import { checkUpload } from "@/lib/documents/upload";
import { extractRequest } from "./extract";

// Text of a saved PDF or photo, checked again by its first bytes
async function readSaved(
  ownerId: string,
  documentId: string,
  name: string,
  model: ModelProvider,
  userKey: string,
) {
  const file = await getDocumentFileForOwner(getDb(), ownerId, documentId);
  if (!file) throw new Error("file unavailable");
  const checked = checkUpload(file.data, name);
  if (!checked.ok) throw new Error("file invalid");
  const reading = await readDocument(
    model,
    { type: checked.type, data: file.data, findBlanks: false },
    new Date(),
    userKey,
  );
  return reading.pages.map((page) => page.text).join("\n");
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
    if (message.documentId) {
      body = await readSaved(ownerId, message.documentId, message.subject, model, userKey);
      if (!body.trim()) throw new Error("file unreadable");
    }
    for (const attachment of message.attachmentIds) {
      const text = await readSaved(ownerId, attachment, "Attachment", model, userKey);
      body += `\n<attachment document="${attachment}">\n${text}\n</attachment>`;
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
        message.updatedAt,
      ),
    };
  } catch (error) {
    await failMessageForOwner(db, ownerId, id, message.updatedAt);
    throw error;
  }
}
