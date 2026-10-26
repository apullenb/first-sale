import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { accounts, sessions, users } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { createAuth } from "./config";

const SETTINGS = { secret: "test-secret-that-is-at-least-thirty-two-chars", baseURL: "http://localhost:3000" };
const OWNER = { name: "Test Owner", email: "owner@example.test", password: "correct horse battery" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  db = await createTestDb();
  auth = createAuth(db, SETTINGS);
});

function errorCode(error: unknown): string | undefined {
  return (error as { body?: { code?: string } }).body?.code;
}

describe("email and password accounts", () => {
  it("creates a user and stores only a password hash", async () => {
    const result = await auth.api.signUpEmail({ body: OWNER });

    expect(result.user.email).toBe(OWNER.email);
    const [account] = await db.select().from(accounts).where(eq(accounts.userId, result.user.id));
    expect(account.providerId).toBe("credential");
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(OWNER.password);
  });

  it("signs in with the right password", async () => {
    await auth.api.signUpEmail({ body: OWNER });
    const result = await auth.api.signInEmail({ body: { email: OWNER.email, password: OWNER.password } });
    expect(result.user.email).toBe(OWNER.email);
    expect(result.token).toBeTruthy();
  });

  it("rejects the wrong password", async () => {
    await auth.api.signUpEmail({ body: OWNER });
    const error = await auth.api
      .signInEmail({ body: { email: OWNER.email, password: "not the password" } })
      .catch((caught: unknown) => caught);
    expect(errorCode(error)).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("rejects a second account with the same email", async () => {
    await auth.api.signUpEmail({ body: OWNER });
    const error = await auth.api.signUpEmail({ body: { ...OWNER, name: "Someone Else" } }).catch((caught: unknown) => caught);
    expect(errorCode(error)).toMatch(/^USER_ALREADY_EXISTS/);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it.each([
    ["an empty name", { name: "   " }, "INVALID_NAME"],
    ["a name over 100 characters", { name: "x".repeat(101) }, "INVALID_NAME"],
    ["a profile image", { image: "javascript:alert(1)" }, "IMAGE_NOT_ALLOWED"],
  ])("rejects %s sent straight to the API", async (_label, extra, code) => {
    const error = await auth.api.signUpEmail({ body: { ...OWNER, ...extra } }).catch((caught: unknown) => caught);
    expect(errorCode(error)).toBe(code);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it("stores emails in lowercase, so case variants can't make a second account", async () => {
    await auth.api.signUpEmail({ body: { ...OWNER, email: "Owner@Example.Test" } });
    const error = await auth.api.signUpEmail({ body: OWNER }).catch((caught: unknown) => caught);
    expect(errorCode(error)).toMatch(/^USER_ALREADY_EXISTS/);
    expect((await db.select().from(users))[0].email).toBe("owner@example.test");
  });

  it("renews the session through get-session, not during server rendering", async () => {
    await auth.api.signUpEmail({ body: OWNER });
    const signIn = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: OWNER.email, password: OWNER.password }),
      }),
    );
    const cookie = (signIn.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toContain("session_token=");
    // Cookie value is "<token>.<signature>"
    const token = decodeURIComponent(cookie.split("=")[1]).split(".")[0];
    const expiry = async () =>
      (await db.select().from(sessions).where(eq(sessions.token, token)))[0].expiresAt.getTime();

    // Two days old, so due for renewal
    const dueSoon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await db.update(sessions).set({ expiresAt: dueSoon }).where(eq(sessions.token, token));
    const headers = new Headers({ cookie });

    await auth.api.getSession({ headers, query: { disableRefresh: true } });
    expect(await expiry()).toBe(dueSoon.getTime());

    const renewed = await auth.handler(new Request("http://localhost:3000/api/auth/get-session", { headers }));
    expect(renewed.headers.get("set-cookie")).toContain("session_token=");
    expect(await expiry()).toBeGreaterThan(dueSoon.getTime());
  });

  it("keeps the update-user endpoint closed", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ image: "javascript:alert(1)" }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const error = await auth.api.signUpEmail({ body: { ...OWNER, password: "short" } }).catch((caught: unknown) => caught);
    expect(errorCode(error)).toBe("PASSWORD_TOO_SHORT");
  });
});
