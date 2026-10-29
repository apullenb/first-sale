import { describe, expect, it } from "vitest";
import { PLATFORM_DATA } from "@/data/website-platforms";
import { type PasteContext, pasteFor } from "./paste";
import { defaultDesign } from "./site/design";
import type { WebsiteCopy } from "./types";

const copy: WebsiteCopy = {
  headline: "Fresh bread",
  subheadline: "",
  intro: "Sourdough, made by hand.",
  about: "I started baking for friends.",
  offerings: [{ name: "Sourdough", description: "A tangy loaf." }],
  howToBuy: "Order by email.",
  contact: "hello@risebakery.com",
  faq: [{ question: "Do you deliver?", answer: "Not yet." }],
  seoTitle: "Rise Bakery",
  seoDescription: "Fresh bread in Columbus.",
};

const context = (patch: Partial<PasteContext> = {}): PasteContext => ({
  name: "Rise Bakery",
  copy,
  design: { ...defaultDesign("#1e6b52"), items: [{ name: "Sourdough", priceCents: 850, buyUrl: "", photo: { photoId: "p1", versionId: "v1" } }] },
  brand: {
    colors: [{ hex: "#1e6b52", name: "Forest" }, { hex: "#f5d76e", name: "Butter" }],
    logo: "/brand/files/logo",
    icon: null,
    practice: { logo: false, icon: false },
  },
  photos: { v1: { href: "/photos/p1/versions/v1/file", practice: false } },
  domain: "risebakery.com",
  domainSetup: PLATFORM_DATA.shopify.domainSetup,
  ...patch,
});

describe("pasteFor", () => {
  it("fills each step from the owner's own words, skipping empty ones", () => {
    expect(pasteFor(["seo", "home"], context())).toEqual([
      { kind: "text", label: "Page title", text: "Rise Bakery" },
      { kind: "text", label: "Description", text: "Fresh bread in Columbus." },
      { kind: "text", label: "Headline", text: "Fresh bread" },
      { kind: "text", label: "Welcome", text: "Sourdough, made by hand." },
    ]);
    expect(pasteFor(["faq"], context())).toEqual([{ kind: "text", label: "Question 1", text: "Do you deliver?\nNot yet." }]);
  });

  it("gives items with the owner's price and photo", () => {
    expect(pasteFor(["items"], context())).toEqual([
      { kind: "text", label: "Sourdough", text: "Sourdough\nA tangy loaf.\nPrice: $8.50" },
      { kind: "file", label: "Photo of Sourdough", href: "/photos/p1/versions/v1/file", note: null },
    ]);
  });

  it("labels practice pictures", () => {
    const practice = context({ photos: { v1: { href: "/photos/p1/versions/v1/file", practice: true } } });
    expect(pasteFor(["items"], practice)[1]).toMatchObject({ kind: "file", note: expect.stringMatching(/Practice preview/) });
    const brand = { ...context().brand!, practice: { logo: true, icon: false } };
    expect(pasteFor(["logo"], context({ brand }))[0]).toMatchObject({ note: expect.stringMatching(/Practice preview/) });
  });

  it("puts the chosen color first and points to Create your logo when there's no brand", () => {
    expect(pasteFor(["colors"], context()).map((value) => value.label)).toEqual(["Main color", "Butter"]);
    const missing = pasteFor(["colors", "logo"], context({ brand: null }));
    expect(missing.map((value) => value.kind)).toEqual(["color", "missing", "missing"]);
    expect(missing.slice(1).map((value) => ("href" in value ? value.href : null))).toEqual(["/logo", "/logo"]);
  });

  it("says where to draft words before there are any", () => {
    expect(pasteFor(["pages", "items"], context({ copy: null })).every((value) => value.kind === "missing")).toBe(true);
  });

  it("gives the platform's DNS records, or says where the platform shows them", () => {
    const [shopify] = pasteFor(["dns"], context());
    expect(shopify).toMatchObject({ kind: "records", label: "Records for risebakery.com" });
    const [square] = pasteFor(["dns"], context({ domainSetup: PLATFORM_DATA.square.domainSetup }));
    expect(square.kind).toBe("missing");
  });

  it("gives nothing for a site with no records to add", () => {
    expect(pasteFor(["dns"], context({ domainSetup: null }))).toEqual([]);
  });
});
