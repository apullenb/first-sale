import { describe, expect, it, vi } from "vitest";
import { getImageModel, getModel, ImageEditError, type ImageEditRequest, type ImageGenerateRequest, type ImageModel, type ModelProvider } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { pngBytes } from "@/lib/photos/test-images";
import { type AssetStore, drawConcepts, drawKey, type LogoRef, makeBrandImages, makeVersions, type NewBrandAsset, refineLogo } from "./generate";
import { PRACTICE_LABEL } from "./practice";
import { logoPrompt } from "./prompts";
import { applyDesign, planRefinement } from "./refine";
import { testBrief, testConcept } from "./test-fixtures";
import type { AssetCheck } from "./types";

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

const concepts = [1, 2, 3].map((n) => ({ id: `concept-${n}`, concept: testConcept({ title: `Idea ${n}` }), brief: testBrief() }));
const chosenBytes = pngBytes(1536, 1024, 42);
const logo: LogoRef = { ...concepts[0], logoId: "logo-1", logo: { mimeType: "image/png", data: chosenBytes }, design: null };

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
    await makeVersions({ image: model, vision }, store, { ...input, kinds: [...input.kinds] });
    expect(edit).toHaveBeenCalledTimes(3);
    for (const call of edit.mock.calls) expect(call[0].images).toEqual([{ mimeType: "image/png", data: chosenBytes }]);
    expect(saved.map((asset) => [asset.kind, asset.sourceId, asset.requestKey])).toEqual([
      ["stacked", "logo-1", "logo-1:v1:stacked"],
      ["profile", "logo-1", "logo-1:v1:profile"],
      ["solid", "logo-1", "logo-1:v1:solid"],
    ]);
    expect(edit.mock.calls.map((call) => call[0].size)).toEqual(["1024x1024", "1024x1024", "1536x1024"]);

    // A retry after a lost connection pays for nothing
    await makeVersions({ image: model, vision }, store, { ...input, kinds: [...input.kinds] });
    expect(edit).toHaveBeenCalledTimes(3);
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
