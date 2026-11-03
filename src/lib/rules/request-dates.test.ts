import { expect, it } from "vitest";
import { requestDate, requestTime } from "./request-dates";
it("parses explicit US dates and rejects guesses, invalid days and missing years", () => {
  expect(requestDate("November 3, 2026")).toBe("2026-11-03");
  expect(requestDate("Nov 3rd 2026")).toBe("2026-11-03");
  expect(requestDate("11/3/2026")).toBe("2026-11-03");
  expect(requestDate("02/30/2026")).toBe("");
  expect(requestDate("next Friday")).toBe("");
  expect(requestDate("Nov 3")).toBe("");
});
it("converts explicit local times without assuming a time zone", () => {
  expect(requestTime("2:30 PM")).toBe("14:30");
  expect(requestTime("12 am")).toBe("00:00");
  expect(requestTime("12 pm")).toBe("12:00");
  expect(requestTime("after lunch")).toBe("");
  expect(requestTime("13 pm")).toBe("");
});
