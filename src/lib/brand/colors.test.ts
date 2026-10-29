import { describe, expect, it } from "vitest";
import { colorName, contrast, darkestFirst, kitColors, textUse } from "./colors";

describe("contrast", () => {
  it("follows WCAG: black on white is 21:1, and 4.5:1 is the line for small text", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(textUse(4.5)).toBe("text");
    expect(textUse(3)).toBe("large");
    expect(textUse(2.9)).toBe("decoration");
  });
});

describe("kit colors", () => {
  it("use the logo's darkest color, or near-black when it's too light", () => {
    const forest = [
      { hex: "#E9DCC4", name: "Cream" },
      { hex: "#1F3A2E", name: "Forest" },
    ];
    expect(darkestFirst(forest)[0].name).toBe("Forest");
    expect(kitColors(forest)).toEqual({ ink: "#1F3A2E", dark: "#1F3A2E", darkName: "Forest" });
    expect(kitColors([{ hex: "#F4C2C2", name: "Pink" }])).toEqual({ ink: "#111111", dark: "#111111", darkName: null });
    expect(kitColors([])).toEqual({ ink: "#111111", dark: "#111111", darkName: null });
  });
});

describe("color names", () => {
  it("name colors the owner picked in plain words", () => {
    expect(colorName("#000000")).toBe("Black");
    expect(colorName("#FFFFFF")).toBe("White");
    expect(colorName("#777777")).toBe("Gray");
    expect(colorName("#1F3A2E")).toBe("Dark green");
    expect(colorName("#E4572E")).toBe("Red");
    expect(colorName("#7A4B2A")).toBe("Brown");
    expect(colorName("#A8DADC")).toBe("Light teal");
  });
});
