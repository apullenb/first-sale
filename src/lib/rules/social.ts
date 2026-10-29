import { type MarketingPlatformId, PLATFORM_DATA } from "@/data/marketing-platforms";
import type { BioRule, HandleRule, SocialProfileFacts } from "@/data/social-profiles";
import type { SkillLevel, StoredIntake } from "@/lib/marketing/intake";
import type { HandHolding, MarketingPlanReply, PlatformRole } from "@/lib/marketing/types";
import { MAX_FIELD } from "@/lib/social/types";
import { handHolding } from "./marketing";

// Plain code: which accounts to set up and in what order, suggested handles, and whether names, handles and bios fit each platform.

export interface SocialAccount {
  id: MarketingPlatformId;
  // The owner had it before First Sale, from their marketing answers
  have: boolean;
  // From the plan, when it has this platform
  role: PlatformRole | null;
  why: string;
  cadence: string;
  help: HandHolding;
}

const ROLE_ORDER: Record<PlatformRole, number> = { main: 0, support: 1, later: 2, suggested: 3 };

// Every account the owner included, the plan's lead first, with the plan's reasons when it has them
export function socialAccounts(intake: Pick<StoredIntake, "include" | "have" | "exclude" | "social" | "seo" | "content">, plan: Pick<MarketingPlanReply, "platforms"> | null): SocialAccount[] {
  const accounts = intake.include
    .filter((id) => !intake.exclude.includes(id))
    .map((id, index) => {
      const entry = plan?.platforms.find((each) => each.platform === id) ?? null;
      return {
        index,
        account: {
          id,
          have: intake.have.includes(id),
          role: entry?.role ?? null,
          why: entry?.why || `You picked this in your marketing answers. ${PLATFORM_DATA[id].goodFor}`,
          cadence: entry?.cadence ?? "",
          help: handHolding(PLATFORM_DATA[id].area, intake),
        },
      };
    });
  const rank = (role: PlatformRole | null) => (role ? ROLE_ORDER[role] : 4);
  return accounts.sort((a, b) => rank(a.account.role) - rank(b.account.role) || a.index - b.index).map((each) => each.account);
}

// Accounts picked on the social page, when the owner hasn't answered the marketing questions yet.
// Other answers stay as they were; an account picked here is no longer ruled out.
export function withPickedAccounts(stored: StoredIntake | null, include: readonly MarketingPlatformId[], social: SkillLevel | null): StoredIntake {
  const base: StoredIntake = stored ?? { include: [], have: [], exclude: [], social: null, seo: null, content: null, done: [], doneNote: "" };
  const unique = [...new Set(include)];
  return {
    ...base,
    include: unique,
    have: base.have.filter((id) => unique.includes(id)),
    exclude: base.exclude.filter((id) => !unique.includes(id)),
    social: social ?? base.social,
  };
}

// Counted in code points, as people see them
export function charCount(text: string): number {
  return [...text].length;
}

const LEGAL = new Set(["llc", "inc", "ltd", "corp", "pllc", "llp", "lp"]);

// Lowercase plain words from a business name, without accents, apostrophes or legal endings like LLC
export function nameWords(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !LEGAL.has(word));
}

const WEB_ENDING = /\.(com|net|org|biz|info|co|us|io|shop|store|app)$/i;

// What's wrong with a handle for this platform; empty when it fits
export function checkHandle(handle: string, rule: HandleRule): string[] {
  const problems: string[] = [];
  if (!handle) return [`Add a ${rule.label.toLowerCase()}.`];
  const bad = [...handle].filter((char) => !/[a-z0-9]/i.test(char) && !rule.extra.includes(char));
  if (bad.length) problems.push(`${rule.label}s can’t use ${[...new Set(bad)].map((char) => (char === " " ? "spaces" : `“${char}”`)).join(", ")}.`);
  const length = charCount(handle);
  if (rule.min !== null && length < rule.min) problems.push(`Use at least ${rule.min} characters.`);
  if (rule.max !== null && length > rule.max) problems.push(`Use ${rule.max} characters or fewer. This one has ${length}.`);
  const first = handle[0];
  const last = handle[handle.length - 1];
  if (rule.notAtEdges && (rule.notAtEdges.includes(first) || rule.notAtEdges.includes(last))) problems.push("Don’t start or end it with a symbol.");
  else if (rule.notAtEnd.includes(last)) problems.push(`Don’t end it with “${last}”.`);
  if (rule.notAllNumbers && /^\d+$/.test(handle)) problems.push("Use at least one letter.");
  if (rule.noWebAddress && WEB_ENDING.test(handle)) problems.push("Don’t end it like a web address.");
  return problems;
}

// Joins whole words until the next one won't fit
function fitWords(words: string[], separator: string, max: number | null): string {
  if (max === null) return words.join(separator);
  let out = "";
  for (const word of words) {
    const next = out ? `${out}${separator}${word}` : word;
    if (next.length > max) break;
    out = next;
  }
  return out || words[0].slice(0, max);
}

// Up to three handles from the business name, each within the platform's rules. Whether one is free is for the platform to say.
export function suggestHandles(name: string | null, city: string | null, rule: HandleRule): string[] {
  const words = nameWords(name ?? "");
  if (!words.length) return [];
  const place = nameWords(city ?? "").join("");
  const separator = [".", "_"].find((char) => rule.extra.includes(char) && !rule.notAtEdges.includes(char) && !rule.notAtEnd.includes(char)) ?? null;
  // The town goes on whole, so the name is cut to make room
  const room = rule.max === null ? null : rule.max - place.length;
  const withPlace = place && (room === null || room >= 3) ? `${fitWords(words, "", room)}${place}` : "";
  const candidates = [
    fitWords(words, "", rule.max),
    withPlace,
    separator && words.length > 1 ? fitWords(words, separator, rule.max) : "",
  ].map((handle) => (rule.min !== null && handle.length < rule.min ? withPlace : handle));
  return [...new Set(candidates)].filter((handle) => handle && checkHandle(handle, rule).length === 0);
}

// What's wrong with an account name; empty when it fits
export function checkName(name: string, facts: SocialProfileFacts): string[] {
  if (!name.trim()) return [`Add a ${facts.name.label.toLowerCase()}.`];
  const length = charCount(name);
  if (facts.name.max !== null && length > facts.name.max) return [`Use ${facts.name.max} characters or fewer. This one has ${length}.`];
  if (length > MAX_FIELD.name) return [`Use ${MAX_FIELD.name} characters or fewer.`];
  return [];
}

// The suggested name: the business name, cut at a word if the platform's limit is shorter
export function suggestName(name: string | null, facts: SocialProfileFacts): string {
  const full = (name ?? "").trim();
  const max = facts.name.max ?? MAX_FIELD.name;
  if (charCount(full) <= max) return full;
  return fitText(full, max);
}

export const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|net|org|biz|info|co|us|io|shop|store|app)\b(?:\/\S*)?/i;
export const EMAIL = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;
export const PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

// What stops a bio being approved for this platform; empty when it fits
export function checkBio(bio: string, rule: BioRule, platformName: string): string[] {
  const problems: string[] = [];
  const length = charCount(bio);
  if (!bio.trim()) return [`Write a ${rule.label.toLowerCase()} first.`];
  if (rule.max !== null && length > rule.max) problems.push(`${platformName} allows ${rule.max} characters. This has ${length}.`);
  else if (length > MAX_FIELD.bio) problems.push(`Keep it to ${MAX_FIELD.bio} characters or fewer.`);
  if (rule.noLinks && (LINK.test(bio) || EMAIL.test(bio))) problems.push(`${platformName} doesn’t allow links here.`);
  if (rule.noContact && (PHONE.test(bio) || EMAIL.test(bio))) problems.push(`${platformName} doesn’t allow contact details here; they go in their own fields.`);
  return problems;
}

// Whole sentences that fit, or whole words when even the first sentence is too long
export function fitText(text: string, limit: number): string {
  if (charCount(text) <= limit) return text;
  let out = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (charCount(next) > limit) break;
    out = next;
  }
  if (out) return out;
  const words = text.split(/\s+/);
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (charCount(next) > limit) break;
    out = next;
  }
  return (out || [...text].slice(0, limit).join("")).replace(/[,;:\s–—-]+$/, "");
}

// The longest a drafted bio may be: the platform's limit, or First Sale's own when it publishes none
export function bioLimit(rule: BioRule): number {
  return rule.max === null ? rule.target : Math.min(rule.max, rule.target);
}

// Set up: marked here, or one the owner said they already have in their marketing answers
export function isSetUp(account: Pick<SocialAccount, "id" | "have">, marks: ReadonlySet<string>): boolean {
  return account.have || marks.has(`social:${account.id}`);
}

export function setUpCount(accounts: readonly SocialAccount[], marks: ReadonlySet<string>): number {
  return accounts.filter((account) => isSetUp(account, marks)).length;
}
