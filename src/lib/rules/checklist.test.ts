import { describe, expect, it } from "vitest";
import { orderTasks, taskReadiness } from "./checklist";

const tasks = [
  { id: "bank-account", prerequisites: ["ein"] },
  { id: "file-llc", prerequisites: ["name-search"] },
  { id: "name-search", prerequisites: [] },
  { id: "ein", prerequisites: ["file-llc"] },
  { id: "insurance", prerequisites: [] },
];

describe("orderTasks", () => {
  it("puts prerequisites first and otherwise keeps the given order", () => {
    expect(orderTasks(tasks).map((task) => task.id)).toEqual([
      "name-search",
      "file-llc",
      "ein",
      "bank-account",
      "insurance",
    ]);
  });

  it("rejects unknown prerequisites", () => {
    expect(() => orderTasks([{ id: "ein", prerequisites: ["missing"] }])).toThrow(/unknown task "missing"/);
  });

  it("rejects cycles", () => {
    expect(() =>
      orderTasks([
        { id: "a", prerequisites: ["b"] },
        { id: "b", prerequisites: ["a"] },
      ]),
    ).toThrow(/circular/);
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      orderTasks([
        { id: "a", prerequisites: [] },
        { id: "a", prerequisites: [] },
      ]),
    ).toThrow(/unique/);
  });
});

describe("taskReadiness", () => {
  it("splits tasks into done, ready, and waiting", () => {
    expect(taskReadiness(tasks, new Set(["name-search"]))).toEqual([
      { id: "bank-account", state: "waiting", waitingOn: ["ein"] },
      { id: "file-llc", state: "ready" },
      { id: "name-search", state: "done" },
      { id: "ein", state: "waiting", waitingOn: ["file-llc"] },
      { id: "insurance", state: "ready" },
    ]);
  });
});
