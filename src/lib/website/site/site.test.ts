import { describe, expect, it } from "vitest";
import { brandFileUrl } from "@/lib/brand/files";
import { brandAssetId } from "@/lib/website/look";
import type { WebsiteContent, WebsiteCopy } from "@/lib/website/types";
import { placeholderCount } from "@/lib/website/words";
import type { BrandKit } from "@/lib/brand/types";
import { testProfile } from "@/test/fixtures";
import { publishCheck, type SiteState, siteSignature } from "./check";
import { buyLinkProblem, defaultDesign, dollars, isKnownPaymentLink, itemFor, parseDollars, productPrice, readDesign, type SiteDesign, withProducts } from "./design";
import { publishReadiness, type PublishCheck } from "./ready";
import { emailHref, phoneHref, renderSite, type SiteInput } from "./render";

const copy: WebsiteCopy = {
  headline: "Fresh bread in Columbus",
  subheadline: "Baked every morning.",
  intro: "Sourdough and rolls, made by hand.",
  about: "I started baking for friends.",
  offerings: [
    { name: "Sourdough", description: "A tangy loaf." },
    { name: "Cinnamon rolls", description: "Soft and sweet." },
  ],
  howToBuy: "Order by email, pick up Saturday.",
  contact: "Email us any time.",
  faq: [{ question: "Do you deliver?", answer: "Not yet." }],
  seoTitle: "Rise Bakery",
  seoDescription: "Fresh bread in Columbus.",
};

const design = (patch: Partial<SiteDesign> = {}): SiteDesign => ({ ...defaultDesign("#1e6b52"), ...patch });

const input = (patch: Partial<SiteInput> = {}): SiteInput => ({
  name: "Rise Bakery",
  copy,
  design: design(),
  images: { logo: null, hero: null, favicon: null, photos: {} },
  contact: { email: "hello@risebakery.com", phone: "(614) 555-0100" },
  year: 2026,
  highlightNotes: false,
  ...patch,
});

describe("site design rules", () => {
  it("reads plain dollar amounts as cents", () => {
    expect(parseDollars("12")).toBe(1200);
    expect(parseDollars("$12.5")).toBe(1250);
    expect(parseDollars("1,200.00")).toBe(120000);
    expect(parseDollars("12.345")).toBeNull();
    expect(parseDollars("twelve")).toBeNull();
    expect(parseDollars("-3")).toBeNull();
    expect(dollars(1250)).toBe("$12.50");
    expect(dollars(1200)).toBe("$12");
  });

  it("only takes https buy links without sign-in details", () => {
    expect(buyLinkProblem("")).toBeNull();
    expect(buyLinkProblem("https://buy.stripe.com/abc")).toBeNull();
    expect(buyLinkProblem("http://buy.stripe.com/abc")).toMatch(/https/);
    expect(buyLinkProblem("javascript:alert(1)")).toMatch(/https/);
    expect(buyLinkProblem("https://me:secret@example.com/pay")).toMatch(/password/);
    expect(buyLinkProblem("https://localhost/pay")).toMatch(/web address/);
    expect(isKnownPaymentLink("https://square.link/u/abc")).toBe(true);
    expect(isKnownPaymentLink("https://example.com/pay")).toBe(false);
  });

  it("keeps each saved field that still reads, and fills the rest", () => {
    const read = readDesign({ style: "bold", color: "red", hidden: ["faq"], items: "nope" }, "#AABBCC");
    expect(read).toMatchObject({ style: "bold", color: "#aabbcc", hidden: ["faq"], items: [], showLogo: true });
    expect(readDesign(null, "not a color").color).toBe("#1e6b52");
  });

  it("adds saved products after the drafted items, unless turned off or already there", () => {
    const products = [
      { id: "p1", name: "Country sourdough loaf", description: "Naturally leavened.", priceCents: 950 },
      { id: "p2", name: "sourdough", description: "Same as the drafted one.", priceCents: 800 },
    ];
    const shown = withProducts(copy, products, design());
    expect(shown.copy.offerings.map((offering) => offering.name)).toEqual(["Sourdough", "Country sourdough loaf"]);
    // An item with no price of its own shows its product's price; one the owner typed stays
    expect(shown.design.items.map((item) => [item.name, item.priceCents])).toEqual([
      ["Sourdough", 800],
      ["Country sourdough loaf", 950],
    ]);
    const typed = design({ items: [{ name: "Sourdough", priceCents: 700, buyUrl: "", photo: null }] });
    expect(itemFor(withProducts(copy, products, typed).design, "sourdough")?.priceCents).toBe(700);
    expect(withProducts(copy, products, design({ hiddenProducts: ["p1"] })).copy.offerings).toHaveLength(1);
    expect(productPrice(products, "Sourdough")).toBe(800);
    expect(productPrice(products, "Bagels")).toBeNull();
    expect(readDesign({ hiddenProducts: "nope" }, "#1e6b52").hiddenProducts).toEqual([]);
  });

  it("brings product photos into matching drafted items and honors explicit image removal", () => {
    const photo = { photoId: "photo-1", versionId: "original:photo-1" };
    const products = [{ id: "p1", name: "Sourdough", description: "Current product description", priceCents: 800, photo }];
    const shown = withProducts(copy, products, design());
    expect(shown.copy.offerings[0].description).toBe("Current product description");
    const crowded = { ...copy, offerings: Array.from({ length: 12 }, (_, i) => ({ name: `Draft item ${i}`, description: "Draft" })) };
    expect(withProducts(crowded, products, design()).copy.offerings.map((item) => item.name)).toEqual(["Sourdough"]);
    expect(itemFor(shown.design, "Sourdough")?.photo).toEqual(photo);
    const hidden = design({ items: [{ name: "Sourdough", priceCents: 800, buyUrl: "", photo: null, hidePhoto: true }] });
    expect(itemFor(withProducts(copy, products, hidden).design, "Sourdough")?.photo).toBeNull();
    expect(withProducts(copy, products, design({ hiddenProducts: ["p1"] })).copy.offerings.map((item) => item.name)).not.toContain("Sourdough");
  });

  it("finds the asset id in a brand file link", () => {
    expect(brandAssetId({ url: brandFileUrl("asset-1"), width: 1, height: 1 })).toBe("asset-1");
    expect(brandAssetId({ url: "/photos/x/file", width: 1, height: 1 })).toBeNull();
    expect(brandAssetId(null)).toBeNull();
  });
});

describe("renderSite", () => {
  it("renders AI themes independently of the previously chosen preset", () => {
    const theme = { name: "Brand studio", rationale: "Brand-led", layout: "centered" as const, font: "sans" as const, background: "#faf3e0", foreground: "#203340", surface: "#ffffff", accent: "#35566e", radius: 8, titleScale: 0.9 };
    const warm = renderSite(input({ design: design({ style: "warm", theme }) }));
    const bold = renderSite(input({ design: design({ style: "bold", theme }) }));
    expect(warm).toBe(bold);
    expect(warm).toContain("font-style:normal");
    expect(warm).not.toContain(".contact h2{font-style:italic}");
  });

  it("escapes every piece of the owner's text and runs no scripts", () => {
    const html = renderSite(input({ name: `Rise <script>alert("x")</script>`, copy: { ...copy, about: `<img src=x onerror=alert(1)>` } }));
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain(`http-equiv="Content-Security-Policy"`);
    expect(html).toContain("default-src 'none'");
  });

  it("shows prices and buy links only from the owner's design", () => {
    const plain = renderSite(input());
    expect(plain).not.toMatch(/\$\d/);
    expect(plain).not.toContain("Buy now");
    expect(plain).toContain(`href="#contact">Get in touch`);

    const priced = renderSite(
      input({ design: design({ items: [{ name: "sourdough", priceCents: 850, buyUrl: "https://buy.stripe.com/abc", photo: null }] }) }),
    );
    expect(priced).toContain(`<p class="price">$8.50</p>`);
    expect(priced).toContain(`href="https://buy.stripe.com/abc" rel="noopener noreferrer" target="_blank"`);
    expect(priced).toContain(`href="#shop">Shop now`);
  });

  it("leaves out hidden parts and turned-off pictures", () => {
    const logo = { src: "/brand/files/logo?view=1", width: 400, height: 200 };
    const html = renderSite(input({ design: design({ hidden: ["faq", "about"], showLogo: false }), images: { logo, hero: null, favicon: logo, photos: {} } }));
    expect(html).not.toContain(`id="faq"`);
    expect(html).not.toContain(`id="about"`);
    expect(html).not.toContain("/brand/files/logo");
    expect(html).toContain(`id="order"`);
  });

  it("builds contact buttons only from a real email and phone", () => {
    const html = renderSite(input());
    expect(html).toContain(`href="mailto:hello@risebakery.com"`);
    expect(html).toContain(`href="tel:6145550100"`);
    expect(emailHref("not an email")).toBeNull();
    expect(emailHref(`a"b@x.com`)).toBeNull();
    expect(phoneHref("call me")).toBeNull();
    expect(renderSite(input({ design: design({ showPhone: false }) }))).not.toContain("tel:");
  });

  it("keeps a bad color out of the stylesheet", () => {
    const html = renderSite(input({ design: design({ color: "red;}</style><script>" }) }));
    expect(html).not.toContain("</style><script>");
    expect(html).toContain("#1e6b52");
  });

  it("keeps in-page links inside the preview", () => {
    expect(renderSite(input())).toContain(`<a href="#about">About</a>`);
    const preview = renderSite(input({ anchorBase: "about:srcdoc" }));
    expect(preview).toContain(`<a href="about:srcdoc#about">About</a>`);
    expect(preview).not.toMatch(/href="#/);
  });

  it("marks [bracketed] notes in the preview only", () => {
    const withNote = { ...copy, about: "[Tell your story]" };
    expect(renderSite(input({ copy: withNote, highlightNotes: true }))).toContain(`<mark class="note">[Tell your story]</mark>`);
    expect(renderSite(input({ copy: withNote }))).not.toContain("<mark");
  });
});

describe("publishReadiness", () => {
  const content: WebsiteContent = { ...copy, flags: [], platform: "first_sale", generatedAt: "2026-10-28T00:00:00Z", simulated: false };
  const check = (patch: Partial<PublishCheck> = {}): PublishCheck => ({
    platform: "first_sale",
    named: true,
    content,
    approved: true,
    design: design(),
    contact: { email: "hello@risebakery.com", phone: null },
    practiceBrand: false,
    practicePhotos: 0,
    conflicts: [],
    ...patch,
  });

  it("is ready once approved words are complete", () => {
    expect(publishReadiness(check()).blockers).toEqual([]);
  });

  it("blocks words that aren't approved, finished or written for this site", () => {
    expect(publishReadiness(check({ approved: false })).blockers).toEqual(["Approve your words in Page content."]);
    expect(publishReadiness(check({ content: { ...content, about: "[Add your story] and [more]" } })).blockers[0]).toMatch(/2 \[bracketed\] notes/);
    expect(publishReadiness(check({ content: { ...content, platform: "wix" } })).blockers[0]).toMatch(/another platform/);
    expect(publishReadiness(check({ content: null })).blockers).toEqual(["Build a draft or add page content in the website editor."]);
    expect(publishReadiness(check({ platform: "square" })).blockers[0]).toMatch(/SnapStart site/);
    expect(publishReadiness(check({ named: false })).blockers).toEqual(["Give your business a name in your answers first."]);
  });

  it("blocks bad buy links and a site with no way to get in touch", () => {
    const bad = design({ items: [{ name: "Sourdough", priceCents: 800, buyUrl: "http://pay.example.com", photo: null }] });
    expect(publishReadiness(check({ design: bad })).blockers).toEqual(["Sourdough: Buy links must start with https://."]);
    const silent = check({ content: { ...content, contact: "" }, contact: { email: null, phone: null } });
    expect(publishReadiness(silent).blockers[0]).toMatch(/reach you/);
    expect(publishReadiness(check({ design: design({ hidden: ["contact"] }) })).blockers[0]).toMatch(/reach you/);
  });

  it("notes practice pictures without blocking the demo finish", () => {
    const { blockers, notes } = publishReadiness(check({ practiceBrand: true, practicePhotos: 2 }));
    expect(blockers).toEqual([]);
    expect(notes.join(" ")).toMatch(/practice preview/);
  });

  it("notes what isn't enforced", () => {
    const { notes } = publishReadiness(check({ content: { ...content, flags: ["“$5” wasn’t in your answers"] } }));
    expect(notes.join(" ")).toMatch(/1 number/);
    expect(notes.join(" ")).toMatch(/No item has a buy link/);
  });
});

describe("saved site checks", () => {
  const content: WebsiteContent = { ...copy, flags: [], platform: "first_sale", generatedAt: "2026-10-28T00:00:00Z", simulated: false };
  const file = (id: string) => ({ url: brandFileUrl(id), width: 10, height: 10 });
  const brand: BrandKit = {
    businessName: "Rise Bakery",
    tagline: "",
    lettering: "",
    colors: [{ hex: "#1e6b52", name: "Forest" }],
    logos: { primary: file("logo"), stacked: null, profile: file("icon"), solid: null },
    images: { websiteHero: file("hero"), facebookCover: null, youtubeBanner: null, linkPreview: null },
    simulated: true,
    uploaded: false,
  };
  const state = (patch: Partial<SiteState> = {}): SiteState => ({
    profile: testProfile(),
    platform: "first_sale",
    approved: true,
    name: "Rise Bakery",
    content,
    design: design({ items: [{ name: "Sourdough", priceCents: 800, buyUrl: "", photo: { photoId: "p1", versionId: "v1" } }] }),
    brand,
    brandPractice: { logo: false, hero: false, icon: false },
    library: [{ id: "v1", photoId: "p1", width: 10, height: 10, simulated: false }],
    products: [],
    contact: { email: "hello@risebakery.com", phone: null },
    year: 2026,
    ...patch,
  });

  it("judges each brand file on its own, not the whole kit", () => {
    // The kit is practice because of some other file; the logo and header shown are real
    expect(publishCheck(state()).practiceBrand).toBe(false);
    expect(publishCheck(state({ brandPractice: { logo: false, hero: true, icon: false } })).practiceBrand).toBe(true);
    expect(publishCheck(state({ brandPractice: { logo: false, hero: true, icon: false }, design: design({ showHero: false }) })).practiceBrand).toBe(false);
    expect(publishCheck(state({ library: [{ id: "v1", photoId: "p1", width: 10, height: 10, simulated: true }] })).practicePhotos).toBe(1);
  });

  it("changes the signature with anything that changes the page", () => {
    const base = siteSignature(state());
    expect(siteSignature(state())).toBe(base);
    expect(siteSignature(state({ contact: { email: "new@risebakery.com", phone: null } }))).not.toBe(base);
    expect(siteSignature(state({ design: design({ showLogo: false }) }))).not.toBe(base);
    expect(siteSignature(state({ content: { ...content, about: "A new story." } }))).not.toBe(base);
    expect(siteSignature(state({ library: [] }))).not.toBe(base);
    // A saved product joins the site, so adding or repricing one changes it too
    const loaf = { id: "p9", name: "Country loaf", description: "Naturally leavened.", priceCents: 950 };
    const withLoaf = siteSignature(state({ products: [loaf] }));
    expect(withLoaf).not.toBe(base);
    expect(siteSignature(state({ products: [{ ...loaf, priceCents: 1000 }] }))).not.toBe(withLoaf);
    // Bookkeeping alone doesn't count
    expect(siteSignature(state({ content: { ...content, generatedAt: "2026-10-29T00:00:00Z" } }))).toBe(base);
  });
});

describe("placeholderCount", () => {
  it("counts only notes in the words, not the lists that hold them", () => {
    expect(placeholderCount(copy)).toBe(0);
    expect(placeholderCount({ ...copy, faq: [{ question: "Hours?", answer: "[Add your hours]" }] })).toBe(1);
  });
});
