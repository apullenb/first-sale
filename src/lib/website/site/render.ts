import { contrast, textOn } from "@/lib/website/look";
import type { WebsiteCopy } from "@/lib/website/types";
import { dollars, itemFor, type SiteDesign, type SiteStyle, shows } from "./design";

// The owner's site as one plain HTML page: no scripts, no outside files, every piece of text escaped.
// Drawn in the live preview; in the demo, nothing is published.

export interface SiteImage {
  src: string;
  width: number;
  height: number;
}

export interface SiteInput {
  name: string;
  copy: WebsiteCopy;
  design: SiteDesign;
  images: {
    logo: SiteImage | null;
    hero: SiteImage | null;
    favicon: SiteImage | null;
    // By photo version id
    photos: Record<string, SiteImage>;
  };
  // From the business email and phone the owner saved
  contact: { email: string | null; phone: string | null };
  year: number;
  // Marks [bracketed] notes so the owner can spot them in the preview
  highlightNotes: boolean;
  // In a srcdoc preview, "#shop" would load the app's own page; "about:srcdoc#shop" scrolls instead
  anchorBase?: string;
}

// Scripts, outside requests and form posts are all refused
export const SITE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function text(value: string, highlight: boolean): string {
  const safe = escapeHtml(value.trim());
  return highlight ? safe.replace(/\[[^\]]+\]/g, (note) => `<mark class="note">${note}</mark>`) : safe;
}

function img(image: SiteImage, alt: string, className: string): string {
  return `<img class="${className}" src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" width="${image.width}" height="${image.height}">`;
}

export function phoneHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}

export function emailHref(email: string): string | null {
  const trimmed = email.trim();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
}

const FONTS: Record<SiteStyle, { body: string; heading: string }> = {
  clean: { body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", heading: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  bold: { body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", heading: "'Arial Black', 'Helvetica Neue', Arial, sans-serif" },
  warm: { body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", heading: "Georgia, 'Times New Roman', serif" },
};

const PAGE: Record<SiteStyle, string> = { clean: "#ffffff", bold: "#ffffff", warm: "#faf6ef" };
const INK = "#1c2321";

function styles(design: SiteDesign): string {
  const page = PAGE[design.style];
  // Drawn into the stylesheet, so only a plain hex color gets through
  const brand = /^#[0-9a-f]{6}$/i.test(design.color) ? design.color : "#1e6b52";
  const onBrand = textOn(brand);
  // Headings and links in the brand color only when it reads well on the page
  const accent = contrast(brand, page) >= 4.5 ? brand : INK;
  const radius = design.style === "warm" ? "18px" : design.style === "bold" ? "6px" : "10px";
  const fonts = FONTS[design.style];
  const heroBand = design.style === "bold" ? `background:${brand};color:${onBrand};` : "";
  const heroInk = design.style === "bold" ? onBrand : INK;
  return `
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:${page};color:${INK};font:17px/1.6 ${fonts.body}}
img{max-width:100%;height:auto;display:block}
a{color:${accent}}
h1,h2,h3{font-family:${fonts.heading};line-height:1.2;margin:0 0 .5em}
h2{font-size:1.75rem;color:${accent}}
p{margin:0 0 1em;white-space:pre-line}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
.skip{position:absolute;left:-999px}
.skip:focus{left:12px;top:12px;background:#fff;padding:8px 12px;z-index:2}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.top{border-bottom:1px solid rgba(0,0,0,.08);background:${page}}
.top .wrap{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 20px;padding-top:12px;padding-bottom:12px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:${INK};font-family:${fonts.heading};font-weight:700;font-size:1.25rem}
.logo{width:auto;max-height:48px;max-width:160px}
nav{display:flex;flex-wrap:wrap;gap:4px 16px}
nav a{color:${INK};text-decoration:none;font-weight:600;padding:8px 0}
nav a:hover{text-decoration:underline}
.hero{${heroBand}padding:48px 0}
.hero h1{font-size:clamp(2rem,5vw,3.25rem);color:${heroInk}}
.hero .sub{font-size:1.25rem}
.hero-image{width:100%;max-height:420px;object-fit:cover;border-radius:${radius};margin-bottom:28px}
.button{display:inline-block;background:${brand};color:${onBrand};padding:12px 22px;border-radius:${radius};font-weight:700;text-decoration:none;margin:4px 8px 4px 0}
.button.alt{background:transparent;color:${accent};box-shadow:inset 0 0 0 2px ${accent}}
.hero .button{${design.style === "bold" ? `background:${onBrand};color:${brand};` : ""}}
section{padding:40px 0}
section+section{border-top:1px solid rgba(0,0,0,.06)}
.items{list-style:none;padding:0;margin:0;display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.item{background:${design.style === "warm" ? "#ffffff" : "#f6f6f4"};border-radius:${radius};padding:16px;display:flex;flex-direction:column}
.item img{aspect-ratio:1/1;object-fit:cover;width:100%;border-radius:calc(${radius} - 4px);margin-bottom:12px}
.item h3{font-size:1.15rem;margin-bottom:.25em}
.price{font-weight:700;font-size:1.1rem;margin-bottom:.5em}
.item .button{margin-top:auto;text-align:center}
details{border-bottom:1px solid rgba(0,0,0,.1);padding:12px 0}
summary{cursor:pointer;font-weight:700}
details p{margin:.5em 0 0}
footer{padding:28px 0;font-size:.9rem;color:#555;border-top:1px solid rgba(0,0,0,.08)}
mark.note{background:#fff1b8;color:${INK};padding:0 2px;border-radius:3px}
@media (max-width:600px){.hero{padding:32px 0}section{padding:28px 0}}
`;
}

// Where the main button goes: the shop when an item can be bought, else contact
function mainAction(input: SiteInput): { label: string; href: string } {
  const { copy, design } = input;
  const buyable = shows(design, "offerings") && copy.offerings.some((offering) => itemFor(design, offering.name)?.buyUrl);
  if (buyable) return { label: "Shop now", href: "#shop" };
  if (shows(design, "contact")) return { label: "Get in touch", href: "#contact" };
  if (shows(design, "offerings") && copy.offerings.length) return { label: "See what we offer", href: "#shop" };
  return { label: "", href: "" };
}

export function renderSite(input: SiteInput): string {
  const { copy, design, images, highlightNotes: mark } = input;
  const name = input.name.trim() || "Your business";
  const sections: string[] = [];
  const nav: { href: string; label: string }[] = [];

  if (shows(design, "offerings") && copy.offerings.length) {
    nav.push({ href: "#shop", label: "What we offer" });
    const items = copy.offerings.map((offering) => {
      const item = itemFor(design, offering.name);
      const photo = item?.photo ? images.photos[item.photo.versionId] : undefined;
      const parts = [
        photo ? img(photo, offering.name, "item-photo") : "",
        `<h3>${text(offering.name, mark)}</h3>`,
        item?.priceCents != null ? `<p class="price">${dollars(item.priceCents)}</p>` : "",
        offering.description.trim() ? `<p>${text(offering.description, mark)}</p>` : "",
        item?.buyUrl
          ? `<a class="button" href="${escapeHtml(item.buyUrl)}" rel="noopener noreferrer" target="_blank">Buy now<span class="sr"> ${escapeHtml(offering.name)} (opens a checkout page)</span></a>`
          : "",
      ];
      return `<li class="item">${parts.join("")}</li>`;
    });
    sections.push(`<section id="shop" aria-labelledby="shop-title"><div class="wrap"><h2 id="shop-title">What we offer</h2><ul class="items">${items.join("")}</ul></div></section>`);
  }
  if (shows(design, "about") && copy.about.trim()) {
    nav.push({ href: "#about", label: "About" });
    sections.push(`<section id="about" aria-labelledby="about-title"><div class="wrap"><h2 id="about-title">About us</h2><p>${text(copy.about, mark)}</p></div></section>`);
  }
  if (shows(design, "howToBuy") && copy.howToBuy.trim()) {
    nav.push({ href: "#order", label: "How to order" });
    sections.push(`<section id="order" aria-labelledby="order-title"><div class="wrap"><h2 id="order-title">How to order</h2><p>${text(copy.howToBuy, mark)}</p></div></section>`);
  }
  if (shows(design, "faq") && copy.faq.length) {
    nav.push({ href: "#faq", label: "Questions" });
    const entries = copy.faq.map((entry) => `<details><summary>${text(entry.question, mark)}</summary><p>${text(entry.answer, mark)}</p></details>`);
    sections.push(`<section id="faq" aria-labelledby="faq-title"><div class="wrap"><h2 id="faq-title">Questions</h2>${entries.join("")}</div></section>`);
  }
  if (shows(design, "contact")) {
    const email = design.showEmail && input.contact.email ? emailHref(input.contact.email) : null;
    const phone = design.showPhone && input.contact.phone ? phoneHref(input.contact.phone) : null;
    const buttons = [
      email ? `<a class="button" href="${escapeHtml(email)}">Email ${escapeHtml(input.contact.email!.trim())}</a>` : "",
      phone ? `<a class="button alt" href="${escapeHtml(phone)}">Call ${escapeHtml(input.contact.phone!.trim())}</a>` : "",
    ].join("");
    if (copy.contact.trim() || buttons) {
      nav.push({ href: "#contact", label: "Contact" });
      sections.push(
        `<section id="contact" aria-labelledby="contact-title"><div class="wrap"><h2 id="contact-title">Get in touch</h2>${copy.contact.trim() ? `<p>${text(copy.contact, mark)}</p>` : ""}${buttons ? `<p>${buttons}</p>` : ""}</div></section>`,
      );
    }
  }

  const action = mainAction(input);
  const at = (hash: string) => `${input.anchorBase ?? ""}${hash}`;
  const logo = design.showLogo && images.logo ? img(images.logo, `${name} logo`, "logo") : "";
  const hero = design.showHero && images.hero ? img(images.hero, "", "hero-image") : "";
  const title = copy.seoTitle.trim() || name;
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<meta http-equiv="Content-Security-Policy" content="${SITE_CSP}">`,
    `<meta name="referrer" content="strict-origin-when-cross-origin">`,
    `<title>${escapeHtml(title)}</title>`,
    copy.seoDescription.trim() ? `<meta name="description" content="${escapeHtml(copy.seoDescription.trim())}">` : "",
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    copy.seoDescription.trim() ? `<meta property="og:description" content="${escapeHtml(copy.seoDescription.trim())}">` : "",
    `<meta property="og:type" content="website">`,
    images.favicon && design.showLogo ? `<link rel="icon" href="${escapeHtml(images.favicon.src)}">` : "",
    `<style>${styles(design)}</style>`,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
${head.join("\n")}
</head>
<body>
<a class="skip" href="${at("#main")}">Skip to content</a>
<header class="top"><div class="wrap"><a class="brand" href="${at("#top")}">${logo}<span>${escapeHtml(name)}</span></a>${
    nav.length ? `<nav aria-label="Main">${nav.map((link) => `<a href="${at(link.href)}">${link.label}</a>`).join("")}</nav>` : ""
  }</div></header>
<main id="main">
<section class="hero" id="top"><div class="wrap">${hero}<h1>${text(copy.headline || name, mark)}</h1>${
    copy.subheadline.trim() ? `<p class="sub">${text(copy.subheadline, mark)}</p>` : ""
  }${copy.intro.trim() ? `<p>${text(copy.intro, mark)}</p>` : ""}${action.label ? `<a class="button" href="${at(action.href)}">${action.label}</a>` : ""}</div></section>
${sections.join("\n")}
</main>
<footer><div class="wrap">© ${input.year} ${escapeHtml(name)}</div></footer>
</body>
</html>
`;
}
