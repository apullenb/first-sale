import { describe, expect, it } from "vitest";
import { families, nextVersion, roleOf } from "./library";

const doc = (id: string, overrides: Partial<{ familyId: string | null; version: number; fromDocumentId: string | null; updatedAt: Date }> = {}) => ({
  id,
  familyId: null,
  version: 1,
  fromDocumentId: null,
  updatedAt: new Date("2026-10-27T10:00:00Z"),
  ...overrides,
});

describe("families", () => {
  it("groups versions under the first one, newest version first", () => {
    const groups = families([
      doc("form"),
      doc("copy-2", { familyId: "form", version: 2, updatedAt: new Date("2026-10-27T11:00:00Z") }),
      doc("copy-3", { familyId: "form", version: 3, updatedAt: new Date("2026-10-27T12:00:00Z") }),
      doc("receipt"),
      // Made before versions existed: joins the form it came from
      doc("old-copy", { fromDocumentId: "form" }),
    ]);
    expect(groups.map((group) => [group.root.id, group.versions.map((each) => each.id)])).toEqual([
      ["form", ["copy-3", "copy-2", "old-copy"]],
      ["receipt", []],
    ]);
  });

  it("numbers the next version after the highest in the family", () => {
    expect(nextVersion([doc("form"), doc("copy", { familyId: "form", version: 4 }), doc("other", { version: 7 })], "form")).toBe(5);
  });
});

describe("roleOf", () => {
  it("names documents saved before roles existed", () => {
    expect(roleOf({ role: null, origin: "official_form", generatedKind: null })).toBe("original");
    expect(roleOf({ role: null, origin: "generated", generatedKind: "filled_form" })).toBe("reviewed");
    expect(roleOf({ role: null, origin: "generated", generatedKind: "business_plan" })).toBe("prepared");
    expect(roleOf({ role: null, origin: "upload", generatedKind: null })).toBe("form");
    expect(roleOf({ role: "receipt", origin: "upload", generatedKind: null })).toBe("receipt");
  });
});
