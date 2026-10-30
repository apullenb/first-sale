// Email addresses and phone numbers printed on an official page, read by code so none can be made up.
// Footers count: offices often list their contact details only there.

export interface Contact {
  value: string;
  // The official page it was printed on
  url: string;
}

export interface Contacts {
  emails: Contact[];
  phones: Contact[];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const ONE_EMAIL = new RegExp(`^${EMAIL.source}$`);
// US numbers: (940) 555-0100, 940-555-0100, 940.555.0100
const PHONE = /(?<![\d-])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-](\d{4})(?![\d-])/g;
const MAX_EACH = 3;

export function pageContacts(html: string, url: string): Contacts {
  const text = decodeEntities(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " "));
  const linked = (scheme: string) => [...html.matchAll(new RegExp(`href=["']${scheme}:([^"'?]+)`, "gi"))].map((match) => decodeEntities(match[1]));

  const emails = unique([...linked("mailto"), ...(text.match(EMAIL) ?? [])].map((each) => each.trim().toLowerCase()).filter(isEmail));
  const phones = unique([...linked("tel"), ...[...text.replace(/<[^>]+>/g, " ").matchAll(PHONE)].map((match) => match[0])].flatMap((each) => formatPhone(each) ?? []));
  return {
    emails: emails.slice(0, MAX_EACH).map((value) => ({ value, url })),
    phones: phones.slice(0, MAX_EACH).map((value) => ({ value, url })),
  };
}

// One list across an office's pages, first found first
export function mergeContacts(all: readonly Contacts[]): Contacts {
  const pick = (lists: Contact[][]) => {
    const seen = new Set<string>();
    return lists.flat().filter((each) => !seen.has(each.value) && seen.add(each.value)).slice(0, MAX_EACH);
  };
  return { emails: pick(all.map((each) => each.emails)), phones: pick(all.map((each) => each.phones)) };
}

// Image names like logo@2x.png look like addresses
function isEmail(value: string): boolean {
  return ONE_EMAIL.test(value) && !/\.(png|jpe?g|gif|svg|webp)$/i.test(value);
}

function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/%40/g, "@");
}
