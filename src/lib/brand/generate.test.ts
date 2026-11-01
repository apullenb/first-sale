import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getImageModel, getModel, ImageEditError, type ImageEditRequest, type ImageGenerateRequest, type ImageModel, type ModelProvider } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { pngBytes } from "@/lib/photos/test-images";
import { type AssetStore, drawConcepts, drawKey, editPicture, type LogoRef, makeBrandImages, makeVersions, type NewBrandAsset, refineLogo } from "./generate";
import { decodePng, encodePng } from "./png";
import { PRACTICE_LABEL } from "./practice";
import { logoPrompt } from "./prompts";
import { applyDesign, planRefinement } from "./refine";
import { testBrief, testConcept } from "./test-fixtures";
import { type AssetCheck, type BrandDesign, CODE_MODEL } from "./types";

const now = new Date("2026-10-27T12:00:00Z");

function memoryStore(room: Awaited<ReturnType<AssetStore["room"]>> = "ok") {
  const saved: (NewBrandAsset & { id: string; check: AssetCheck | null })[] = [];
  const store: AssetStore = {
    findByRequest: async (key) => saved.find((asset) => asset.requestKey === key)?.id ?? null,
    room: async () => room,
    add: async (asset) => {
      const existing = saved.find((row) => row.requestKey === asset.requestKey);
      if (existing) return { ok: true, id: existing.id };
      const id = `asset-${saved.length + 1}`;
      saved.push({ ...asset, id, check: null });
      return { ok: true, id };
    },
    setCheck: async (id, check) => {
      saved.find((asset) => asset.id === id)!.check = check;
    },
  };
  return { store, saved };
}

function imageModel(result = () => pngBytes(1536, 1024, 200)) {
  const generate = vi.fn(async (request: ImageGenerateRequest) => {
    void request;
    return { data: result(), format: "png" };
  });
  const edit = vi.fn(async (request: ImageEditRequest) => {
    void request;
    return { data: pngBytes(1024, 1024, 100), format: "png" };
  });
  const model: ImageModel = { name: "Test image", model: "test-image", simulated: false, edit, generate };
  return { model, generate, edit };
}

// Reads "Rise Bakery" back from every picture
const vision: ModelProvider = {
  name: "Test vision",
  model: "test-vision",
  capabilities: { vision: true, pdf: false, jsonSchema: true, reasoningEffort: true, webSearch: false },
  simulated: false,
  async complete() {
    return { text: JSON.stringify({ lettering: ["Rise Bakery"], readable: true, notes: "", flags: [] }), finishReason: "stop", usage: null };
  },
};

// Reads no lettering, which never asks for a retry, and gives the drift reply
function visionFor(drift: { flags: { kind: string; detail: string }[] }): ModelProvider {
  return {
    ...vision,
    async complete(request) {
      const text = JSON.stringify(request.messages);
      const reply = text.includes("compare a small business") ? drift : { lettering: [], readable: false, notes: "" };
      return { text: JSON.stringify(reply), finishReason: "stop", usage: null };
    },
  };
}

// A white PNG with filled boxes, framed in `edge` when given
function canvasPng(width: number, height: number, boxes: { x: number; y: number; w: number; h: number; color: [number, number, number] }[], edge?: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const box = boxes.findLast((each) => x >= each.x && x < each.x + each.w && y >= each.y && y < each.y + each.h);
      const onEdge = edge && (x === 0 || y === 0 || x === width - 1 || y === height - 1);
      data.set([...(onEdge ? edge : (box?.color ?? [255, 255, 255])), 255], (y * width + x) * 4);
    }
  }
  return encodePng({ data, width, height });
}

const concepts = [1, 2, 3].map((n) => ({ id: `concept-${n}`, concept: testConcept({ title: `Idea ${n}` }), brief: testBrief() }));
const chosenBytes = pngBytes(1536, 1024, 42);
const logo = { ...concepts[0], logoId: "logo-1", logo: { mimeType: "image/png", data: chosenBytes }, design: null as BrandDesign | null } satisfies LogoRef;

describe("drawing logo ideas", () => {
  it("draws each idea from code-built instructions and keeps the bytes exactly as returned", async () => {
    const { model, generate } = imageModel();
    const { store, saved } = memoryStore();
    const result = await drawConcepts({ image: model, vision }, store, { concepts, userKey: "k", now });

    expect(result).toEqual({ ids: ["asset-1", "asset-2", "asset-3"], failed: null });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[0][0]).toMatchObject({ prompt: logoPrompt(concepts[0].brief, concepts[0].concept), size: "1536x1024", format: "png", userKey: "k" });
    expect(saved[0]).toMatchObject({ kind: "logo", conceptId: "concept-1", requestKey: drawKey("concept-1"), simulated: false, width: 1536, height: 1024, mimeType: "image/png" });
    expect(saved[0].data).toEqual(pngBytes(1536, 1024, 200));
    expect(saved[0].check).toMatchObject({ method: "ai", lettering: { status: "matches" } });
  });

  it("never pays twice for an idea already drawn", async () => {
    const { model, generate } = imageModel();
    const { store } = memoryStore();
    await drawConcepts({ image: model, vision }, store, { concepts, now });
    const again = await drawConcepts({ image: model, vision }, store, { concepts, now });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(again.ids).toEqual(["asset-1", "asset-2", "asset-3"]);
  });

  it("checks for room before paying", async () => {
    const { model, generate } = imageModel();
    const { store } = memoryStore("too_many");
    await expect(drawConcepts({ image: model, vision }, store, { concepts, now })).rejects.toThrow(OwnerFacingError);
    expect(generate).not.toHaveBeenCalled();
  });

  it("saves nothing for a failed drawing, and keeps the ones that came back", async () => {
    const { model, generate } = imageModel();
    generate.mockRejectedValueOnce(new ImageEditError("busy", 503, true));
    const { store, saved } = memoryStore();
    const result = await drawConcepts({ image: model, vision }, store, { concepts, now });
    expect(saved).toHaveLength(2);
    expect(result.failed).toContain("1 of 3 didn’t come back");
    // The retry draws only the missing one
    await drawConcepts({ image: model, vision }, store, { concepts, now });
    expect(generate).toHaveBeenCalledTimes(4);
    expect(saved).toHaveLength(3);
  });

  it("fails with a plain message when every drawing fails, saving nothing", async () => {
    const { model, generate } = imageModel();
    generate.mockRejectedValue(new ImageEditError("blocked", 400, false, "content_policy_violation"));
    const { store, saved } = memoryStore();
    await expect(drawConcepts({ image: model, vision }, store, { concepts, now })).rejects.toThrow("wouldn’t make this one");
    expect(saved).toEqual([]);
  });

  it("refuses bytes that aren't a picture", async () => {
    const { model } = imageModel(() => new Uint8Array([1, 2, 3]));
    const { store, saved } = memoryStore();
    await expect(drawConcepts({ image: model, vision }, store, { concepts: concepts.slice(0, 1), now })).rejects.toThrow("isn’t a usable picture");
    expect(saved).toEqual([]);
  });

  it("keeps a drawing whose spelling check failed, and says it wasn't checked", async () => {
    const { model } = imageModel();
    const { store, saved } = memoryStore();
    const broken: ModelProvider = { ...vision, complete: async () => Promise.reject(new Error("down")) };
    await drawConcepts({ image: model, vision: broken }, store, { concepts: concepts.slice(0, 1), now });
    expect(saved[0].check).toMatchObject({ method: "failed" });
  });
});

describe("changes, versions and brand images start from the logo itself", () => {
  it("sends the draft being changed as image 1", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await refineLogo({ image: model, vision }, store, { logo, change: "Thicker letters", requestKey: "r1", now });
    expect(edit.mock.calls[0][0].images).toEqual([{ mimeType: "image/png", data: chosenBytes }]);
    expect(edit.mock.calls[0][0].instruction).toContain("“Thicker letters”");
    expect(saved[0]).toMatchObject({ kind: "logo", sourceId: "logo-1", change: "Thicker letters", requestKey: "r1" });
  });

  it("draws and checks a one-click change as the logo will be, and records what changed", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const plan = planRefinement({ kind: "tagline", text: "Baked at dawn" }, logo);
    if (!plan.ok) throw new Error(plan.message);
    await refineLogo({ image: model, vision }, store, { logo, change: plan.label, oneClick: { lines: plan.lines, design: plan.design }, requestKey: "t1", now });
    const instruction = edit.mock.calls[0][0].instruction;
    expect(instruction).toContain("Add the tagline “Baked at dawn” under the name");
    expect(instruction).toContain("Tagline, smaller than the name and spelled exactly: “Baked at dawn”");
    expect(instruction).not.toContain("The owner’s change");
    expect(saved[0]).toMatchObject({ change: "Tagline added: “Baked at dawn”", design: { tagline: "Baked at dawn", preset: "tagline" } });
    // The vision model reads only the name, so the new tagline is reported missing
    expect(saved[0].check?.lettering?.status).toBe("misspelled");
  });

  it("keeps earlier one-click changes on a change in the owner's words, without claiming it was one-click", async () => {
    const { model } = imageModel();
    const { store, saved } = memoryStore();
    const design = { tagline: "", preset: "tagline" as const };
    await refineLogo({ image: model, vision }, store, { logo: { ...logo, design }, change: "Thicker letters", requestKey: "w1", now });
    expect(saved[0].design).toEqual({ tagline: "" });
  });

  it("makes versions in a changed logo's colors and keeps its changes on them", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const design = { palette: [{ hex: "#5B2A86", name: "Purple" }], preset: "colors" as const };
    const recolored: LogoRef = { ...logo, ...applyDesign(logo.concept, logo.brief, design), design };
    await makeVersions({ image: model, vision }, store, { logo: recolored, kinds: ["solid"], requestKey: "v2", now });
    expect(edit.mock.calls[0][0].instruction).not.toContain("#1F3A2E");
    expect(saved[0].design).toEqual({ palette: design.palette });
  });

  it("makes every version from the chosen logo, once per request key", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const input = { logo, kinds: ["stacked", "profile", "solid"] as const, requestKey: "v1", now };
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { ...input, kinds: [...input.kinds] });
    expect(edit).toHaveBeenCalledTimes(3);
    for (const call of edit.mock.calls) expect(call[0].images).toEqual([{ mimeType: "image/png", data: chosenBytes }]);
    expect(saved.map((asset) => [asset.kind, asset.sourceId, asset.requestKey])).toEqual([
      ["stacked", "logo-1", "logo-1:v1:stacked"],
      ["profile", "logo-1", "logo-1:v1:profile"],
      ["solid", "logo-1", "logo-1:v1:solid"],
    ]);
    expect(edit.mock.calls.map((call) => call[0].size)).toEqual(["1024x1024", "1024x1024", "1536x1024"]);

    // A retry after a lost connection pays for nothing
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { ...input, kinds: [...input.kinds] });
    expect(edit).toHaveBeenCalledTimes(3);
  });

  it("tries a version once more when the check flags drift, and keeps both", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const drifting = visionFor({ flags: [{ kind: "lettering", detail: "The g in grooming became a capital G" }] });
    const result = await makeVersions({ image: model, vision: drifting }, store, { logo, kinds: ["stacked"], requestKey: "r1", now });
    expect(edit).toHaveBeenCalledTimes(2);
    expect(edit.mock.calls[1][0].instruction).toContain("- The g in grooming became a capital G");
    expect(saved.map((asset) => asset.requestKey)).toEqual(["logo-1:r1:stacked", "logo-1:r1:stacked:retry"]);
    expect(saved.every((asset) => asset.check?.drift.length === 1)).toBe(true);
    // The retry is the one shown; never a third try
    expect(result.ids).toEqual(["asset-2"]);
  });

  it("skips the retry when there's no room for another file", async () => {
    const { model, edit } = imageModel();
    const drifting = visionFor({ flags: [{ kind: "symbol", detail: "The dog is missing" }] });
    let left = 1;
    const { store } = memoryStore();
    const tight: AssetStore = { ...store, room: async () => (left-- > 0 ? "ok" : "too_many") };
    await makeVersions({ image: model, vision: drifting }, tight, { logo, kinds: ["stacked"], requestKey: "r2", now });
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("makes the one-color version one color in code, keeping white details", async () => {
    const twoBlues = canvasPng(60, 40, [
      { x: 10, y: 10, w: 15, h: 15, color: [40, 90, 200] },
      { x: 30, y: 10, w: 15, h: 15, color: [10, 30, 90] },
      { x: 15, y: 15, w: 4, h: 4, color: [255, 255, 255] },
    ]);
    const { model } = imageModel();
    model.edit = vi.fn(async () => ({ data: twoBlues, format: "png" }));
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { logo, kinds: ["solid"], requestKey: "s1", now });
    const pixels = decodePng(saved[0].data)!;
    const colors = new Set<string>();
    for (let index = 0; index < pixels.data.length; index += 4) colors.add(Array.from(pixels.data.slice(index, index + 3)).join(","));
    // testConcept's darkest color, #1F3A2E, and the white
    expect([...colors].sort()).toEqual(["255,255,255", "31,58,46"]);
  });

  it("clears a frame drawn around the icon", async () => {
    const framed = canvasPng(40, 40, [{ x: 15, y: 15, w: 10, h: 10, color: [30, 60, 40] }], [144, 144, 144]);
    const { model } = imageModel();
    model.edit = vi.fn(async () => ({ data: framed, format: "png" }));
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { logo, kinds: ["profile"], requestKey: "f1", now });
    const pixels = decodePng(saved[0].data)!;
    expect(Array.from(pixels.data.slice(0, 4))).toEqual([255, 255, 255, 255]);
  });

  it("never returns another logo's files for a reused request key", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision }, store, { logo, kinds: ["stacked"], requestKey: "same", now });
    const other: LogoRef = { ...logo, logoId: "logo-2" };
    const result = await makeVersions({ image: model, vision }, store, { logo: other, kinds: ["stacked"], requestKey: "same", now });
    expect(edit).toHaveBeenCalledTimes(2);
    expect(saved.map((asset) => asset.sourceId)).toEqual(["logo-1", "logo-2"]);
    expect(result.ids).toEqual(["asset-2"]);
  });

  it("shapes each brand image for where it goes", async () => {
    const { model, edit } = imageModel();
    const { store } = memoryStore();
    await makeBrandImages({ image: model, vision }, store, { logo, kinds: ["facebook_cover", "youtube_banner", "website_hero", "link_preview"], change: null, requestKey: "i1", now });
    expect(edit.mock.calls.map((call) => call[0].size)).toEqual(["1920x1080", "2560x1440", "1920x1080", "1200x630"]);
    for (const call of edit.mock.calls) expect(call[0].images[0].data).toEqual(chosenBytes);
  });

  it("sends the approved example as image 2 for the other slots, never for the example itself", async () => {
    const { model, edit } = imageModel();
    const { store } = memoryStore();
    const example = { mimeType: "image/png", data: pngBytes(1920, 1080, 9) };
    await makeBrandImages({ image: model, vision }, store, { logo, kinds: ["website_hero", "facebook_cover"], change: null, example, requestKey: "x1", now });
    expect(edit.mock.calls[0][0].images).toHaveLength(1);
    expect(edit.mock.calls[1][0].images).toEqual([{ mimeType: "image/png", data: chosenBytes }, example]);
    expect(edit.mock.calls[1][0].instruction).toContain("Image 2 is the business’s approved website header picture. Match its look exactly");
    expect(edit.mock.calls[0][0].instruction).not.toContain("Image 2");
  });

  it("follows the owner's Photo / Illustration switch, and labels practice previews with it", async () => {
    const { model, edit } = imageModel();
    await makeBrandImages({ image: model, vision }, memoryStore().store, { logo, kinds: ["website_hero"], change: null, medium: "illustration", requestKey: "m1", now });
    expect(edit.mock.calls[0][0].instruction).toContain("flat illustrated scene");
    const { store, saved } = memoryStore();
    await makeBrandImages({ image: getImageModel({})!, vision: getModel({}) }, store, { logo, kinds: ["website_hero"], change: null, requestKey: "m2", now });
    expect(new TextDecoder().decode(saved[0].data)).toContain(`${PRACTICE_LABEL} · Photo style`.toUpperCase());
  });
});

describe("editing a version or brand image", () => {
  const picture = { mimeType: "image/png", data: pngBytes(1024, 1024, 77) };

  it("sends the picture as image 1 and the chosen logo as image 2, and saves a new file made from the logo", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await editPicture({ image: model, vision }, store, { logo, picture: { kind: "stacked", file: picture }, change: "More space under the symbol", requestKey: "e1", now });
    const request = edit.mock.calls[0][0];
    expect(request.images).toEqual([picture, { mimeType: "image/png", data: chosenBytes }]);
    expect(request.size).toBe("1024x1024");
    expect(request.instruction).toContain("“More space under the symbol”");
    expect(request.instruction).toContain("R-i-s-e B-a-k-e-r-y");
    expect(saved[0]).toMatchObject({ kind: "stacked", sourceId: "logo-1", conceptId: "concept-1", change: "More space under the symbol", requestKey: "logo-1:e1:edit" });
  });

  it("keeps the logo as it is in a brand image, and no other words", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await editPicture({ image: model, vision }, store, { logo, picture: { kind: "website_hero", file: picture }, change: "Warmer colors", requestKey: "e2", now });
    expect(edit.mock.calls[0][0].instruction).toContain("keep it exactly as in image 2");
    expect(edit.mock.calls[0][0].instruction).toContain("No words other than the ones in the logo.");
    expect(edit.mock.calls[0][0].instruction).toContain("clearly visible at a glance");
    expect(edit.mock.calls[0][0].size).toBe("1920x1080");
    expect(saved[0]).toMatchObject({ kind: "website_hero", sourceId: "logo-1" });
  });

  it("never pays twice for the same request", async () => {
    const { model, edit } = imageModel();
    const { store } = memoryStore();
    const input = { logo, picture: { kind: "profile" as const, file: picture }, change: "Bigger symbol", requestKey: "e3", now };
    const first = await editPicture({ image: model, vision }, store, input);
    expect(await editPicture({ image: model, vision }, store, input)).toBe(first);
    expect(edit).toHaveBeenCalledTimes(1);
  });
});

describe("versions and edits built from the logo's own pixels", () => {
  // A logo the image model drew in a live run, downscaled
  const dogBytes = new Uint8Array(readFileSync(path.join(__dirname, "test-logos", "dog-grooming.png")));
  const dog: LogoRef = { ...logo, brief: testBrief({ name: "Wagging Wheels Grooming" }), logo: { mimeType: "image/png", data: dogBytes } };

  it("builds every version in code when the logo splits, with no image call and no AI check", async () => {
    const { model, edit } = imageModel();
    const checking = vi.fn(vision.complete);
    const { store, saved } = memoryStore();
    const result = await makeVersions({ image: model, vision: { ...vision, complete: checking } }, store, { logo: dog, kinds: ["stacked", "profile", "solid"], requestKey: "c1", now });
    expect(edit).not.toHaveBeenCalled();
    expect(checking).not.toHaveBeenCalled();
    expect(result.ids).toHaveLength(3);
    for (const asset of saved) {
      expect(asset).toMatchObject({ model: CODE_MODEL, simulated: false, mimeType: "image/png", sourceId: "logo-1", conceptId: "concept-1" });
      expect(asset.prompt).toMatch(/^Built in code/);
      expect(asset.check).toMatchObject({ method: "code", drift: [], layout: { built: "code" } });
      expect(decodePng(asset.data)).not.toBeNull();
    }
    expect(saved.map((asset) => asset.requestKey)).toEqual(["logo-1:c1:stacked", "logo-1:c1:profile", "logo-1:c1:solid"]);
  });

  it("draws with the image model when asked to redraw, and says so on the file", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { logo: dog, kinds: ["stacked"], redraw: true, requestKey: "c2", now });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(saved[0]).toMatchObject({ model: "test-image" });
    expect(saved[0].check?.layout).toMatchObject({ built: "model", note: "Drawn by the image model, because you asked for a new drawing." });
  });

  it("falls back to the image model when the logo doesn't split, keeping why", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision: visionFor({ flags: [] }) }, store, { logo, kinds: ["profile"], requestKey: "c3", now });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(saved[0].check?.layout).toMatchObject({ built: "model", note: "Drawn by the image model: Nothing was found in the logo to work with. (0% sure)" });
  });

  it("makes bolder lettering in code, and leaves other changes to the image model", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await refineLogo({ image: model, vision }, store, { logo: dog, change: "Make the lettering bolder", requestKey: "b1", now });
    expect(edit).not.toHaveBeenCalled();
    expect(saved[0]).toMatchObject({ kind: "logo", model: CODE_MODEL, change: "Make the lettering bolder", sourceId: "logo-1" });
    expect(saved[0].check).toMatchObject({ method: "code" });
    await refineLogo({ image: model, vision }, store, { logo: dog, change: "Add a little bone", requestKey: "b2", now });
    expect(edit).toHaveBeenCalledTimes(1);
    expect(saved[1].check?.layout).toBeUndefined();
  });

  it("keeps a lettering recolor's color on the file, so the kit follows it", async () => {
    const { model } = imageModel();
    const { store, saved } = memoryStore();
    await refineLogo({ image: model, vision }, store, { logo: dog, change: "Make the lettering navy", requestKey: "b3", now });
    expect(saved[0].design?.palette?.[0]).toEqual({ hex: "#1B2A4A", name: "Navy" });
  });

  it("builds an uploaded logo's versions the same way", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const uploaded: LogoRef = { id: null, concept: null, brief: testBrief(), logoId: "upload-1", logo: { mimeType: "image/png", data: dogBytes }, design: null, words: "Wagging Wheels Grooming" };
    await makeVersions({ image: model, vision }, store, { logo: uploaded, kinds: ["profile"], requestKey: "u1", now });
    expect(edit).not.toHaveBeenCalled();
    expect(saved[0]).toMatchObject({ model: CODE_MODEL, conceptId: null, sourceId: "upload-1" });
  });
});

describe("an uploaded logo", () => {
  const palette = [{ hex: "#1F3A2E", name: "Dark green" }];
  const uploaded: LogoRef = { id: null, concept: null, brief: testBrief(), logoId: "upload-1", logo: { mimeType: "image/webp", data: chosenBytes }, design: { palette }, words: "Rise" };

  it("makes versions from the file itself, with no idea behind them, checked against the owner's words", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision }, store, { logo: uploaded, kinds: ["stacked"], requestKey: "u1", now });
    const request = edit.mock.calls[0][0];
    expect(request.images[0]).toEqual({ mimeType: "image/webp", data: chosenBytes });
    expect(request.instruction).toContain("If the logo has a symbol");
    expect(request.instruction).toContain("“Rise”");
    expect(saved[0]).toMatchObject({ conceptId: null, sourceId: "upload-1", design: { palette } });
    // The test vision model reads "Rise Bakery", which isn't what the owner said the logo shows
    expect(saved[0].check?.lettering?.status).toBe("extra_words");
  });

  it("skips the spelling check when the owner didn't say what the logo says", async () => {
    const { model } = imageModel();
    const { store, saved } = memoryStore();
    await makeVersions({ image: model, vision }, store, { logo: { ...uploaded, words: "" }, kinds: ["solid"], requestKey: "u2", now });
    expect(saved[0].check).toMatchObject({ method: "ai", lettering: null });
  });

  it("makes brand pictures in the owner's colors", async () => {
    const { model, edit } = imageModel();
    const { store } = memoryStore();
    await makeBrandImages({ image: model, vision }, store, { logo: uploaded, kinds: ["website_hero"], change: null, requestKey: "u3", now });
    expect(edit.mock.calls[0][0].instruction).toContain("(#1F3A2E)");
  });

  it("gets an edited copy from the owner's words, as a new file, and the upload is never sent back changed", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const id = await refineLogo({ image: model, vision }, store, { logo: uploaded, change: "Make the letters thicker", requestKey: "u4", now });
    expect(id).toBe("asset-1");
    const request = edit.mock.calls[0][0];
    expect(request.images).toEqual([{ mimeType: "image/webp", data: chosenBytes }]);
    expect(request.instruction).toContain("“Make the letters thicker”");
    expect(request.instruction).toContain("“Rise”");
    expect(saved[0]).toMatchObject({ kind: "logo", conceptId: null, sourceId: "upload-1", change: "Make the letters thicker", words: "Rise", design: { palette } });
    // The test vision model reads "Rise Bakery"; the owner said the logo says "Rise"
    expect(saved[0].check?.lettering?.status).toBe("extra_words");
  });

  it("has no one-click changes, which are only for logos drawn here", async () => {
    const { model, edit } = imageModel();
    const { store, saved } = memoryStore();
    const oneClick = { lines: ["Make it simpler."], design: { preset: "simpler" as const } };
    await expect(refineLogo({ image: model, vision }, store, { logo: uploaded, change: "Simpler", oneClick, requestKey: "u6", now })).rejects.toThrow(OwnerFacingError);
    expect(edit).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("gets a labeled practice preview in practice mode", async () => {
    const { store, saved } = memoryStore();
    await makeVersions({ image: getImageModel({})!, vision: getModel({}) }, store, { logo: uploaded, kinds: ["profile"], requestKey: "u5", now });
    expect(saved[0]).toMatchObject({ mimeType: "image/svg+xml", simulated: true, conceptId: null });
    expect(new TextDecoder().decode(saved[0].data)).toContain(PRACTICE_LABEL.toUpperCase());
  });
});

describe("practice mode", () => {
  it("saves a labeled text preview, never a picture passed off as Muse's", async () => {
    const { store, saved } = memoryStore();
    const image = getImageModel({})!;
    await drawConcepts({ image, vision: getModel({}) }, store, { concepts: concepts.slice(0, 1), now });
    const svg = new TextDecoder().decode(saved[0].data);
    expect(saved[0]).toMatchObject({ simulated: true, mimeType: "image/svg+xml", model: "practice-preview" });
    expect(svg).toContain(PRACTICE_LABEL.toUpperCase());
    expect(svg).toContain("Rise Bakery");
    expect(saved[0].check).toMatchObject({ method: "skipped" });
  });

  it("shows one-click changes in the preview, so practice mode demonstrates them", async () => {
    const { store, saved } = memoryStore();
    const plan = planRefinement({ kind: "colors", colors: { hexes: ["#5B2A86"] } }, logo);
    if (!plan.ok) throw new Error(plan.message);
    const tagged = planRefinement({ kind: "tagline", text: "Baked at dawn" }, { ...logo, ...applyDesign(logo.concept, logo.brief, plan.design), design: plan.design });
    if (!tagged.ok) throw new Error(tagged.message);
    await refineLogo({ image: getImageModel({})!, vision: getModel({}) }, store, { logo, change: tagged.label, oneClick: { lines: tagged.lines, design: tagged.design }, requestKey: "p1", now });
    const svg = new TextDecoder().decode(saved[0].data);
    expect(svg).toContain("Baked at dawn");
    expect(svg).toContain("#5B2A86");
    expect(svg).not.toContain("#1F3A2E");
    expect(svg).toContain(PRACTICE_LABEL.toUpperCase());
  });

  it("escapes the business name in the preview", async () => {
    const { store, saved } = memoryStore();
    const brief = testBrief({ name: "<script>&\"x\"" });
    await drawConcepts({ image: getImageModel({})!, vision: getModel({}) }, store, { concepts: [{ ...concepts[0], brief }], now });
    const svg = new TextDecoder().decode(saved[0].data);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&amp;&quot;x&quot;");
  });
});
