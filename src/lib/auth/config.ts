import { randomBytes } from "node:crypto";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { setSessionCookie } from "better-auth/cookies";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "@/db/client";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/auth-schema";
import { DEMO_NOTE, DEMO_SESSION_SECONDS, DEMO_TOKEN_PREFIX, demoOwnerEmail, isDemoToken } from "@/lib/demo";
import { isValidName, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./rules";

export interface AuthSettings {
  secret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
  // On in production only, unless set (tests)
  rateLimit?: { enabled: boolean };
}

// Vercel's production, deployment and branch URLs, plus any listed in BETTER_AUTH_TRUSTED_ORIGINS (comma-separated)
function envTrustedOrigins(): string[] {
  const listed = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const vercel = [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
  return [...listed, ...vercel];
}

// Paths a demo session may call; every other auth endpoint is refused for it
const OPEN_TO_DEMO = new Set(["/get-session", "/sign-out", "/sign-in/email", "/sign-up/email", "/demo-session", "/ok", "/error"]);

// GET /api/auth/demo-session, reached through /demo: a short read-only session for the demo owner
function demoSessions() {
  return {
    id: "demo-session",
    endpoints: {
      demoSession: createAuthEndpoint("/demo-session", { method: "GET" }, async (ctx) => {
        const email = demoOwnerEmail();
        const found = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
        if (!found) throw ctx.redirect("/demo/unavailable");
        // Someone already signed in keeps their own session
        if (await getSessionFromCtx(ctx)) throw ctx.redirect("/");
        const session = await ctx.context.internalAdapter.createSession(
          found.user.id,
          true,
          { token: DEMO_TOKEN_PREFIX + randomBytes(32).toString("base64url"), expiresAt: new Date(Date.now() + DEMO_SESSION_SECONDS * 1000) },
          true,
        );
        // Browser-session cookies; "don't remember" also stops get-session from extending it
        await setSessionCookie(ctx, { session, user: found.user }, true);
        throw ctx.redirect("/");
      }),
    },
    rateLimit: [{ pathMatcher: (path: string) => path === "/demo-session", window: 60, max: 10 }],
  } satisfies BetterAuthPlugin;
}

// Email and password accounts stored in our own Postgres. Secret and URL default to BETTER_AUTH_* env vars.
export function createAuth(db: Db, settings: AuthSettings = {}) {
  return betterAuth({
    ...settings,
    trustedOrigins: settings.trustedOrigins ?? envTrustedOrigins(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications, rateLimit: rateLimits },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    // No profile screen yet; closed so names and images can't skip the sign-up checks
    disabledPaths: ["/update-user"],
    // In the database so limits hold across serverless instances (on in production only)
    rateLimit: { storage: "database", ...settings.rateLimit },
    advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] } },
    hooks: {
      // The browser form checks these too; this stops direct API calls
      before: createAuthMiddleware(async (ctx) => {
        if (!OPEN_TO_DEMO.has(ctx.path)) {
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (isDemoToken(current?.session.token)) throw new APIError("FORBIDDEN", { message: DEMO_NOTE, code: "DEMO_READ_ONLY" });
        }
        if (ctx.path !== "/sign-up/email") return;
        const body = (ctx.body ?? {}) as { name?: unknown; image?: unknown };
        if (!isValidName(body.name)) {
          throw new APIError("BAD_REQUEST", { message: "Invalid name", code: "INVALID_NAME" });
        }
        if (body.image !== undefined) {
          throw new APIError("BAD_REQUEST", { message: "Profile images aren't supported", code: "IMAGE_NOT_ALLOWED" });
        }
      }),
    },
    // Must stay last: lets server actions set the session cookie
    plugins: [demoSessions(), nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
