// Finds and removes numbers SnapStart never keeps: Social Security and ITIN numbers, EINs, payment cards, bank routing
// and account numbers, and ID document numbers. Decided in code with each number's own validity rules, never by a model.
// Findings carry the kind and place only, never the number, so they're safe to log and store.

export const SENSITIVE_KINDS = ["ssn", "itin", "ein", "card", "routing", "account", "id_document"] as const;
export type SensitiveKind = (typeof SENSITIVE_KINDS)[number];
export type SensitiveCounts = Partial<Record<SensitiveKind, number>>;

export interface Finding {
  kind: SensitiveKind;
  start: number;
  end: number;
}

// What replaces each number; no digits, quotes or backslashes, so redacting twice changes nothing and JSON stays valid
export const REDACTED: Record<SensitiveKind, string> = {
  ssn: "[Social Security number removed]",
  itin: "[ITIN removed]",
  ein: "[tax ID number removed]",
  card: "[card number removed]",
  routing: "[routing number removed]",
  account: "[account number removed]",
  id_document: "[ID number removed]",
};

export const KIND_NAMES: Record<SensitiveKind, [string, string]> = {
  ssn: ["Social Security number", "Social Security numbers"],
  itin: ["ITIN", "ITINs"],
  ein: ["tax ID number", "tax ID numbers"],
  card: ["card number", "card numbers"],
  routing: ["bank routing number", "bank routing numbers"],
  account: ["account number", "account numbers"],
  id_document: ["ID number", "ID numbers"],
};

const SEP = "[-‐-―.\\s]";
const DIGIT_RUN = /(?<![\w-])\d(?:[ -]?\d){8,18}(?![\w-])/g;

// SSA: area never 000, 666 or 9xx; group never 00; serial never 0000. ITINs start with 9 and use their own groups.
function ssnOrItin(area: string, group: string, serial: string): "ssn" | "itin" | null {
  if (group === "00" || serial === "0000") return null;
  const a = Number(area);
  const g = Number(group);
  if (a >= 900) return (g >= 50 && g <= 65) || (g >= 70 && g <= 88) || (g >= 90 && g <= 92) || (g >= 94 && g <= 99) ? "itin" : null;
  return a === 0 || a === 666 ? null : "ssn";
}

// Prefixes the IRS has never assigned to an EIN
const NO_EIN_PREFIX = new Set(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"]);

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

// Visa, Mastercard, American Express and Discover number ranges, at their lengths
function cardIssuer(digits: string): boolean {
  const n = digits.length;
  const two = Number(digits.slice(0, 2));
  const four = Number(digits.slice(0, 4));
  if (digits[0] === "4") return n === 13 || n === 16 || n === 19;
  if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return n === 16;
  if (two === 34 || two === 37) return n === 15;
  if (four === 6011 || two === 65 || (Number(digits.slice(0, 3)) >= 644 && Number(digits.slice(0, 3)) <= 649)) return n >= 16 && n <= 19;
  return false;
}

// ABA checksum, and the Federal Reserve's first-two-digit ranges
export function routingNumber(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const prefix = Number(digits.slice(0, 2));
  if (!((prefix <= 12) || (prefix >= 21 && prefix <= 32) || (prefix >= 61 && prefix <= 72) || prefix === 80)) return false;
  const d = [...digits].map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

// A label just before a number says what it is, even when it isn't written in its usual format
const LABELS: { kind: SensitiveKind; pattern: RegExp }[] = [
  { kind: "itin", pattern: /\bITIN\b/i },
  { kind: "ssn", pattern: /\b(SSN|SS#|soc(ial)?\.?\s*sec(urity)?\.?(\s*(no|number|#))?)\b|\bTIN\b|taxpayer identification/i },
  { kind: "ein", pattern: /\b(EIN|FEIN)\b|employer identification|federal tax (id|identification)|tax\s*id\b|taxpayer (number|no\.?)/i },
  { kind: "routing", pattern: /\b(routing|ABA|RTN)\b/i },
  { kind: "account", pattern: /\b(account|acct\.?|a\/c)\s*(number|no\.?|num\.?|#)?\s*$/i },
  { kind: "id_document", pattern: /\b(driver'?s?|driving)\s*licen[cs]e|\bDL\s*(#|no\.?|number)|\bpassport\b|state id\b/i },
];

function labelBefore(text: string, start: number): SensitiveKind | null {
  const before = text.slice(Math.max(0, start - 40), start).replace(/[:#\s.]+$/, " ");
  // The label nearest the number wins
  let best: { kind: SensitiveKind; at: number } | null = null;
  for (const { kind, pattern } of LABELS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    for (const match of before.matchAll(new RegExp(pattern.source, flags))) {
      if (!best || match.index > best.at) best = { kind, at: match.index };
    }
  }
  return best?.kind ?? null;
}

export function findSensitive(text: string): Finding[] {
  const found: Finding[] = [];
  const add = (kind: SensitiveKind, start: number, end: number) => {
    if (!found.some((each) => start < each.end && end > each.start)) found.push({ kind, start, end });
  };

  // Formatted SSNs and ITINs: 3-2-4, with the same separator both times
  for (const match of text.matchAll(new RegExp(`(?<![\\w-])(\\d{3})(${SEP})(\\d{2})\\2(\\d{4})(?![\\w-])`, "g"))) {
    const kind = ssnOrItin(match[1], match[3], match[4]);
    if (kind) add(kind, match.index, match.index + match[0].length);
  }
  // Formatted EINs: 2-7
  for (const match of text.matchAll(/(?<![\w-])(\d{2})[-‐-―](\d{7})(?![\w-])/g)) {
    if (!NO_EIN_PREFIX.has(match[1])) add("ein", match.index, match.index + match[0].length);
  }
  // Card numbers: 13 to 19 digits, spaced or not, passing Luhn and an issuer's range
  for (const match of text.matchAll(DIGIT_RUN)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 13 && cardIssuer(digits) && luhn(digits)) add("card", match.index, match.index + match[0].length);
  }
  // Labeled numbers in any format: a bare 9-digit SSN, a routing or account number, a license or passport number
  for (const match of text.matchAll(/(?<![\w-])[A-Z]{0,2}\d(?:[ -]?[\dA-Z]){3,16}(?![\w-])/gi)) {
    const kind = labelBefore(text, match.index);
    if (!kind) continue;
    const digits = match[0].replace(/[^\d]/g, "");
    const letters = /[a-z]/i.test(match[0]);
    const end = match.index + match[0].length;
    // A label never excuses a number its own rules say was never issued, such as 000-00-0000 on a blank form
    if ((kind === "ssn" || kind === "itin") && !letters && digits.length === 9) {
      const real = ssnOrItin(digits.slice(0, 3), digits.slice(3, 5), digits.slice(5));
      if (real) add(real, match.index, end);
    } else if (kind === "ein" && !letters && digits.length === 9) {
      if (!NO_EIN_PREFIX.has(digits.slice(0, 2))) add("ein", match.index, end);
    }
    else if (kind === "routing" && !letters && routingNumber(digits)) add("routing", match.index, end);
    else if (kind === "account" && !letters && digits.length >= 6 && digits.length <= 17) add("account", match.index, end);
    else if (kind === "id_document" && digits.length >= 4) add("id_document", match.index, end);
  }
  return found.sort((a, b) => a.start - b.start);
}

export function redactSensitive(text: string, kinds: readonly SensitiveKind[] = SENSITIVE_KINDS): { text: string; counts: SensitiveCounts } {
  const findings = findSensitive(text).filter((each) => kinds.includes(each.kind));
  if (!findings.length) return { text, counts: {} };
  const counts: SensitiveCounts = {};
  let out = "";
  let at = 0;
  for (const finding of findings) {
    out += text.slice(at, finding.start) + REDACTED[finding.kind];
    at = finding.end;
    counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  }
  return { text: out + text.slice(at), counts };
}

export function addCounts(a: SensitiveCounts, b: SensitiveCounts): SensitiveCounts {
  const sum: SensitiveCounts = { ...a };
  for (const kind of SENSITIVE_KINDS) if (b[kind]) sum[kind] = (sum[kind] ?? 0) + b[kind]!;
  return sum;
}

export const countOf = (counts: SensitiveCounts | null | undefined) => SENSITIVE_KINDS.reduce((sum, kind) => sum + (counts?.[kind] ?? 0), 0);

// "2 Social Security numbers and 1 card number"
export function describeCounts(counts: SensitiveCounts): string {
  const parts = SENSITIVE_KINDS.filter((kind) => counts[kind]).map((kind) => `${counts[kind]} ${KIND_NAMES[kind][counts[kind] === 1 ? 0 : 1]}`);
  return new Intl.ListFormat("en-US", { type: "conjunction" }).format(parts);
}
