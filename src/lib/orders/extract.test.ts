import { describe, expect, it } from "vitest";
import { checkExtraction, extractionSchema, extractRequest } from "./extract";
import { getModel } from "@/lib/ai";

const empty = { value: "", excerpt: "" };
const raw = () =>
  extractionSchema.parse({
    category: "order",
    customerName: empty,
    customerEmail: empty,
    title: empty,
    date: empty,
    time: empty,
    location: empty,
    total: empty,
    reference: empty,
    items: [],
    missing: [],
  });
it("drops fabricated fields, quantities and dates while keeping exact source evidence", () => {
  const input = raw();
  input.customerName = { value: "Jo", excerpt: "Customer: Jo" };
  input.total = { value: "$100.00", excerpt: "Total: $100.00" };
  input.date = { value: "2026-11-07", excerpt: "next Saturday" };
  input.items = [{ name: "Candle", quantity: 3, excerpt: "2 Candle" }];
  const result = checkExtraction(
    input,
    "Customer: Jo\nTotal: $100.00\nnext Saturday\n2 Candle",
  );
  expect(result).toMatchObject({
    customerName: "Jo",
    totalCents: 10000,
    requestedDate: "",
    items: [],
  });
  expect(result.evidence.customerName).toBe("Customer: Jo");
  expect(result.warnings.join(" ")).toContain("unverified");
});
describe("offline intake", () => {
  it("extracts labeled facts without inventing a payment", async () => {
    const result = await extractRequest(
      getModel(),
      "Order\nCustomer: Sam\nDescription: Two cakes\nDate: 2026-11-07\nTotal: $80.00\nPAID",
      "Rise Bakery",
    );
    expect(result).toMatchObject({
      category: "order",
      customerName: "Sam",
      title: "Two cakes",
      requestedDate: "2026-11-07",
      totalCents: 8000,
    });
    expect(result.warnings.join(" ")).toContain("Record payments separately");
  });
});
