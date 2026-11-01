import { describe, expect, it } from "vitest";
import { defaultOperation, demoOperation, operationSetupSchema } from "./operations";

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
});
