import type { WebsiteCopy } from "./types";

// Plain helpers over the site's words, safe for the browser too

// Every piece of text on the site, for checks and counts
export function copyTexts(copy: WebsiteCopy): string[] {
  return [
    copy.headline,
    copy.subheadline,
    copy.intro,
    copy.about,
    ...copy.offerings.flatMap((item) => [item.name, item.description]),
    copy.howToBuy,
    copy.contact,
    ...copy.faq.flatMap((entry) => [entry.question, entry.answer]),
    copy.seoTitle,
    copy.seoDescription,
  ];
}

// [Bracketed] notes still to fill in, counted in each text so list brackets never count
export function placeholderCount(copy: WebsiteCopy): number {
  return copyTexts(copy).reduce((sum, text) => sum + (text.match(/\[[^\]]+\]/g)?.length ?? 0), 0);
}

// Just the words, without flags or bookkeeping, for editing and comparing
export function copyOf(content: WebsiteCopy): WebsiteCopy {
  const { headline, subheadline, intro, about, offerings, howToBuy, contact, faq, seoTitle, seoDescription } = content;
  return { headline, subheadline, intro, about, offerings, howToBuy, contact, faq, seoTitle, seoDescription };
}
