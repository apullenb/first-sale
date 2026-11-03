import { describe, expect, it } from "vitest";
import { filingReadiness } from "./readiness";

const form = { pdfUrl: "https://example.gov/form.pdf", onlineUrl: null, selfDownload: null, submit: [{ kind: "mail" as const, how: "Mail it." }], fee: null };

describe("filingReadiness", () => {
  it("isn't ready from related pages alone, even with nothing to finish first", () => {
    expect(filingReadiness({ form: null, links: [{ confirms: false }], feeCents: null })).toEqual({ verified: false, missing: ["application", "route"], feeKnown: false });
  });

  it("still needs a way to submit when a page confirms the step", () => {
    expect(filingReadiness({ form: null, links: [{ confirms: true }], feeCents: 2300 })).toEqual({ verified: false, missing: ["route"], feeKnown: true });
  });

  it("is ready with an official form and a way to submit, and flags an unknown fee instead of blocking", () => {
    expect(filingReadiness({ form, links: [], feeCents: null })).toEqual({ verified: true, missing: [], feeKnown: false });
    expect(filingReadiness({ form: { ...form, submit: [], onlineUrl: "https://example.gov/apply" }, links: [], feeCents: 0 })).toMatchObject({ verified: true, feeKnown: true });
  });
});
