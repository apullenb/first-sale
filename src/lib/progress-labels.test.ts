import { describe, expect, it } from "vitest";
import { progressLabel } from "./progress-labels";

describe("progress labels", () => {
  it("names each measure and its unit", () => {
    expect(progressLabel("setup", 3, 4)).toBe("Business setup: 3 of 4 stages");
    expect(progressLabel("launch", 0, 5)).toBe("Launch requirements: 0 of 5 tasks");
    expect(progressLabel("marketing", 0, 10)).toBe("Marketing: 0 of 10 tasks");
    expect(progressLabel("brand", 2, 6)).toBe("Build your brand: 2 of 6 steps");
  });

  it("uses the singular for one", () => {
    expect(progressLabel("launch", 0, 1)).toBe("Launch requirements: 0 of 1 task");
  });
});
