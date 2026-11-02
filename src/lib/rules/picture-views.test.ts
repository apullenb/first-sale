import { describe, expect, it } from "vitest";
import { EXTRA_VIEWS, gallery, isWorn, PICTURE_VIEWS, wearerFor, wearerFrom } from "./picture-views";

const item = (name: string, description = "", kind: "product" | "service" = "product") => ({ kind, name, description, wearer: null });

describe("picture views", () => {
  it("start with the main photo, then another angle, a close-up and in use", () => {
    expect(PICTURE_VIEWS).toEqual(["main", "angle", "detail", "in_use"]);
    expect(EXTRA_VIEWS).toEqual(["angle", "detail", "in_use"]);
  });

  it("make the gallery one approved picture per view, in view order", () => {
    const pictures = [
      { id: "in-use", view: "in_use" as const, approved: true },
      { id: "angle-old", view: "angle" as const, approved: true },
      { id: "main", view: "main" as const, approved: true },
      { id: "detail", view: "detail" as const, approved: false },
      { id: "angle-new", view: "angle" as const, approved: true },
    ];
    expect(gallery(pictures).map((each) => each.id)).toEqual(["main", "angle-new", "in-use"]);
  });
});

describe("who wears it", () => {
  it("only matters for things worn on the body", () => {
    expect(isWorn(item("Linen dress"))).toBe(true);
    expect(isWorn(item("Silver earrings"))).toBe(true);
    expect(isWorn(item("Walnut cutting board"))).toBe(false);
    expect(isWorn(item("Hat fitting", "", "service"))).toBe(false);
    expect(wearerFor(item("Walnut cutting board"))).toBeNull();
  });

  it("comes from the item's own words", () => {
    expect(wearerFrom(item("Women's linen dress"))).toBe("women");
    expect(wearerFrom(item("Flannel shirt", "A men's classic fit"))).toBe("men");
    expect(wearerFrom(item("Knit hat", "Sized for toddlers"))).toBe("kids");
    expect(wearerFrom(item("Hoodie", "Unisex sizes"))).toBe("anyone");
    expect(wearerFrom(item("Ladies' scarf"))).toBe("women");
  });

  it("asks the owner when the words don't say, and keeps their answer", () => {
    expect(wearerFor(item("Linen dress"))).toBe("ask");
    expect(wearerFor({ ...item("Linen dress"), wearer: "kids" })).toBe("kids");
    expect(wearerFor(item("Men's flannel shirt"))).toBe("men");
  });
});
