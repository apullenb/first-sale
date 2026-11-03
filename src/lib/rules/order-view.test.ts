import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/lib/domain";
import {
  dateText,
  dueText,
  fulfillmentFits,
  inTab,
  laterSteps,
  nextStep,
  relativeDays,
  sortOrders,
  stepAction,
  tabOf,
  timeText,
  type TrackingStatus,
} from "./order-tracking";

const TODAY = "2026-11-03";

describe("status tabs", () => {
  it("put every status in exactly one tab, with shipped beside ready", () => {
    expect(Object.fromEntries(ORDER_STATUSES.map((status) => [status, tabOf(status)]))).toEqual({
      new: "review",
      needs_review: "review",
      confirmed: "todo",
      in_progress: "in_progress",
      ready: "ready",
      shipped: "ready",
      fulfilled: "done",
      cancelled: "cancelled",
    });
    const active = ORDER_STATUSES.filter((status) => inTab(status, "active"));
    expect(active).toEqual(["new", "confirmed", "needs_review", "in_progress", "ready", "shipped"]);
  });
});

describe("next steps", () => {
  const order = (status: TrackingStatus, workType: "products" | "made_to_order" | "services", fulfillment = "pickup") => ({ status, workType, fulfillment });

  it("offer only later steps of the existing model", () => {
    expect(laterSteps(order("confirmed", "made_to_order"))).toEqual(["in_progress", "ready", "fulfilled"]);
    expect(laterSteps(order("confirmed", "products", "shipping"))).toEqual(["shipped", "fulfilled"]);
    expect(laterSteps(order("in_progress", "services", "at_customer"))).toEqual(["fulfilled"]);
    expect(laterSteps(order("fulfilled", "products"))).toEqual([]);
    expect(laterSteps(order("cancelled", "products"))).toEqual([]);
  });

  it("keep orders in review out of the steps, except email samples", () => {
    expect(nextStep(order("needs_review", "made_to_order"))).toBeNull();
    expect(nextStep(order("needs_review", "made_to_order"), true)).toBe("confirmed");
    expect(nextStep(order("confirmed", "services"))).toBe("in_progress");
  });

  it("word each step as a button", () => {
    expect(stepAction("in_progress", "made_to_order")).toBe("Start making");
    expect(stepAction("in_progress", "services")).toBe("Start work");
    expect(stepAction("ready", "products")).toBe("Mark ready");
    expect(stepAction("shipped", "products")).toBe("Mark shipped");
    expect(stepAction("fulfilled", "services")).toBe("Mark completed");
    expect(stepAction("confirmed", "services")).toBe("Mark scheduled");
  });

  it("allow a new handover only when the current step still exists", () => {
    expect(fulfillmentFits("ready", "products", "shipping")).toBe(false);
    expect(fulfillmentFits("ready", "products", "delivery")).toBe(true);
    expect(fulfillmentFits("confirmed", "products", "shipping")).toBe(true);
    expect(fulfillmentFits("needs_review", "products", "shipping")).toBe(true);
  });
});

describe("due dates", () => {
  it("read as a short date, a time and how far off", () => {
    expect(dateText("2026-11-07", TODAY)).toBe("Sat, Nov 7");
    expect(dateText("2027-06-06", TODAY)).toBe("Sun, Jun 6, 2027");
    expect(timeText("10:00")).toBe("10 am");
    expect(timeText("07:30")).toBe("7:30 am");
    expect(timeText("12:15")).toBe("12:15 pm");
    expect(timeText("00:00")).toBe("12 am");
    expect(timeText("")).toBe("");
    expect(relativeDays("2026-11-07", TODAY)).toBe("in 4 days");
    expect(relativeDays("2026-11-04", TODAY)).toBe("tomorrow");
    expect(relativeDays(TODAY, TODAY)).toBe("today");
    expect(relativeDays("2026-11-02", TODAY)).toBe("yesterday");
    expect(relativeDays("2026-10-30", TODAY)).toBe("4 days ago");
  });

  it("are overdue only while work is still open", () => {
    expect(dueText({ status: "confirmed", requestedDate: "2026-11-07", jobTime: "10:00" }, TODAY)).toEqual({ date: "Sat, Nov 7 · 10 am", relative: "in 4 days", overdue: false, today: false });
    expect(dueText({ status: "in_progress", requestedDate: "2026-11-01", jobTime: "" }, TODAY)).toMatchObject({ overdue: true, relative: "2 days ago" });
    expect(dueText({ status: "fulfilled", requestedDate: "2026-11-01", jobTime: "" }, TODAY).overdue).toBe(false);
    expect(dueText({ status: "confirmed", requestedDate: TODAY, jobTime: "" }, TODAY).today).toBe(true);
    expect(dueText({ status: "confirmed", requestedDate: null, jobTime: "" }, TODAY).date).toBe("No due date");
  });
});

describe("sorting", () => {
  const rows = [
    { id: "a", requestedDate: null, jobTime: "", createdAt: "2026-11-03T09:00:00Z", customerName: "zoe" },
    { id: "b", requestedDate: "2026-11-07", jobTime: "14:00", createdAt: "2026-11-01T09:00:00Z", customerName: "Alex" },
    { id: "c", requestedDate: "2026-11-07", jobTime: "09:00", createdAt: "2026-11-02T09:00:00Z", customerName: "bea" },
    { id: "d", requestedDate: "2026-11-05", jobTime: "", createdAt: "2026-10-30T09:00:00Z", customerName: "Alex" },
  ];
  it("by due date puts the soonest first and undated last", () => {
    expect(sortOrders(rows, "due").map((row) => row.id)).toEqual(["d", "c", "b", "a"]);
  });
  it("by newest or customer name", () => {
    expect(sortOrders(rows, "newest").map((row) => row.id)).toEqual(["a", "c", "b", "d"]);
    expect(sortOrders(rows, "customer").map((row) => row.id)).toEqual(["b", "d", "c", "a"]);
  });
});
