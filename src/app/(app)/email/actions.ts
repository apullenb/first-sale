"use server";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import {
  beginMyEmailConnection,
  disconnectMyEmail,
  dismissMyCustomerMessage,
  importMyEmail,
  processMyCustomerMessage,
  retryMyCustomerMessage,
  sendMyCustomerReply,
} from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import type { JobRef } from "@/lib/workflows";

export async function connectCustomerEmail(): Promise<{
  ok: boolean;
  message: string;
  url?: string | null;
}> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  try {
    const result = await beginMyEmailConnection();
    (await cookies()).set(
      "customer_email_state",
      `${result.state}:${result.binding}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/api/email/callback",
      },
    );
    return {
      ok: true,
      message: "Opening your email service…",
      url: result.url,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof OwnerFacingError
          ? error.message
          : "Could not start the connection.",
      url: null,
    };
  }
}
export async function importCustomerEmail(): Promise<{
  ok: boolean;
  message: string;
  busy?: JobRef;
}> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const result = await importMyEmail();
  refresh();
  if (!result.ok) return result;
  const { added, read, failed, remaining, more } = result.value;
  const parts = [
    added
      ? `Imported ${added} new email${added === 1 ? "" : "s"}.`
      : "No new emails.",
  ];
  if (more) parts.push("More arrived than one import brings in; the newest were imported.");
  if (read) parts.push(`Read ${read}.`);
  if (failed) parts.push(`${failed} need another look.`);
  if (remaining)
    parts.push(`${remaining} still waiting; import again to read them.`);
  return { ok: true, message: parts.join(" ") };
}
export async function disconnectCustomerEmail() {
  if (await isDemoSession()) return DEMO_REFUSAL;
  try {
    await disconnectMyEmail();
    refresh();
    return { ok: true, message: "Email disconnected." };
  } catch {
    return {
      ok: false,
      message: "Could not disconnect your inbox. Try again.",
    };
  }
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
export async function sendCustomerReply(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .object({
      id: z.string().min(1).max(60),
      reply: z.string().trim().min(1).max(10_000),
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Enter a reply before approving it." };
  const result = await sendMyCustomerReply(parsed.data.id, parsed.data.reply);
  refresh();
  return result;
}
