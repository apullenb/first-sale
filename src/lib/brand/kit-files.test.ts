import { describe, expect, it } from "vitest";
import { KIT_FACTS, KIT_GROUPS, KIT_RECIPES, kitFileName, kitReadme, kitRecipes } from "./kit-files";

const all = { primary: true, stacked: true, profile: true, solid: true };

describe("the logo kit", () => {
  it("offers only files made from what the owner approved", () => {
    const chosenOnly = kitRecipes({ primary: true, stacked: false, profile: false, solid: false });
    expect(chosenOnly.map((recipe) => recipe.id)).toEqual(["main-clear", "main-white"]);
    expect(kitRecipes(all)).toHaveLength(KIT_RECIPES.length);
  });

  it("has see-through, one-color, dark-background, favicon, home-screen and profile files", () => {
    const ids = KIT_RECIPES.map((recipe) => recipe.id);
    expect(ids).toEqual(expect.arrayContaining(["main-clear", "icon-clear", "solid-ink", "solid-white", "solid-on-dark", "favicon", "touch-180", "app-192", "app-512", "facebook-320"]));
    expect(new Set(ids).size).toBe(ids.length);
    // Google recommends larger than 48 × 48
    expect(KIT_RECIPES.find((recipe) => recipe.id === "favicon")).toMatchObject({ format: "ico", icoSizes: [16, 32, 48, 96] });
  });

  it("cite a platform page for every size a platform asks for", () => {
    for (const recipe of KIT_RECIPES.filter((each) => each.group === "website" || each.id === "facebook-320")) {
      expect(recipe.citation?.url).toMatch(/^https:\/\//);
      expect(recipe.citation?.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(KIT_RECIPES.find((recipe) => recipe.id === "app-512")?.size).toEqual({ width: 512, height: 512 });
    // A size SnapStart picked says so, and cites nothing
    expect(KIT_RECIPES.find((recipe) => recipe.id === "square-800")).toMatchObject({ use: expect.stringContaining("SnapStart picked this size") });
    expect(KIT_RECIPES.find((recipe) => recipe.id === "square-800")?.citation).toBeUndefined();
    for (const group of Object.values(KIT_FACTS)) expect(group.sources.length).toBeGreaterThan(0);
  });

  it("names files after the business, and marks practice previews", () => {
    const favicon = KIT_RECIPES.find((recipe) => recipe.id === "favicon")!;
    expect(kitFileName("Rise Bakery", favicon, false)).toBe("Rise Bakery - favicon.ico");
    expect(kitFileName("Rise Bakery", KIT_RECIPES[0], true)).toBe("Rise Bakery - logo - see-through - practice preview.png");
    // No folders or characters some systems refuse
    expect(kitFileName("A/B: \"Café\" <Co>?", favicon, false)).toBe("A B Café Co - favicon.ico");
    expect(kitFileName("  ", favicon, false)).toBe("favicon.ico");
  });

  it("explains each file in the zip, and why any were left out", () => {
    const recipes = kitRecipes(all);
    const note = kitReadme({
      businessName: "Rise Bakery",
      recipes,
      skipped: [{ recipe: recipes[0], reason: "The background isn’t one plain color." }],
      simulated: true,
      colors: [{ name: "Forest", hex: "#1f3a2e" }],
    });
    expect(note).toContain("PRACTICE PREVIEW");
    expect(note).toContain("Forest #1F3A2E");
    expect(note).toContain("not included. The background isn’t one plain color.");
    for (const group of Object.values(KIT_GROUPS)) expect(note).toContain(group.title);
    expect(note).toContain("uspto.gov");
  });
});
