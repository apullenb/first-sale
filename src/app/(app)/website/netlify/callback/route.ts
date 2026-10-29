import { NextResponse, type NextRequest } from "next/server";
import { saveMyWebsitePlan } from "@/lib/data/my-business";
import { netlifyApp } from "@/lib/website/hosting";
import { CALLBACK_PATH, exchangeCode, sameState, sealToken, STATE_COOKIE, tokenSecret } from "@/lib/website/hosting/oauth";

// Netlify sends the owner back here after they approve (or cancel)
export async function GET(request: NextRequest) {
  const app = netlifyApp();
  const params = request.nextUrl.searchParams;
  const done = (result: "connected" | "failed") => {
    const response = NextResponse.redirect(new URL(`/website?netlify=${result}#step-publish`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: CALLBACK_PATH, maxAge: 0 });
    return response;
  };
  const code = params.get("code");
  if (!app || !code || code.length > 500 || !sameState(request.cookies.get(STATE_COOKIE)?.value, params.get("state"))) return done("failed");
  try {
    const token = await exchangeCode(app, code);
    const saved = await saveMyWebsitePlan({ hostConnection: { provider: "netlify", token: sealToken(token, tokenSecret()), connectedAt: new Date().toISOString() } });
    return done(saved ? "connected" : "failed");
  } catch {
    return done("failed");
  }
}
