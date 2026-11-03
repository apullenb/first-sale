import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessions } from "@/db/schema";
import { DEMO_SESSION_SECONDS, isDemoToken } from "@/lib/demo";
import { createTestDb } from "@/test/db";
import { createAuth } from "./config";

const BASE = "http://localhost:3000";
const SETTINGS = { secret: "test-secret-that-is-at-least-thirty-two-chars", baseURL: BASE };
const DEMO = { name: "Demo Owner", email: "demo@example.test", password: "correct horse battery" };
const OTHER = { name: "Real Owner", email: "real@example.test", password: "correct horse battery" };

let db: Awaited<ReturnType<typeof createTestDb>>;
let auth: ReturnType<typeof createAuth>;

beforeEach(async () => {
  db = await createTestDb();
  auth = createAuth(db, SETTINGS);
  await auth.api.signUpEmail({ body: DEMO });
  await db.delete(sessions);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const openDemo = (cookie = "", ip = "203.0.113.7") =>
  auth.handler(new Request(`${BASE}/api/auth/demo-session`, { headers: { cookie, "x-forwarded-for": ip } }));

const sessionCookie = (response: Response) =>
  (response.headers.get("set-cookie") ?? "")
    .split(/,(?=\s*[\w.-]+=)/)
    .map((part) => part.trim().split(";")[0])
    .filter((part) => part.includes("session_token=") || part.includes("dont_remember="))
    .join("; ");

describe("the demo link", () => {
  it("says the demo isn't available when no demo account is set", async () => {
    const response = await openDemo();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/demo/unavailable");
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("says the same when the demo account doesn't exist", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", "nobody@example.test");
    expect((await openDemo()).headers.get("location")).toBe("/demo/unavailable");
  });

  it("opens a short read-only session for the demo owner, without a password", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", " Demo@Example.test ");
    const response = await openDemo();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const cookie = sessionCookie(response);
    expect(cookie).toContain("session_token=");

    const [row] = await db.select().from(sessions);
    expect(isDemoToken(row.token)).toBe(true);
    const left = row.expiresAt.getTime() - Date.now();
    expect(left).toBeGreaterThan((DEMO_SESSION_SECONDS - 60) * 1000);
    expect(left).toBeLessThanOrEqual(DEMO_SESSION_SECONDS * 1000);

    const session = await auth.api.getSession({ headers: new Headers({ cookie }), query: { disableRefresh: true } });
    expect(session?.user.email).toBe(DEMO.email);
    expect(isDemoToken(session?.session.token)).toBe(true);

    // get-session never stretches it to a normal session's length
    await auth.handler(new Request(`${BASE}/api/auth/get-session`, { headers: { cookie } }));
    const [after] = await db.select().from(sessions).where(eq(sessions.id, row.id));
    expect(after.expiresAt.getTime()).toBe(row.expiresAt.getTime());
  });

  it("refuses account changes from a demo session but lets it log out", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", DEMO.email);
    const cookie = sessionCookie(await openDemo());
    const post = (path: string, body: object) =>
      auth.handler(
        new Request(`${BASE}/api/auth${path}`, {
          method: "POST",
          headers: { cookie, "Content-Type": "application/json", Origin: BASE },
          body: JSON.stringify(body),
        }),
      );

    const change = await post("/change-password", { currentPassword: DEMO.password, newPassword: "a brand new password" });
    expect(change.status).toBe(403);
    expect(await change.json()).toMatchObject({ code: "DEMO_READ_ONLY" });
    expect((await post("/revoke-sessions", {})).status).toBe(403);

    expect((await post("/sign-out", {})).status).toBe(200);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("leaves the demo owner's own password sessions writable", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", DEMO.email);
    const signedIn = await auth.api.signInEmail({ body: { email: DEMO.email, password: DEMO.password } });
    expect(isDemoToken(signedIn.token)).toBe(false);
  });

  it("keeps someone already signed in on their own account", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", DEMO.email);
    await auth.api.signUpEmail({ body: OTHER });
    const signIn = await auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: BASE },
        body: JSON.stringify({ email: OTHER.email, password: OTHER.password }),
      }),
    );
    const before = await db.select().from(sessions);
    const response = await openDemo(sessionCookie(signIn));
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token=");
    expect(await db.select().from(sessions)).toHaveLength(before.length);
  });

  it("is rate-limited per address like sign-in", async () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", DEMO.email);
    const limited = createAuth(db, { ...SETTINGS, rateLimit: { enabled: true } });
    const open = (ip: string) => limited.handler(new Request(`${BASE}/api/auth/demo-session`, { headers: { "x-forwarded-for": ip } }));
    const statuses = [];
    for (let i = 0; i < 12; i++) statuses.push((await open("203.0.113.9")).status);
    expect(statuses).toContain(429);
    expect((await open("198.51.100.4")).status).toBe(302);
  });
});
