"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import {
  clearMyForwardingConfirmation,
  dismissMyCustomerMessage,
  getMyForwardingAddress,
  markMyReplySent,
  newMyForwardingAddress,
  processMyCustomerMessage,
  readMyNewEmail,
  retryMyCustomerMessage,
} from "@/lib/data/my-business";
import { inboundAvailable } from "@/lib/email/inbound";
import type { JobRef } from "@/lib/workflows";

export async function getForwardingAddress() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  if (!inboundAvailable())
    return { ok: false, message: "The forwarding address isn’t set up on this site yet." };
  const token = await getMyForwardingAddress();
  refresh();
  return token
    ? { ok: true, message: "Your SnapStart address is ready." }
    : { ok: false, message: "Tell us about your business first." };
}
export async function newForwardingAddress() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  if (!inboundAvailable())
    return { ok: false, message: "The forwarding address isn’t set up on this site yet." };
  const token = await newMyForwardingAddress();
  refresh();
  return token
    ? { ok: true, message: "Here’s your new address. The old one no longer works, so update any forwarding you set up." }
    : { ok: false, message: "Could not make a new address. Try again." };
}
export async function hideForwardingConfirmation() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  await clearMyForwardingConfirmation();
  refresh();
  return { ok: true, message: "" };
}
export async function readNewCustomerEmail(): Promise<{
  ok: boolean;
  message: string;
  busy?: JobRef;
}> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const result = await readMyNewEmail();
  refresh();
  if (!result.ok) return result;
  const { read, failed, remaining } = result.value;
  const parts = [
    read
      ? `Read ${read} email${read === 1 ? "" : "s"}. Check the details below.`
      : failed
        ? ""
        : "No new emails yet. Forward one to your SnapStart address, then try again.",
  ];
  if (failed) parts.push(`${failed} need another look.`);
  if (remaining)
    parts.push(`${remaining} still waiting. Tap Read new emails again to read them.`);
  return { ok: true, message: parts.filter(Boolean).join(" ") };
}
export async function retryCustomerMessage(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.string().min(1).max(60).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a message." };
  await retryMyCustomerMessage(parsed.data);
  const result = await processMyCustomerMessage(parsed.data);
  refresh();
  return {
    ok: result.ok,
    message: result.ok ? "Request checked." : result.message,
  };
}
export async function dismissCustomerMessage(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.string().min(1).max(60).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose a message." };
  const ok = await dismissMyCustomerMessage(parsed.data);
  refresh();
  return {
    ok,
    message: ok ? "Message resolved." : "Could not resolve this message.",
  };
}
// The owner's own record; SnapStart sends nothing
export async function markCustomerReplySent(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .object({
      id: z.string().min(1).max(60),
      reply: z.string().trim().min(1).max(10_000),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Write your reply first." };
  const ok = await markMyReplySent(parsed.data.id, parsed.data.reply);
  refresh();
  return {
    ok,
    message: ok ? "Marked as sent from your email." : "Could not mark this reply. Try again.",
  };
}
