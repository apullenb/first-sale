import { describe, expect, it, vi } from "vitest";
import { sha1, type SiteFile } from "@/lib/website/site/bundle";
import { NETLIFY_API, netlifyHost } from "./netlify";
import { authorizeUrl, exchangeCode, NETLIFY_TOKEN_URL, netlifyApp, openToken, sameState, sealToken } from "./oauth";
import { practiceHost, siteNameFor } from "./practice";
import { publishTarget } from "./target";
import { HostError, type HostingState } from "./types";

const files: SiteFile[] = [
  { path: "index.html", body: new TextEncoder().encode("<p>hi</p>"), contentType: "text/html" },
  { path: "assets/logo.png", body: new Uint8Array([1, 2, 3]), contentType: "image/png" },
];

type Reply = { status?: number; body?: unknown };

// A fake Netlify: answers by method and path, and records every call
function fakeNetlify(routes: Record<string, Reply | Reply[]>) {
  const calls: { method: string; path: string; body: unknown; headers: Headers }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url).replace(NETLIFY_API, "");
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: init?.body, headers: new Headers(init?.headers) });
    const route = routes[`${method} ${path}`];
    const reply = Array.isArray(route) ? route.shift() : route;
    if (!reply) return new Response("not found", { status: 404 });
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const site = { id: "site-1", name: "rise-bakery", ssl_url: "https://rise-bakery.netlify.app", admin_url: "https://app.netlify.com/projects/rise-bakery" };
const options = (fetchImpl: typeof fetch) => ({ fetchImpl, wait: async () => {}, random: () => "x7k2" });

describe("netlifyHost", () => {
  it("makes the site, sends each file's SHA1, uploads only what Netlify asks for, and waits until it's live", async () => {
    const { fetchImpl, calls } = fakeNetlify({
      "POST /sites": { status: 201, body: site },
      "POST /sites/site-1/deploys": { body: { id: "dep-1", required: [sha1(files[1].body)], state: "uploading" } },
      "PUT /deploys/dep-1/files/assets/logo.png": { body: {} },
      "GET /deploys/dep-1": [{ body: { id: "dep-1", state: "processing" } }, { body: { id: "dep-1", state: "ready" } }],
    });
    const result = await netlifyHost("token-1", options(fetchImpl)).publish(files, { siteId: null, siteName: "rise-bakery" });

    expect(result).toEqual({
      siteId: "site-1",
      siteName: "rise-bakery",
      url: "https://rise-bakery.netlify.app",
      adminUrl: "https://app.netlify.com/projects/rise-bakery",
      deployId: "dep-1",
      state: "ready",
    });
    expect(calls.every((call) => call.headers.get("Authorization") === "Bearer token-1")).toBe(true);
    expect(JSON.parse(String(calls[1].body))).toEqual({ files: { "/index.html": sha1(files[0].body), "/assets/logo.png": sha1(files[1].body) } });
    expect(calls.filter((call) => call.method === "PUT").map((call) => call.path)).toEqual(["/deploys/dep-1/files/assets/logo.png"]);
  });

  it("tries another name when the first is taken", async () => {
    const { fetchImpl, calls } = fakeNetlify({
      "POST /sites": [{ status: 422, body: { errors: { subdomain: ["must be unique"] } } }, { status: 201, body: { ...site, name: "rise-bakery-x7k2" } }],
      "POST /sites/site-1/deploys": { body: { id: "dep-1", required: [], state: "ready" } },
    });
    const result = await netlifyHost("t", options(fetchImpl)).publish(files, { siteId: null, siteName: "rise-bakery" });
    expect(JSON.parse(String(calls[1].body))).toEqual({ name: "rise-bakery-x7k2" });
    expect(result.siteName).toBe("rise-bakery-x7k2");
  });

  it("updates the same site next time, and makes a new one if the owner deleted it", async () => {
    const kept = fakeNetlify({ "GET /sites/site-1": { body: site }, "POST /sites/site-1/deploys": { body: { id: "d", required: [], state: "ready" } } });
    await netlifyHost("t", options(kept.fetchImpl)).publish(files, { siteId: "site-1", siteName: "rise-bakery" });
    expect(kept.calls.some((call) => call.path === "/sites")).toBe(false);

    const gone = fakeNetlify({
      "GET /sites/site-1": { status: 404 },
      "POST /sites": { status: 201, body: { ...site, id: "site-2" } },
      "POST /sites/site-2/deploys": { body: { id: "d", required: [], state: "ready" } },
    });
    expect((await netlifyHost("t", options(gone.fetchImpl)).publish(files, { siteId: "site-1", siteName: "rise-bakery" })).siteId).toBe("site-2");
  });

  it("asks the owner to reconnect when Netlify refuses the token", async () => {
    const { fetchImpl } = fakeNetlify({ "POST /sites": { status: 401 } });
    const error = await netlifyHost("t", options(fetchImpl))
      .publish(files, { siteId: null, siteName: "rise-bakery" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HostError);
    expect((error as HostError).reconnect).toBe(true);
  });

  it("makes a new site when the saved one is in an account this connection can't reach, without asking to reconnect", async () => {
    const { fetchImpl } = fakeNetlify({
      "GET /sites/site-old": { status: 403 },
      "POST /sites": { status: 201, body: site },
      "POST /sites/site-1/deploys": { body: { id: "d", required: [], state: "ready" } },
    });
    expect((await netlifyHost("t", options(fetchImpl)).publish(files, { siteId: "site-old", siteName: "rise-bakery" })).siteId).toBe("site-1");

    const refused = fakeNetlify({ "POST /sites": { status: 201, body: site }, "POST /sites/site-1/deploys": { status: 403 } });
    const error = await netlifyHost("t", options(refused.fetchImpl))
      .publish(files, { siteId: null, siteName: "rise-bakery" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HostError);
    expect((error as HostError).reconnect).toBe(false);
  });

  it("remembers a new site before uploading, so a failed upload doesn't leave a second one", async () => {
    const { fetchImpl } = fakeNetlify({ "POST /sites": { status: 201, body: site }, "POST /sites/site-1/deploys": { status: 500 } });
    const onCreated = vi.fn(async () => {});
    await expect(netlifyHost("t", options(fetchImpl)).publish(files, { siteId: null, siteName: "rise-bakery", onCreated })).rejects.toThrow(/error 500/);
    expect(onCreated).toHaveBeenCalledWith({ siteId: "site-1", siteName: "rise-bakery" });
  });

  it("checks again whether a deploy that was still finishing is live", async () => {
    const { fetchImpl } = fakeNetlify({ "GET /deploys/d": [{ body: { id: "d", state: "processing" } }, { body: { id: "d", state: "ready" } }] });
    const host = netlifyHost("t", options(fetchImpl));
    expect(await host.check?.("d")).toBe("processing");
    expect(await host.check?.("d")).toBe("ready");
  });

  it("says to wait when Netlify's publish limit is hit, and reports a failed deploy", async () => {
    const busy = fakeNetlify({ "POST /sites": { status: 429 } });
    await expect(netlifyHost("t", options(busy.fetchImpl)).publish(files, { siteId: null, siteName: "a" })).rejects.toThrow(/a minute/);

    const broken = fakeNetlify({
      "POST /sites": { status: 201, body: site },
      "POST /sites/site-1/deploys": { body: { id: "dep-1", required: [], state: "processing" } },
      "GET /deploys/dep-1": { body: { id: "dep-1", state: "error", error_message: "Bad file" } },
    });
    await expect(netlifyHost("t", options(broken.fetchImpl)).publish(files, { siteId: null, siteName: "a" })).rejects.toThrow(/Bad file/);
  });

  it("keeps only plain https addresses from Netlify's reply", async () => {
    const { fetchImpl } = fakeNetlify({
      "POST /sites": { status: 201, body: { ...site, ssl_url: "javascript:alert(1)", url: "http://rise-bakery.netlify.app", admin_url: "https://evil.example/" } },
      "POST /sites/site-1/deploys": { body: { id: "d", required: [], state: "processing" } },
      "GET /deploys/d": { body: { id: "d", state: "processing" } },
    });
    const result = await netlifyHost("t", { ...options(fetchImpl), polls: 2 }).publish(files, { siteId: null, siteName: "rise-bakery" });
    expect(result.url).toBe("https://rise-bakery.netlify.app");
    expect(result.adminUrl).toBeNull();
    expect(result.state).toBe("processing");
  });
});

describe("practiceHost", () => {
  it("uploads nothing and says it's a practice run", async () => {
    const host = practiceHost();
    expect(host.simulated).toBe(true);
    expect(await host.publish(files, { siteId: null, siteName: "rise-bakery" })).toMatchObject({ siteId: "practice-rise-bakery", url: "https://rise-bakery.netlify.app" });
  });

  it("names the site from the web address, or else the business name", () => {
    expect(siteNameFor("Rise & Shine Bakery", null)).toBe("rise-and-shine-bakery");
    expect(siteNameFor("Rise Bakery", "risebakery.com")).toBe("risebakery");
    expect(siteNameFor("Café Olé!", null)).toBe("cafe-ole");
    expect(siteNameFor("!!!", null)).toBe("my-business");
    expect(siteNameFor("a".repeat(80), null)).toHaveLength(40);
  });
});

describe("Netlify connection", () => {
  const app = { clientId: "client-1", clientSecret: "secret-1", redirectUri: "http://localhost:3000/website/netlify/callback" };

  it("is set up only when the app's id, secret and address are all set", () => {
    expect(netlifyApp({ NETLIFY_CLIENT_ID: "a", NETLIFY_CLIENT_SECRET: "b", BETTER_AUTH_URL: "http://localhost:3000" })).toEqual({
      clientId: "a",
      clientSecret: "b",
      redirectUri: "http://localhost:3000/website/netlify/callback",
    });
    expect(netlifyApp({ NETLIFY_CLIENT_ID: "a", BETTER_AUTH_URL: "http://localhost:3000" })).toBeNull();
  });

  it("sends the owner to Netlify's documented authorize page", () => {
    const url = new URL(authorizeUrl(app, "state-1"));
    expect(url.origin + url.pathname).toBe("https://app.netlify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: "client-1", response_type: "code", redirect_uri: app.redirectUri, state: "state-1" });
  });

  it("trades the code for a token, and fails plainly when Netlify says no", async () => {
    const ok = vi.fn(async () => Response.json({ access_token: "tok-1" })) as unknown as typeof fetch;
    expect(await exchangeCode(app, "code-1", ok)).toBe("tok-1");
    const [url, init] = vi.mocked(ok).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(NETLIFY_TOKEN_URL);
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toMatchObject({ grant_type: "authorization_code", code: "code-1", client_id: "client-1" });

    const refused = vi.fn(async () => new Response("no", { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeCode(app, "code-1", refused)).rejects.toBeInstanceOf(HostError);
  });

  it("stores tokens encrypted, readable only with the same secret", () => {
    const sealed = sealToken("tok-1", "secret-a");
    expect(sealed).not.toContain("tok-1");
    expect(openToken(sealed, "secret-a")).toBe("tok-1");
    expect(openToken(sealed, "secret-b")).toBeNull();
    expect(openToken(`${sealed.slice(0, -2)}xx`, "secret-a")).toBeNull();
    expect(openToken("tok-1", "secret-a")).toBeNull();
  });

  it("matches the state only when it's exactly the one sent", () => {
    expect(sameState("abc", "abc")).toBe(true);
    expect(sameState("abc", "abd")).toBe(false);
    expect(sameState(undefined, "abc")).toBe(false);
    expect(sameState("abc", null)).toBe(false);
    // Same length in characters, different in bytes
    expect(sameState("abc", "ab\u00e9")).toBe(false);
  });
});

describe("publishTarget", () => {
  const netlify = { id: "netlify" as const, simulated: false };
  const practice = { id: "practice" as const, simulated: true };
  const published = (patch: Partial<HostingState>): HostingState => ({
    provider: "netlify",
    simulated: false,
    siteId: "site-1",
    siteName: "rise-bakery",
    url: "https://rise-bakery.netlify.app",
    adminUrl: null,
    deployId: "d",
    state: "ready",
    publishedAt: "2026-10-28T12:00:00Z",
    hash: "h",
    ...patch,
  });
  it("never lets a practice run replace a real site's record", () => {
    expect(publishTarget(practice, published({}), "rise-bakery")).toMatch(/Connect Netlify again/);
    expect(publishTarget(practice, published({ provider: "practice", simulated: true }), "rise-bakery")).toEqual({ siteId: "site-1", siteName: "rise-bakery" });
  });

  it("updates the last site on the same host, even one whose first publish failed", () => {
    expect(publishTarget(netlify, published({}), "x")).toEqual({ siteId: "site-1", siteName: "rise-bakery" });
    expect(publishTarget(netlify, published({ state: "failed", hash: "" }), "x")).toEqual({ siteId: "site-1", siteName: "rise-bakery" });
    expect(publishTarget(netlify, published({ provider: "practice", simulated: true }), "rise-and-shine")).toEqual({ siteId: null, siteName: "rise-and-shine" });
    expect(publishTarget(netlify, null, "rise-and-shine")).toEqual({ siteId: null, siteName: "rise-and-shine" });
  });
});
