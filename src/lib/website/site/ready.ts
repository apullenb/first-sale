import { placeholderCount } from "@/lib/website/words";
import type { PlatformId, WebsiteContent } from "@/lib/website/types";
import { buyLinkProblem, itemFor, type SiteDesign, shows } from "./design";

// Plain rules for whether the site SnapStart builds can be finished (a demo: nothing goes online).
// Blockers stop the finish; notes are shown, not enforced.

export interface PublishCheck {
  platform: PlatformId | null;
  // The owner gave the business a name; the site shows it everywhere
  named: boolean;
  content: WebsiteContent | null;
  approved: boolean;
  design: SiteDesign;
  contact: { email: string | null; phone: string | null };
  // The logo or header picture shown is a practice preview, not made for this business
  practiceBrand: boolean;
  // Item photos shown that are practice previews
  practicePhotos: number;
  // Price or ordering claims that disagree with saved prices or answers
  conflicts: string[];
}

export interface Readiness {
  blockers: string[];
  notes: string[];
}

export function publishReadiness(check: PublishCheck): Readiness {
  const { content, design } = check;
  const blockers: string[] = [];
  const notes: string[] = [];

  if (check.platform !== "first_sale") blockers.push("Choose “SnapStart site” in step 1 to finish it here.");
  if (!check.named) blockers.push("Give your business a name in your answers first.");
  if (!content) {
    blockers.push("Build a draft or add page content in the website editor.");
    return { blockers, notes };
  }
  if (content.platform !== "first_sale") blockers.push("Your words were written for another platform. Rebuild your draft in the website editor.");
  const left = placeholderCount(content);
  if (left) blockers.push(`Fill in or delete ${left} [bracketed] ${left === 1 ? "note" : "notes"} in Page content.`);
  if (!check.approved) blockers.push("Approve your words in Page content.");
  blockers.push(...check.conflicts);
  if (content.flags.length) notes.push(`${content.flags.length} ${content.flags.length === 1 ? "number in your words wasn’t" : "numbers in your words weren’t"} in your answers. Make sure ${content.flags.length === 1 ? "it’s" : "they’re"} right.`);

  const items = shows(design, "offerings") ? content.offerings.map((offering) => ({ offering, item: itemFor(design, offering.name) })) : [];
  for (const { offering, item } of items) {
    const problem = item ? buyLinkProblem(item.buyUrl) : null;
    if (problem) blockers.push(`${offering.name}: ${problem}`);
  }

  const email = design.showEmail && Boolean(check.contact.email);
  const phone = design.showPhone && Boolean(check.contact.phone);
  if (!shows(design, "contact") || (!content.contact.trim() && !email && !phone)) {
    blockers.push("Show a way for customers to reach you: turn on the Contact part, with your words, email or phone.");
  }

  // Fine for a demo; a real site would need its own pictures
  if (check.practiceBrand) {
    notes.push("Your logo or header picture is a practice preview, not made for your business. Replace it before a real launch.");
  }
  if (check.practicePhotos) {
    notes.push(`${check.practicePhotos} item ${check.practicePhotos === 1 ? "photo is a practice preview" : "photos are practice previews"}. Replace ${check.practicePhotos === 1 ? "it" : "them"} before a real launch.`);
  }

  if (items.length && !items.some(({ item }) => item?.buyUrl)) {
    notes.push("No item has a buy link, so customers will contact you to order and pay.");
  }
  if (items.length && items.some(({ item }) => item?.priceCents == null)) {
    notes.push("Some items have no price on the site.");
  }
  return { blockers, notes };
}
