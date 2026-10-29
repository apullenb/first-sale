import { describe, expect, it } from "vitest";
import { getModel, type ModelProvider } from "@/lib/ai";
import { allowedKinds, conceptMessages, writeConcepts } from "./concepts";
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

  it("passes on the kinds of logo the owner picked, and logos they like as taste only", () => {
    const [system, user] = conceptMessages({ brief: testBrief({ logoKinds: ["wordmark", "emblem"], logoLikes: "bold, simple letters" }), basedOn: null });
    expect(user.content).toContain('"kindsTheyWant": [\n    "wordmark",\n    "emblem"\n  ]');
    expect(user.content).toContain('"logosTheyLike": "bold, simple letters"');
    expect(system.content).toContain("use only those kinds");
    expect(system.content).toContain("Never copy, imitate or mention those logos");
  });

  it("keeps the liked idea's kind for more like it, and leaves a mix when nothing is picked", () => {
    expect(allowedKinds({ brief: testBrief({ logoKinds: ["wordmark"] }), basedOn: testConcept({ kind: "emblem" }) })).toEqual(["wordmark", "emblem"]);
    expect(allowedKinds({ brief: testBrief(), basedOn: testConcept() })).toEqual([]);
  });

  it("refuses ideas of a kind the owner didn't pick", async () => {
    const offPick: ModelProvider = {
      name: "Test",
      model: "test",
      capabilities: { vision: false, pdf: false, jsonSchema: true, reasoningEffort: false, webSearch: false },
      simulated: false,
      complete: async () => ({ text: JSON.stringify({ concepts: Array.from({ length: 5 }, () => testConcept({ kind: "emblem" })) }), finishReason: "stop", usage: null }),
    };
    await expect(writeConcepts(offPick, { brief: testBrief({ logoKinds: ["wordmark"] }), basedOn: null })).rejects.toThrow();
  });

  it("practice ideas follow the owner's picked kinds", async () => {
    const ideas = await writeConcepts(getModel({}), { brief: testBrief({ logoKinds: ["emblem", "monogram"] }), basedOn: null });
    expect(ideas.map((idea) => idea.kind)).toEqual(["emblem", "monogram", "emblem", "monogram", "emblem"]);
  });

  it("has practice stand-ins, one per idea asked for", async () => {
    expect(await writeConcepts(getModel({}), { brief: testBrief(), basedOn: null })).toHaveLength(5);
    expect(await writeConcepts(getModel({}), { brief: testBrief(), basedOn: testConcept() })).toHaveLength(3);
  });
});
