import { describe, expect, it } from "vitest";
import { approvedExample, imageSlots, recommendedImages, versionSlots } from "./slots";

const file = (id: string, kind: string, sourceId: string | null = "logo-1") => ({ id, kind, sourceId });

describe("version slots", () => {
  it("are all empty, with a +, before anything is made", () => {
    const slots = versionSlots([file("logo-1", "logo", null)], "logo-1", {});
    expect(slots.map((slot) => [slot.kind, slot.empty, slot.newest])).toEqual([
      ["stacked", true, null],
      ["profile", true, null],
      ["solid", true, null],
    ]);
  });

  it("show the newest file large, earlier ones beside it, and the owner's pick", () => {
    const files = [file("s1", "stacked"), file("p1", "profile"), file("s2", "stacked"), file("s3", "stacked")];
    const [stacked, profile, solid] = versionSlots(files, "logo-1", { stacked: "s1" });
    expect(stacked).toMatchObject({ empty: false, newest: { id: "s3" }, picked: { id: "s1" } });
    expect(stacked.earlier.map((each) => each.id)).toEqual(["s2", "s1"]);
    expect(profile).toMatchObject({ empty: false, newest: { id: "p1" }, picked: null, earlier: [] });
    expect(solid.empty).toBe(true);
  });

  it("only hold files made from the chosen logo, and ignore a pick from another logo", () => {
    const files = [file("old", "stacked", "logo-0"), file("new", "stacked")];
    const [stacked] = versionSlots(files, "logo-1", { stacked: "old" });
    expect(stacked).toMatchObject({ newest: { id: "new" }, picked: null, earlier: [] });
    expect(versionSlots(files, null, {})[0].empty).toBe(true);
  });
});

describe("brand image slots", () => {
  it("recommend every kind that hasn't been made, in a fixed order", () => {
    const slots = imageSlots([file("h1", "website_hero")], "logo-1", { website_hero: "h1" });
    const extras = ["instagram_post", "instagram_story", "ad_square", "flyer", "product_scene"];
    expect(slots.map((slot) => slot.kind)).toEqual(["website_hero", "facebook_cover", "youtube_banner", "link_preview", ...extras]);
    expect(slots.filter((slot) => slot.empty).map((slot) => slot.kind)).toEqual(["facebook_cover", "youtube_banner", "link_preview", ...extras]);
    expect(slots[0]).toMatchObject({ newest: { id: "h1" }, picked: { id: "h1" } });
  });

  it("recommend a platform's image only when the owner hasn't excluded it; the website's always", () => {
    expect([...recommendedImages(null)]).toEqual(["website_hero", "facebook_cover", "youtube_banner", "link_preview"]);
    expect([...recommendedImages({ exclude: ["facebook"] })]).toEqual(["website_hero", "youtube_banner", "link_preview"]);
    expect([...recommendedImages({ exclude: ["facebook", "youtube", "tiktok"] })]).toEqual(["website_hero", "link_preview"]);
  });

  it("recommend the optional Instagram post only when the owner picked Instagram", () => {
    expect([...recommendedImages({ include: ["instagram"], exclude: [] })]).toContain("instagram_post");
    expect([...recommendedImages({ include: ["facebook"], exclude: [] })]).not.toContain("instagram_post");
    expect([...recommendedImages({ include: ["instagram"], exclude: [] })]).not.toContain("flyer");
  });

  it("have an approved example only once the owner uses a header made from the chosen logo", () => {
    expect(approvedExample([file("h1", "website_hero")], "logo-1", {})).toBeNull();
    expect(approvedExample([file("h1", "website_hero")], "logo-1", { website_hero: "h1" })).toMatchObject({ id: "h1" });
    expect(approvedExample([file("h0", "website_hero", "logo-0")], "logo-1", { website_hero: "h0" })).toBeNull();
  });

  it("are all empty without a chosen logo", () => {
    expect(imageSlots([file("h1", "website_hero")], null, {}).every((slot) => slot.empty)).toBe(true);
  });
});
