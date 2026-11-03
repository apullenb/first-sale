import { type HTMLElement, parse } from "node-html-parser";

// Enough for one section of an official page; longer pages are cut at a line break
export const MAX_SOURCE_CHARS = 12_000;

// Site banners and footers only: an article's own <header> can hold the heading a link points to
const NOISE =
  "script, style, noscript, template, svg, iframe, nav, form, button, dialog, body > header, body > footer, [role=banner], [role=contentinfo]";
const HEADINGS = "h1, h2, h3, h4, h5, h6";
const HEADING = /^H[1-6]$/;
// Private-use characters that tag heading lines while a section is cut out
const MARK = String.fromCharCode(0xe000);
const TARGET = String.fromCharCode(0xe001);
const MARKERS = new RegExp(`[${MARK}${TARGET}]`, "g");
const TAG = new RegExp(`^[${MARK}${TARGET}](\\d)${MARK}`);

export interface PageText {
  title: string;
  // The page's main heading, or the linked section's
  heading: string;
  // Null when the link's #section isn't on the page
  text: string | null;
}

// Readable text of an official page, or of one section when the link has a #fragment
export function pageText(html: string, fragment = ""): PageText {
  // The markers must be the only private-use characters on the page
  const root = parse(html.replace(MARKERS, ""));
  for (const element of root.querySelectorAll(NOISE)) element.remove();

  const title = clean(root.querySelector("title")?.text ?? "");
  if (fragment) {
    const anchor = root.querySelectorAll("[id]").find((element) => element.id === fragment);
    const heading = clean(anchor ? (HEADING.test(anchor.tagName) ? anchor : (anchor.closest(HEADINGS) ?? headingAfterEmpty(anchor)))?.text ?? "" : "");
    const section = sectionText(root, fragment);
    return { title, heading, text: section === null ? null : truncate(section) };
  }
  const main = root.querySelector("main") ?? root.querySelector("[role=main]") ?? root.querySelector("body") ?? root;
  const heading = clean((main.querySelector("h1") ?? root.querySelector("h1") ?? main.querySelector("h2"))?.text ?? "");
  return { title, heading, text: truncate(blockText(main)) };
}

// From a heading with this id to the next heading at the same level or higher, wherever the markup nests them
function sectionText(root: HTMLElement, id: string): string | null {
  const anchor = root.querySelectorAll("[id]").find((element) => element.id === id);
  if (!anchor) return null;
  const target = HEADING.test(anchor.tagName) ? anchor : (anchor.closest(HEADINGS) ?? headingAfterEmpty(anchor));
  if (!target) return blockText(anchor) || null;

  const level = Number(target.tagName[1]);
  const container = target.closest("main, [role=main]") ?? root.querySelector("body") ?? root;
  for (const heading of container.querySelectorAll(HEADINGS)) {
    heading.insertAdjacentHTML("afterbegin", `${heading === target ? TARGET : MARK}${heading.tagName[1]}${MARK}`);
  }
  const lines = blockText(container).split("\n");
  const start = lines.findIndex((line) => line.startsWith(TARGET) && TAG.test(line));
  if (start === -1) return null;

  const section = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    const tag = line.match(TAG);
    if (tag && Number(tag[1]) <= level) break;
    section.push(line);
  }
  const text = section.map((line) => line.replace(TAG, "")).filter(Boolean);
  // A heading with nothing under it isn't a source
  return text.length > 1 ? text.join("\n") : null;
}

// CMS pages often put an empty <a id> just before the heading it names
function headingAfterEmpty(anchor: HTMLElement): HTMLElement | null {
  const next = anchor.text.trim() ? null : anchor.nextElementSibling;
  return next && HEADING.test(next.tagName) ? next : null;
}

function blockText(element: HTMLElement): string {
  return element.structuredText
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .join("\n");
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  const cut = text.lastIndexOf("\n", MAX_SOURCE_CHARS);
  return text.slice(0, cut > MAX_SOURCE_CHARS / 2 ? cut : MAX_SOURCE_CHARS);
}

const GENERIC = /^(home|index|untitled|page|welcome|default|document|main|details?)$/i;
const STOP = new Set(["about", "your", "with", "from", "this", "that", "what", "when", "where", "which", "have", "will", "page", "official", "website", "site", "home", "gov"]);

// Content words, roughly stemmed, so "names" matches "name"
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP.has(word))
    .map((word) => word.replace(/(ies|es|s|ed|ing)$/, "") || word);
}

// Share of a label's words found in the page's own text
function describes(label: string, body: ReadonlySet<string>): number {
  const own = words(label);
  return own.length ? own.filter((word) => body.has(word)).length / own.length : 0;
}

// The label a source shows: its title, unless the page's heading describes the page better
export function sourceTitle(input: { title: string; heading: string; text: string }): string {
  const title = clean(input.title);
  const heading = clean(input.heading).slice(0, 120);
  if (!heading) return title;
  if (!title || GENERIC.test(title)) return heading;
  const body = new Set(words(input.text.slice(0, 6000)));
  const fit = describes(title, body);
  return fit < 0.5 && describes(heading, body) > fit ? heading : title;
}
