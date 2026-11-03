import { describe, expect, it } from "vitest";
import { PLAN_DEFAULTS, type PlanTaskDraft } from "@/lib/rules/plan";
import { startupPlanBlocks } from "./startup-plan";

const step: PlanTaskDraft & { status: "todo" } = {
  ...PLAN_DEFAULTS,
  key: "license",
  title: "Business license",
  topic: "license_permit",
  level: "city",
  why: "Many cities license businesses.",
  agency: "City clerk",
  links: [],
  prepare: [],
  feeCents: null,
  feeCheckedAt: null,
  deadline: null,
  needsProfessional: false,
  verification: "sourced",
  uncertainty: [],
  whoToCall: "",
  whatToAsk: [],
  doneWhen: "",
  prerequisites: [],
  requirementStatus: "verified",
  status: "todo",
};

describe("startupPlanBlocks", () => {
  it("numbers the steps that apply, then lists rules waiting on the owner's answers apart, never as steps", () => {
    const blocks = startupPlanBlocks({
      steps: [step],
      maybe: [{ title: "Sales tax permit", why: "Texas requires it for taxable sales.", conditions: ["Only if you sell anything Texas taxes."] }],
    });
    expect(blocks.map((block) => block.heading)).toEqual(["1. Business license", "Waiting on your answers", "Sales tax permit"]);
    expect(blocks[2].paragraphs).toEqual(["Texas requires it for taxable sales.", "Depends on: Only if you sell anything Texas taxes."]);
  });

  it("leaves the part out when everything is settled", () => {
    expect(startupPlanBlocks({ steps: [step] }).map((block) => block.heading)).toEqual(["1. Business license"]);
  });
});
