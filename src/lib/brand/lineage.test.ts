import { describe, expect, it } from "vitest";
import { ancestorIds, ownLogos } from "./lineage";

const upload = (id: string) => ({ id, kind: "logo", origin: "uploaded", conceptId: null, sourceId: null });
const edit = (id: string, sourceId: string) => ({ id, kind: "logo", origin: "generated", conceptId: null, sourceId });
const drawn = (id: string) => ({ id, kind: "logo", origin: "generated", conceptId: "concept-1", sourceId: null });
const version = (id: string, sourceId: string) => ({ id, kind: "stacked", origin: "generated", conceptId: null, sourceId });

describe("the owner's own logos", () => {
  const files = [upload("u1"), edit("e1", "u1"), edit("e2", "e1"), edit("e3", "u1"), upload("u2"), drawn("d1"), version("v1", "e2")];

  it("know which logos the chosen one was edited from", () => {
    expect(ancestorIds(files, "e2")).toEqual(["e1", "u1"]);
    expect(ancestorIds(files, "u1")).toEqual([]);
    expect(ancestorIds(files, "v1")).toEqual(["e2", "e1", "u1"]);
  });

  it("list each upload followed by its edits, so edits of an upload that isn't chosen stay usable", () => {
    expect(ownLogos(files, "d1").map((each) => [each.file.id, each.depth, each.holdsChosen])).toEqual([
      ["u1", 0, false],
      ["e1", 1, false],
      ["e2", 2, false],
      ["e3", 1, false],
      ["u2", 0, false],
    ]);
  });

  it("leave out the chosen logo and ones shown elsewhere, and mark the ones it was made from", () => {
    const listed = ownLogos(files, "e2", new Set(["e1"]));
    expect(listed.map((each) => [each.file.id, each.holdsChosen])).toEqual([
      ["u1", true],
      ["e3", false],
      ["u2", false],
    ]);
  });
});
