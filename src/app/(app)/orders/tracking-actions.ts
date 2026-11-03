"use server";
import { randomUUID, createHash } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import {
  addMyCustomerMessage,
  createMyDocument,
  processMyCustomerMessage,
  progressMyOrder,
  recordMyOrder,
  recordMyPayment,
  scheduleMyOrder,
} from "@/lib/data/my-business";
import {
  trackingInputSchema,
  TRACKING_STATUSES,
  centsSchema,
} from "@/lib/rules/order-tracking";
import { orderIssueText } from "@/lib/rules/inventory";
import { checkUpload } from "@/lib/documents/upload";

export async function saveTrackedOrder(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = trackingInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the details.",
    };
  const result = await recordMyOrder({
    ...parsed.data,
    requestedDate: parsed.data.requestedDate || null,
  });
  if (!result.ok)
    return {
      ok: false,
      message:
        result.reason === "needs_review"
          ? result.issues
              .map((issue) =>
                orderIssueText(issue, (id) => result.names[id] ?? "Item"),
              )
              .join(" ")
          : "This record cannot be confirmed. Reload and check its status.",
    };
  refresh();
  return {
    ok: true,
    message: "Saved. You can now record payments and track progress.",
  };
}
export async function progressTrackedOrder(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .object({
      id: z.string().min(1).max(60),
      status: z.enum(TRACKING_STATUSES),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a valid status." };
  const ok = await progressMyOrder(parsed.data.id, parsed.data.status);
  refresh();
  return {
    ok,
    message: ok
      ? "Progress updated."
      : "That change is not available. Reload and check the current status.",
  };
}
export async function recordTrackedPayment(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .object({
      orderId: z.string().min(1).max(60),
      requestKey: z.uuid(),
      amountCents: centsSchema.positive(),
      kind: z.enum(["payment", "refund"]),
      paidOn: z.iso.date(),
      note: z.string().trim().max(300),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Check the amount and payment date." };
  const ok = await recordMyPayment(parsed.data);
  refresh();
  return {
    ok,
    message: ok
      ? "Payment record saved. No money was charged or moved."
      : "Check the balance and amount. Confirm this order and its total before recording a payment.",
  };
}
export async function scheduleTrackedOrder(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = trackingInputSchema
    .pick({ requestedDate: true, jobTime: true, location: true })
    .extend({ id: z.string().min(1).max(60) })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Check the date, time and location." };
  const ok = await scheduleMyOrder(parsed.data);
  refresh();
  return {
    ok,
    message: ok ? "Schedule saved." : "This record cannot be rescheduled.",
  };
}
export async function importCustomerRequest(form: FormData) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  let id: string | null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 4_000_000)
      return { ok: false, message: "Choose a PDF or image under 4 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer()),
      check = checkUpload(bytes, file.name);
    if (!check.ok) return check;
    const saved = await createMyDocument({
      title: check.title,
      origin: "upload",
      mimeType: check.type,
      data: bytes,
      sha256: check.sha256,
      role: "supporting",
      requestKey: `invoice:${check.sha256}`,
      content: {
        readAt: new Date().toISOString(),
        simulated: false,
        readMethod: "none",
        pages: [],
        fields: [],
        unclear: [],
      },
    });
    if (!saved.ok)
      return {
        ok: false,
        message:
          "The invoice could not be saved. Check your document storage limit.",
      };
    id = await addMyCustomerMessage({
      source: "invoice",
      sourceKey: `invoice:${check.sha256}`,
      subject: check.title,
      documentId: saved.id,
    });
  } else {
    const text = String(form.get("text") ?? "").trim();
    if (text.length < 5 || text.length > 30_000)
      return {
        ok: false,
        message: "Paste a customer email or invoice, up to 30,000 characters.",
      };
    id = await addMyCustomerMessage({
      source: "email",
      sourceKey: `paste:${createHash("sha256").update(text).digest("hex")}`,
      subject: "Pasted customer request",
      body: text,
    });
  }
  if (!id) return { ok: false, message: "The request could not be saved." };
  const result = await processMyCustomerMessage(id);
  refresh();
  return {
    ok: result.ok,
    message: result.ok
      ? "Request saved. Review the extracted details below; stock and payments are unchanged."
      : "Request saved, but reading did not finish. Retry from the inbox.",
    requestKey: randomUUID(),
  };
}
export async function setTrackedTotal(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .object({ id: z.string().min(1).max(60), totalCents: centsSchema })
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Enter the agreed total in dollars and cents.",
    };
  const ok = await (
    await import("@/lib/data/my-business")
  ).setMyOrderTotal(parsed.data.id, parsed.data.totalCents);
  refresh();
  return {
    ok,
    message: ok
      ? "Agreed total updated."
      : "The total cannot be changed. Catalog totals use saved item prices; refund recorded payments before reducing a total below the amount paid.",
  };
}
