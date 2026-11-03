import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/signup", "/demo", "/demo/unavailable"]);

// Quick cookie-only check that sends signed-out visitors to log in.
// Pages still verify the session itself (getCurrentUser), since a cookie can be stale.
export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname) || getSessionCookie(request)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the auth API, the inbound email webhook (its own password), Next internals and files like favicon.ico
  matcher: ["/((?!api/auth/|api/email/inbound|_next/static|_next/image|.*\\..*).*)"],
};
