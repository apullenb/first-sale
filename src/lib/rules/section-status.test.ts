import { describe, expect, it } from "vitest";
import { type JourneyFacts, sectionState, sidebarStatus } from "./section-status";

const START = ["/business", "/requirements", "/structure", "/checklist", "/documents"];
const BRAND = ["/logo", "/brand", "/website", "/products", "/marketing", "/social"];

const facts = (overrides: Partial<JourneyFacts> = {}): JourneyFacts => ({
  business: true,
  research: "current",
  structureChosen: true,
  plan: { exists: true, proposal: false, ready: 0, left: 0, minutes: 0, waiting: 0 },
  libraryToCheck: 0,
  logoChosen: false,
  logoVersionsApproved: false,
  websiteLive: false,
  products: 0,
  marketingApproved: false,
  socialPlatforms: [],
  marks: new Set(),
  ...overrides,
});

describe("sidebarStatus", () => {
  it("folds up the start once nothing is left for the owner, even with a step still at an office", () => {
    // Two sent in, and one more that can't start until they're approved
    const status = sidebarStatus(facts({ plan: { exists: true, proposal: false, ready: 0, left: 1, minutes: 30, waiting: 2 } }));
    expect(status["/checklist"].state).toBe("waiting");
    expect(sectionState(status, START)).toBe("waiting");
  });

  it("keeps the start open while a plan step is ready, counting every step not started and its time", () => {
    const status = sidebarStatus(facts({ plan: { exists: true, proposal: false, ready: 2, left: 3, minutes: 90, waiting: 1 } }));
    expect(status["/checklist"]).toEqual({ state: "todo", count: 3, minutes: 90 });
    expect(sectionState(status, START)).toBe("todo");
  });

  it("treats changed answers, plan changes to review and forms to check as the owner's to do", () => {
    expect(sidebarStatus(facts({ research: "stale" }))["/requirements"].state).toBe("todo");
    expect(sidebarStatus(facts({ plan: { exists: true, proposal: true, ready: 0, left: 0, minutes: 0, waiting: 0 } }))["/checklist"].state).toBe("todo");
    expect(sidebarStatus(facts({ plan: { exists: false, proposal: false, ready: 0, left: 0, minutes: 0, waiting: 0 } }))["/checklist"].state).toBe("todo");
    expect(sidebarStatus(facts({ libraryToCheck: 1 }))["/documents"].state).toBe("todo");
    expect(sidebarStatus(facts({ business: false }))["/documents"].state).toBe("todo");
  });

  it("counts a brand step done when made here or marked as already done", () => {
    const status = sidebarStatus(facts({ logoChosen: true, products: 2, marks: new Set(["brand", "website", "marketing", "social"]) }));
    expect(BRAND.map((href) => status[href].state)).toEqual(["done", "done", "done", "done", "done", "done"]);
    expect(sectionState(status, BRAND)).toBe("done");
  });

  it("needs every picked social account set up, and none picked means not done", () => {
    expect(sidebarStatus(facts())["/social"].state).toBe("todo");
    const some = facts({ socialPlatforms: ["instagram", "facebook"], marks: new Set(["social:instagram"]) });
    expect(sidebarStatus(some)["/social"].state).toBe("todo");
    const all = facts({ socialPlatforms: ["instagram", "facebook"], marks: new Set(["social:instagram", "social:facebook"]) });
    expect(sidebarStatus(all)["/social"].state).toBe("done");
  });

  it("leaves a section to do when it has no known steps", () => {
    expect(sectionState({}, ["/nowhere"])).toBe("todo");
  });
});
