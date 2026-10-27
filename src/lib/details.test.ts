import { describe, expect, it } from "vitest";
import { DETAIL_KEYS, detailProblem, displayDetail, isDetailKey, looksLikeIdNumber } from "./details";

describe("looksLikeIdNumber", () => {
  it.each([
    ["an SSN", "123-45-6789"],
    ["an EIN", "12-3456789"],
    ["nine bare digits", "123456789"],
    ["an SSN inside other text", "My SSN is 123-45-6789."],
  ])("matches %s", (_name, text) => {
    expect(looksLikeIdNumber(text)).toBe(true);
  });

  it.each([
    ["a ZIP+4", "Columbus, OH 43215-1234"],
    ["a phone number", "614-555-0123"],
    ["a phone number with area code in parentheses", "(614) 555-0123"],
    ["a five-digit ZIP", "43215"],
    ["ten digits", "6145550123"],
    ["a street address", "1200 Main St, Suite 4"],
  ])("doesn't match %s", (_name, text) => {
    expect(looksLikeIdNumber(text)).toBe(false);
  });
});

describe("detailProblem", () => {
  it("asks for a value when it's empty or blank", () => {
    expect(detailProblem("business_email", "   ")).toBe("Enter business email.");
  });

  it("enforces each detail's length", () => {
    expect(detailProblem("business_phone", "1".repeat(10))).toBeNull();
    expect(detailProblem("business_phone", "x".repeat(41))).toBe("Keep it under 40 characters.");
  });

  it("only takes a listed option for choice details", () => {
    expect(detailProblem("structure_choice", "llc")).toBeNull();
    expect(detailProblem("structure_choice", " undecided ")).toBeNull();
    expect(detailProblem("structure_choice", "Limited liability company (LLC)")).toBe("Pick one of the options.");
    expect(detailProblem("management", "owners")).toBe("Pick one of the options.");
  });

  it("refuses ID numbers", () => {
    expect(detailProblem("owner_names", "Jo Baker 123-45-6789")).toMatch(/doesn’t store Social Security/);
  });

  it("accepts an address with a ZIP+4", () => {
    expect(detailProblem("principal_address", "1 Main St\nColumbus, OH 43215-1234")).toBeNull();
  });
});

describe("detail keys", () => {
  it("knows its own keys and nothing inherited", () => {
    expect(DETAIL_KEYS).toContain("principal_address");
    expect(isDetailKey("principal_address")).toBe(true);
    expect(isDetailKey("toString")).toBe(false);
    expect(isDetailKey("ssn")).toBe(false);
  });

  it("shows a choice by its label", () => {
    expect(displayDetail("structure_choice", "llc")).toBe("Limited liability company (LLC)");
    expect(displayDetail("business_email", "jo@example.test")).toBe("jo@example.test");
  });
});

describe("looksLikeIdNumber, other ways of writing them", () => {
  it.each(["123 45 6789", "123.45.6789", "123–45–6789", "12 3456789", "12.3456789"])("catches %s", (text) => {
    expect(looksLikeIdNumber(text)).toBe(true);
  });

  it.each(["614 555 0123", "43215-1234", "Suite 1200, 43215"])("leaves %s alone", (text) => {
    expect(looksLikeIdNumber(text)).toBe(false);
  });
});
