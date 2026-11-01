// Plain code: where the owner stands on a business email address and phone number

export const CONTACT_ITEMS = ["email", "phone"] as const;
export type ContactItem = (typeof CONTACT_ITEMS)[number];

// "help": show me how; "later": put it in my plan. Both leave a step to finish.
export const CONTACT_CHOICES = ["help", "later"] as const;
export type ContactChoice = (typeof CONTACT_CHOICES)[number];

export const CONTACT_HREF = "/contact";
export const CONTACT_STEP_TITLE = "Set up a business email and phone";

// Journey mark keys: the owner put an item off, or has one without typing it here
export const contactLaterKey = (item: ContactItem) => `contact:${item}:later`;
export const contactHaveKey = (item: ContactItem) => `contact:${item}:have`;

export const CONTACT_DETAIL: Record<ContactItem, "business_email" | "business_phone"> = { email: "business_email", phone: "business_phone" };

export type ItemState = "done" | "todo" | "open";

export interface ContactStatus {
  // Shown once: after intake, or on Today for owners who finished intake before this was asked
  asked: boolean;
  items: Record<ContactItem, ItemState>;
  // In the plan once the owner put something off or asked for help; stays, as done, once finished
  step: "none" | "todo" | "done";
}

export function contactStatus(detailKeys: Iterable<string>, marks: Iterable<string>): ContactStatus {
  const details = new Set(detailKeys);
  const marked = new Set(marks);
  const items = Object.fromEntries(
    CONTACT_ITEMS.map((item): [ContactItem, ItemState] => [
      item,
      details.has(CONTACT_DETAIL[item]) || marked.has(contactHaveKey(item)) ? "done" : marked.has(contactLaterKey(item)) ? "todo" : "open",
    ]),
  ) as Record<ContactItem, ItemState>;
  const deferred = CONTACT_ITEMS.some((item) => marked.has(contactLaterKey(item)));
  const finished = CONTACT_ITEMS.every((item) => items[item] === "done");
  return {
    // Answered once each item has a choice
    asked: CONTACT_ITEMS.every((item) => items[item] !== "open"),
    items,
    step: !deferred ? "none" : finished ? "done" : "todo",
  };
}

// A US phone number: ten digits, or eleven starting with 1, with any punctuation and an optional extension
export function isUsPhone(text: string): boolean {
  const main = text.replace(/\s*(?:x|ext\.?|extension)\s*\d{1,6}\s*$/i, "");
  if (!/^[\d\s().+-]+$/.test(main)) return false;
  const digits = main.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function isEmailAddress(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(text.trim());
}
