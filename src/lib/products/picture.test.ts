import { describe, expect, it } from "vitest";
import { imageStyle } from "@/lib/brand/image-style";
import { KEEP_PRODUCT } from "@/lib/photos/instructions";
import { createMockImageProvider } from "@/lib/ai/providers/mock-image";
import { makeItemPicture, type NewItemPicture, pictureRequest, viewScene } from "./picture";

const item = { kind: "product" as const, name: "Walnut board", description: "A walnut cutting board with a juice groove", location: "", included: "" };
const style = imageStyle({ vibes: [], leanings: { tone: null, energy: null, finish: null } as never, story: "", logoLikes: "" });
const main = { mimeType: "image/png", data: new Uint8Array([1]) };
const photo = { mimeType: "image/jpeg", data: new Uint8Array([2]) };
const base = { view: "main" as const, style, brief: null, main: null, photo: null, base: null, change: null, wearer: null };

describe("picture requests", () => {
  it("make a main photo from the description: the product alone on a plain background, no text", () => {
    const request = pictureRequest({ ...base, item });
    expect(request.images).toEqual([]);
    expect(request.prompt).toContain("A walnut cutting board with a juice groove");
    expect(request.prompt).toContain("plain, clean white or light neutral background");
    expect(request.prompt).toContain("No words, letters, logos");
    expect(request.prompt).toContain("photorealistic");
  });

  it("make a main photo from the owner's photo with the product photo rules", () => {
    const request = pictureRequest({ ...base, item, photo });
    expect(request.images).toEqual([photo]);
    for (const rule of KEEP_PRODUCT) expect(request.prompt).toContain(rule);
  });

  it("make each extra view from the approved main only", () => {
    expect(() => pictureRequest({ ...base, item, view: "angle" })).toThrow(/Approve a main photo first/);
    const angle = pictureRequest({ ...base, item, view: "angle", main });
    expect(angle.images).toEqual([main]);
    expect(angle.prompt).toContain("different angle");
    for (const rule of KEEP_PRODUCT) expect(angle.prompt).toContain(rule);
    expect(pictureRequest({ ...base, item, view: "detail", main }).prompt).toContain("close-up");
    expect(pictureRequest({ ...base, item, view: "in_use", main }).prompt).toContain("in use");
  });

  it("show a worn item on the person it's for", () => {
    expect(viewScene("product", "in_use", "women")).toContain("worn by a woman");
    expect(viewScene("product", "in_use", "kids")).toContain("worn by a child");
    expect(viewScene("product", "in_use", null)).not.toContain("worn by");
    expect(viewScene("service", "angle", null)).toContain("in progress");
  });

  it("change a view with the approved main as the reference for the item", () => {
    const changed = pictureRequest({ ...base, item, view: "angle", main, base: { id: "p1", file: photo }, change: "Warmer light" });
    expect(changed.images).toEqual([photo, main]);
    expect(changed.prompt).toContain("“Warmer light”");
    expect(pictureRequest({ ...base, item, base: { id: "p1", file: photo }, change: "Warmer light" }).images).toEqual([photo]);
  });
});

describe("practice pictures", () => {
  it("are labeled placeholders for each view", async () => {
    const saved: NewItemPicture[] = [];
    const store = { findByRequest: async () => null, room: async () => "ok" as const, add: async (picture: NewItemPicture) => (saved.push(picture), { ok: true as const, id: `p${saved.length}` }) };
    await makeItemPicture(createMockImageProvider(), store, { ...base, item, view: "detail", main, requestKey: "k" });
    expect(saved[0]).toMatchObject({ view: "detail", simulated: true, mimeType: "image/svg+xml" });
    const svg = new TextDecoder().decode(saved[0].data);
    expect(svg).toContain("PRACTICE PREVIEW, NOT MADE BY AI");
    expect(svg).toContain("Close-up");
  });
});
