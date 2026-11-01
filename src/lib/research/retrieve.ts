import type { JurisdictionLevel } from "@/lib/domain";
import { pdfText } from "@/lib/documents/pdf";
import { type Contacts, pageContacts } from "./contacts";
import type { ResearchCategory } from "./coverage";
import { MAX_SOURCE_CHARS, pageText } from "./page-text";
import { isAllowedHost } from "./source-pack";
import type { RetrievedSource } from "./verify";

const MAX_REDIRECTS = 5;
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 20_000;
const USER_AGENT = "SnapStart/0.1 (research for first-time small business owners)";

export interface SourceToRead {
  id: string;
  title: string;
  url: string;
  level: JurisdictionLevel;
  allowedHosts: readonly string[];
  // Owner of the site in the .gov registry
  government: string;
  // Found by search rather than listed in a source pack
  discovered: boolean;
  // What it was read for, for the coverage summary
  categories?: ResearchCategory[];
}

export interface RetrievedPage extends RetrievedSource {
  title: string;
  level: JurisdictionLevel;
  government: string;
  discovered: boolean;
  text: string;
  categories?: ResearchCategory[];
  // Printed on the page, footer included; not saved
  contacts?: Contacts;
}

export interface UnreadSource {
  id: string;
  title: string;
  url: string;
  reason: string;
  level?: JurisdictionLevel;
  categories?: ResearchCategory[];
}

export type Fetched =
  | { ok: true; finalUrl: string; html: string; pdf?: undefined }
  | { ok: true; finalUrl: string; pdf: Uint8Array; html?: undefined }
  | { ok: false; reason: string };

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
      if (!fetches.has(key)) fetches.set(key, fetchOfficialPage(page, source.allowedHosts, fetchImpl, { pdf: true }));
      return { source, fragment, fetched: await fetches.get(key)! };
    }),
  );

  const pages: RetrievedPage[] = [];
  const unread: UnreadSource[] = [];
  for (const { source, fragment, fetched } of results) {
    if (!fetched.ok) {
      unread.push({ id: source.id, title: source.title, url: source.url, reason: fetched.reason, level: source.level, categories: source.categories });
      continue;
    }
    const text = fetched.pdf ? await readPdfSource(fetched.pdf) : pageText(fetched.html, fragment).text;
    if (!text) {
      const reason = text === null ? "The linked section isn’t on the page anymore" : "The page had no readable text";
      unread.push({ id: source.id, title: source.title, url: source.url, reason, level: source.level, categories: source.categories });
      continue;
    }
    pages.push({
      id: source.id,
      title: source.title,
      url: fragment && !fetched.pdf ? `${fetched.finalUrl}#${fragment}` : fetched.finalUrl,
      level: source.level,
      government: source.government,
      discovered: source.discovered,
      text,
      retrievedAt: now.toISOString(),
      categories: source.categories,
      contacts: fetched.html ? pageContacts(fetched.html, fetched.finalUrl) : undefined,
    });
  }
  return { pages, unread };
}

async function readPdfSource(bytes: Uint8Array): Promise<string> {
  try {
    return await pdfText(bytes, MAX_SOURCE_CHARS);
  } catch {
    return "";
  }
}

// Follows redirects by hand, so every hop must stay on an approved host. PDFs only when asked for.
export async function fetchOfficialPage(
  url: string,
  allowedHosts: readonly string[],
  fetchImpl: typeof fetch = fetch,
  options: { pdf?: boolean; html?: boolean; maxBytes?: number } = {},
): Promise<Fetched> {
  const wantHtml = options.html ?? true;
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
        headers: { "User-Agent": USER_AGENT, Accept: options.pdf ? "text/html, application/pdf" : "text/html" },
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
    const type = response.headers.get("content-type") ?? "";
    const isHtml = wantHtml && /text\/html|application\/xhtml\+xml/i.test(type);
    // Some sites send PDFs as generic binary files; the first bytes are checked below
    const isPdf = Boolean(options.pdf) && !isHtml && /application\/(pdf|x-pdf|octet-stream)/i.test(type);
    if (!isHtml && !isPdf) {
      await response.body?.cancel();
      return { ok: false, reason: options.pdf && !wantHtml ? "The link isn’t a PDF form" : "The link isn’t a web page" };
    }

    try {
      const body = await readCapped(response, options.maxBytes ?? MAX_BYTES);
      if (body === null) return { ok: false, reason: isPdf ? "The file is too large" : "The page is too large" };
      if (isPdf) {
        // Checked by its first bytes, not just the header the site sent
        if (new TextDecoder().decode(body.slice(0, 5)) !== "%PDF-") return { ok: false, reason: "The file isn’t a PDF" };
        return { ok: true, finalUrl: current, pdf: body };
      }
      return { ok: true, finalUrl: current, html: new TextDecoder().decode(body) };
    } catch {
      return { ok: false, reason: "Couldn’t read the page" };
    }
  }
  return { ok: false, reason: "Too many redirects" };
}

async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array();
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
  return new Uint8Array(Buffer.concat(chunks));
}

function splitFragment(url: string): { page: string; fragment: string } {
  const hash = url.indexOf("#");
  return hash === -1 ? { page: url, fragment: "" } : { page: url.slice(0, hash), fragment: url.slice(hash + 1) };
}
