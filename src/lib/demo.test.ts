import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCanWrite, DemoReadOnlyError, demoOwnerEmail, isDemoToken } from "./demo";
import { OwnerFacingError } from "./errors";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("demo settings", () => {
  it("is off without DEMO_OWNER_EMAIL", () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", "");
    expect(demoOwnerEmail()).toBeNull();
    vi.stubEnv("DEMO_OWNER_EMAIL", "  ");
    expect(demoOwnerEmail()).toBeNull();
  });

  it("matches the email the way accounts store it", () => {
    vi.stubEnv("DEMO_OWNER_EMAIL", " Demo@Example.COM ");
    expect(demoOwnerEmail()).toBe("demo@example.com");
  });

  it("knows demo tokens only by the prefix /demo adds", () => {
    expect(isDemoToken("demo_abc")).toBe(true);
    expect(isDemoToken("AbC123demo_")).toBe(false);
    expect(isDemoToken(undefined)).toBe(false);
  });
});

describe("assertCanWrite", () => {
  it("refuses a demo session with a note the owner sees as is", () => {
    expect(() => assertCanWrite({ demo: true })).toThrow(DemoReadOnlyError);
    expect(() => assertCanWrite({ demo: true })).toThrow(OwnerFacingError);
    expect(() => assertCanWrite({ demo: true })).toThrow(/This is the demo, so changes aren’t saved/);
  });

  it("lets every other session write", () => {
    expect(() => assertCanWrite({ demo: false })).not.toThrow();
  });
});
