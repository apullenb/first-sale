// Finds the customer's own email inside one the owner forwarded, from the forward block each mail app writes

export interface Person {
  name: string;
  email: string;
}
export interface ParsedEmail {
  // The customer
  from: Person | null;
  subject: string;
  date: Date | null;
  body: string;
  // Who forwarded it, when it was forwarded by hand
  forwardedBy: Person | null;
  // What the forwarder wrote above the forwarded part
  note: string;
}

const EMAIL = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// "Sam Lee <sam@x.com>", "\"Lee, Sam\" <sam@x.com>", "Sam Lee [mailto:sam@x.com]", "sam@x.com"
export function parsePerson(raw: string): Person | null {
  const text = raw.replace(/\s+/g, " ").trim();
  const email = text.match(EMAIL)?.[0];
  if (!email) return null;
  const name = text
    .replace(/<[^>]*>|\[mailto:[^\]]*\]|\(mailto:[^)]*\)/gi, "")
    .replace(email, "")
    .replace(/["'*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { name: name.slice(0, 200), email: email.toLowerCase() };
}

// Gmail, Yahoo, Apple Mail and Outlook's separator lines
const MARKERS = [
  /^-{2,}\s*Forwarded message\s*-{2,}\s*$/i,
  /^-{2,}\s*Forwarded Message\s*-{2,}\s*$/i,
  /^Begin forwarded message:\s*$/i,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/i,
  /^_{8,}\s*$/,
];
const HEADER = /^\s*\*?\s*(From|Sent|Date|To|Cc|Subject|Reply-To)\s*:\s*\*?\s*(.*)$/i;

function headerBlock(lines: string[], start: number) {
  const fields: Record<string, string> = {};
  let index = start;
  // Skip blank lines between the separator and the headers
  while (index < lines.length && !lines[index].trim()) index++;
  let last = "";
  for (; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) break;
    const match = line.match(HEADER);
    if (match) {
      last = match[1].toLowerCase();
      fields[last] ??= match[2].trim();
    } else if (last && /^\s/.test(line)) {
      // Long headers wrap onto an indented next line
      fields[last] += ` ${line.trim()}`;
    } else break;
  }
  return { fields, end: index };
}

// Outlook writes "Monday, November 2, 2026 9:14 AM"; Gmail "Mon, Nov 2, 2026 at 9:14 AM"
export function parseLooseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s+at\s+/i, " ")
    .replace(/,(\s*\d{1,2}:\d{2})/, "$1")
    .replace(/\b([ECMP])[SD]T\b/, (zone) => ({ EST: "-0500", EDT: "-0400", CST: "-0600", CDT: "-0500", MST: "-0700", MDT: "-0600", PST: "-0800", PDT: "-0700" })[zone] ?? zone)
    .trim();
  const time = Date.parse(cleaned);
  return Number.isNaN(time) ? null : new Date(time);
}

const quoted = (line: string) => line.replace(/^>\s?/, "");

export function parseIncoming(input: {
  from: Person | null;
  subject: string;
  date: Date | null;
  text: string;
}): ParsedEmail {
  const lines = input.text.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = quoted(lines[index]).trim();
    const marked = MARKERS.some((marker) => marker.test(line));
    // Some apps drop the separator and start straight at "From:"
    const bare =
      !marked &&
      /^fwd?:/i.test(input.subject.trim()) &&
      /^\*?From\s*:/i.test(line);
    if (!marked && !bare) continue;
    const plain = lines.map(quoted);
    const { fields, end } = headerBlock(plain, marked ? index + 1 : index);
    const customer = fields.from ? parsePerson(fields.from) : null;
    if (!customer || !fields.subject && !fields.date && !fields.sent) continue;
    return {
      from: customer,
      subject: (fields.subject ?? input.subject.replace(/^(fwd?|fw)\s*:\s*/i, "")).slice(0, 1000),
      date: parseLooseDate(fields.date ?? fields.sent),
      body: plain.slice(end).join("\n").trim().slice(0, 30_000),
      forwardedBy: input.from,
      note: lines.slice(0, index).join("\n").trim().slice(0, 5_000),
    };
  }
  // Forwarded automatically: the sender is the customer
  return {
    from: input.from,
    subject: input.subject.slice(0, 1000),
    date: input.date,
    body: input.text.trim().slice(0, 30_000),
    forwardedBy: null,
    note: "",
  };
}

// Groups replies in one conversation: same customer, same subject without Re:/Fwd:
export function threadKey(email: string, subject: string) {
  const base = subject
    .replace(/^\s*((re|fwd?|fw|aw|wg)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return `${email.toLowerCase()}:${base}`.slice(0, 500);
}
