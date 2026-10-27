import type { JurisdictionLevel } from "@/lib/domain";
import { pageText } from "./page-text";
import { isAllowedHost } from "./source-pack";
import type { RetrievedSource } from "./verify";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 20_000;
const USER_AGENT = "FirstSale/0.1 (research for first-time small business owners)";

export interface SourceToRead {
  id: string;
  title: string;
  url: string;
  level: JurisdictionLevel;
  allowedHosts: readonly string[];
}

export interface RetrievedPage extends RetrievedSource {
  title: string;
  level: JurisdictionLevel;
  text: string;
}

export interface UnreadSource {
  id: string;
  title: string;
  url: string;
  reason: string;
}

type Fetched = { ok: true; finalUrl: string; html: string } | { ok: false; reason: string };

// Reads each page once, even when several sources are sections of it
export async function retrieveSources(
  sources: readonly SourceToRead[],
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<{ pages: RetrievedPage[]; unread: UnreadSource[] }> {
  const fetches = new Map<string, Promise<Fetched>>();
  const results = await Promise.all(
    sources.map(async (source) => {
      const { page, fragment } = splitFragment(source.url);
      const key = `${page} ${source.allowedHosts.join(",")}`;
      if (!fetches.has(key)) fetches.set(key, fetchOfficialPage(page, source.allowedHosts, fetchImpl));
      return { source, fragment, fetched: await fetches.get(key)! };
    }),
  );

  const pages: RetrievedPage[] = [];
  const unread: UnreadSource[] = [];
  for (const { source, fragment, fetched } of results) {
    if (!fetched.ok) {
      unread.push({ id: source.id, title: source.title, url: source.url, reason: fetched.reason });
      continue;
    }
    const { text } = pageText(fetched.html, fragment);
    if (!text) {
      const reason = text === null ? "The linked section isn’t on the page anymore" : "The page had no readable text";
      unread.push({ id: source.id, title: source.title, url: source.url, reason });
      continue;
    }
    pages.push({
      id: source.id,
      title: source.title,
      url: fragment ? `${fetched.finalUrl}#${fragment}` : fetched.finalUrl,
      level: source.level,
      text,
      retrievedAt: now.toISOString(),
    });
  }
  return { pages, unread };
}

// Follows redirects by hand, so every hop must stay on an approved host
export async function fetchOfficialPage(
  url: string,
  allowedHosts: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Fetched> {
  let current = url;
  // One time limit for the whole page, redirects and body included
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedHost(current, allowedHosts)) {
      return { ok: false, reason: hop === 0 ? "Not an approved official site" : "Redirected to a site that isn’t approved" };
    }

    let response: Response;
    try {
      response = await fetchImpl(current, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
        signal,
      });
    } catch {
      return { ok: false, reason: "Couldn’t reach the site" };
    }

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      const next = location ? URL.parse(location, current) : null;
      if (!next) return { ok: false, reason: "The site sent a broken redirect" };
      current = splitFragment(next.href).page;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { ok: false, reason: `The site answered with error ${response.status}` };
    }
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      return { ok: false, reason: "The link isn’t a web page" };
    }

    try {
      const html = await readCapped(response, MAX_BYTES);
      return html === null ? { ok: false, reason: "The page is too large" } : { ok: true, finalUrl: current, html };
    } catch {
      return { ok: false, reason: "Couldn’t read the page" };
    }
  }
  return { ok: false, reason: "Too many redirects" };
}

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function splitFragment(url: string): { page: string; fragment: string } {
  const hash = url.indexOf("#");
  return hash === -1 ? { page: url, fragment: "" } : { page: url.slice(0, hash), fragment: url.slice(hash + 1) };
}
