import { describe, expect, it } from "vitest";
import { STEPS } from "@/lib/intake/answers";
import { CHAPTERS } from "./chapters";

describe("setup chapters", () => {
  it("cover every step once, in step order", () => {
    expect(CHAPTERS.flatMap((chapter) => chapter.steps)).toEqual([...STEPS]);
  });
});
