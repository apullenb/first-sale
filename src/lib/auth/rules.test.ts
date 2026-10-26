import { describe, expect, it } from "vitest";
import { authErrorMessage, isValidEmail } from "./rules";

describe("isValidEmail", () => {
  it.each(["owner@example.com", "  owner@example.com  ", "first.last+shop@mail.example.org"])("accepts %j", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(["", "owner", "owner@", "owner@example", "own er@example.com"])("rejects %j", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("explains known errors in plain words", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toMatch(/don’t match/);
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toMatch(/already exists/);
  });

  it("asks people to wait when rate limited", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Wait a moment/);
  });

  it("never shows unknown server text", () => {
    expect(authErrorMessage({ code: "SOMETHING_INTERNAL" })).toBe("Something went wrong. Try again.");
    expect(authErrorMessage(null)).toBe("Something went wrong. Try again.");
  });
});
