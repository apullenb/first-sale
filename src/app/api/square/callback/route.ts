import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isDemoSession } from "@/lib/auth/server";
import { finishMySquareConnection } from "@/lib/data/my-business";
import { squareConfig } from "@/lib/square/config";

export async function GET(request: Request) {
  if (await isDemoSession()) return new Response("Demo accounts cannot connect Square.", { status: 403 });
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const cookieStore = await cookies();
  const expected = cookieStore.get("square_oauth_state")?.value ?? "";
  cookieStore.delete({ name: "square_oauth_state", path: "/api/square/callback" });
  const destination = new URL("/products/square", squareConfig().redirectUri);
  destination.searchParams.set("connection", "failed");
  if (!url.searchParams.has("error") && /^[a-f0-9]{64}$/.test(state) && expected.length === state.length && timingSafeEqual(Buffer.from(expected), Buffer.from(state))) {
    const code = url.searchParams.get("code");
    if (code && code.length <= 2000) {
      try { await finishMySquareConnection(state, code); destination.searchParams.set("connection", "connected"); }
      catch { /* Connection errors stay out of callback URLs and logs. */ }
    }
  }
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
