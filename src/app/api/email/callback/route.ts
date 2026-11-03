import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isDemoSession } from "@/lib/auth/server";
import { finishMyEmailConnection } from "@/lib/data/my-business";
import { emailConfig } from "@/lib/email/client";

export async function GET(request: Request) {
  if (await isDemoSession())
    return new Response("Demo accounts cannot connect email.", { status: 403 });
  const url = new URL(request.url),
    store = await cookies();
  const [expected, binding] = (
    store.get("customer_email_state")?.value ?? ""
  ).split(":");
  store.delete({ name: "customer_email_state", path: "/api/email/callback" });
  const state = url.searchParams.get("state") ?? "",
    code = url.searchParams.get("code");
  const destination = new URL("/email", emailConfig().redirectUri);
  destination.searchParams.set("connection", "failed");
  if (
    code &&
    code.length <= 2000 &&
    binding &&
    /^[a-f0-9]{64}$/.test(state) &&
    expected?.length === state.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(state))
  ) {
    try {
      if (await finishMyEmailConnection(code, binding))
        destination.searchParams.set("connection", "connected");
    } catch {
      /* Credentials stay out of redirect URLs. */
    }
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
