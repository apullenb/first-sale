import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import type { CompletionRequest, ModelProvider } from "@/lib/ai";
import { requirementDraft } from "@/test/fixtures";
import { checkClaims } from "./claims";
import type { VerifiedRequirement } from "./verify";

const sourced = (overrides: Partial<VerifiedRequirement> = {}): VerifiedRequirement => ({
  ...requirementDraft({ key: "ein", evidence: "You never have to pay a fee for an EIN.", feeUsd: 0 }),
  verification: "sourced",
  problems: [],
  confirmedBy: ["irs-ein"],
  ...overrides,
});

function judge(reply: string | Error) {
  const requests: CompletionRequest[] = [];
  const model: ModelProvider = {
    ...createMockProvider(),
    async complete(request) {
      requests.push(request);
      if (reply instanceof Error) throw reply;
      return { text: reply, finishReason: "stop", usage: null };
    },
  };
  return { model, requests };
}

describe("checkClaims", () => {
  it("makes a requirement its quote doesn't back one to confirm, without the fee that rested on the quote", async () => {
    const { model, requests } = judge(JSON.stringify({ unsupported: [{ key: "ein", reason: "The quote is about the fee, not who needs one." }] }));
    const other = sourced({ key: "sales-tax", evidence: "A permit is required to sell taxable items." });

    const { requirements, checked } = await checkClaims(model, [sourced(), other]);

    expect(checked).toBe(true);
    expect(requirements[0]).toMatchObject({
      verification: "needs_verification",
      claimsChecked: true,
      feeUsd: null,
      confirmedBy: [],
      problems: ["The quote doesn’t show this requirement: The quote is about the fee, not who needs one."],
    });
    expect(requirements[1]).toEqual({ ...other, claimsChecked: true });
    // One call judges every sourced claim, with its quote, as data
    expect(requests).toHaveLength(1);
    const sent = String(requests[0].messages[1].content);
    expect(sent).toContain("<claims>");
    expect(sent).toContain("You never have to pay a fee for an EIN.");
  });

  // Regression: a failed check used to leave quotes looking fully checked
  it("never blocks results: if the check fails, quotes stay but are marked as not read by it", async () => {
    const { model } = judge(new Error("service down"));
    const input = [sourced(), sourced({ key: "other", verification: "needs_verification" })];
    const { requirements, checked } = await checkClaims(model, input);
    expect(checked).toBe(false);
    expect(requirements).toEqual([{ ...input[0], claimsChecked: false }, input[1]]);
  });

  it("reads a few claims a call, in parallel, so one slow call leaves only its own claims unread", async () => {
    const requests: CompletionRequest[] = [];
    const base = createMockProvider();
    const model: ModelProvider = {
      ...base,
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) throw new Error("timed out");
        return { text: JSON.stringify({ unsupported: [] }), finishReason: "stop", usage: null };
      },
    };
    const input = Array.from({ length: 8 }, (_, index) => sourced({ key: `r${index}` }));
    const { requirements, checked } = await checkClaims(model, input);
    expect(requests).toHaveLength(2);
    expect(checked).toBe(false);
    expect(requirements.map((each) => each.claimsChecked)).toEqual([false, false, false, false, false, false, true, true]);
  });

  it("only judges requirements that code already found quoted on an official page", async () => {
    const { model, requests } = judge(JSON.stringify({ unsupported: [{ key: "ein", reason: "x" }] }));
    const unsourced = sourced({ verification: "needs_verification", problems: ["Quote not found on the cited pages"] });

    const { requirements } = await checkClaims(model, [unsourced]);
    expect(requests).toHaveLength(0);
    expect(requirements).toEqual([unsourced]);
  });

  it("finds nothing to change in practice mode", async () => {
    const input = [sourced()];
    const { requirements, checked } = await checkClaims(createMockProvider(), input);
    expect(checked).toBe(true);
    expect(requirements).toEqual([{ ...input[0], claimsChecked: true }]);
  });
});
