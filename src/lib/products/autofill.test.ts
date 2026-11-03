import { describe, expect, it } from "vitest";
import { itemsStepTitle, likelyKind, sellsWhat, suggestedItems } from "./autofill";

type Profile = Parameters<typeof suggestedItems>[0];
const profile = (overrides: Partial<Profile> = {}): Profile => ({ category: null, offeringKinds: [], productTags: [], firstItems: "", ...overrides });

describe("what the business sells", () => {
  it("reads products, services or both from the answers", () => {
    expect(sellsWhat(profile({ category: "crafts" }))).toEqual({ products: true, services: false });
    expect(sellsWhat(profile({ category: "home_services" }))).toEqual({ products: false, services: true });
    expect(sellsWhat(profile({ category: "personal_care", offeringKinds: ["services", "resale"] }))).toEqual({ products: true, services: true });
    expect(sellsWhat(profile({ category: "other", offeringKinds: ["services"] }))).toEqual({ products: false, services: true });
  });

  it("starts with products when nothing says", () => {
    expect(sellsWhat(profile())).toEqual({ products: true, services: false });
  });

  it("shows a kind the owner already listed", () => {
    expect(sellsWhat(profile({ category: "home_services" }), [{ kind: "product" }])).toEqual({ products: true, services: true });
  });

  it("names the step for what they sell", () => {
    expect(itemsStepTitle({ products: true, services: false }, false)).toBe("Add your products");
    expect(itemsStepTitle({ products: true, services: false }, true)).toBe("Manage your products");
    expect(itemsStepTitle({ products: false, services: true }, false)).toBe("Add your services");
    expect(itemsStepTitle({ products: false, services: true }, true)).toBe("Manage your services");
    expect(itemsStepTitle({ products: true, services: true }, true)).toBe("Manage what you sell");
  });
});

describe("suggested items", () => {
  it("lists the owner's first items, then their picked examples, as names only", () => {
    expect(suggestedItems(profile({ category: "baked_goods", productTags: ["cookies", "breads"], firstItems: "sourdough loaves; cinnamon rolls." }))).toEqual([
      { name: "Sourdough loaves", kind: "product", from: "first_items" },
      { name: "Cinnamon rolls", kind: "product", from: "first_items" },
      { name: "Cookies", kind: "product", from: "examples" },
      { name: "Bread and rolls", kind: "product", from: "examples" },
    ]);
  });

  it("marks services for a services business", () => {
    expect(suggestedItems(profile({ category: "home_services", productTags: ["pet_care"], firstItems: "Mobile dog grooming from a van" }))).toEqual([
      { name: "Mobile dog grooming from a van", kind: "service", from: "first_items" },
      { name: "Pet sitting or walking", kind: "service", from: "examples" },
    ]);
    expect(likelyKind(profile({ offeringKinds: ["services"] }))).toBe("service");
  });

  it("skips an example the owner's own words already cover", () => {
    expect(suggestedItems(profile({ category: "crafts", productTags: ["candles"], firstItems: "Hand-poured soy candles" })).map((item) => item.name)).toEqual(["Hand-poured soy candles"]);
  });

  it("skips anything already listed, repeats and blanks", () => {
    const answers = profile({ category: "baked_goods", productTags: ["cookies"], firstItems: "Cookies, , cookies, Pie" });
    expect(suggestedItems(answers, [{ name: "pie" }]).map((item) => item.name)).toEqual(["Cookies"]);
  });

  it("stops at eight", () => {
    expect(suggestedItems(profile({ firstItems: Array.from({ length: 12 }, (_, i) => `Item ${i}`).join(", ") }))).toHaveLength(8);
  });
});
