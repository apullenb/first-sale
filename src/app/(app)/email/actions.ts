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
  pauseMyEmail,
  processMyCustomerMessage,
  retryMyCustomerMessage,
  sendMyCustomerReply,
} from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";

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
export async function changeCustomerEmail(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.enum(["pause", "resume", "disconnect"]).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an action." };
  try {
    if (parsed.data === "disconnect") await disconnectMyEmail();
    else await pauseMyEmail(parsed.data === "pause");
    refresh();
    return { ok: true, message: "Email connection updated." };
  } catch {
    return {
      ok: false,
      message: "Could not update your connection. Try again.",
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

export async function setEmailReminder(input: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z
    .number()
    .int()
    .refine((value) => [1, 2, 3, 7].includes(value))
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Choose a follow-up interval." };
  const ok = await (
    await import("@/lib/data/my-business")
  ).setMyEmailReminder(parsed.data);
  refresh();
  return {
    ok,
    message: ok
      ? "Follow-up preference saved. Reminders appear in your inbox."
      : "Connect email first.",
  };
}
