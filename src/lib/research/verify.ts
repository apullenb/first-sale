import type { JurisdictionLevel, RequirementDraft, VerificationState } from "@/lib/domain";
import { isAllowedHost } from "./source-pack";

export interface RetrievedSource {
  id: string;
  url: string;
  retrievedAt: string;
}

export type Verified<T> = T & { verification: VerificationState; problems: string[] };

// A claim counts as sourced only if every source it cites was actually retrieved from an allowed host.
export function verifyCitations<T extends { sourceIds: readonly string[] }>(
  claims: readonly T[],
  retrieved: readonly RetrievedSource[],
  allowedHosts: readonly string[],
): Verified<T>[] {
  const byId = new Map(retrieved.map((source) => [source.id, source]));

  return claims.map((claim) => {
    const problems: string[] = [];
    if (claim.sourceIds.length === 0) problems.push("No source cited");

    for (const id of claim.sourceIds) {
      const source = byId.get(id);
      if (!source) {
        problems.push(`Cited source "${id}" was not retrieved`);
      } else if (!isAllowedHost(source.url, allowedHosts)) {
        problems.push(`Source "${id}" is not on an approved official site`);
      }
    }

    return {
      ...claim,
      verification: problems.length === 0 ? "sourced" : "needs_verification",
      problems,
    };
  });
}

export interface ReadPage extends RetrievedSource {
  level: JurisdictionLevel;
  text: string;
}

// confirmedBy: the page the quote was found on, when it's sourced
export type VerifiedRequirement = Verified<RequirementDraft> & { confirmedBy?: string[] };

// verifyCitations, then: the quote must be on a cited page, any fee or deadline inside that quote,
// and a state or local requirement needs a page from that level, not just general federal guidance.
export function verifyRequirements(
  drafts: readonly RequirementDraft[],
  pages: readonly ReadPage[],
  allowedHosts: readonly string[],
): VerifiedRequirement[] {
  const byId = new Map(pages.map((page) => [page.id, page]));

  return verifyCitations(drafts, pages, allowedHosts).map((claim) => {
    const problems = [...claim.problems];
    const cited = claim.sourceIds.flatMap((id) => byId.get(id) ?? []);
    // The quote must come from a page of the same government as the requirement
    let quoted: Quoted | null = null;
    let quotedFrom: string | null = null;
    for (const page of cited.filter((each) => each.level === claim.level)) {
      quoted = claim.evidence ? findQuote([normalize(page.text)], claim.evidence) : null;
      if (quoted) {
        quotedFrom = page.id;
        break;
      }
    }

    if (cited.length > 0) {
      if (!cited.some((page) => page.level === claim.level)) {
        problems.push(`Only ${cited[0].level} pages were cited for a ${claim.level} requirement`);
      } else if (!quoted) {
        problems.push("Quote not found on the cited pages");
      }
    }

    let feeUsd = claim.feeUsd;
    if (feeUsd !== null && !(quoted && mentionsFee(quoted, feeUsd))) {
      if (quoted) problems.push("Fee not found in the quote");
      feeUsd = null;
    }
    let deadline = claim.deadline?.trim() || null;
    if (deadline !== null && !(quoted && containsPhrase(quoted, normalize(deadline)))) {
      if (quoted) problems.push("Deadline not found in the quote");
      deadline = null;
    }

    const sourced = problems.length === 0;
    return {
      ...claim,
      feeUsd,
      deadline,
      verification: sourced ? "sourced" : "needs_verification",
      problems,
      confirmedBy: sourced && quotedFrom ? [quotedFrom] : [],
    };
  });
}

// "..." may join up to three pieces, each long enough to mean something, close together on the page
const MIN_PIECE = 20;
const MAX_PIECES = 3;
const MAX_GAP = 200;

// A cited page's normalized text, and the stretches of it the quote shows
interface Quoted {
  text: string;
  spans: [start: number, end: number][];
}

function findQuote(texts: readonly string[], quote: string): Quoted | null {
  // Leading or trailing "..." only says the sentence goes on
  const whole = normalize(quote).replace(/^(?:\.\.\.\s*)+|(?:\s*\.\.\.)+$/g, "");
  if (whole.length < MIN_PIECE) return null;
  // Whole first: some pages have "..." of their own
  for (const text of texts) {
    const at = wholeIndex(text, whole);
    if (at !== -1) return { text, spans: [[at, at + whole.length]] };
  }

  const pieces = whole
    .split("...")
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (pieces.length < 2 || pieces.length > MAX_PIECES || pieces.some((piece) => piece.length < MIN_PIECE)) return null;
  for (const text of texts) {
    for (let first = wholeIndex(text, pieces[0]); first !== -1; first = wholeIndex(text, pieces[0], first + 1)) {
      const spans: Quoted["spans"] = [[first, first + pieces[0].length]];
      const fits = pieces.slice(1).every((piece) => {
        const after = spans.at(-1)![1];
        const at = wholeIndex(text, piece, after);
        if (at === -1 || at - after > MAX_GAP) return false;
        spans.push([at, at + piece.length]);
        return true;
      });
      if (fits) return { text, spans };
    }
  }
  return null;
}

// First match at or after `from` that doesn't cut into a word or number, so "$99" never matches "$990"
function wholeIndex(text: string, phrase: string, from = 0): number {
  const word = /[a-z0-9]/;
  for (let at = text.indexOf(phrase, from); at !== -1; at = text.indexOf(phrase, at + 1)) {
    const end = at + phrase.length;
    const cutBefore = word.test(phrase[0]) && word.test(text[at - 1] ?? "");
    const cutAfter =
      word.test(phrase.at(-1)!) &&
      (word.test(text[end] ?? "") || (/\d/.test(phrase.at(-1)!) && /[.,]/.test(text[end] ?? "") && /\d/.test(text[end + 1] ?? "")));
    if (!cutBefore && !cutAfter) return at;
  }
  return -1;
}

// A match inside one shown stretch; text the "..." skips doesn't count
function inQuote(quoted: Quoted, pattern: RegExp): boolean {
  const regex = new RegExp(pattern.source, "g");
  return quoted.spans.some(([start, end]) => {
    regex.lastIndex = start;
    for (let match = regex.exec(quoted.text); match && match.index < end; match = regex.exec(quoted.text)) {
      if (match.index + match[0].length <= end) return true;
    }
    return false;
  });
}

// Amount not followed by more digits, so $99 doesn't match $990, $9.90 or $99,000
const AMOUNT_END = String.raw`(?!\d|,\d|\.\d)`;
// "Free" about cost, not "free counseling" or "toll-free"
const NO_COST = String.raw`\b(?:is|are|it's|for|always|completely) free\b|\bfree (?:of charge|to (?:apply|file|register|get|use))\b|\bno (?:fee|cost|charge)\b|\bwithout (?:a )?(?:fee|cost|charge)\b`;

function mentionsFee(quoted: Quoted, feeUsd: number): boolean {
  if (feeUsd === 0) {
    return inQuote(quoted, new RegExp(String.raw`${NO_COST}|\$0(?:\.00)?${AMOUNT_END}`));
  }
  const forms = new Set([
    feeUsd.toFixed(2),
    feeUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ]);
  if (Number.isInteger(feeUsd)) forms.add(String(feeUsd)).add(feeUsd.toLocaleString("en-US"));
  return [...forms].some((form) =>
    inQuote(quoted, new RegExp(String.raw`\$\s?${form.replace(/[.,]/g, "\\$&")}${AMOUNT_END}`)),
  );
}

// Whole words inside one shown stretch, so "30 days" doesn't match "130 days"
function containsPhrase(quoted: Quoted, phrase: string): boolean {
  if (phrase.length < 4) return false;
  return quoted.spans.some(([start, end]) => {
    const at = wholeIndex(quoted.text, phrase, start);
    return at !== -1 && at + phrase.length <= end;
  });
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Page number where an excerpt appears word for word (ignoring case, spacing and curly quotes), or null
export function pageWithExcerpt(pages: readonly { number: number; text: string }[], excerpt: string): number | null {
  const want = normalize(excerpt).replace(/^(?:\.\.\.\s*)+|(?:\s*\.\.\.)+$/g, "");
  if (want.length < 8) return null;
  for (const page of pages) {
    if (wholeIndex(normalize(page.text), want) !== -1) return page.number;
  }
  return null;
}
