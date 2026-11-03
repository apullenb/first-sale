import { describe, expect, it } from "vitest";
import { DEMO_EMAILS } from "@/data/email-demo";
import { dueDateFromWording } from "./demo-dates";

// 2026-11-03 is a Tuesday
const TODAY = "2026-11-03";

describe("due dates from sample wording", () => {
  it("takes the next named weekday after today", () => {
    expect(dueDateFromWording("Pickup Saturday, about 10 am", TODAY)).toBe("2026-11-07");
    expect(dueDateFromWording("Pickup Friday, 7:30 am", TODAY)).toBe("2026-11-06");
    expect(dueDateFromWording("Delivery Tuesday, before 7 am", TODAY)).toBe("2026-11-10");
  });

  it("finds the next month whose day falls on the named weekday", () => {
    expect(dueDateFromWording("Pickup Wednesday the 25th, after 4 pm", TODAY)).toBe("2026-11-25");
    // Nov 25 2026 is a Wednesday, so a Friday the 25th waits for December
    expect(dueDateFromWording("Friday the 25th", TODAY)).toBe("2026-12-25");
    expect(dueDateFromWording("Wednesday the 25th", "2026-11-26")).toBe("2027-08-25");
  });

  it("takes a month and day this year, or next year once it has passed", () => {
    expect(dueDateFromWording("Ship to Denver, CO, arriving by December 15", TODAY)).toBe("2026-12-15");
    expect(dueDateFromWording("Delivery June 6, morning, Oak Hollow Barn", TODAY)).toBe("2027-06-06");
    expect(dueDateFromWording("November 3", TODAY)).toBe(TODAY);
    expect(dueDateFromWording("February 29", TODAY)).toBe("2028-02-29");
  });

  it("takes the next day of the month on its own", () => {
    expect(dueDateFromWording("Needed by the 21st", TODAY)).toBe("2026-11-21");
    expect(dueDateFromWording("by the 2nd", TODAY)).toBe("2026-12-02");
    expect(dueDateFromWording("the 31st", TODAY)).toBe("2026-12-31");
  });

  it("leaves vague wording undated", () => {
    expect(dueDateFromWording("No date", TODAY)).toBeNull();
    expect(dueDateFromWording("Order #1043 shipped soon", TODAY)).toBeNull();
    expect(dueDateFromWording("the 45th", TODAY)).toBeNull();
  });

  it("dates every sample that goes to Orders & jobs", () => {
    const dated = DEMO_EMAILS.filter((email) => email.result.kind === "order" || email.result.kind === "quote").map((email) => [email.id, dueDateFromWording(email.result.when, TODAY)]);
    expect(Object.fromEntries(dated)).toEqual({
      cookies: "2026-11-07",
      cake: "2026-11-21",
      breakfast: "2026-11-06",
      wholesale: "2026-11-10",
      tins: "2026-12-15",
      pies: "2026-11-25",
      favors: "2027-06-06",
    });
  });
});
