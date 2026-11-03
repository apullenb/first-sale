import { describe, expect, it } from "vitest";
import { testProfile } from "@/test/fixtures";
import {
  canTransition,
  orderAttention,
  paymentSummary,
  statusesFor,
  validPayment,
  workDefault,
} from "./order-tracking";

describe("business-specific work", () => {
  it("uses service, made-to-order and stocked workflows from saved facts", () => {
    expect(workDefault(testProfile({ offeringKinds: ["services"] }), [])).toBe(
      "services",
    );
    expect(workDefault(testProfile({ offeringKinds: ["handmade"] }), [])).toBe(
      "made_to_order",
    );
    expect(workDefault(testProfile({ offeringKinds: ["resale"] }), [])).toBe(
      "products",
    );
    expect(statusesFor("services", "pickup")).toEqual([
      "confirmed",
      "in_progress",
      "fulfilled",
    ]);
    expect(statusesFor("products", "shipping")).toEqual([
      "confirmed",
      "shipped",
      "fulfilled",
    ]);
  });
  it("never confirms imports or rewinds fulfillment by changing status", () => {
    expect(
      canTransition("needs_review", "confirmed", "products", "pickup"),
    ).toBe(false);
    expect(canTransition("fulfilled", "confirmed", "products", "pickup")).toBe(
      false,
    );
    expect(canTransition("confirmed", "shipped", "services", "shipping")).toBe(
      false,
    );
    expect(canTransition("confirmed", "fulfilled", "services", "pickup")).toBe(
      true,
    );
  });
  it("prioritizes review and overdue work without flagging completed work", () => {
    expect(
      orderAttention(
        { status: "needs_review", requestedDate: "2026-10-01" },
        "2026-11-03",
      ),
    ).toBe("review");
    expect(
      orderAttention(
        { status: "confirmed", requestedDate: "2026-10-01" },
        "2026-11-03",
      ),
    ).toBe("overdue");
    expect(
      orderAttention(
        { status: "fulfilled", requestedDate: "2026-10-01" },
        "2026-11-03",
      ),
    ).toBe("closed");
  });
});
describe("payment ledger", () => {
  it("handles deposits, balances and partial refunds independently of work status", () => {
    const entries = [
      { kind: "payment" as const, amountCents: 2500 },
      { kind: "payment" as const, amountCents: 7500 },
    ];
    expect(paymentSummary(10_000, entries)).toMatchObject({
      paid: 10_000,
      balance: 0,
      status: "Paid",
    });
    expect(
      paymentSummary(10_000, [
        ...entries,
        { kind: "refund", amountCents: 2000 },
      ]),
    ).toMatchObject({
      paid: 8000,
      balance: 2000,
      status: "Partially refunded",
    });
    expect(paymentSummary(null, [])).toMatchObject({
      balance: null,
      status: "Unpaid",
    });
    // Paid back in full after a refund, and nothing owed on a free order
    expect(
      paymentSummary(10_000, [
        ...entries,
        { kind: "refund", amountCents: 2000 },
        { kind: "payment", amountCents: 2000 },
      ]),
    ).toMatchObject({ balance: 0, status: "Paid" });
    expect(paymentSummary(0, [])).toMatchObject({
      balance: 0,
      status: "Nothing due",
    });
  });
  it("rejects overpayments, excess refunds, unknown totals and fractional cents", () => {
    const entries = [{ kind: "payment" as const, amountCents: 2500 }];
    expect(
      validPayment(5000, entries, { kind: "payment", amountCents: 3000 }),
    ).toBe(false);
    expect(
      validPayment(5000, entries, { kind: "refund", amountCents: 2501 }),
    ).toBe(false);
    expect(validPayment(null, [], { kind: "payment", amountCents: 1 })).toBe(
      false,
    );
    expect(validPayment(5000, [], { kind: "payment", amountCents: 0.5 })).toBe(
      false,
    );
    expect(
      validPayment(5000, entries, { kind: "refund", amountCents: 2500 }),
    ).toBe(true);
  });
});
