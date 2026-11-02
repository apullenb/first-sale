import { describe, expect, it } from "vitest";
import { defaultOperation, demoOperation, operationSetupSchema, sampleRequestItem } from "./operations";

const email = () => ({ ...defaultOperation("email"), email: "hello@example.com" });

describe("daily workflow setup", () => {
  it("requires a business email for email sources and at least one supported task", () => {
    expect(operationSetupSchema.safeParse(defaultOperation("email")).success).toBe(false);
    expect(operationSetupSchema.safeParse(email()).success).toBe(true);
    expect(operationSetupSchema.safeParse({ ...email(), goals: [] }).success).toBe(false);
    expect(operationSetupSchema.safeParse({ ...email(), goals: ["Send automatically"] }).success).toBe(false);
    expect(operationSetupSchema.safeParse({ ...email(), source: "Website" }).success).toBe(false);
    expect(operationSetupSchema.safeParse({ ...email(), mode: "live" }).success).toBe(false);
  });

  it("allows a manual tracker without email, with only fixed reminder intervals", () => {
    const manual = { ...defaultOperation("requests"), source: "Enter requests myself" };
    expect(operationSetupSchema.safeParse(manual).success).toBe(true);
    expect(operationSetupSchema.safeParse({ ...manual, reminder: "0" }).success).toBe(false);
    expect(operationSetupSchema.safeParse({ ...manual, goals: ["Track orders", "Track orders"] }).success).toBe(false);
  });

  it("only drafts a sample reply when the owner chose reply drafting", () => {
    const sample = demoOperation({ ...email(), goals: ["Flag messages that need my attention"] });
    expect(sample.result).toContain("No reply was drafted or sent");
  });

  it("labels sample orders and leaves order and stock changes for review", () => {
    const sample = demoOperation({ ...defaultOperation("requests"), source: "Website", reminder: "1" });
    expect(sample.title).toContain("DEMO");
    expect(sample.result).toContain("stock is unchanged");
    expect(sample.reminder).toContain("1 day,");
  });

  it("names an exact option of the owner's own item in the sample request", () => {
    const options = { groups: [{ name: "Size", values: ["12 oz"] }], variants: [{ values: ["12 oz"], priceCents: 1800, quantity: 4 }] };
    const item = sampleRequestItem([{ name: "Loaf", priceCents: 950, quantity: null, options: { groups: [], variants: [] } }, { name: "Candle", priceCents: 1200, quantity: 4, options }]);
    expect(item).toEqual({ name: "Candle", values: ["12 oz"], priceCents: 1800, quantity: 4 });
    const sample = demoOperation({ ...defaultOperation("requests"), source: "Enter requests myself" }, item);
    expect(sample.message).toBe("Hi! Could I order 2 of your Candle (12 oz)?");
    expect(sample.result).toContain("That option is $18 each, with 4 in stock. No order was placed and stock is unchanged.");
    expect(sampleRequestItem([])).toBeNull();
  });
});
