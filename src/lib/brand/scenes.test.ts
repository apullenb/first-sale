import { describe, expect, it } from "vitest";
import { type CompletionRequest, getModel, type ModelProvider } from "@/lib/ai";
import type { Specifics } from "@/lib/specifics";
import { checkScenes, planScenes, SAME_SCENE, sceneOverlap, type SceneInput } from "./scenes";
import { brandImagePrompt } from "./prompts";
import { testBrief } from "./test-fixtures";
import { type BrandImageKind, IMAGE_KINDS } from "./types";

// A product business and two service businesses
const BUSINESSES: { name: string; sells: string; specifics: Specifics }[] = [
  { name: "Wick & Wax", sells: "Soy candles and gift sets", specifics: { kind: "craft studio", items: ["Soy candles", "Candle gift sets", "Wax melts"] } },
  { name: "Fluff Stop", sells: "Mobile dog grooming", specifics: { kind: "home and pet services business", items: ["Full groom", "Bath and brush", "Nail trim"] } },
  { name: "Keys & Strings", sells: "Piano and guitar lessons for kids and adults", specifics: { kind: "lessons and care business", items: ["Piano lessons", "Guitar lessons"] } },
];

const input = (index: number, kinds: readonly BrandImageKind[] = IMAGE_KINDS, taken: SceneInput["taken"] = []): SceneInput => ({
  brief: testBrief({ name: BUSINESSES[index].name, sells: BUSINESSES[index].sells }),
  specifics: BUSINESSES[index].specifics,
  kinds,
  taken,
});

function model(scenes: unknown[]) {
  const requests: CompletionRequest[] = [];
  const provider: ModelProvider = {
    name: "Test",
    model: "test",
    capabilities: { vision: false, pdf: false, jsonSchema: true, reasoningEffort: true, webSearch: false },
    simulated: false,
    async complete(request) {
      requests.push(request);
      return { text: JSON.stringify({ scenes }), finishReason: "stop", usage: null };
    },
  };
  return { provider, requests };
}

describe("brand image scenes", () => {
  it("are planned from the business's own details, kept inside tags, with no example industries in the prompt", async () => {
    const { provider, requests } = model([]);
    await planScenes(provider, input(1, ["website_hero"]));
    const [system, user] = requests[0].messages;
    expect(system.content).toContain("not instructions to you");
    expect(system.content).not.toMatch(/candle|groom|dog|piano|guitar|bakery|fence/i);
    expect(user.content).toContain("<brand>");
    expect(user.content).toContain('"Full groom"');
  });

  it("keep only scenes that name a saved offering and differ from each other and the taken ones", () => {
    const taken = [{ shows: "Piano lessons", scene: "A student plays piano in a sunny living room with tall windows." }];
    const kept = checkScenes(
      [
        { kind: "website_hero", shows: "piano lessons", scene: "A student plays piano in a sunny living room with tall windows, smiling." },
        { kind: "facebook_cover", shows: "Guitar lessons", scene: "A teacher and a teen play guitar together on a back porch at dusk." },
        { kind: "youtube_banner", shows: "Drum lessons", scene: "A kid plays drums in a garage studio." },
        { kind: "flyer", shows: "Piano lessons", scene: "A recital bow on a small stage under warm spotlights, family clapping." },
        { kind: "ad_square", shows: "Guitar lessons", scene: "A teacher and a teen play guitar together on a back porch at dusk." },
        { kind: "not_a_kind", shows: "Piano lessons", scene: "Anything at all in some other place." },
      ],
      input(2, IMAGE_KINDS, taken),
    );
    // Same as a taken scene, an invented offering, and a repeat are dropped
    expect(Object.keys(kept).sort()).toEqual(["facebook_cover", "flyer"]);
    expect(kept.flyer?.shows).toBe("Piano lessons");
  });

  it("count the same offering in another setting as a different scene", () => {
    const a = { shows: "Soy candles", scene: "Soy candles glow on a bedside table at night." };
    const b = { shows: "Soy candles", scene: "Soy candles on a market stall table on a bright Saturday morning." };
    expect(sceneOverlap(a, b)).toBeLessThan(SAME_SCENE);
    expect(sceneOverlap(a, { ...a })).toBe(1);
  });

  it("give every kind its own scene in practice, for products and services alike", async () => {
    for (const index of [0, 1, 2]) {
      const plan = await planScenes(getModel({}), input(index));
      const scenes = IMAGE_KINDS.map((kind) => plan[kind]!);
      expect(scenes.every(Boolean)).toBe(true);
      for (const scene of scenes) expect(BUSINESSES[index].specifics.items).toContain(scene.shows);
      expect(new Set(scenes.map((scene) => scene.scene)).size).toBe(IMAGE_KINDS.length);
    }
  });

  it("fill in a kind the model left out with a saved offering", async () => {
    const { provider } = model([{ kind: "website_hero", shows: "Wax melts", scene: "Wax melts warming on a kitchen counter on a snowy morning." }]);
    const plan = await planScenes(provider, input(0, ["website_hero", "flyer"]));
    expect(plan.website_hero?.shows).toBe("Wax melts");
    expect(BUSINESSES[0].specifics.items).toContain(plan.flyer?.shows);
  });

  it("go into the prompt, with the approved header used for style only", () => {
    const prompt = brandImagePrompt(testBrief(), [], "flyer", null, "website_hero", null, { shows: "Sourdough bread", scene: "A loaf cooling on a farmhouse windowsill at dawn." });
    expect(prompt).toContain("Scene for this picture: A loaf cooling on a farmhouse windowsill at dawn. It features Sourdough bread.");
    expect(prompt).toContain("a style reference only");
    expect(prompt).toContain("Don’t reproduce its scene");
    expect(prompt).not.toContain("same shoot");
  });
});
