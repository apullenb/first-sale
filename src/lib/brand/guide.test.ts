import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/documents/pdf";
import { pngBytes } from "@/lib/photos/test-images";
import { colorRows } from "./colors";
import { fontPair, logoGuidePdf } from "./guide";

const colors = [
  { hex: "#1f3a2e", name: "Forest" },
  { hex: "#E9DCC4", name: "Cream" },
];

describe("logo guide rules", () => {
  it("give each color its codes and how readable it is on white", () => {
    expect(colorRows(colors)).toEqual([
      { name: "Forest", hex: "#1F3A2E", rgb: "RGB 31, 58, 46", ratio: 12.3, use: "Easy to read on white, even as small text." },
      { name: "Cream", hex: "#E9DCC4", rgb: "RGB 233, 220, 196", ratio: 1.4, use: "Too light to read on white: use it for shapes and backgrounds, not words." },
    ]);
  });

  it("suggest free fonts that suit the logo's lettering", () => {
    expect(fontPair("warm rounded serif, lowercase")).toEqual({ headings: "Nunito", body: "Nunito" });
    expect(fontPair("classic serif lettering")).toEqual({ headings: "Lora", body: "Source Sans 3" });
    expect(fontPair("clean, modern sans-serif lettering")).toEqual({ headings: "Inter", body: "Inter" });
    expect(fontPair("sturdy slab-serif lettering")).toEqual({ headings: "Roboto Slab", body: "Roboto" });
    expect(fontPair("hand-lettered brush lettering")).toEqual({ headings: "Poppins", body: "Lato" });
  });
});

describe("the logo guide PDF", () => {
  const input = {
    businessName: "Rise Bakery",
    tagline: "Sourdough and pastries",
    colors,
    lettering: "classic serif lettering",
    simulated: false,
    images: [
      { label: "Main logo", file: { mimeType: "image/png", data: pngBytes(300, 200, 40) } },
      { label: "Icon", file: { mimeType: "image/png", data: pngBytes(100, 100, 40) } },
    ],
    now: new Date("2026-10-28T12:00:00Z"),
  };

  it("fits on one page, with the logo, colors, fonts, space rules and do's and don'ts", async () => {
    const bytes = await logoGuidePdf(input);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    const text = (await readPdf(bytes)).pages[0].text;
    for (const expected of ["Rise Bakery logo guide", "Sourdough and pastries", "#1F3A2E", "RGB 233, 220, 196", "Lora", "quarter of its height", "Do", "stretch", "uspto.gov"]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain("Practice");
  });

  it("flows onto a second page, with the footer on each, when the answers are long", async () => {
    const long = "x".repeat(14);
    const bytes = await logoGuidePdf({
      ...input,
      businessName: `Rise ${long} Bakery ${long} Cafe ${long}`,
      tagline: `${long} ${long} ${long} ${long}`,
      colors: [1, 2, 3].map((n) => ({ hex: "#1F3A2E", name: `A very long color name ${n} ${long}` })),
      lettering: "warm, hand-lettered brush lettering with long flowing tails, tight spacing and a slight bounce, still easy to read at small sizes",
      simulated: true,
    });
    const pages = (await readPdf(bytes)).pages;
    expect(pages.length).toBe(2);
    for (const page of pages) expect(page.text).toContain("Not checked for trademarks");
    expect(pages.map((page) => page.text).join("\n")).toContain("busy photo");
  });

  it("says so when it's made from practice previews, which it can't show", async () => {
    const bytes = await logoGuidePdf({ ...input, simulated: true, images: [{ label: "Main logo", file: { mimeType: "image/svg+xml", data: new TextEncoder().encode("<svg/>") } }] });
    const text = (await readPdf(bytes)).pages[0].text;
    expect(text).toContain("Practice preview, not made by Muse");
    expect(text).toContain("no logo drawn");
  });
});
