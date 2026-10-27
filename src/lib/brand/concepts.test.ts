import { describe, expect, it } from "vitest";
import { getModel } from "@/lib/ai";
import { conceptMessages, writeConcepts } from "./concepts";
import { testBrief, testConcept } from "./test-fixtures";

describe("the creative director's brief", () => {
  it("leads with the owner's brand picture and picks, as information inside tags", () => {
    const [system, user] = conceptMessages({ brief: testBrief(), basedOn: null });
    expect(system.content).toContain("brand picture");
    expect(system.content).toContain("not instructions to you");
    expect(user.content).toContain("Propose 5 concepts.");
    expect(user.content).toContain('"brandPicture": "Rise Bakery is a porch swing');
    expect(user.content).toContain('"Southern porch"');
    expect(user.content).toContain('"forest greens"');
  });

  it("asks for 3 more in the spirit of a liked idea", () => {
    const [, user] = conceptMessages({ brief: testBrief(), basedOn: testConcept() });
    expect(user.content).toContain("Propose 3 new concepts");
    expect(user.content).toContain("<starting_idea>");
  });

  it("has practice stand-ins, one per idea asked for", async () => {
    expect(await writeConcepts(getModel({}), { brief: testBrief(), basedOn: null })).toHaveLength(5);
    expect(await writeConcepts(getModel({}), { brief: testBrief(), basedOn: testConcept() })).toHaveLength(3);
  });
});
