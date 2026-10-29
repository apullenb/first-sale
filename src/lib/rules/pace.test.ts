import { describe, expect, it } from "vitest";
import { launchPace } from "./pace";

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
