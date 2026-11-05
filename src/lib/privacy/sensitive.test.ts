import { describe, expect, it } from "vitest";
import { describeCounts, findSensitive, luhn, redactSensitive, routingNumber } from "./sensitive";

const kinds = (text: string) => findSensitive(text).map((each) => each.kind);

describe("findSensitive", () => {
  it("finds Social Security numbers in their usual formats, and ITINs by their own ranges", () => {
    expect(kinds("SSN: 123-45-6789")).toEqual(["ssn"]);
    expect(kinds("Number 123 45 6789 on file")).toEqual(["ssn"]);
    expect(kinds("ITIN 912-70-1234")).toEqual(["itin"]);
    // Labeled, without dashes
    expect(kinds("Social Security No. 123456789")).toEqual(["ssn"]);
    expect(kinds("your TIN: 123456789")).toEqual(["ssn"]);
  });

  it("skips numbers the SSA never issues, so a printed placeholder isn't taken for one, even right after a label", () => {
    expect(kinds("000-12-3456 666-12-3456 123-00-4567 123-45-0000 900-12-3456")).toEqual([]);
    expect(kinds("Social Security number: 000-00-0000")).toEqual([]);
    expect(kinds("SSN\nExample: 000000000")).toEqual([]);
    expect(kinds("EIN: 071234567")).toEqual([]);
  });

  it("finds EINs by IRS prefix, formatted or labeled", () => {
    expect(kinds("EIN 12-3456789")).toEqual(["ein"]);
    expect(kinds("Employer Identification Number: 123456789")).toEqual(["ein"]);
    // 07 is a prefix the IRS never assigns
    expect(kinds("Case 07-1234567")).toEqual([]);
  });

  it("finds card numbers only when they pass Luhn and fall in an issuer's range", () => {
    expect(kinds("Card 4111 1111 1111 1111 exp 12/29")).toEqual(["card"]);
    expect(kinds("Amex 3782-822463-10005")).toEqual(["card"]);
    expect(kinds("Order 4111 1111 1111 1112")).toEqual([]);
    expect(kinds("Tracking 1234567890123456")).toEqual([]);
  });

  it("finds labeled bank and ID numbers, checking routing numbers with the ABA checksum", () => {
    expect(kinds("Routing number: 021000021")).toEqual(["routing"]);
    expect(kinds("Routing number: 021000022")).toEqual([]);
    expect(kinds("Account #: 000123456789")).toEqual(["account"]);
    expect(kinds("Driver's License No. TX 12345678")).toEqual(["id_document"]);
    expect(kinds("Passport: X12345678")).toEqual(["id_document"]);
  });

  it("leaves everyday numbers alone: phones, ZIP codes, dates, money, order and permit numbers", () => {
    const everyday = [
      "Call (512) 555-0123 or 512-555-0123.",
      "Austin, TX 78701-1234",
      "Filed 11/04/2026, fee $25.00, due 2026-12-01.",
      "Order 123456789 shipped.",
      "Permit 2026-001234",
      "Chapter 25-2 of the City Code, section 25-2-901.",
      "Texas taxpayer number 32012345678",
    ];
    for (const text of everyday) expect(kinds(text), text).toEqual([]);
  });
});

describe("redactSensitive", () => {
  it("replaces each number with a label that names it, counts them, and changes nothing on a second pass", () => {
    const { text, counts } = redactSensitive("Owner SSN 123-45-6789, EIN 12-3456789, card 4111111111111111.");
    expect(text).toBe("Owner SSN [Social Security number removed], EIN [tax ID number removed], card [card number removed].");
    expect(counts).toEqual({ ssn: 1, ein: 1, card: 1 });
    expect(redactSensitive(text)).toEqual({ text, counts: {} });
    expect(describeCounts(counts)).toBe("1 Social Security number, 1 tax ID number, and 1 card number");
  });

  it("keeps JSON valid", () => {
    const json = JSON.stringify({ note: "SSN 123-45-6789" });
    expect(JSON.parse(redactSensitive(json).text)).toEqual({ note: "SSN [Social Security number removed]" });
  });

  it("can be limited to some kinds", () => {
    expect(redactSensitive("SSN 123-45-6789, EIN 12-3456789", ["ssn"]).text).toBe("SSN [Social Security number removed], EIN 12-3456789");
  });
});

describe("checksums", () => {
  it("checks Luhn and ABA routing numbers", () => {
    expect(luhn("4111111111111111")).toBe(true);
    expect(luhn("4111111111111112")).toBe(false);
    expect(routingNumber("021000021")).toBe(true);
    expect(routingNumber("121000358")).toBe(true);
    expect(routingNumber("991000021")).toBe(false);
  });
});
