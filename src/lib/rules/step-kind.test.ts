import { describe, expect, it } from "vitest";
import { stepKindOf, waitsOnOffice } from "./step-kind";

describe("stepKindOf", () => {
  it("treats operating as a structure as a decision, never a filing", () => {
    expect(stepKindOf({ title: "Operate as a sole proprietorship", topic: "structure", forStructures: ["sole_proprietorship"], feeCents: null })).toBe("decision");
    expect(stepKindOf({ title: "Choose a business structure", topic: "structure", forStructures: [], feeCents: null })).toBe("decision");
    expect(waitsOnOffice("decision")).toBe(false);
  });

  it("keeps forming a company a filing, with or without a known fee", () => {
    expect(stepKindOf({ title: "File a certificate of formation to form your LLC", topic: "structure", forStructures: ["llc"], feeCents: 30000 })).toBe("filing");
    expect(stepKindOf({ title: "Form your LLC with the state of Ohio", topic: "structure", forStructures: ["llc"], feeCents: null })).toBe("filing");
  });

  it("sends confirming with an office to the written question", () => {
    expect(stepKindOf({ title: "Confirm Denton zoning allows home baking with customer pickup", topic: "location_zoning" })).toBe("contact");
    expect(stepKindOf({ title: "Home business rules", topic: "location_zoning", requirementStatus: "to_find_out" })).toBe("contact");
    expect(stepKindOf({ title: "General business license", topic: "license_permit" }, { confirm: true })).toBe("contact");
  });

  it("tells training and rules to follow apart from filings", () => {
    expect(stepKindOf({ title: "Complete an accredited food handler course", topic: "license_permit" })).toBe("training");
    expect(stepKindOf({ title: "Label your cottage foods the way Texas requires", topic: "license_permit" })).toBe("compliance");
    expect(stepKindOf({ title: "Check that your foods fit Texas cottage food rules", topic: "license_permit" })).toBe("compliance");
    expect(stepKindOf({ title: "Check whether anything you do needs a federal license", topic: "license_permit" })).toBe("compliance");
    expect(stepKindOf({ title: "Register your cottage food operation with DSHS", topic: "license_permit" })).toBe("filing");
    expect(stepKindOf({ title: "File an assumed name certificate with the Denton County Clerk", topic: "name_registration" })).toBe("filing");
  });

  it("lets an official form make it a filing", () => {
    expect(stepKindOf({ title: "Sales tax rules", topic: "tax_registration" }, { hasForm: true })).toBe("filing");
  });
});
