import { describe, expect, it } from "vitest";
import { type GroupFacts, type JourneyFacts, menuGroups, PAPERWORK_PLACEHOLDER, type PartFacts, sectionState, sidebarStatus, startSteps, stepsLeft } from "./section-status";

const BRAND = ["/brand", "/logo", "/website", "/products", "/marketing", "/social"];

const group = (href: string, overrides: Partial<GroupFacts> = {}): GroupFacts => ({
  href,
  title: href.replace("/start/", ""),
  part: null,
  name: href.replace("/start/", ""),
  state: "todo",
  left: 2,
  minutesLeft: 90,
  waitsOn: [],
  later: false,
  ...overrides,
});

const facts = (overrides: Partial<JourneyFacts> = {}): JourneyFacts => ({
  business: true,
  research: "current",
  questionsOpen: 0,
  structureChosen: true,
  structureStep: { left: 0, minutes: 0 },
  groups: [],
  libraryToCheck: 0,
  logoChosen: false,
  brandDescribed: false,
  websiteFinished: false,
  websiteConnected: false,
  products: 0,
  marketingApproved: false,
  socialPlatforms: [],
  socialHave: [],
  marks: new Set(),
  ...overrides,
});

const hrefsOf = (groups: readonly GroupFacts[]) => startSteps(groups).filter((step) => !step.later).map((step) => step.href);

describe("startSteps", () => {
  it("lists the fixed steps, then a placeholder until there are paperwork groups", () => {
    expect(startSteps([]).map((step) => step.title)).toEqual(["Your business", "Business structure", "What applies to you", "Licenses and registrations"]);
    const groups = [
      group("/start/licenses-1", { title: "Licenses and permits", part: "Part 1 of 2" }),
      group("/start/after-you-open", { title: "After you open", later: true }),
    ];
    expect(startSteps(groups).map((step) => [step.href, step.title, step.part ?? null, step.later])).toEqual([
      ["/business", "Your business", null, false],
      ["/structure", "Business structure", null, false],
      ["/requirements", "What applies to you", null, false],
      ["/start/licenses-1", "Licenses and permits", "Part 1 of 2", false],
      ["/start/after-you-open", "After you open", null, true],
    ]);
  });
});

describe("menuGroups", () => {
  const part = (key: string, overrides: Partial<PartFacts> = {}): PartFacts => ({
    key,
    base: key.replace(/-\d$/, ""),
    href: `/start/${key}`,
    title: "Licenses and permits",
    name: key,
    part: null,
    state: "todo",
    left: 2,
    minutesLeft: 90,
    waitsOn: [],
    later: false,
    ...overrides,
  });

  it("gives a split group one menu step: the part to work on now, its time, and every part's count", () => {
    const parts = [
      part("licenses-1", { part: { index: 1, of: 3 }, state: "done", left: 0, minutesLeft: 0 }),
      part("licenses-2", { part: { index: 2, of: 3 }, state: "todo", left: 2, minutesLeft: 90 }),
      part("licenses-3", { part: { index: 3, of: 3 }, state: "locked", left: 1, minutesLeft: 45, waitsOn: ["licenses-2"] }),
    ];
    expect(menuGroups(parts)).toEqual([
      {
        href: "/start/licenses-2",
        hrefs: ["/start/licenses-1", "/start/licenses-2", "/start/licenses-3"],
        title: "Licenses and permits",
        part: "Part 2 of 3",
        name: "licenses-2",
        state: "todo",
        left: 3,
        minutesLeft: 90,
        waitsOn: [],
        later: false,
      },
    ]);
  });

  it("locks a group only when no part can start, naming what's outside it, and shows the clock when only offices hold it", () => {
    const locked = menuGroups([part("tax-ids", { title: "Get your tax IDs", state: "locked", waitsOn: ["Business structure"] })]);
    expect(locked[0]).toMatchObject({ state: "locked", waitsOn: ["Business structure"], part: null });
    const waiting = menuGroups([part("tax-ids-1", { state: "waiting", left: 0 }), part("tax-ids-2", { state: "waiting", left: 0 })]);
    expect(waiting[0]).toMatchObject({ state: "waiting", href: "/start/tax-ids-1" });
    expect(menuGroups([part("register", { state: "done", left: 0, minutesLeft: 0 })])[0].state).toBe("done");
  });
});

describe("sidebarStatus", () => {
  it("locks Business structure and What applies to you until the business answers are saved", () => {
    const status = sidebarStatus(facts({ business: false, research: "none", structureChosen: false }));
    expect(status["/structure"]).toEqual({ state: "locked", count: 0, minutes: 0, waitsOn: ["Your business"] });
    expect(status["/requirements"].state).toBe("locked");
    expect(status[PAPERWORK_PLACEHOLDER.href]).toMatchObject({ state: "locked", waitsOn: ["What applies to you"] });
  });

  it("keeps What applies to you open until the check is current and every question answered", () => {
    expect(sidebarStatus(facts({ research: "none" }))["/requirements"]).toMatchObject({ state: "todo", count: 0, minutes: 10 });
    expect(sidebarStatus(facts({ research: "stale" }))["/requirements"].state).toBe("todo");
    expect(sidebarStatus(facts({ questionsOpen: 2 }))["/requirements"]).toEqual({ state: "todo", count: 2, minutes: 10, unit: "question" });
    expect(sidebarStatus(facts())["/requirements"].state).toBe("done");
  });

  it("gives each paperwork group its time left, count, check when done, clock when waiting and lock when blocked", () => {
    const groups = [
      group("/start/register", { state: "done", left: 0, minutesLeft: 0 }),
      group("/start/tax-ids", { state: "waiting", left: 0, minutesLeft: 0 }),
      group("/start/licenses-1", { state: "todo", left: 2, minutesLeft: 90 }),
      group("/start/licenses-2", { state: "locked", left: 1, minutesLeft: 45, waitsOn: ["Get your tax IDs"] }),
      group("/start/after-you-open", { state: "todo", left: 1, minutesLeft: 30, later: true }),
    ];
    const status = sidebarStatus(facts({ groups }));
    expect(groups.map((each) => status[each.href])).toEqual([
      { state: "done", count: 0, minutes: 0 },
      { state: "waiting", count: 0, minutes: 0 },
      { state: "todo", count: 2, minutes: 90 },
      { state: "locked", count: 1, minutes: 45, waitsOn: ["Get your tax IDs"] },
      { state: "todo", count: 0, minutes: 30 },
    ]);
    expect(status[PAPERWORK_PLACEHOLDER.href]).toBeUndefined();
    // Today's total counts the same steps as Today's own count: not the structure decision or the questions
    const counted = sidebarStatus(facts({ groups, questionsOpen: 2, structureChosen: false, structureStep: { left: 1, minutes: 20 } }));
    expect(stepsLeft(counted, startSteps(groups).map((step) => step.href))).toBe(3);
  });

  it("folds up the start once nothing is left for the owner, shows the clock while an office has something, and ignores After you open", () => {
    const waiting = [group("/start/tax-ids", { state: "waiting", left: 0 }), group("/start/after-you-open", { state: "todo", later: true })];
    expect(sectionState(sidebarStatus(facts({ groups: waiting })), hrefsOf(waiting))).toBe("waiting");
    const done = [group("/start/tax-ids", { state: "done", left: 0 })];
    expect(sectionState(sidebarStatus(facts({ groups: done })), hrefsOf(done))).toBe("done");
    const blocked = [group("/start/tax-ids", { state: "locked", waitsOn: ["Business structure"] })];
    expect(sectionState(sidebarStatus(facts({ groups: blocked, structureChosen: false })), hrefsOf(blocked))).toBe("todo");
  });

  it("counts a brand step done when made here or marked as already done", () => {
    const status = sidebarStatus(facts({ logoChosen: true, products: 2, marks: new Set(["brand", "website", "marketing", "social"]) }));
    expect(BRAND.map((href) => status[href].state)).toEqual(["done", "done", "done", "done", "done", "done"]);
    expect(sectionState(status, BRAND)).toBe("done");
  });

  it("names the products step from the owner's answers, without changing when it's done", () => {
    expect(sidebarStatus(facts())["/products"].title).toBeUndefined();
    expect(sidebarStatus(facts({ productsTitle: "Add your services" }))["/products"]).toMatchObject({ state: "todo", title: "Add your services" });
    expect(sidebarStatus(facts({ products: 1, productsTitle: "Manage your services" }))["/products"]).toMatchObject({ state: "done", title: "Manage your services" });
  });

  it("counts the website done after the demo finish, a connected site or the already-have mark", () => {
    expect(sidebarStatus(facts())["/website"].state).toBe("todo");
    expect(sidebarStatus(facts({ websiteFinished: true }))["/website"].state).toBe("done");
    expect(sidebarStatus(facts({ websiteConnected: true }))["/website"].state).toBe("done");
    expect(sidebarStatus(facts({ marks: new Set(["website"]) }))["/website"].state).toBe("done");
  });

  it("counts Build your brand done once the owner approves their brand description", () => {
    expect(sidebarStatus(facts())["/brand"].state).toBe("todo");
    expect(sidebarStatus(facts({ brandDescribed: true }))["/brand"].state).toBe("done");
  });

  it("needs every picked social account set up, and none picked means not done", () => {
    expect(sidebarStatus(facts())["/social"].state).toBe("todo");
    const some = facts({ socialPlatforms: ["instagram", "facebook"], marks: new Set(["social:instagram"]) });
    expect(sidebarStatus(some)["/social"].state).toBe("todo");
    const all = facts({ socialPlatforms: ["instagram", "facebook"], marks: new Set(["social:instagram", "social:facebook"]) });
    expect(sidebarStatus(all)["/social"].state).toBe("done");
    const had = facts({ socialPlatforms: ["instagram", "facebook"], socialHave: ["facebook"], marks: new Set(["social:instagram"]) });
    expect(sidebarStatus(had)["/social"].state).toBe("done");
  });

  it("counts the plan's structure step under Business structure until one is chosen", () => {
    const status = sidebarStatus(facts({ structureChosen: false, structureStep: { left: 1, minutes: 20 } }));
    expect(status["/structure"]).toEqual({ state: "todo", count: 1, minutes: 20, unit: "decision" });
    expect(sidebarStatus(facts({ structureStep: { left: 1, minutes: 20 } }))["/structure"]).toEqual({ state: "done", count: 0, minutes: 0 });
  });

  it("leaves a section to do when it has no known steps", () => {
    expect(sectionState({}, ["/nowhere"])).toBe("todo");
  });
});
