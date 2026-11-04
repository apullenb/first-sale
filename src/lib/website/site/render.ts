import { contrast, textOn } from "@/lib/website/look";
import type { WebsiteCopy } from "@/lib/website/types";
import { dollars, itemFor, SITE_SECTIONS, themeSchema, type SiteDesign, type SiteTheme, shows } from "./design";

export interface SiteImage { src: string; width: number; height: number }
export interface SiteInput {
  name: string;
  copy: WebsiteCopy;
  design: SiteDesign;
  images: { logo: SiteImage | null; hero: SiteImage | null; favicon: SiteImage | null; photos: Record<string, SiteImage> };
  contact: { email: string | null; phone: string | null };
  year: number;
  highlightNotes: boolean;
  anchorBase?: string;
}
export const SITE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
export function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function text(value: string, mark = false): string {
  const safe = escapeHtml(value.trim());
  return mark ? safe.replace(/\[[^\]]+\]/g, (note) => `<mark class="note">${note}</mark>`) : safe;
}
export function emailHref(email: string): string | null {
  const value = email.trim();
  return /^[^\s@<>"'\\]+@[^\s@<>"'\\]+\.[^\s@<>"'\\]+$/.test(value) ? `mailto:${value}` : null;
}
export function phoneHref(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(digits) ? `tel:${digits}` : null;
}
function image(photo: SiteImage, alt: string, className: string): string {
  return `<img class="${className}" src="${escapeHtml(photo.src)}" alt="${escapeHtml(alt)}" width="${photo.width}" height="${photo.height}" decoding="async">`;
}
const HEX = /^#[\da-f]{6}$/i;
function direction(design: SiteDesign): SiteTheme {
  const parsed = themeSchema.safeParse(design.theme);
  if (parsed.success) return parsed.data;
  const accent = HEX.test(design.color) ? design.color : "#1e6b52";
  const dark = design.style === "bold";
  return { name: "Your website", rationale: "", layout: "split", font: design.style === "warm" ? "editorial" : "sans", background: dark ? "#172522" : "#fffefb", foreground: dark ? "#f4f6f2" : "#202e29", surface: dark ? "#243530" : "#f1f3ec", accent, radius: design.style === "warm" ? 18 : 8, titleScale: 0.9, density: "balanced", catalogLayout: "grid", imageShape: "square" };
}

// Blend two hex colors; amount is the share of b
function mix(a: string, b: string, amount: number): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `#${[1, 3, 5].map((at) => Math.round(channel(a, at) * (1 - amount) + channel(b, at) * amount).toString(16).padStart(2, "0")).join("")}`;
}
const lightness = (hex: string) => contrast(hex, "#000000");

const FONTS: Record<SiteTheme["font"], { stack: string; weight: number; tracking: string }> = {
  sans: { stack: '"Avenir Next","Helvetica Neue",Helvetica,Arial,sans-serif', weight: 600, tracking: "-.04em" },
  serif: { stack: 'Georgia,"Times New Roman",serif', weight: 400, tracking: "-.03em" },
  editorial: { stack: '"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif', weight: 400, tracking: "-.025em" },
  display: { stack: 'Didot,"Bodoni 72","Bodoni MT","Big Caslon",Georgia,serif', weight: 400, tracking: "-.02em" },
  rounded: { stack: 'ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Avenir Next",sans-serif', weight: 650, tracking: "-.03em" },
};

const ORNAMENT: Record<string, string> = {
  rule: `<span class="orn orn-rule" aria-hidden="true"></span>`,
  dots: `<svg class="orn" aria-hidden="true" width="34" height="8" viewBox="0 0 34 8"><circle cx="4" cy="4" r="3"/><circle cx="17" cy="4" r="3"/><circle cx="30" cy="4" r="3"/></svg>`,
  wave: `<svg class="orn orn-wave" aria-hidden="true" width="56" height="10" viewBox="0 0 56 10"><path d="M1 5c4.5-5 9-5 13.5 0s9 5 13.5 0 9-5 13.5 0 9 5 13.5 0" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`,
  star: `<svg class="orn" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M7 0c.6 3.9 2.1 5.4 7 7-4.9 1.6-6.4 3.1-7 7-.6-3.9-2.1-5.4-7-7 4.9-1.6 6.4-3.1 7-7z"/></svg>`,
  none: "",
};

function palette(theme: SiteTheme) {
  const ink = contrast(theme.foreground, theme.background) >= 4.5 ? theme.foreground : textOn(theme.background);
  const soft = contrast(ink, theme.surface) >= 4.5 ? theme.surface : theme.background;
  const highlight = theme.highlight && HEX.test(theme.highlight) ? theme.highlight : mix(theme.accent, theme.background, 0.72);
  const darkPage = lightness(theme.background) < 0.35;
  const deep = darkPage ? mix(theme.background, "#000000", 0.35) : mix(ink, theme.accent, 0.22);
  const tint = mix(theme.accent, theme.background, 0.9);
  const story = { accent: theme.accent, dark: deep, tint, highlight }[theme.storySurface ?? "accent"];
  return { ink, soft, highlight, deep, tint, story, onAccent: textOn(theme.accent), onHighlight: textOn(highlight), onDeep: textOn(deep), onStory: textOn(story), onTint: contrast(ink, tint) >= 4.5 ? ink : textOn(tint) };
}

function stylesheet(theme: SiteTheme, position: string): string {
  const c = palette(theme);
  const font = FONTS[theme.font] ?? FONTS.sans;
  const body = theme.bodyFont === "serif" ? '"Iowan Old Style","Palatino Linotype",Georgia,serif' : '-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif';
  const space = theme.density === "compact" ? 64 : theme.density === "airy" ? 128 : 96;
  const button = theme.buttonShape === "pill" ? "999px" : theme.buttonShape === "square" ? "2px" : theme.buttonShape === "soft" ? `${Math.min(theme.radius, 14)}px` : theme.radius >= 14 ? "999px" : `${theme.radius}px`;
  const shape = theme.imageShape === "portrait" ? "4/5" : theme.imageShape === "landscape" ? "4/3" : "1";
  const scale = theme.titleScale;
  return `
:root{--paper:${theme.background};--ink:${c.ink};--soft:${c.soft};--accent:${theme.accent};--on-accent:${c.onAccent};--hl:${c.highlight};--on-hl:${c.onHighlight};--deep:${c.deep};--on-deep:${c.onDeep};--tint:${c.tint};--on-tint:${c.onTint};--story:${c.story};--on-story:${c.onStory};--radius:${theme.radius}px;--btn:${button};--line:color-mix(in srgb,var(--ink) 14%,transparent);--muted:color-mix(in srgb,var(--ink) 72%,var(--paper));--heading:${font.stack};--section:${space}px}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:16.5px/1.7 ${body};-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}a{color:inherit}img{display:block;max-width:100%;height:auto}a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:4px}h1,h2,h3,p,ol,figure,blockquote{margin:0}h1,h2,h3{font-family:var(--heading);font-style:normal;font-weight:${font.weight};letter-spacing:${font.tracking};line-height:1.06}h1{font-size:clamp(2.7rem,${(5.6 * scale).toFixed(2)}vw,${(5.4 * scale).toFixed(2)}rem);max-width:15ch;text-wrap:balance}h2{font-size:clamp(2.1rem,${(3.8 * scale).toFixed(2)}vw,3.6rem);text-wrap:balance}h3{font-size:1.32rem;line-height:1.2;letter-spacing:-.015em}p{white-space:pre-line}.wrap{width:min(1240px,calc(100% - 96px));margin:auto}.skip{position:absolute;left:-10000px}.skip:focus{left:16px;top:16px;z-index:10;background:var(--paper);padding:12px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.orn{display:inline-block;flex-shrink:0;fill:var(--accent);stroke:var(--accent);vertical-align:middle}.orn-rule{width:36px;height:2px;background:var(--accent)}.eyebrow,.kicker{display:inline-flex;align-items:center;gap:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:var(--accent)}
.topbar{background:var(--deep);color:var(--on-deep);font-size:.76rem;letter-spacing:.02em}.topbar .wrap{display:flex;justify-content:center;gap:28px;padding:9px 0;flex-wrap:wrap}.topbar a{text-decoration:none;opacity:.92}.topbar a:hover{opacity:1;text-decoration:underline}
.header{position:relative;z-index:3;background:transparent}.header-inner{min-height:112px;display:flex;justify-content:space-between;align-items:center;gap:32px;padding:14px 0;border-bottom:1px solid var(--line)}.brand{display:flex;min-width:0;align-items:center;gap:16px;font-family:var(--heading);font-size:1.35rem;letter-spacing:-.02em;font-weight:${font.weight};text-decoration:none}.logo{display:block;width:auto;height:auto;max-width:280px;max-height:96px;object-fit:contain;background:none;border:0;box-shadow:none;border-radius:0}.navigation{display:flex;gap:30px;align-items:center;flex-wrap:wrap}.navigation a{font-size:.86rem;font-weight:550;text-decoration:none;position:relative}.navigation a:not(.button):after{content:"";position:absolute;left:0;right:100%;bottom:-6px;height:2px;background:var(--accent);transition:right .25s}.navigation a:not(.button):hover:after{right:0}
.button{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:52px;padding:14px 28px;border:1.5px solid var(--accent);border-radius:var(--btn);background:var(--accent);color:var(--on-accent);text-decoration:none;font-size:.88rem;font-weight:650;letter-spacing:.01em;transition:transform .2s,filter .2s}.button:hover{filter:brightness(.93);transform:translateY(-1px)}.button.small{min-height:42px;padding:9px 20px;font-size:.8rem}.button.secondary{background:transparent;border-color:currentColor;color:inherit}.text-link{font-size:.88rem;font-weight:600;text-decoration:none;border-bottom:1.5px solid currentColor;padding-bottom:3px}.text-link:hover{color:var(--accent)}
.hero{position:relative;padding:72px 0 88px;overflow:hidden}.hero:before{content:"";position:absolute;width:62vw;height:62vw;max-width:860px;max-height:860px;right:-14vw;top:-18vw;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--hl) 55%,transparent),transparent 68%);z-index:-1;pointer-events:none}.hero-grid{display:grid;grid-template-columns:1fr 1.05fr;align-items:center;gap:clamp(40px,6vw,96px)}.hero-copy{display:flex;flex-direction:column;align-items:flex-start;gap:26px}.hero .sub{font-size:1.16rem;line-height:1.7;max-width:42ch;color:var(--muted)}.hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:26px;margin-top:6px}.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0;margin:4px 0 0}.chips li{padding:6px 14px;border:1px solid var(--line);border-radius:999px;font-size:.76rem;font-weight:550;background:color-mix(in srgb,var(--paper) 70%,transparent)}
.hero-media{position:relative;border-radius:var(--radius);background:var(--soft)}.hero-media>img{border-radius:inherit}.hero-image{width:100%;height:100%;max-height:680px;min-height:460px;object-fit:cover;object-position:${position};aspect-ratio:.95}.frame-arch .hero.split:not(.collection) .hero-media{border-radius:999px 999px var(--radius) var(--radius)}.frame-offset .hero.split .hero-media,.frame-offset .hero.centered .hero-media{margin:0 22px 22px 0}.frame-offset .hero.split .hero-media:after,.frame-offset .hero.centered .hero-media:after{content:"";position:absolute;inset:22px -22px -22px 22px;border-radius:inherit;background:var(--hl);z-index:-1}.frame-framed .hero.split .hero-media,.frame-framed .hero.centered .hero-media{padding:14px;background:var(--paper);box-shadow:0 0 0 1px var(--line),0 30px 60px -30px color-mix(in srgb,var(--ink) 45%,transparent)}.frame-framed .hero-media>img{border-radius:calc(var(--radius)*.6)}
.hero-collection{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1.3fr .9fr;gap:16px;height:600px;position:relative}.hero-collection .hero-media{grid-column:1/3;overflow:hidden}.hero-collection .hero-image{min-height:100%;max-height:none;aspect-ratio:auto}.hero-tile{position:relative;margin:0;min-height:0;overflow:hidden;border-radius:var(--radius);background:var(--soft)}.hero-tile img{width:100%;height:100%;object-fit:cover}.hero-tile figcaption{position:absolute;bottom:12px;left:12px;padding:7px 13px;background:var(--paper);color:var(--ink);font-size:.74rem;font-weight:600;line-height:1.3;border-radius:999px;box-shadow:0 6px 18px -8px rgba(0,0,0,.35)}.hero.collection .hero-grid{grid-template-columns:.9fr 1.1fr}
.no-image .hero-grid{display:block}.no-image .hero-copy{max-width:900px;padding:40px 0}.no-image h1{max-width:18ch}.hero.centered .hero-grid{grid-template-columns:1fr;gap:56px}.hero.centered .hero-copy{text-align:center;align-items:center;max-width:900px;margin:auto}.hero.centered h1{max-width:18ch}.hero.centered .hero-actions,.hero.centered .chips{justify-content:center}.hero.centered .hero-media{width:100%;overflow:hidden}.hero.centered .hero-image{aspect-ratio:2.2;min-height:340px;max-height:620px}
.hero.cover{padding:0;isolation:isolate;color:#fff;background:var(--deep)}.hero.cover:before{display:none}.hero.cover .hero-grid{display:flex;align-items:flex-end;min-height:min(86vh,720px)}.hero.cover .hero-copy{position:relative;z-index:2;max-width:660px;padding:120px 0 96px}.hero.cover .hero-media{position:absolute;inset:0;z-index:-2;border-radius:0;padding:0;margin:0;box-shadow:none}.hero.cover .hero-media:after{display:none}.hero.cover .hero-image{width:100%;height:100%;min-height:100%;aspect-ratio:auto;max-height:none;border-radius:0}.hero.cover:after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(20deg,color-mix(in srgb,var(--deep) 92%,transparent) 8%,color-mix(in srgb,var(--deep) 55%,transparent) 55%,transparent)}.hero.cover .sub,.hero.cover .eyebrow{color:#fff}.hero.cover .orn{fill:#fff;stroke:#fff}.hero.cover .orn-rule{background:#fff}.hero.cover .text-link{color:#fff}.hero.cover .chips li{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.35)}
.ribbon{background:var(--accent);color:var(--on-accent);overflow:hidden;white-space:nowrap}.ribbon p{display:flex;gap:28px;align-items:center;padding:17px 0;font-family:var(--heading);font-size:1.25rem;letter-spacing:-.01em;white-space:nowrap}.ribbon .orn{fill:var(--on-accent);stroke:var(--on-accent)}.ribbon .orn-rule{background:var(--on-accent)}
.quote-band{background:var(--tint);color:var(--on-tint);padding:calc(var(--section)*.85) 0;text-align:center}.quote-band blockquote{max-width:30ch;margin:auto;font-family:var(--heading);font-size:clamp(1.6rem,2.8vw,2.45rem);line-height:1.3;letter-spacing:-.015em;text-wrap:balance}.quote-band blockquote:before{content:"\\201C";display:block;font-size:4.6rem;line-height:.6;margin-bottom:14px;color:var(--accent)}.quote-band .kicker{margin-top:26px;justify-content:center}
.intro-band{padding:30px 0;border-bottom:1px solid var(--line)}.intro-band p{max-width:70ch;color:var(--muted);font-size:1rem}
.section{padding:var(--section) 0}.section-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-bottom:48px}.section-heading h2{margin-top:16px}.section-heading>p{max-width:38ch;font-size:.95rem;color:var(--muted)}.centered-heading{flex-direction:column;align-items:center;text-align:center}
.items{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(var(--columns,3),minmax(0,1fr));gap:48px 30px}.item{position:relative;display:flex;flex-direction:column;gap:14px;min-width:0}.item-media{position:relative;overflow:hidden;border-radius:var(--radius);background:var(--soft);aspect-ratio:${shape}}.item-photo{width:100%;height:100%;object-fit:cover;transition:transform .5s ease}.item:hover .item-photo{transform:scale(1.04)}.item-title{display:flex;align-items:baseline;justify-content:space-between;gap:18px}.price{white-space:nowrap;font-size:.9rem;font-weight:650;padding:4px 12px;border-radius:999px;background:var(--hl);color:var(--on-hl)}.item-description{font-size:.92rem;color:var(--muted);line-height:1.75}.item-action{margin-top:auto;padding-top:4px}.item.no-photo{padding:30px;border-radius:var(--radius);background:var(--soft);border:1px solid var(--line)}.item.no-photo:before{content:"";display:block;width:42px;height:42px;border-radius:50%;background:var(--hl);margin-bottom:6px}
.cards-framed .item{padding:14px 14px 22px;border:1px solid var(--line);border-radius:calc(var(--radius) + 6px);background:var(--paper)}.cards-framed .item .item-title,.cards-framed .item .item-description,.cards-framed .item .item-action{padding:0 8px}.cards-lifted .catalog{background:var(--soft)}.cards-lifted .item{background:var(--paper);border-radius:calc(var(--radius) + 4px);padding-bottom:24px;box-shadow:0 22px 44px -28px color-mix(in srgb,var(--ink) 40%,transparent);overflow:hidden}.cards-lifted .item-media{border-radius:0}.cards-lifted .item .item-title,.cards-lifted .item .item-description,.cards-lifted .item .item-action{padding:0 22px}.cards-lifted .item.no-photo{padding:28px}.cards-caption .item:not(.no-photo) .item-media+.item-title .price{position:absolute;top:14px;right:14px}.cards-caption .item:not(.no-photo) .item-title{padding-top:4px;border-top:2px solid var(--ink)}
.items.list{grid-template-columns:1fr;gap:0}.items.list .item{display:grid;grid-template-columns:200px 1fr auto;gap:8px 36px;align-items:center;padding:30px 0;border:0;border-bottom:1px solid var(--line);border-radius:0;background:none;box-shadow:none}.items.list .item:first-child{border-top:1px solid var(--line)}.items.list .item-media{grid-row:1/4;aspect-ratio:4/3}.items.list .item .item-title,.items.list .item .item-description,.items.list .item .item-action{padding:0;grid-column:2}.items.list .item.no-photo{display:grid;grid-template-columns:1fr;padding:30px 0}.items.list .item.no-photo:before{display:none}.items.list .item.no-photo>*{grid-column:1}.items.featured{grid-template-columns:repeat(var(--columns,2),minmax(0,1fr))}.items.featured .item h3{font-size:1.75rem}.items.featured .item-media{aspect-ratio:${theme.imageShape === "landscape" ? "4/3" : "4/5"}}
.gallery{padding:0 0 var(--section)}.gallery-strip{display:grid;grid-template-columns:repeat(var(--count),minmax(0,1fr));gap:12px;list-style:none;margin:0;padding:0 12px}.gallery-strip li{overflow:hidden;border-radius:calc(var(--radius)*.6);aspect-ratio:1}.gallery-strip li:nth-child(even){transform:translateY(28px)}.gallery-strip img{width:100%;height:100%;object-fit:cover}.gallery-caption{display:flex;justify-content:center;margin-top:56px}
.story{background:var(--story);color:var(--on-story);position:relative;overflow:hidden}.story .kicker{color:inherit;opacity:.85}.story .orn{fill:currentColor;stroke:currentColor}.story .orn-rule{background:currentColor}.story-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(40px,7vw,110px);align-items:start}.story h2{max-width:13ch;margin-top:18px}.story-copy{font-size:1.14rem;line-height:1.95;max-width:52ch}.story-lead{font-family:var(--heading);font-size:clamp(1.45rem,2.2vw,1.95rem);line-height:1.38;letter-spacing:-.015em;margin-bottom:22px;white-space:normal}.story:after{content:"";position:absolute;width:420px;height:420px;border-radius:50%;left:-140px;bottom:-220px;border:1.5px solid currentColor;opacity:.16}
.order-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(40px,7vw,110px)}.order-grid h2{margin-top:16px}.order-copy{max-width:56ch;color:var(--muted);font-size:1.02rem}.steps{list-style:none;counter-reset:step;padding:0;display:grid;gap:14px}.steps li{counter-increment:step;display:grid;grid-template-columns:52px 1fr;gap:18px;align-items:start;padding:22px 24px;border-radius:var(--radius);background:var(--soft);border:1px solid var(--line)}.steps li:before{content:counter(step,decimal-leading-zero);font-family:var(--heading);font-size:1.5rem;line-height:1.1;color:var(--accent)}
.faq{background:var(--tint);color:var(--on-tint)}.faq-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(40px,7vw,110px)}.faq-grid h2{margin-top:16px}.questions{display:grid;gap:12px}.questions details{border-radius:var(--radius);background:var(--paper);color:var(--ink);padding:20px 24px;border:1px solid var(--line)}summary{display:flex;align-items:center;justify-content:space-between;gap:24px;cursor:pointer;list-style:none;font-size:1.02rem;font-weight:600}summary:after{content:"+";display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border-radius:50%;background:var(--hl);color:var(--on-hl);font-size:1.1rem;font-weight:500}details[open] summary:after{content:"\\2212"}summary::-webkit-details-marker{display:none}.questions details p{padding:14px 40px 4px 0;color:var(--muted);font-size:.95rem}
.contact{padding:var(--section) 0}.contact-card{position:relative;overflow:hidden;display:flex;justify-content:space-between;align-items:center;gap:60px;padding:clamp(40px,6vw,80px);border-radius:calc(var(--radius) + 10px);background:var(--deep);color:var(--on-deep)}.contact-card:after{content:"";position:absolute;width:380px;height:380px;right:-120px;top:-160px;border-radius:50%;background:var(--accent);opacity:.35}.contact-card>*{position:relative;z-index:1}.contact .kicker{color:inherit;opacity:.85}.contact .orn{fill:currentColor;stroke:currentColor}.contact .orn-rule{background:currentColor}.contact h2{margin:16px 0 18px;max-width:16ch}.contact-copy{max-width:46ch;opacity:.86;font-size:1rem}.contact-actions{display:flex;flex-direction:column;gap:12px;flex-shrink:0;max-width:100%}.contact-card .button{background:var(--paper);color:var(--ink);border-color:var(--paper)}.contact-card .button.secondary{background:transparent;color:var(--on-deep);border-color:currentColor}
.footer{background:var(--soft);padding:72px 0 30px;border-top:1px solid var(--line)}.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:48px}.footer-brand{display:flex;flex-direction:column;gap:16px;align-items:flex-start}.footer-brand .logo{max-height:72px;max-width:220px}.footer-name{font-family:var(--heading);font-size:1.5rem;letter-spacing:-.02em}.footer-about{color:var(--muted);font-size:.9rem;max-width:40ch}.footer h3{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--accent);margin-bottom:16px}.footer ul{list-style:none;padding:0;margin:0;display:grid;gap:10px;font-size:.92rem}.footer ul a{text-decoration:none;overflow-wrap:anywhere}.footer ul a:hover{text-decoration:underline;text-underline-offset:4px}.footer-base{display:flex;justify-content:space-between;gap:20px;margin-top:56px;padding-top:24px;border-top:1px solid var(--line);font-size:.78rem;color:var(--muted)}.note{background:#fff1b8;color:#273329;padding:0 3px}
@media(min-width:761px) and (max-width:1050px){.wrap{width:calc(100% - 64px)}.items[style="--columns:4"]{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-grid{gap:40px}.hero-collection{height:500px}.navigation{gap:20px}.gallery-strip li:nth-child(n+5){display:none}.gallery-strip{--count:4!important}}
@media(max-width:760px){body{font-size:16px}.wrap{width:calc(100% - 40px)}.topbar .wrap{gap:14px;font-size:.7rem}.header-inner{min-height:0;flex-direction:column;align-items:flex-start;padding:18px 0 16px;gap:14px}.logo{max-width:210px;max-height:72px}.navigation{gap:18px;row-gap:10px}.navigation a{font-size:.8rem}.navigation .button{display:none}.hero{padding:30px 0 52px}.hero-grid,.hero.collection .hero-grid{grid-template-columns:1fr;gap:34px}.hero-copy{gap:20px}h1{font-size:clamp(2.4rem,10.5vw,3.5rem);line-height:1.06}h2{font-size:clamp(1.9rem,8vw,2.5rem)}.hero .sub{font-size:1.02rem}.hero-image{min-height:320px;max-height:460px;aspect-ratio:.95}.hero-collection{height:440px;gap:10px}.hero-tile figcaption{font-size:.66rem;padding:5px 10px;left:8px;bottom:8px}.hero.centered .hero-image{min-height:240px;aspect-ratio:1.3}.frame-offset .hero.split .hero-media,.frame-offset .hero.centered .hero-media{margin:0 14px 14px 0}.frame-offset .hero.split .hero-media:after,.frame-offset .hero.centered .hero-media:after{inset:14px -14px -14px 14px}.hero.cover .hero-grid{min-height:600px}.hero.cover .hero-copy{padding:90px 0 56px}.ribbon p{font-size:1.05rem;padding:13px 0;gap:20px}.quote-band blockquote{font-size:1.45rem}.section{padding:calc(var(--section)*.62) 0}.section-heading{margin-bottom:30px;align-items:flex-start;flex-direction:column;gap:12px}.centered-heading{align-items:center}.items,.items.featured{grid-template-columns:repeat(2,minmax(0,1fr));gap:30px 14px}.item{gap:10px}.item-title{align-items:flex-start;flex-direction:column;gap:8px}.item h3,.items.featured .item h3{font-size:1.08rem}.item-description{font-size:.84rem}.item.no-photo{padding:18px}.cards-framed .item{padding:8px 8px 16px}.cards-framed .item .item-title,.cards-framed .item .item-description,.cards-framed .item .item-action{padding:0 4px}.cards-lifted .item .item-title,.cards-lifted .item .item-description,.cards-lifted .item .item-action{padding:0 12px}.items.list .item{grid-template-columns:96px 1fr;gap:8px 18px;padding:22px 0}.gallery-strip{--count:3!important;padding:0 8px;gap:8px}.gallery-strip li:nth-child(n+4){display:none}.gallery-strip li:nth-child(even){transform:translateY(16px)}.gallery-caption{margin-top:36px}.story-grid,.order-grid,.faq-grid{grid-template-columns:1fr;gap:26px}.story-copy{font-size:1.04rem}.steps li{grid-template-columns:40px 1fr;padding:18px}.questions details{padding:16px 18px}.contact-card{flex-direction:column;align-items:flex-start;gap:30px;padding:36px 24px}.contact-actions,.contact-actions .button{width:100%}.footer{padding:52px 0 26px}.footer-grid{grid-template-columns:1fr;gap:34px}.footer-base{flex-direction:column;gap:6px}}
@media(max-width:360px){.items,.items.featured{grid-template-columns:1fr}.item-title{flex-direction:row}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.item-photo,.button,.navigation a:after{transition:none}}
`;
}

// Short "how to order" text as numbered steps; anything with notes or one long sentence stays a paragraph
function steps(value: string): string[] | null {
  if (value.includes("[")) return null;
  const parts = value.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9“"])/).map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 && parts.length <= 4 ? parts : null;
}

// The first sentence of the story leads it, when the rest still says something
function lead(value: string): [string, string] | null {
  const match = value.trim().match(/^(.{20,180}?[.!?])\s+([\s\S]{40,})$/);
  return match ? [match[1], match[2]] : null;
}

export function renderSite(input: SiteInput): string {
  const { copy, design, images, highlightNotes: mark } = input;
  const theme = direction(design);
  const name = input.name.trim() || "Your business";
  const at = (hash: string) => `${input.anchorBase ?? ""}${hash}`;
  const label = (value: string | undefined, fallback: string) => text(value?.trim() || fallback, mark);
  const ornament = ORNAMENT[theme.ornament ?? "rule"] ?? "";
  const kicker = (value: string) => `<p class="kicker">${ornament}<span>${escapeHtml(value)}</span></p>`;
  const header = design.showHero ? (design.heroImage ? images.photos[design.heroImage.versionId] : null) ?? images.hero ?? copy.offerings.map((offering) => { const ref = itemFor(design, offering.name)?.photo; return ref ? images.photos[ref.versionId] : undefined; }).find(Boolean) : null;
  const productPhotos = (shows(design, "offerings") ? copy.offerings : []).flatMap((offering) => {
    const ref = itemFor(design, offering.name)?.photo;
    const photo = ref ? images.photos[ref.versionId] : null;
    return photo && photo.src !== header?.src ? [{ name: offering.name, photo }] : [];
  }).filter((entry, index, all) => all.findIndex((other) => other.photo.src === entry.photo.src) === index);
  const collection = design.heroComposition !== "single" && theme.layout === "split" && header && productPhotos.length >= 2;
  const heroMedia = header ? `<div class="hero-media" data-edit="hero">${image(header, "", "hero-image")}</div>` : "";
  const heroVisual = collection ? `<div class="hero-collection">${heroMedia}${productPhotos.slice(0, 2).map(({ name, photo }) => `<figure class="hero-tile" data-product="${escapeHtml(name)}">${image(photo, name, "hero-detail")}<figcaption>${escapeHtml(name)}</figcaption></figure>`).join("")}</div>` : heroMedia;
  const sections = new Map<string, { html: string; href: string; label: string }>();
  const offerings = shows(design, "offerings") ? copy.offerings : [];
  if (offerings.length) {
    const items = offerings.map((offering) => {
      const item = itemFor(design, offering.name);
      const photo = item?.photo ? images.photos[item.photo.versionId] : null;
      const action = item?.buyUrl ? `<a class="text-link" href="${escapeHtml(item.buyUrl)}" rel="noopener noreferrer" target="_blank">Buy now<span class="sr"> ${escapeHtml(offering.name)} (opens a checkout page)</span></a>` : shows(design, "contact") ? `<a class="text-link" href="${at("#contact")}">Ask about this <span aria-hidden="true">→</span></a>` : "";
      return `<li data-product="${escapeHtml(offering.name)}" class="item${photo ? "" : " no-photo"}">${photo ? `<div class="item-media">${image(photo, offering.name, "item-photo")}</div>` : ""}<div class="item-title"><h3>${text(offering.name, mark)}</h3>${item?.priceCents != null ? `<p class="price">${dollars(item.priceCents)}</p>` : ""}</div>${(item?.description ?? offering.description).trim() ? `<p class="item-description">${text(item?.description ?? offering.description, mark)}</p>` : ""}${action ? `<div class="item-action">${action}</div>` : ""}</li>`;
    });
    const columns = Math.min(theme.catalogLayout === "featured" ? 2 : items.length === 4 || items.length >= 7 ? 4 : 3, items.length);
    sections.set("offerings", { href: "#shop", label: "What we offer", html: `<section class="section catalog" id="shop" aria-labelledby="shop-title"><div class="wrap"><div class="section-heading"><div>${kicker(`Discover ${name}`)}<h2 id="shop-title">${label(design.labels?.catalog, productPhotos.length ? "The collection." : "What we offer")}</h2></div></div><ul class="items ${theme.catalogLayout ?? "grid"}" style="--columns:${columns}">${items.join("")}</ul></div></section>` });
  }
  if (shows(design, "about") && copy.about.trim()) {
    const split = lead(copy.about);
    const story = split ? `<p class="story-lead">${text(split[0], mark)}</p><p>${text(split[1], mark)}</p>` : `<p>${text(copy.about, mark)}</p>`;
    sections.set("about", { href: "#about", label: "About", html: `<section class="section story" id="about" aria-labelledby="about-title"><div class="wrap story-grid"><div>${kicker(`The story behind ${name}`)}<h2 id="about-title">${label(design.labels?.about, "Made personal.")}</h2></div><div class="story-copy" data-edit="about">${story}</div></div></section>` });
  }
  if (shows(design, "howToBuy") && copy.howToBuy.trim()) {
    const list = steps(copy.howToBuy);
    const body = list ? `<ol class="steps" data-edit="howToBuy">${list.map((step) => `<li><p>${text(step, mark)}</p></li>`).join("")}</ol>` : `<p class="order-copy" data-edit="howToBuy">${text(copy.howToBuy, mark)}</p>`;
    sections.set("howToBuy", { href: "#order", label: "How to order", html: `<section class="section" id="order" aria-labelledby="order-title"><div class="wrap order-grid"><div>${kicker("The next step")}<h2 id="order-title">${label(design.labels?.order, "How it works.")}</h2></div>${body}</div></section>` });
  }
  if (shows(design, "faq") && copy.faq.length) sections.set("faq", { href: "#faq", label: "Questions", html: `<section class="section faq" id="faq" aria-labelledby="faq-title"><div class="wrap faq-grid"><div>${kicker("A little clarity")}<h2 id="faq-title">Good to know.</h2></div><div class="questions">${copy.faq.map((faq) => `<details><summary>${text(faq.question, mark)}</summary><p>${text(faq.answer, mark)}</p></details>`).join("")}</div></div></section>` });
  const email = design.showEmail && input.contact.email ? emailHref(input.contact.email) : null;
  const phone = design.showPhone && input.contact.phone ? phoneHref(input.contact.phone) : null;
  if (shows(design, "contact") && (copy.contact.trim() || email || phone)) sections.set("contact", { href: "#contact", label: "Contact", html: `<section class="contact" id="contact" aria-labelledby="contact-title"><div class="wrap"><div class="contact-card"><div>${kicker("Let's talk")}<h2 id="contact-title">${label(design.labels?.contact, "Something in mind?")}</h2>${copy.contact.trim() ? `<p class="contact-copy" data-edit="contact">${text(copy.contact, mark)}</p>` : ""}</div><div class="contact-actions">${email ? `<a class="button" href="${escapeHtml(email)}">Email ${escapeHtml(input.contact.email!)}</a>` : ""}${phone ? `<a class="button secondary" href="${escapeHtml(phone)}">Call ${escapeHtml(input.contact.phone!)}</a>` : ""}</div></div></div></section>` });
  const order = [...new Set([...(theme.sectionOrder ?? []), ...SITE_SECTIONS])];
  const ordered = order.flatMap((key) => sections.has(key) ? [{ key, ...sections.get(key)! }] : []);
  const buyable = offerings.some((offering) => itemFor(design, offering.name)?.buyUrl) && sections.has("offerings");
  const action = buyable ? { label: "Shop now", href: "#shop" } : sections.has("offerings") && productPhotos.length ? { label: "Explore the collection", href: "#shop" } : sections.has("contact") ? { label: "Get in touch", href: "#contact" } : sections.has("offerings") ? { label: "Explore what we offer", href: "#shop" } : null;
  const layout = header ? theme.layout : theme.layout === "cover" ? "split" : theme.layout;
  const logoImage = design.showLogo ? images.logo : null;
  const logo = logoImage ? image(logoImage, `${name} logo`, "logo") : "";
  // A wide logo already spells the name
  const wordmark = Boolean(logoImage && logoImage.width >= logoImage.height * 1.8);
  const title = copy.seoTitle.trim() || name;
  const chips = offerings.length >= 2 && !collection ? `<ul class="chips" aria-label="What we offer">${offerings.slice(0, 4).map((offering) => `<li>${escapeHtml(offering.name)}</li>`).join("")}</ul>` : "";
  const ribbon = offerings.length >= 3 && theme.ornament !== "none" ? `<div class="ribbon" aria-hidden="true"><p>${[...offerings, ...offerings, ...offerings].slice(0, 12).map((offering) => `<span>${escapeHtml(offering.name)}</span>${ornament || ORNAMENT.star}`).join("")}</p></div>` : "";
  const quote = copy.intro.trim() ? theme.pullQuote === false ? `<div class="intro-band"><div class="wrap"><p data-edit="intro">${text(copy.intro, mark)}</p></div></div>` : `<section class="quote-band" aria-label="About ${escapeHtml(name)}"><div class="wrap"><blockquote data-edit="intro"><p>${text(copy.intro, mark)}</p></blockquote>${kicker(name)}</div></section>` : "";
  const shots = [...(header ? [{ name, photo: header }] : []), ...productPhotos];
  const gallery = theme.gallery && shots.length >= 3 ? `<section class="gallery" aria-label="Photos from ${escapeHtml(name)}"><ul class="gallery-strip" style="--count:${Math.min(shots.length, 5)}">${shots.slice(0, 5).map(({ name, photo }) => `<li>${image(photo, name, "gallery-photo")}</li>`).join("")}</ul></section>` : "";
  const main = ordered.map((section) => section.key === "offerings" ? section.html + gallery : section.html).join("\n");
  const topbar = email || phone ? `<div class="topbar"><div class="wrap">${email ? `<a href="${escapeHtml(email)}">${escapeHtml(input.contact.email!)}</a>` : ""}${phone ? `<a href="${escapeHtml(phone)}">${escapeHtml(input.contact.phone!)}</a>` : ""}</div></div>` : "";
  const navCta = action ? `<a class="button small" href="${at(action.href)}">${action.label}</a>` : "";
  const footer = `<footer class="footer"><div class="wrap"><div class="footer-grid"><div class="footer-brand">${logoImage ? image(logoImage, `${name} logo`, "logo") : ""}${wordmark ? "" : `<p class="footer-name">${escapeHtml(name)}</p>`}${copy.seoDescription.trim() ? `<p class="footer-about">${escapeHtml(copy.seoDescription)}</p>` : ""}</div>${ordered.length ? `<nav aria-label="Footer"><h3>Explore</h3><ul>${ordered.map((section) => `<li><a href="${at(section.href)}">${section.label}</a></li>`).join("")}</ul></nav>` : "<div></div>"}${email || phone ? `<div><h3>Contact</h3><ul>${email ? `<li><a href="${escapeHtml(email)}">${escapeHtml(input.contact.email!)}</a></li>` : ""}${phone ? `<li><a href="${escapeHtml(phone)}">${escapeHtml(input.contact.phone!)}</a></li>` : ""}</ul></div>` : "<div></div>"}</div><div class="footer-base"><span>© ${input.year} ${escapeHtml(name)}</span><span>${escapeHtml(title)}</span></div></div></footer>`;
  const frame = theme.heroFrame ?? "plain";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${SITE_CSP}"><meta name="referrer" content="strict-origin-when-cross-origin"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(copy.seoDescription)}">${design.showLogo && images.favicon ? `<link rel="icon" href="${escapeHtml(images.favicon.src)}">` : ""}<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(copy.seoDescription)}"><style>${stylesheet(theme, design.imagePosition ?? "center")}</style></head>
<body class="frame-${frame} cards-${theme.cardStyle ?? "minimal"}"><a class="skip" href="${at("#main")}">Skip to content</a>${topbar}<header class="header"><div class="wrap header-inner"><a class="brand" href="${at("#top")}">${logo}<span${wordmark ? ' class="sr"' : ""}>${escapeHtml(name)}</span></a><nav class="navigation" aria-label="Main">${ordered.map((section) => `<a href="${at(section.href)}">${section.label}</a>`).join("")}${navCta}</nav></div></header><main id="main"><section class="hero ${layout}${collection ? " collection" : ""}${header ? "" : " no-image"}" id="top"><div class="wrap hero-grid"><div class="hero-copy"><p class="eyebrow">${ornament}<span>${escapeHtml(name)}</span></p><h1 data-edit="headline">${text(copy.headline || name, mark)}</h1>${copy.subheadline.trim() ? `<p class="sub" data-edit="subheadline">${text(copy.subheadline, mark)}</p>` : ""}<div class="hero-actions">${action ? `<a class="button" href="${at(action.href)}">${action.label}</a>` : ""}${sections.has("offerings") && action?.href !== "#shop" ? `<a class="text-link" href="${at("#shop")}">Explore what we offer <span aria-hidden="true">→</span></a>` : ""}</div>${chips}</div>${heroVisual}</div></section>${ribbon}${quote}${main}</main>${footer}</body></html>`;
}
