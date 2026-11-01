import { dollars, itemFor, type SiteDesign } from "./site/design";
import type { DnsRecord, DomainSetup, PasteKind } from "./platforms";
import type { WebsiteCopy } from "./types";

// What the owner copies into the platform at each step, filled from their own saved work. Plain data for the page.

export type PasteValue =
  | { kind: "text"; label: string; text: string }
  | { kind: "color"; label: string; hex: string }
  | { kind: "file"; label: string; href: string; note: string | null }
  | { kind: "records"; label: string; records: DnsRecord[]; note: string; source: { label: string; url: string } }
  // Something SnapStart can't fill yet, with where to make it
  | { kind: "missing"; label: string; text: string; href: string | null };

export interface PasteContext {
  name: string;
  copy: WebsiteCopy | null;
  design: SiteDesign;
  brand: {
    colors: { hex: string; name: string }[];
    // Download links
    logo: string | null;
    icon: string | null;
    practice: { logo: boolean; icon: boolean };
  } | null;
  // Download links by photo version id
  photos: Record<string, { href: string; practice: boolean }>;
  domain: string | null;
  domainSetup: DomainSetup | null;
}

const WORDS = "/website#step-words";
const LOGO = "/logo";

function words(copy: WebsiteCopy | null, label: string, pieces: [string, string][]): PasteValue[] {
  if (!copy) return [{ kind: "missing", label, text: "Draft your words in step 3, and they’ll be here ready to copy.", href: WORDS }];
  return pieces.filter(([, text]) => text.trim()).map(([pieceLabel, text]) => ({ kind: "text", label: pieceLabel, text: text.trim() }));
}

const PRACTICE = "Practice preview, not made for your business.";

export function pasteFor(kinds: readonly PasteKind[], context: PasteContext): PasteValue[] {
  const { copy, design, brand } = context;
  return kinds.flatMap((kind): PasteValue[] => {
    switch (kind) {
      case "name":
        return [{ kind: "text", label: "Business name", text: context.name }];
      case "seo":
        return words(copy, "Search results", [
          ["Page title", copy?.seoTitle ?? ""],
          ["Description", copy?.seoDescription ?? ""],
        ]);
      case "home":
        return words(copy, "Home page", [
          ["Headline", copy?.headline ?? ""],
          ["Line under the headline", copy?.subheadline ?? ""],
          ["Welcome", copy?.intro ?? ""],
        ]);
      case "pages":
        return words(copy, "Pages", [
          ["About", copy?.about ?? ""],
          ["How to order", copy?.howToBuy ?? ""],
        ]);
      case "contact":
        return words(copy, "Contact", [["Contact", copy?.contact ?? ""]]);
      case "faq":
        return copy?.faq.length
          ? copy.faq.map((entry, index) => ({ kind: "text", label: `Question ${index + 1}`, text: `${entry.question}\n${entry.answer}` }))
          : words(copy, "Questions", []);
      case "colors": {
        const main: PasteValue = { kind: "color", label: "Main color", hex: design.color };
        const others = (brand?.colors ?? [])
          .filter((color) => color.hex.toLowerCase() !== design.color.toLowerCase())
          .map((color): PasteValue => ({ kind: "color", label: color.name, hex: color.hex }));
        return brand ? [main, ...others] : [main, { kind: "missing", label: "Brand colors", text: "Create or upload your logo, and its colors show here.", href: LOGO }];
      }
      case "logo":
        return brand?.logo
          ? [{ kind: "file", label: "Your logo", href: brand.logo, note: brand.practice.logo ? PRACTICE : null }]
          : [{ kind: "missing", label: "Logo", text: "Create or upload your logo, and it’ll be here to download.", href: LOGO }];
      case "favicon":
        return brand?.icon
          ? [{ kind: "file", label: "Site icon (square logo)", href: brand.icon, note: brand.practice.icon ? PRACTICE : "Upload this as the favicon." }]
          : [];
      case "items": {
        if (!copy) return words(copy, "What you sell", []);
        return copy.offerings.flatMap((offering): PasteValue[] => {
          const item = itemFor(design, offering.name);
          const price = item?.priceCents != null ? `\nPrice: ${dollars(item.priceCents)}` : "";
          const photo = item?.photo ? context.photos[item.photo.versionId] : undefined;
          return [
            { kind: "text", label: offering.name, text: `${offering.name}\n${offering.description}${price}`.trim() },
            ...(photo ? [{ kind: "file" as const, label: `Photo of ${offering.name}`, href: photo.href, note: photo.practice ? PRACTICE : null }] : []),
          ];
        });
      }
      case "dns": {
        const setup = context.domainSetup;
        if (!setup) return [];
        const label = context.domain ? `Records for ${context.domain}` : "Records for your web address";
        if (setup.shownIn) return [{ kind: "missing", label, text: `${setup.shownIn} ${setup.note}`, href: null }];
        return [{ kind: "records", label, records: setup.records, note: setup.note, source: setup.source }];
      }
    }
  });
}
