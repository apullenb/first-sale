import "server-only";
import { getModel } from "@/lib/ai";
import { getMyDocument, myAiKey, updateMyDocument } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { runWorkflow } from "@/lib/workflow-runner";
import { readDocument } from "./read";

// Reads a stored document and saves its text and blanks. Not a server action: callers check the owner's input first.
export async function readAndSave(doc: { id: string; type: Parameters<typeof readDocument>[1]["type"]; data?: Uint8Array; text?: string }) {
  return runWorkflow("read_document", doc.id, async () => {
    const content = await readDocument(getModel(), { type: doc.type, data: doc.data, text: doc.text }, new Date(), await myAiKey());
    const before = await getMyDocument(doc.id);
    // A failed read never replaces a good earlier one
    if (!content.pages.some((page) => page.text.trim()) && before?.content.pages.some((page) => page.text.trim())) {
      throw new OwnerFacingError(`We couldn’t read it this time, so we kept the earlier reading. ${content.unclear[0]?.why ?? ""}`.trim());
    }
    // Answers stay for blanks that are still there with the same label; explanations start fresh
    const same = new Set(
      content.fields.filter((field) => before?.content.fields.some((old) => old.id === field.id && old.label === field.label)).map((field) => field.id),
    );
    const answers = Object.fromEntries(Object.entries(before?.answers ?? {}).filter(([fieldId]) => same.has(fieldId)));
    await updateMyDocument(doc.id, { content, guide: null, answers });
  });
}
