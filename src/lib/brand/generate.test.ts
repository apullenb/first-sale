import { describe, expect, it, vi } from "vitest";
import { getImageModel, getModel, ImageEditError, type ImageEditRequest, type ImageGenerateRequest, type ImageModel, type ModelProvider } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { pngBytes } from "@/lib/photos/test-images";
import { type AssetStore, drawConcepts, drawKey, type LogoRef, makeBrandImages, makeVersions, type NewBrandAsset, refineLogo } from "./generate";
import { PRACTICE_LABEL } from "./practice";
import { logoPrompt } from "./prompts";
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
const logo: LogoRef = { ...concepts[0], logoId: "logo-1", logo: { mimeType: "image/png", data: chosenBytes } };

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

  it("escapes the business name in the preview", async () => {
    const { store, saved } = memoryStore();
    const brief = testBrief({ name: "<script>&\"x\"" });
    await drawConcepts({ image: getImageModel({})!, vision: getModel({}) }, store, { concepts: [{ ...concepts[0], brief }], now });
    const svg = new TextDecoder().decode(saved[0].data);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&amp;&quot;x&quot;");
  });
});
