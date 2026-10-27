import { describe, expect, it } from "vitest";
import { testProfile } from "@/test/fixtures";
import { placeOf } from "./applicability";
import { answerChanges } from "./changes";
import { categoryOf, coverageFor, relevantCells } from "./coverage";

const profile = testProfile({ offeringKinds: ["food"], location: { county: "Franklin", city: "Columbus" } });
const base = { profile, place: placeOf(profile), searched: true, gaps: [], pages: [], unread: [], requirements: [] };
const cell = (cells: ReturnType<typeof coverageFor>, category: string, level: string) => cells.find((each) => each.category === category && each.level === level)?.state;

describe("coverageFor", () => {
  it("says what each category found, and never turns a gap into 'nothing applies'", () => {
    const cells = coverageFor({
      ...base,
      pages: [
        { level: "state", categories: ["food"] },
        { level: "state", categories: ["formation"] },
      ],
      unread: [{ level: "county", categories: ["food"] }],
      gaps: [
        { level: "city", category: "licenses", about: "", failed: false },
        { level: "city", category: "zoning", about: "", failed: true },
      ],
      requirements: [{ topic: "license_permit", title: "Cottage food labels", key: "cottage", level: "state", verification: "sourced" }],
    });
    expect(cell(cells, "food", "state")).toBe("confirmed");
    expect(cell(cells, "formation", "state")).toBe("read_unconfirmed");
    expect(cell(cells, "food", "county")).toBe("unreadable");
    expect(cell(cells, "licenses", "city")).toBe("no_official_page");
    expect(cell(cells, "zoning", "city")).toBe("search_failed");
    expect(cell(cells, "tax", "state")).toBe("not_searched");
  });

  it("asks for the place before county and city rules can be checked", () => {
    const nowhere = testProfile({ location: { county: "", city: "" } });
    const cells = coverageFor({ ...base, profile: nowhere, place: placeOf(nowhere) });
    expect(cell(cells, "licenses", "county")).toBe("place_unknown");
    expect(cell(cells, "zoning", "city")).toBe("place_unknown");
  });

  it("doesn't report gaps as failures when search wasn't available", () => {
    const cells = coverageFor({ ...base, searched: false, gaps: [{ level: "city", category: "licenses", about: "", failed: false }] });
    expect(cell(cells, "licenses", "city")).toBe("not_searched");
  });
});

describe("relevantCells and categoryOf", () => {
  it("adds food and product rules only when they matter", () => {
    expect(relevantCells(testProfile({ offeringKinds: ["handmade"] })).some((each) => each.category === "food")).toBe(false);
    expect(relevantCells(testProfile({ offeringKinds: ["handmade"], makesForKids: "yes" })).some((each) => each.category === "activity")).toBe(true);
    // "Not sure" keeps the row so the gap shows; only "no" leaves it out
    expect(relevantCells(testProfile({ offeringKinds: ["handmade"], makesForKids: "unsure" })).some((each) => each.category === "activity")).toBe(true);
    expect(relevantCells(testProfile({ offeringKinds: ["handmade"], makesForKids: "no" })).some((each) => each.category === "activity")).toBe(false);
  });

  it("files food permits under food, other licenses under licenses", () => {
    expect(categoryOf({ topic: "license_permit", title: "Home bakery registration", key: "home-bakery" })).toBe("food");
    expect(categoryOf({ topic: "license_permit", title: "General business license", key: "business-license" })).toBe("licenses");
    expect(categoryOf({ topic: "employer", title: "Payroll", key: "payroll" })).toBe("tax");
  });
});

describe("answerChanges", () => {
  it("lists what changed and whether research must run again", () => {
    const before = testProfile({ owners: { count: 1 } });
    const after = testProfile({ owners: { count: 2 }, foodNeedsCold: "yes" });
    const changes = answerChanges(before, after, null, "partnership");
    expect(changes.map((change) => change.what)).toEqual(["Whether your food needs refrigeration", "Who owns the business", "Your business structure"]);
    expect(changes.at(-1)).toMatchObject({ before: "not decided", now: "a partnership", recheck: false });
    expect(answerChanges(before, before, "llc", "llc")).toEqual([]);
  });
});
