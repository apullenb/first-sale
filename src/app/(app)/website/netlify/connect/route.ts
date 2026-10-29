import { NextResponse } from "next/server";
import { getMyWebsitePlan } from "@/lib/data/my-business";
import { netlifyApp } from "@/lib/website/hosting";
import { authorizeUrl, CALLBACK_PATH, newState, STATE_COOKIE } from "@/lib/website/hosting/oauth";

// Sends the owner to Netlify to approve First Sale; a one-time state cookie ties the reply to this browser
export async function GET(request: Request) {
  const app = netlifyApp();
  const back = new URL("/website#step-publish", request.url);
  if (!app || !(await getMyWebsitePlan())) return NextResponse.redirect(back);
  const state = newState();
  const response = NextResponse.redirect(authorizeUrl(app, state));
  response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: app.redirectUri.startsWith("https://"), sameSite: "lax", path: CALLBACK_PATH, maxAge: 600 });
  return response;
}
