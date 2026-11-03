// Opens a reply in the owner's own email app; SnapStart never sends it

// Some email apps cut longer links off, so a longer reply is copied instead
export const MAX_MAILTO_LENGTH = 1900;
// A plain address, with nothing that could add recipients or headers to the link
const SAFE_EMAIL = /^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;

export function replySubject(subject: string) {
  const base = subject
    .replace(/^\s*((re|fwd?|fw)\s*:\s*)+/i, "")
    .replace(/[\r\n]+/g, " ")
    .trim();
  return `Re: ${base || "Your message"}`.slice(0, 200);
}

const encode = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

// `full`: with the reply text; `short`: subject only, for when the text is copied
export function replyLink(to: string, subject: string, body: string) {
  if (!SAFE_EMAIL.test(to)) return null;
  const base = `mailto:${encode(to).replace("%40", "@")}?subject=${encode(replySubject(subject))}`;
  const full = `${base}&body=${encode(body.replace(/\r?\n/g, "\r\n"))}`;
  return { full: full.length <= MAX_MAILTO_LENGTH ? full : null, short: base };
}
