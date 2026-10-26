import { describe, expect, it } from "vitest";
import { isAllowedHost } from "./source-pack";
import { verifyCitations } from "./verify";

const retrieved = [
  { id: "irs-ein", url: "https://www.irs.gov/ein", retrievedAt: "2026-10-26T00:00:00Z" },
  { id: "blog", url: "https://example-blog.com/llc-tips", retrievedAt: "2026-10-26T00:00:00Z" },
];
const allowedHosts = ["irs.gov", "sba.gov"];

describe("verifyCitations", () => {
  it("marks claims with retrieved, allowlisted sources as sourced", () => {
    const [claim] = verifyCitations([{ title: "Get an EIN", sourceIds: ["irs-ein"] }], retrieved, allowedHosts);
    expect(claim).toMatchObject({ title: "Get an EIN", verification: "sourced", problems: [] });
  });

  it("flags claims with no sources", () => {
    const [claim] = verifyCitations([{ sourceIds: [] }], retrieved, allowedHosts);
    expect(claim).toMatchObject({ verification: "needs_verification", problems: ["No source cited"] });
  });

  it("flags sources that were never retrieved", () => {
    const [claim] = verifyCitations([{ sourceIds: ["irs-ein", "made-up"] }], retrieved, allowedHosts);
    expect(claim.verification).toBe("needs_verification");
    expect(claim.problems).toEqual(['Cited source "made-up" was not retrieved']);
  });

  it("flags sources outside the official allowlist", () => {
    const [claim] = verifyCitations([{ sourceIds: ["blog"] }], retrieved, allowedHosts);
    expect(claim.verification).toBe("needs_verification");
  });
});

describe("isAllowedHost", () => {
  it("matches the host and its subdomains over https", () => {
    expect(isAllowedHost("https://www.irs.gov/x", allowedHosts)).toBe(true);
    expect(isAllowedHost("https://irs.gov/x", allowedHosts)).toBe(true);
  });

  it("rejects look-alike hosts, http, and bad URLs", () => {
    expect(isAllowedHost("https://notirs.gov/x", allowedHosts)).toBe(false);
    expect(isAllowedHost("https://irs.gov.example.com/x", allowedHosts)).toBe(false);
    expect(isAllowedHost("http://www.irs.gov/x", allowedHosts)).toBe(false);
    expect(isAllowedHost("not a url", allowedHosts)).toBe(false);
  });
});
