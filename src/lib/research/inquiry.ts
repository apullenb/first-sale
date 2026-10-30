import type { BusinessProfile } from "@/lib/domain";
import { type Place, placeLabel } from "./applicability";

// A written question the owner can send through an office's contact page or email, instead of calling.
// Plain code from saved answers: no address, no ID numbers, and the owner signs it themselves.

export interface Inquiry {
  subject: string;
  body: string;
}

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

const WHERE: Record<NonNullable<BusinessProfile["premises"]>, string> = {
  home: " I work from home.",
  rented_space: " I work from a space I rent.",
  shared_kitchen: " I work from a shared kitchen or studio.",
  online_only: "",
  unsure: "",
};

// In the owner's own voice, as in "I plan to sell home goods in person and on my own website"
const WHAT: Record<BusinessProfile["offeringKinds"][number], string> = {
  food: "food I make",
  handmade: "handmade goods",
  resale: "goods I buy to resell",
  services: "services",
  other: "other goods or services",
};

const HOW: Record<BusinessProfile["channels"][number], string> = {
  in_person: "in person",
  markets: "at markets and events",
  storefront: "from a storefront",
  own_website: "on my own website",
  marketplace: "on marketplaces like Etsy",
  social_media: "through social media",
  wholesale: "to shops (wholesale)",
};

// "Home goods" reads "home goods" mid-sentence; "DVDs" and "iPhone cases" stay as typed
function midSentence(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

// title: the step asked about; left out for a free-standing question
export function writtenInquiry(input: { title?: string; questions: readonly string[]; profile: BusinessProfile; place: Place }): Inquiry {
  const { profile, place, title } = input;
  const what = midSentence(profile.firstItems.trim()) || LIST.format(profile.offeringKinds.map((kind) => WHAT[kind])) || "goods or services";
  const where = profile.premises ? WHERE[profile.premises] : "";
  const how = profile.channels.length ? ` ${LIST.format(profile.channels.map((channel) => HOW[channel]))}` : "";
  const owners = profile.owners.count > 1 ? ` There are ${profile.owners.count} owners.` : "";
  const asked = input.questions.length ? input.questions : [`Does “${title ?? "this requirement"}” apply to my business, and how do I complete it?`];
  const questions = asked.length === 1 ? asked[0] : asked.map((question, index) => `${index + 1}. ${question}`).join("\n");
  const intro = title ? `My ${asked.length === 1 ? "question is" : "questions are"} about “${title}”:` : null;
  return {
    subject: (title ? `Question from a new small business: ${title}` : `Question from a new small business in ${placeLabel(place)}`).slice(0, 120),
    body: [
      "Hello,",
      "",
      `I’m starting a small business in ${placeLabel(place)} and want to make sure I follow the rules. I plan to sell ${what}${how}.${where}${owners}`,
      "",
      ...(intro ? [intro] : []),
      questions,
      "",
      "Could you reply in writing, or point me to the official page or form that covers this?",
      "",
      "Thank you,",
      "[Your name]",
    ].join("\n"),
  };
}

// For a "find out" step: the condition the owner wasn't sure about is asked first, then the office's own follow-ups
export function findOutInquiry(input: { title: string; condition: string; questions: readonly string[]; profile: BusinessProfile; place: Place }): Inquiry {
  const asked = `Does this apply to my business? I understand it depends on this: ${input.condition.trim()}`;
  return writtenInquiry({ ...input, questions: [asked, ...input.questions] });
}

// The owner doesn't know a fact about their own place yet: ask that first, then whether the rule applies
export function placeInquiry(input: { title: string; question: string; profile: BusinessProfile; place: Place }): Inquiry {
  return writtenInquiry({ ...input, questions: [input.question, `If so, does “${input.title}” apply to my business?`] });
}
