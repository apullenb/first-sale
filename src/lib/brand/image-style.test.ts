import { describe, expect, it } from "vitest";
import { imageStyle } from "./image-style";
import { NO_LEANINGS } from "./types";

const answers = (vibes: string[], more: Partial<Parameters<typeof imageStyle>[0]> = {}) =>
  imageStyle({ vibes: vibes as Parameters<typeof imageStyle>[0]["vibes"], leanings: NO_LEANINGS, story: "", logoLikes: "", ...more });

describe("imageStyle", () => {
  it("picks photography for boutique, rustic, elegant and cozy brands", () => {
    expect(answers(["western", "rustic", "warm", "earthy"]).medium).toBe("photo");
    expect(answers(["elegant", "luxurious", "minimal"]).medium).toBe("photo");
    expect(answers(["cozy", "cabin in the woods", "natural and organic"])).toMatchObject({ medium: "photo", light: "warm, soft natural light" });
  });

  it("picks illustration only when the answers say playful, drawn or cartoony", () => {
    expect(answers(["playful", "bright and colorful", "cheerful"]).medium).toBe("illustration");
    expect(answers(["warm", "whimsical", "cozy"], { leanings: { ...NO_LEANINGS, tone: "playful" } }).medium).toBe("illustration");
    expect(answers(["warm", "cozy", "calm"], { story: "A cartoon dog waves from the van window." }).medium).toBe("illustration");
    // One playful word alone isn't enough
    expect(answers(["playful", "warm", "calm"]).medium).toBe("photo");
  });

  it("sets the light from the mood", () => {
    expect(answers(["dark and moody", "elegant", "luxurious"]).light).toMatch(/low, directional/);
    expect(answers(["coastal", "calm", "minimal"]).light).toMatch(/bright, clean daylight/);
  });
});
