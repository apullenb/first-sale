import { contrast, textOn } from "@/lib/website/look";
import type { WebsiteCopy } from "@/lib/website/types";
import { dollars, itemFor, type SiteDesign, shows } from "./design";

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

function styles(design: SiteDesign): string {
  const brand = /^#[0-9a-f]{6}$/i.test(design.color) ? design.color : "#1e6b52";
  const warm = design.style === "warm";
  const bold = design.style === "bold";
  const page = bold ? "#141b1a" : warm ? "#f6f1e8" : "#fbfcfa";
  const ink = bold ? "#f4f5ec" : warm ? "#352d27" : "#1c2926";
  const muted = bold ? "#b8c2bc" : "#64716a";
  const line = bold ? "#35413b" : warm ? "#ded6ca" : "#dce4dd";
  const surface = bold ? "#202b26" : warm ? "#ebe3d6" : "#edf2eb";
  const accent = contrast(brand, page) >= 4.5 ? brand : ink;
  const button = bold ? "#d3f28a" : brand;
  return `
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${page};color:${ink};font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}img{max-width:100%;height:auto;display:block}a{color:inherit}button,a,summary{-webkit-tap-highlight-color:transparent}a:focus-visible,summary:focus-visible{outline:3px solid ${accent};outline-offset:5px}h1,h2,h3,p{margin:0}p{white-space:pre-line}h1,h2,h3{font-weight:400;line-height:1.08;letter-spacing:-.045em;font-family:${warm ? 'Georgia,"Times New Roman",serif' : 'inherit'}}h2{font-size:clamp(2.3rem,5vw,4.5rem)}h3{font-size:1.3rem;letter-spacing:-.025em}.wrap{width:min(1280px,calc(100% - 112px));margin:auto}.skip{position:absolute;left:-9999px}.skip:focus{left:20px;top:12px;background:${page};padding:12px;z-index:5}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.top{border-bottom:1px solid ${line}}.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:28px;min-height:100px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;font-size:1.1rem;letter-spacing:-.035em;font-weight:650;max-width:50%}.logo{max-height:42px;max-width:110px;object-fit:contain}nav{display:flex;gap:28px;flex-wrap:wrap}nav a{font-size:.82rem;text-decoration:none;letter-spacing:.02em}nav a:hover{text-decoration:underline;text-underline-offset:6px}
.hero{padding:82px 0 70px}.hero-grid{display:grid;grid-template-columns:1.06fr 1fr;align-items:center;gap:70px}.eyebrow,.section-label{font-size:.69rem;letter-spacing:.2em;text-transform:uppercase;font-weight:650;color:${muted}}.hero-copy{display:flex;flex-direction:column;align-items:flex-start;gap:28px;padding:25px 0}.hero h1{font-size:clamp(3.5rem,6.6vw,7.3rem);line-height:.98;max-width:13ch;overflow-wrap:anywhere}.hero .sub{font-size:1.2rem;line-height:1.55;max-width:34ch;color:${muted}}.hero .intro{font-size:.95rem;max-width:45ch;color:${muted}}.button{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:14px 28px;background:${button};color:${textOn(button)};border:1px solid transparent;border-radius:${warm ? "100px" : "4px"};text-decoration:none;font-size:.85rem;font-weight:600;letter-spacing:.025em;transition:transform .18s,opacity .18s}.button:hover{opacity:.86;transform:translateY(-2px)}.button.alt{background:none;border-color:${line};color:${ink}}.hero .button{margin-top:6px}.hero-media{position:relative;min-height:550px;height:100%;overflow:hidden;border-radius:${warm ? "220px 220px 8px 8px" : "4px"};background:${surface}}.hero-image{width:100%;height:100%;min-height:550px;object-fit:cover}.hero-art{position:relative;display:grid;place-items:center;min-height:550px;overflow:hidden;background:linear-gradient(145deg,${surface},${brand}40)}.art-circle{position:absolute;inset:14%;border:1px solid ${brand}55;border-radius:50%;box-shadow:0 0 0 45px ${brand}08,0 0 0 90px ${brand}06}.art-monogram{position:relative;font-family:Georgia,serif;font-size:clamp(12rem,27vw,26rem);line-height:1;color:${accent};font-style:italic;letter-spacing:-.13em;transform:translateX(-.07em)}.art-caption{position:absolute;bottom:30px;left:30px;right:30px;display:flex;justify-content:space-between;border-top:1px solid ${line};padding-top:18px;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase}.hero-foot{display:flex;justify-content:space-between;gap:25px;border-bottom:1px solid ${line};padding:30px 0;color:${muted};font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
section:not(.hero){padding:96px 0}.section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:30px;margin-bottom:42px}.section-heading .section-label{padding-bottom:9px}.items{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(var(--item-columns,3),minmax(0,1fr));gap:32px}.item{min-width:0;display:flex;flex-direction:column;gap:14px}.item-media{aspect-ratio:4/5;background:${surface};overflow:hidden;position:relative;border-radius:${warm ? "90px 90px 5px 5px" : "4px"};margin-bottom:9px}.item-photo{width:100%;height:100%;object-fit:cover;transition:transform .4s}.item:hover .item-photo{transform:scale(1.025)}.item-placeholder{height:100%;display:grid;place-items:center;background:linear-gradient(145deg,transparent,${brand}16);position:relative}.item-placeholder:before{content:"";position:absolute;width:44%;height:52%;border:1px solid ${brand}45;border-radius:50% 50% 8px 8px;transform:rotate(-12deg)}.item-placeholder span{font-family:Georgia,serif;font-style:italic;font-size:5rem;color:${accent};z-index:1}.item-meta{display:flex;justify-content:space-between;align-items:baseline;gap:18px}.price{font-size:.94rem;white-space:nowrap}.item>p{color:${muted};font-size:.9rem}.item .button{align-self:flex-start;margin-top:auto;min-height:42px;padding:9px 20px}.story{background:${surface}}.story-grid{display:grid;grid-template-columns:1fr 1fr;gap:100px;align-items:start}.story h2{max-width:9ch}.story p:not(.section-label){font-size:clamp(1.2rem,2vw,1.7rem);line-height:1.7;font-weight:350;max-width:34ch}.story .section-label{margin-bottom:22px}.order-grid{display:grid;grid-template-columns:1fr 1fr;gap:100px;border-bottom:1px solid ${line};padding-bottom:70px}.order-grid p{max-width:45ch;font-size:1.05rem;color:${muted}}.faq-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:100px}details{border-bottom:1px solid ${line};padding:22px 0}details:first-child{border-top:1px solid ${line}}summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:22px;font-size:1.05rem}summary:after{content:"+";font-size:1.4rem;color:${muted}}details[open] summary:after{content:"−"}summary::-webkit-details-marker{display:none}details p{padding-top:18px;color:${muted};font-size:.95rem}.contact{background:${surface};text-align:center}.contact h2{font-size:clamp(3rem,7vw,6rem);margin:22px auto;max-width:15ch}.contact-copy{max-width:48ch;margin:0 auto 30px;color:${muted}}.contact-links{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}footer{padding:30px 0;border-top:1px solid ${line}}footer .wrap{display:flex;justify-content:space-between;align-items:center;gap:24px;font-size:.8rem;color:${muted}}mark.note{background:#fff1b8;color:#1c2926;padding:0 3px}
${bold ? '.hero h1{font-weight:650;text-transform:uppercase;font-size:clamp(3.4rem,7vw,7.8rem);letter-spacing:-.07em}.hero-media{border-radius:160px 4px 4px 4px}.hero-art{background:linear-gradient(160deg,#314332,#17221b)}.hero-foot{color:#d3f28a}.story{border-top:1px solid #35413b;border-bottom:1px solid #35413b}.item-media{border-radius:3px}.art-monogram{color:#d3f28a}' : ''}
${warm ? '.hero{padding-top:65px}.hero-copy{align-items:center;text-align:center}.hero h1{max-width:12ch;font-style:italic}.hero-grid{gap:65px}.item-meta h3{font-size:1.5rem}.contact h2{font-style:italic}' : ''}
@media(min-width:1600px){.hero-media,.hero-image,.hero-art{min-height:650px}}@media(max-width:950px){.wrap{width:calc(100% - 56px)}.hero-grid{gap:35px}.hero h1{font-size:4rem}.hero-media,.hero-image,.hero-art{min-height:440px}.items{gap:22px}.story-grid,.order-grid,.faq-grid{gap:40px}}@media(max-width:650px){.wrap{width:calc(100% - 40px)}.top .wrap{min-height:78px;flex-wrap:wrap;padding:20px 0;gap:16px}.brand{max-width:100%}nav{gap:18px}nav a{font-size:.73rem}.hero{padding:35px 0 25px}.hero-grid{grid-template-columns:1fr;gap:30px}.hero-copy{gap:22px}.hero h1{font-size:clamp(3.3rem,13vw,5rem);max-width:14ch}.hero-media,.hero-image,.hero-art{min-height:390px}.art-monogram{font-size:17rem}.hero-foot{font-size:.6rem;letter-spacing:.05em}.items{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 18px}.item-meta{flex-direction:column;gap:6px}.item h3{font-size:1.1rem}.item-placeholder span{font-size:3rem}.item .button{font-size:.75rem;padding:8px 12px}.section-heading{align-items:flex-start;flex-direction:column;gap:14px}section:not(.hero){padding:60px 0}.story-grid,.order-grid,.faq-grid{grid-template-columns:1fr;gap:30px}.story h2{max-width:13ch}.order-grid{padding-bottom:45px}.contact h2{font-size:3.3rem}footer .wrap{align-items:flex-start;flex-direction:column;gap:12px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
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
        `<div class="item-media">${photo ? img(photo, offering.name, "item-photo") : `<div class="item-placeholder" aria-hidden="true"><span>${escapeHtml(offering.name.slice(0, 1))}</span></div>`}</div>`,
        `<div class="item-meta"><h3>${text(offering.name, mark)}</h3>${item?.priceCents != null ? `<p class="price">${dollars(item.priceCents)}</p>` : ""}</div>`,
        offering.description.trim() ? `<p>${text(offering.description, mark)}</p>` : "",
        item?.buyUrl
          ? `<a class="button" href="${escapeHtml(item.buyUrl)}" rel="noopener noreferrer" target="_blank">Buy now<span class="sr"> ${escapeHtml(offering.name)} (opens a checkout page)</span></a>`
          : "",
      ];
      return `<li class="item">${parts.join("")}</li>`;
    });
    sections.push(`<section id="shop" aria-labelledby="shop-title"><div class="wrap"><div class="section-heading"><h2 id="shop-title">What we offer</h2><span class="section-label">Take a closer look</span></div><ul class="items" style="--item-columns:${Math.min(3, copy.offerings.length)}">${items.join("")}</ul></div></section>`);
  }
  if (shows(design, "about") && copy.about.trim()) {
    nav.push({ href: "#about", label: "About" });
    sections.push(`<section id="about" class="story" aria-labelledby="about-title"><div class="wrap story-grid"><div><p class="section-label">A little about us</p><h2 id="about-title">Our story.</h2></div><p>${text(copy.about, mark)}</p></div></section>`);
  }
  if (shows(design, "howToBuy") && copy.howToBuy.trim()) {
    nav.push({ href: "#order", label: "How to order" });
    sections.push(`<section id="order" aria-labelledby="order-title"><div class="wrap order-grid"><h2 id="order-title">How to order.</h2><p>${text(copy.howToBuy, mark)}</p></div></section>`);
  }
  if (shows(design, "faq") && copy.faq.length) {
    nav.push({ href: "#faq", label: "Questions" });
    const entries = copy.faq.map((entry) => `<details><summary>${text(entry.question, mark)}</summary><p>${text(entry.answer, mark)}</p></details>`);
    sections.push(`<section id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><h2 id="faq-title">Good to know.</h2><div>${entries.join("")}</div></div></section>`);
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
        `<section id="contact" class="contact" aria-labelledby="contact-title"><div class="wrap"><p class="section-label">Let’s make a connection</p><h2 id="contact-title">Get in touch.</h2>${copy.contact.trim() ? `<p class="contact-copy">${text(copy.contact, mark)}</p>` : ""}${buttons ? `<div class="contact-links">${buttons}</div>` : ""}</div></section>`,
      );
    }
  }

  const action = mainAction(input);
  const at = (hash: string) => `${input.anchorBase ?? ""}${hash}`;
  const logo = design.showLogo && images.logo ? img(images.logo, `${name} logo`, "logo") : "";
  const featured = design.showHero ? images.hero ?? copy.offerings.map((offering) => {
    const photo = itemFor(design, offering.name)?.photo;
    return photo ? images.photos[photo.versionId] : undefined;
  }).find((photo) => photo !== undefined) : null;
  const hero = featured ? img(featured, "", "hero-image") : `<div class="hero-art" aria-hidden="true"><span class="art-circle"></span><span class="art-monogram">${escapeHtml(name.slice(0, 1))}</span><div class="art-caption"><span>${escapeHtml(name)}</span><span>Explore</span></div></div>`;
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
<section class="hero" id="top"><div class="wrap"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">${escapeHtml(name)}</p><h1>${text(copy.headline || name, mark)}</h1>${
    copy.subheadline.trim() ? `<p class="sub">${text(copy.subheadline, mark)}</p>` : ""
  }${copy.intro.trim() ? `<p class="intro">${text(copy.intro, mark)}</p>` : ""}${action.label ? `<a class="button" href="${at(action.href)}">${action.label}</a>` : ""}</div><div class="hero-media">${hero}</div></div><div class="hero-foot"><span>${escapeHtml(name)}</span><span>Discover what we do <span aria-hidden="true">↘</span></span></div></div></section>
${sections.join("\n")}
</main>
<footer><div class="wrap"><span class="brand">${escapeHtml(name)}</span><span>© ${input.year} ${escapeHtml(name)}</span></div></footer>
</body>
</html>
`;
}
