import { describe, expect, it } from "vitest";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { testProfile } from "@/test/fixtures";
import { budgetShare, demandTestOption, featureNeeds, packageShare } from "./budget";
import { costSummary } from "./costs";

describe("budget share", () => {
  it("gives a lower bound for a budget under $1,000", () => {
    expect(budgetShare(588, "under_1k")).toEqual({
      text: "At least 58% of your startup budget (Under $1,000). Your budget is a range, so this is the smallest share.",
      heavy: true,
    });
  });

  it("gives a range when the cost is below the bottom of the budget", () => {
    expect(budgetShare(588, "1k_5k")?.text).toBe("11% to 59% of your startup budget ($1,000–$5,000), depending on where in that range you are.");
    expect(budgetShare(588, "1k_5k")?.heavy).toBe(false);
  });

  it("says when a package takes the whole budget, or none of it", () => {
    expect(budgetShare(1200, "under_1k")?.text).toMatch(/^All of your startup budget/);
    expect(budgetShare(0, "under_1k")?.text).toMatch(/^None of your startup budget/);
    expect(budgetShare(588, "over_25k")?.text).toBe("At most 3% of your startup budget (Over $25,000).");
  });

  it("says nothing without a budget", () => {
    expect(budgetShare(588, null)).toBeNull();
    expect(budgetShare(588, "unsure")).toBeNull();
  });

  it("uses the package's own first-year total from code", () => {
    const square = PLATFORM_DATA.square;
    expect(packageShare(square, "under_1k")).toEqual(budgetShare(costSummary(square).firstYearUsd, "under_1k"));
  });
});

describe("testing demand", () => {
  it("finds a $0 plan that still takes payments, with its own facts", () => {
    const option = demandTestOption(PLATFORM_ORDER.map((id) => PLATFORM_DATA[id]));
    expect(option?.plan.monthlyUsd).toBe(0);
    expect(option?.plan.takesPayments).toBe(true);
    expect(option?.lines[0]).toContain(option!.plan.adds);
    expect(option?.lines.join(" ")).not.toMatch(/\$\d+(?:\.\d+)? a year/);
  });

  it("names which paid features matter for a tight budget", () => {
    const needs = featureNeeds(testProfile({ startupBudget: "under_1k", channels: ["markets", "own_website"], handoff: ["pickup_home", "local_delivery"] }));
    expect(needs.find((need) => need.feature === "Your own web address")?.need).toBe("later");
    expect(needs.find((need) => need.feature === "Taking card payments online")?.need).toBe("now");
    expect(needs.find((need) => need.feature.startsWith("Ordering for"))?.feature).toBe("Ordering for pickup and nearby delivery");
  });
});
