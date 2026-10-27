import type { BusinessProfile } from "@/lib/domain";
import { CHANNEL_LABELS, OFFERING_KIND_LABELS } from "@/lib/intake/options";
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

export function writtenInquiry(input: { title: string; questions: readonly string[]; profile: BusinessProfile; place: Place }): Inquiry {
  const { profile, place } = input;
  const what = profile.firstItems.trim() || LIST.format(profile.offeringKinds.map((kind) => OFFERING_KIND_LABELS[kind].toLowerCase()));
  const where = profile.premises ? WHERE[profile.premises] : "";
  const how = LIST.format(profile.channels.map((channel) => CHANNEL_LABELS[channel].toLowerCase()));
  const owners = profile.owners.count > 1 ? ` There are ${profile.owners.count} owners.` : "";
  const questions = (input.questions.length ? input.questions : [`Does “${input.title}” apply to my business, and how do I complete it?`])
    .map((question, index) => `${index + 1}. ${question}`)
    .join("\n");
  return {
    subject: `Question from a new small business: ${input.title}`.slice(0, 120),
    body: [
      "Hello,",
      "",
      `I’m starting a small business in ${placeLabel(place)} and want to make sure I follow the rules. I plan to sell ${what}, ${how}.${where}${owners}`,
      "",
      `My question is about “${input.title}”:`,
      questions,
      "",
      "Could you reply in writing, or point me to the official page or form that covers this?",
      "",
      "Thank you,",
      "[Your name]",
    ].join("\n"),
  };
}
