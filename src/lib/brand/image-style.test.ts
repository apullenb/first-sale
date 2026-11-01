import { describe, expect, it } from "vitest";
import { imageStyle, ruleMedium } from "./image-style";
import { NO_LEANINGS } from "./types";

type Answers = Parameters<typeof imageStyle>[0];
const brief = (vibes: string[], more: Partial<Answers> = {}): Answers => ({ vibes: vibes as Answers["vibes"], leanings: NO_LEANINGS, story: "", logoLikes: "", ...more });
const answers = (vibes: string[], more: Partial<Answers> = {}) => imageStyle(brief(vibes, more));

describe("imageStyle", () => {
  it("picks photography by default, for boutique, rustic, elegant and cozy brands", () => {
    expect(answers(["western", "rustic", "warm", "earthy"]).medium).toBe("photo");
    expect(answers(["elegant", "luxurious", "minimal"]).medium).toBe("photo");
    expect(answers(["cozy", "cabin in the woods", "natural and organic"])).toMatchObject({ medium: "photo", by: "rules", lively: false, light: "warm, soft natural light" });
  });

  it("keeps playful, bright and bold brands as photos, made bright and punchy", () => {
    const playful = answers(["playful", "bright and colorful", "cheerful"], { leanings: { ...NO_LEANINGS, tone: "playful", energy: "loud" } });
    expect(playful).toMatchObject({ medium: "photo", lively: true });
    expect(playful.light).toMatch(/bright, punchy/);
    expect(answers(["bold", "desert", "warm"])).toMatchObject({ medium: "photo", lively: true });
    expect(answers(["warm", "calm", "cozy"], { leanings: { ...NO_LEANINGS, tone: "playful" } })).toMatchObject({ medium: "photo", lively: true });
  });

  it("picks illustration only when the owner asks for drawings or picks hand-drawn or whimsical", () => {
    expect(answers(["warm", "hand-drawn", "cozy"]).medium).toBe("illustration");
    expect(answers(["warm", "whimsical", "cozy"]).medium).toBe("illustration");
    expect(answers(["warm", "cozy", "calm"], { story: "A cartoon dog waves from the van window." }).medium).toBe("illustration");
    expect(answers(["warm", "cozy", "calm"], { logoLikes: "Logos with a friendly mascot" }).medium).toBe("illustration");
    expect(answers(["warm", "cozy", "calm"], { story: "I'd love drawings of our bread." }).medium).toBe("illustration");
    // Words that only sound like it
    expect(answers(["warm", "cozy", "calm"], { story: "People are drawn to our warm, animated kitchen." }).medium).toBe("photo");
  });

  it("follows the owner's switch over the rule", () => {
    expect(imageStyle(brief(["warm", "hand-drawn", "cozy"]), "photo")).toMatchObject({ medium: "photo", by: "owner" });
    expect(imageStyle(brief(["rustic", "warm", "earthy"]), "illustration")).toMatchObject({ medium: "illustration", by: "owner" });
    expect(ruleMedium(brief(["rustic", "warm", "earthy"]))).toBe("photo");
  });

  it("sets the light from the mood", () => {
    expect(answers(["dark and moody", "elegant", "playful"])).toMatchObject({ lively: false, light: expect.stringMatching(/low, directional/) });
    expect(answers(["coastal", "calm", "minimal"]).light).toMatch(/bright, clean daylight/);
  });
});
