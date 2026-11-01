import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "@/db/client";
import { accounts, rateLimits, sessions, users, verifications } from "@/db/auth-schema";
import { isValidName, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./rules";

export interface AuthSettings {
  secret?: string;
  baseURL?: string;
  trustedOrigins?: string[];
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
    rateLimit: { storage: "database" },
    advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] } },
    hooks: {
      // The browser form checks these too; this stops direct API calls
      before: createAuthMiddleware(async (ctx) => {
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
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
