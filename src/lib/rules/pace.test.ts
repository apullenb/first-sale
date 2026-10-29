import { describe, expect, it } from "vitest";
import { launchPace, minutesByTopic } from "./pace";

describe("minutesByTopic", () => {
  it("sums the owner's time by kind of step, largest first", () => {
    const { parts, restMinutes } = minutesByTopic([{ topic: "license_permit" }, { topic: "structure" }, { topic: "license_permit" }, {}]);
    expect(parts).toEqual([
      { topic: "license_permit", minutes: 90 },
      { topic: "structure", minutes: 20 },
      { topic: "other", minutes: 20 },
    ]);
    expect(restMinutes).toBe(0);
  });

  it("folds the smallest kinds into the rest past the limit", () => {
    const { parts, restMinutes } = minutesByTopic([{ topic: "employer" }, { topic: "license_permit" }, { topic: "tax_registration" }, { topic: "structure" }]);
    expect(parts).toEqual([
      { topic: "employer", minutes: 60 },
      { topic: "license_permit", minutes: 45 },
    ]);
    expect(restMinutes).toBe(50);
  });
});

describe("launchPace", () => {
  it("counts an hour of work a day and calls a week or more to spare on track", () => {
    expect(launchPace(250, 30)).toEqual({ workDays: 5, spareDays: 25, onTrack: true });
    expect(launchPace(250, 11)).toEqual({ workDays: 5, spareDays: 6, onTrack: false });
  });

  it("goes negative when the work doesn't fit before launch day", () => {
    expect(launchPace(600, 4)).toEqual({ workDays: 10, spareDays: -6, onTrack: false });
  });

  it("needs no days when nothing is left", () => {
    expect(launchPace(0, 9)).toEqual({ workDays: 0, spareDays: 9, onTrack: true });
    expect(launchPace(0, 3)).toEqual({ workDays: 0, spareDays: 3, onTrack: true });
  });
});
