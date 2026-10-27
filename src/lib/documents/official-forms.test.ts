import { describe, expect, it, vi } from "vitest";
import { officialForm } from "@/data/official-forms";
import { testProfile } from "@/test/fixtures";
import { ss4LikeForm } from "@/test/pdf";
import { autofillContext, autofillFacts, outdatedFacts } from "./autofill";
import { answerGuide, officialOriginal, refreshedAnswers } from "./form-prep";
import { downloadOfficialForm } from "./official-forms";
import { fillPdfCopy } from "./fill";

const SS4 = officialForm("irs-ss4")!;
const P = "topmostSubform[0].Page1[0].";
const NOW = new Date("2026-10-27T15:00:00Z");
const AUSTIN = { state: "TX" as const, county: "Travis", city: "Austin", insideCityLimits: "yes" as const };

const pdfResponse = (bytes: Uint8Array) => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf" } });

// The sibling woodworkers: two owners in Austin, Texas, who chose a partnership
const siblings = testProfile({
  name: "Two Brothers Woodshop",
  owners: { count: 2 },
  offeringKinds: ["handmade"],
  firstItems: "Cutting boards",
  location: AUSTIN,
});
const details = [
  { key: "structure_choice" as const, value: "partnership" },
  { key: "owner_names" as const, value: "Sam Lee, Alex Lee" },
  { key: "principal_address" as const, value: "12 Elm St\nAustin, TX 78701" },
  { key: "business_purpose" as const, value: "Handmade wooden cutting boards and bowls" },
  { key: "start_date" as const, value: "November 1, 2026" },
];

describe("downloadOfficialForm", () => {
  it("downloads the form from the IRS, checks it's the exact revision, and keeps it unchanged", async () => {
    const bytes = await ss4LikeForm();
    const fetchImpl = vi.fn(async () => pdfResponse(bytes));
    const result = await downloadOfficialForm(SS4, fetchImpl, NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(fetchImpl).toHaveBeenCalledWith("https://www.irs.gov/pub/irs-pdf/fss4.pdf", expect.anything());
    expect(result.bytes).toEqual(bytes);
    expect(result.verification).toMatchObject({ ok: true, government: "Internal Revenue Service (Department of the Treasury)", formKey: "irs-ss4" });
    expect(result.verification.checks.every((check) => check.ok)).toBe(true);
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("flags a newer revision instead of filling it with rules made for another", async () => {
    const result = await downloadOfficialForm(SS4, vi.fn(async () => pdfResponse(await ss4LikeForm("Rev. March 2027"))), NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.verification.ok).toBe(false);
    expect(result.verification.checks.find((check) => !check.ok)?.label).toBe("The form says “(Rev. December 2025)”");
    const prepared = officialOriginal(SS4, result, autofillContext(siblings, details), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(prepared.answers).toEqual({});
  });

  it("refuses redirects off the official site and files that aren't PDFs", async () => {
    const redirect = vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://forms.example.com/ss4.pdf" } }));
    expect(await downloadOfficialForm(SS4, redirect, NOW)).toEqual({ ok: false, reason: "Redirected to a site that isn’t approved" });
    const page = vi.fn(async () => new Response("<html></html>", { headers: { "Content-Type": "text/html" } }));
    expect(await downloadOfficialForm(SS4, page, NOW)).toEqual({ ok: false, reason: "The link isn’t a PDF form" });
  });

  it("has no download for a form without a PDF", async () => {
    expect(await downloadOfficialForm({ ...officialForm("tx-sales-tax-permit")!, pdfUrl: null }, vi.fn(), NOW)).toMatchObject({ ok: false });
  });
});

describe("SS-4 autofill for the sibling woodworkers", () => {
  async function prepared() {
    const result = await downloadOfficialForm(SS4, vi.fn(async () => pdfResponse(await ss4LikeForm())), NOW);
    if (!result.ok) throw new Error(result.reason);
    return { result, doc: officialOriginal(SS4, result, autofillContext(siblings, details), { stepId: "s1", requestKey: "key-12345", now: NOW }) };
  }

  it("fills what their confirmed details answer, and leaves the rest for them", async () => {
    const { doc } = await prepared();
    const value = (name: string) => doc.answers[`${P}${name}`];
    expect(value("f1_2[0]")).toMatchObject({ value: "Two Brothers Woodshop", source: "profile.name", state: "suggested" });
    expect(value("f1_2[0]").note).toMatch(/partnership agreement/);
    expect(value("Line4ReadOrder[0].f1_5[0]")).toMatchObject({ value: "12 Elm St", source: "detail.principal_address" });
    expect(value("Line4ReadOrder[0].f1_6[0]")).toMatchObject({ value: "Austin, TX 78701" });
    expect(value("f1_9[0]")).toMatchObject({ value: "Travis County, Texas", source: "derived.county_state" });
    expect(value("c1_3[2]")).toMatchObject({ value: "Yes", source: "derived.structure" });
    expect(value("c1_3[0]")).toMatchObject({ value: "No" });
    expect(value("c1_1[1]")).toMatchObject({ value: "Yes" });
    expect(value("f1_31[0]")).toMatchObject({ value: "November 1, 2026" });
    expect(value("f1_38[0]")).toMatchObject({ value: "Handmade wooden cutting boards and bowls" });
    // Two owners: who's responsible is theirs to pick, and their SSN is never filled in
    expect(value("f1_10[0]")).toMatchObject({ value: "", state: "unanswered" });
    expect(value("f1_10[0]").note).toMatch(/Pick one owner/);
    expect(value("f1_11[0]")).toMatchObject({ value: "", state: "fill_yourself" });
    expect(value("f1_12[0]")).toMatchObject({ state: "unanswered", note: "Only for an LLC." });
    expect(doc.factsUsed).toMatchObject({ "profile.name": "Two Brothers Woodshop", "derived.county_state": "Travis County, Texas" });
    expect(doc.content.fields.find((field) => field.id === `${P}f1_9[0]`)?.label).toBe("Line 6: County and state where the business is");
  });

  it("asks for the decision first while the structure is undecided", async () => {
    const result = await downloadOfficialForm(SS4, vi.fn(async () => pdfResponse(await ss4LikeForm())), NOW);
    if (!result.ok) throw new Error(result.reason);
    const undecided = details.filter((detail) => detail.key !== "structure_choice");
    const doc = officialOriginal(SS4, result, autofillContext(siblings, undecided), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(doc.answers[`${P}f1_2[0]`]).toMatchObject({ state: "unanswered", note: expect.stringMatching(/Decide your business structure/) });
    expect(doc.answers[`${P}c1_3[2]`]).toMatchObject({ state: "unanswered" });
  });

  it("puts only confirmed answers into the reviewed copy, and the original stays as downloaded", async () => {
    const { result, doc } = await prepared();
    const answers = { ...doc.answers, [`${P}f1_9[0]`]: { ...doc.answers[`${P}f1_9[0]`], state: "confirmed" as const } };
    const filled = await fillPdfCopy(result.bytes, doc.content.fields, answers);
    if (!filled.ok) throw new Error(filled.reason);
    expect(filled.filled).toBe(1);
    expect(result.bytes).toEqual(doc.data);
  });

  it("flags the draft when a detail changes, and drafts that answer again from the new value", async () => {
    const { doc } = await prepared();
    const confirmed = { ...doc.answers, [`${P}f1_38[0]`]: { ...doc.answers[`${P}f1_38[0]`], state: "confirmed" as const } };
    const changed = [...details.filter((detail) => detail.key !== "business_purpose"), { key: "business_purpose" as const, value: "Wooden toys" }];
    const facts = autofillFacts(siblings, changed);
    const outdated = outdatedFacts(doc.factsUsed, facts);
    expect(outdated).toEqual([{ id: "detail.business_purpose", label: "What the business does, in one sentence", before: "Handmade wooden cutting boards and bowls", now: "Wooden toys" }]);
    const refreshed = refreshedAnswers({ ...doc, answers: confirmed }, SS4, outdated, autofillContext(siblings, changed), facts);
    expect(refreshed.answers[`${P}f1_38[0]`]).toMatchObject({ value: "Wooden toys", state: "suggested" });
    expect(refreshed.answers[`${P}f1_38[0]`].note).toMatch(/changed since this was drafted/);
    expect(refreshed.used["detail.business_purpose"]).toBe("Wooden toys");
    expect(outdatedFacts(refreshed.used, facts)).toEqual([]);
  });
});

describe("answerGuide", () => {
  it("prepares an online application's answers from the Comptroller's list, for the owner to review", () => {
    const baker = testProfile({ name: "Rise Bakery", owners: { count: 1 }, location: AUSTIN });
    const known = [
      { key: "structure_choice" as const, value: "sole_proprietorship" },
      { key: "owner_names" as const, value: "Dana Ruiz" },
    ];
    const guide = answerGuide(officialForm("tx-sales-tax-permit")!, autofillContext(baker, known), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(guide).toMatchObject({ role: "answer_guide", data: null, formKey: "tx-sales-tax-permit", sourceUrl: "https://comptroller.texas.gov/taxes/permit/" });
    expect(guide.content.readMethod).toBe("catalog");
    expect(guide.answers.legal_name).toMatchObject({ value: "Dana Ruiz", state: "suggested" });
    expect(guide.answers.dba).toMatchObject({ value: "Rise Bakery" });
    expect(guide.answers.county).toMatchObject({ value: "Travis County, Texas" });
    expect(guide.answers.location).toMatchObject({ state: "unanswered" });
    expect(guide.answers.tax_id).toMatchObject({ value: "", state: "fill_yourself" });
  });
});

describe("SS-4 answer guide for the online application", () => {
  it("keeps boxes as boxes, so the guide says to tick them instead of printing Yes or No", async () => {
    const guide = answerGuide(SS4, autofillContext(siblings, details), { stepId: "s1", requestKey: "key-12345", now: NOW });
    const box = guide.content.fields.find((field) => field.id === `${P}c1_3[2]`);
    expect(box).toMatchObject({ kind: "checkbox", label: "Line 9a: Type of entity: Partnership" });
    expect(guide.answers[`${P}c1_3[2]`]).toMatchObject({ value: "Yes", state: "suggested" });
    // Listed so the owner knows it's asked, but always theirs to enter
    expect(guide.answers[`${P}f1_11[0]`]).toMatchObject({ value: "", state: "fill_yourself" });
  });
});

describe("review fixes", () => {
  const solo = testProfile({ name: "Rise Bakery", owners: { count: 1 }, location: AUSTIN });
  const soloDetails = [
    { key: "structure_choice" as const, value: "sole_proprietorship" },
    { key: "owner_names" as const, value: "Jane Doe" },
    { key: "principal_address" as const, value: "123 Main St, Austin, TX 78701" },
  ];
  async function download(revision?: string) {
    const result = await downloadOfficialForm(SS4, vi.fn(async () => pdfResponse(await ss4LikeForm(revision))), NOW);
    if (!result.ok) throw new Error(result.reason);
    return result;
  }

  it("drafts again an answer the owner confirmed when the structure it depended on changes", async () => {
    const doc = officialOriginal(SS4, await download(), autofillContext(solo, soloDetails), { stepId: "s1", requestKey: "key-12345", now: NOW });
    const line1 = `${P}f1_2[0]`;
    expect(doc.answers[line1]).toMatchObject({ value: "Jane Doe", source: "detail.owner_names", alsoFrom: ["derived.structure", "profile.owner_count"] });
    const confirmed = { ...doc.answers, [line1]: { ...doc.answers[line1], state: "confirmed" as const } };

    const asLlc = [{ key: "structure_choice" as const, value: "llc" }, ...soloDetails.slice(1)];
    const facts = autofillFacts(solo, asLlc);
    const outdated = outdatedFacts(doc.factsUsed, facts);
    expect(outdated.map((each) => each.id)).toContain("derived.structure");
    const refreshed = refreshedAnswers({ ...doc, answers: confirmed }, SS4, outdated, autofillContext(solo, asLlc), facts);
    // An LLC's legal name isn't the owner's own name, so it's no longer filled, let alone confirmed
    expect(refreshed.answers[line1]).toMatchObject({ value: "", state: "unanswered" });
    expect(outdatedFacts(refreshed.used, facts)).toEqual([]);
  });

  it("flags a draft when an answer behind a blank it left changes", async () => {
    const ownName = testProfile({ ...solo, nameIsLegalName: "yes" });
    const doc = officialOriginal(SS4, await download(), autofillContext(ownName, soloDetails), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(doc.answers[`${P}f1_3[0]`]).toMatchObject({ value: "", state: "unanswered" });
    const changed = testProfile({ ...solo, nameIsLegalName: "no" });
    expect(outdatedFacts(doc.factsUsed, autofillFacts(changed, soloDetails)).map((each) => each.id)).toContain("derived.name_is_legal_name");
  });

  it("flags a draft when a fact it needed shows up later", async () => {
    const undecided = soloDetails.slice(1);
    const doc = officialOriginal(SS4, await download(), autofillContext(solo, undecided), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(outdatedFacts(doc.factsUsed, autofillFacts(solo, undecided))).toEqual([]);
    const outdated = outdatedFacts(doc.factsUsed, autofillFacts(solo, soloDetails));
    expect(outdated).toContainEqual(expect.objectContaining({ id: "derived.structure", before: "", now: "Sole proprietorship" }));
  });

  it("splits an address typed on one line into the street and city, state and ZIP", async () => {
    const doc = officialOriginal(SS4, await download(), autofillContext(solo, soloDetails), { stepId: "s1", requestKey: "key-12345", now: NOW });
    expect(doc.answers[`${P}Line4ReadOrder[0].f1_5[0]`]).toMatchObject({ value: "123 Main St" });
    expect(doc.answers[`${P}Line4ReadOrder[0].f1_6[0]`]).toMatchObject({ value: "Austin, TX 78701" });
    const vague = officialOriginal(SS4, await download(), autofillContext(solo, [...soloDetails.slice(0, 2), { key: "principal_address" as const, value: "Near the park" }]), {
      stepId: "s1",
      requestKey: "key-12345",
      now: NOW,
    });
    expect(vague.answers[`${P}Line4ReadOrder[0].f1_5[0]`]).toMatchObject({ value: "", state: "unanswered" });
  });

  it("keeps a form's own labels when it didn't pass every check", async () => {
    const doc = officialOriginal(SS4, await download("Rev. March 2027"), autofillContext(solo, soloDetails), { stepId: "s1", requestKey: "key-12345", now: NOW });
    const ssn = doc.content.fields.find((field) => field.id === `${P}f1_11[0]`);
    expect(ssn?.label).toMatch(/SSN, ITIN, or EIN/);
    expect(doc.content.fields.some((field) => field.label.startsWith("Line 1:"))).toBe(false);
  });
});
