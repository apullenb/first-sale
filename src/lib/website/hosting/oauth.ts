import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { HostError } from "./types";

// Connecting an owner's Netlify account. Authorize URL from https://docs.netlify.com/api/get-started/ (read 2026-10-28);
// the token URL isn't on that page, so it follows Netlify's own example app (github.com/netlify-labs/oauth-example).

export const NETLIFY_AUTHORIZE_URL = "https://app.netlify.com/authorize";
export const NETLIFY_TOKEN_URL = "https://api.netlify.com/oauth/token";
export const CALLBACK_PATH = "/website/netlify/callback";
export const STATE_COOKIE = "fs_netlify_state";

export interface OAuthApp {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Null when this copy of First Sale has no Netlify app registered; publishing is then a practice run
export function netlifyApp(env: Record<string, string | undefined> = process.env): OAuthApp | null {
  const clientId = env.NETLIFY_CLIENT_ID?.trim();
  const clientSecret = env.NETLIFY_CLIENT_SECRET?.trim();
  const base = env.BETTER_AUTH_URL?.trim();
  if (!clientId || !clientSecret || !base) return null;
  return { clientId, clientSecret, redirectUri: new URL(CALLBACK_PATH, base).toString() };
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export function sameState(expected: string | undefined, received: string | null): boolean {
  if (!expected || !received) return false;
  const [a, b] = [Buffer.from(expected), Buffer.from(received)];
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}

export function authorizeUrl(app: OAuthApp, state: string): string {
  const url = new URL(NETLIFY_AUTHORIZE_URL);
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", app.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(app: OAuthApp, code: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(NETLIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      redirect_uri: app.redirectUri,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  const body = response.ok ? ((await response.json()) as { access_token?: unknown }) : null;
  if (typeof body?.access_token !== "string" || !body.access_token) throw new HostError("Netlify didn’t finish connecting. Try connecting again.");
  return body.access_token;
}

// Tokens are stored encrypted with a key made from the app's secret, never sent to the browser
function key(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "first-sale", "host-token", 32));
}

export function sealToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const sealed = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64url")}`;
}

// Null when the secret changed or the value was tampered with
export function openToken(value: string, secret: string): string | null {
  if (!value.startsWith("v1.")) return null;
  try {
    const raw = Buffer.from(value.slice(3), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function tokenSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return secret;
}
