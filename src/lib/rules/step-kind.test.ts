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

  describe("with the research model's read", () => {
    it("uses it when code knows nothing against it", () => {
      // Wording the patterns would call a filing
      expect(stepKindOf({ title: "Sanitation standards for home kitchens", topic: "license_permit", ownerAction: "compliance" })).toBe("compliance");
      expect(stepKindOf({ title: "ServSafe manager credential", topic: "license_permit", ownerAction: "training" })).toBe("training");
      expect(stepKindOf({ title: "Whether to collect tips", topic: "other", ownerAction: "decision" })).toBe("decision");
      expect(stepKindOf({ title: "Zoning for customer visits", topic: "location_zoning", ownerAction: "contact" })).toBe("contact");
      expect(stepKindOf({ title: "Keep your sales tax account current", topic: "tax_registration", ownerAction: "filing" })).toBe("filing");
    });

    it("lets a fee or a catalog form make it a filing", () => {
      expect(stepKindOf({ title: "Food handler card", topic: "license_permit", feeCents: 700, ownerAction: "decision" })).toBe("training");
      expect(stepKindOf({ title: "Home business approval", topic: "location_zoning", feeCents: 5000, ownerAction: "compliance" })).toBe("filing");
      expect(stepKindOf({ title: "Sales tax rules", topic: "tax_registration", ownerAction: "compliance" }, { hasForm: true })).toBe("filing");
      expect(stepKindOf({ title: "Home business approval", topic: "location_zoning", feeCents: 5000, ownerAction: "filing" })).toBe("filing");
    });

    it("keeps the structure choice a decision and office questions a contact", () => {
      expect(stepKindOf({ title: "Choose a business structure", topic: "structure", forStructures: [], ownerAction: "filing" })).toBe("decision");
      expect(stepKindOf({ title: "Home business rules", topic: "location_zoning", requirementStatus: "to_find_out", ownerAction: "compliance" })).toBe("contact");
      expect(stepKindOf({ title: "General business license", topic: "license_permit", ownerAction: "filing" }, { confirm: true })).toBe("contact");
    });

    it("falls back to the patterns for steps saved without it", () => {
      expect(stepKindOf({ title: "Complete an accredited food handler course", topic: "license_permit", ownerAction: null })).toBe("training");
      expect(stepKindOf({ title: "Sanitation standards for home kitchens", topic: "license_permit" })).toBe("filing");
    });
  });
});
