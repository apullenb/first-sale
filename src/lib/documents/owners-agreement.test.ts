import { describe, expect, it } from "vitest";
import type { DetailKey } from "@/lib/details";
import type { BusinessProfile } from "@/lib/domain";
import { governmentFor } from "@/lib/research/official-sites";
import { structureOf } from "@/lib/research/applicability";
import { testProfile } from "@/test/fixtures";
import { autofillFacts, outdatedFacts } from "./autofill";
import {
  agreementPdf,
  agreementReadiness,
  agreementReasons,
  agreementStepKey,
  buildAgreement,
  checkChoices,
  type ChoicesInput,
  choicesToInputs,
  inputsToChoices,
} from "./owners-agreement";
import { pdfText } from "./pdf";
import { writePdf } from "./pdf-writer";

type Details = { key: DetailKey; value: string }[];

const austin = (overrides: Parameters<typeof testProfile>[0] = {}) => testProfile({ name: "Rise Bakery LLC", location: { state: "TX", county: "Travis", city: "Austin" }, ...overrides });

const llcDetails = (extra: Details = []): Details => [
  { key: "structure_choice", value: "llc" },
  { key: "owner_names", value: "Dana Ruiz" },
  { key: "management", value: "member_managed" },
  { key: "principal_address", value: "12 Elm St\nAustin, TX 78701" },
  ...extra,
];

function readiness(profile: BusinessProfile, details: Details) {
  return agreementReadiness(profile, new Map(autofillFacts(profile, details).map((fact) => [fact.id, fact])), structureOf(profile, details).structure);
}

function ready(profile: BusinessProfile, details: Details) {
  const result = readiness(profile, details);
  if (result.kind !== "ready") throw new Error(`not ready: ${JSON.stringify(result)}`);
  return result;
}

function built(profile: BusinessProfile, details: Details, input: ChoicesInput) {
  const { basis } = ready(profile, details);
  const checked = checkChoices(basis, input);
  if (!checked.ok) throw new Error(checked.message);
  return buildAgreement(basis, checked.choices);
}

const text = (agreement: ReturnType<typeof buildAgreement>) => agreement.sections.map((section) => `${section.heading}: ${section.body}`).join("\n");
const solo: ChoicesInput = { owners: ["Dana Ruiz"], members: [{ percent: "", contribution: "$2,000 cash." }], decisions: null, manager: "", basedOn: "" };
const pair = (decisions: ChoicesInput["decisions"], percents = ["60", "40"]): ChoicesInput => ({
  owners: ["Dana Ruiz", "Sam Ruiz"],
  members: percents.map((percent, index) => ({ percent, contribution: index === 0 ? "$3,000 cash" : "" })),
  decisions,
  manager: "",
  basedOn: "",
});

describe("agreementReadiness", () => {
  it("is only for an LLC or a partnership, once the structure is recorded", () => {
    expect(readiness(austin(), [])).toMatchObject({ kind: "none", why: expect.stringContaining("Record your business structure") });
    expect(readiness(austin(), [{ key: "structure_choice", value: "sole_proprietorship" }])).toMatchObject({ kind: "none" });
    expect(readiness(austin(), [{ key: "structure_choice", value: "corporation" }])).toMatchObject({ kind: "none", why: expect.stringContaining("bylaws") });
  });

  it("lists what's missing: owner names that match the owner count, and who runs an LLC", () => {
    const result = readiness(austin({ owners: { count: 2 } }), [
      { key: "structure_choice", value: "llc" },
      { key: "owner_names", value: "Dana Ruiz" },
    ]);
    expect(result).toEqual({
      kind: "missing",
      structure: "llc",
      missing: ["Owners’ names: your business details list 1, but your answers say 2 owners.", "Who runs the LLC, in your business details."],
    });
    expect(readiness(austin(), [{ key: "structure_choice", value: "partnership" }, { key: "owner_names", value: "Dana Ruiz" }])).toMatchObject({
      kind: "missing",
      missing: expect.arrayContaining(["A partnership has at least two owners. Your answers say 1."]),
    });
  });

  it("records every fact it rests on, so a change later flags the agreement", () => {
    const profile = austin();
    const { used } = ready(profile, llcDetails());
    expect(used).toMatchObject({ "profile.name": "Rise Bakery LLC", "detail.owner_names": "Dana Ruiz", "detail.business_purpose": "" });

    expect(outdatedFacts(used, autofillFacts(profile, llcDetails([{ key: "business_purpose", value: "Sourdough bread" }]))).map((fact) => fact.id)).toEqual([
      "detail.business_purpose",
    ]);
    expect(outdatedFacts(used, autofillFacts(profile, llcDetails([{ key: "management", value: "manager_managed" }]))).map((fact) => fact.id)).toEqual(["detail.management"]);
  });
});

describe("checkChoices", () => {
  const { basis } = ready(austin({ owners: { count: 2 } }), [
    { key: "structure_choice", value: "partnership" },
    { key: "owner_names", value: "Dana Ruiz, Sam Ruiz" },
  ]);

  it("needs shares that add up to exactly 100%", () => {
    expect(checkChoices(basis, pair("majority", ["60", "30"]))).toEqual({ ok: false, message: "The owners’ shares add up to 90%. They need to add up to 100%." });
    expect(checkChoices(basis, pair("majority", ["sixty", "40"]))).toMatchObject({ ok: false, message: expect.stringContaining("Dana Ruiz") });
    expect(checkChoices(basis, pair("majority", ["33.33", "66.67"]))).toMatchObject({ ok: true });
    expect(checkChoices(basis, pair("majority", ["50 %", "50"]))).toMatchObject({ ok: true });
    expect(checkChoices(basis, pair("majority", ["0", "100"]))).toEqual({ ok: false, message: "Dana Ruiz’s share needs to be more than 0%." });
  });

  it("refuses shares sent for owners who have since changed", () => {
    expect(checkChoices(basis, { ...pair("majority"), owners: ["Sam Ruiz", "Dana Ruiz"] })).toEqual({ ok: false, message: "Your owners changed. Reload the page and try again." });
  });

  it("won't make a PDF that would print letters as question marks", () => {
    const named = ready(austin({ owners: { count: 2 } }), [
      { key: "structure_choice", value: "partnership" },
      { key: "owner_names", value: "Nguyễn Văn An, José Peña" },
    ]).basis;
    const result = checkChoices(named, { ...pair("everyone"), owners: ["Nguyễn Văn An", "José Peña"] });
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("can’t print ễ ă yet") });
  });

  it("asks how owners decide, and refuses ID numbers", () => {
    expect(checkChoices(basis, pair(null))).toEqual({ ok: false, message: "Choose how the owners make decisions." });
    const withId = pair("everyone");
    withId.members[1].contribution = "SSN 123-45-6789";
    expect(checkChoices(basis, withId)).toMatchObject({ ok: false, message: expect.stringContaining("Social Security") });
  });

  it("needs the manager's name for a manager-managed LLC", () => {
    const managed = ready(austin(), llcDetails([{ key: "management", value: "manager_managed" }])).basis;
    expect(checkChoices(managed, solo)).toEqual({ ok: false, message: "Enter the name of the person who manages the LLC." });
    expect(checkChoices(managed, { ...solo, manager: "Lee Park" })).toMatchObject({ ok: true, choices: { manager: "Lee Park" } });
  });
});

describe("buildAgreement", () => {
  it("writes a Texas company agreement for a one-member LLC from the owner's own details", () => {
    const agreement = built(austin(), llcDetails([{ key: "business_purpose", value: "Selling sourdough bread at markets" }]), solo);
    const body = text(agreement);

    expect(agreement.title).toBe("Company Agreement of Rise Bakery LLC");
    expect(agreement.sections.map((section) => section.key)).toEqual(["company", "members", "management", "money", "debts", "taxes", "records", "changes"]);
    expect(body).toContain("Rise Bakery LLC (the “Company”) is a Texas limited liability company");
    expect(body).toContain("Its main business is: Selling sourdough bread at markets.");
    expect(body).toContain("Its principal office is at 12 Elm St, Austin, TX 78701.");
    expect(body).toContain("Dana Ruiz is the Company’s only member and owns 100% of it. Dana Ruiz’s starting contribution: $2,000 cash.");
    expect(body).toContain("The member can act and sign for the Company, including opening and using its bank accounts.");
    expect(body).toContain("total debts would be more than the fair value of everything it owns");
    expect(body).toContain("tax returns for the last six years");
    expect(agreement.signers).toEqual(["Dana Ruiz"]);
  });

  it("names the manager of a manager-managed LLC", () => {
    const body = text(built(austin(), llcDetails([{ key: "management", value: "manager_managed" }]), { ...solo, manager: "Lee Park" }));
    expect(body).toContain("The Company is managed by a manager, Lee Park.");
    expect(body).toContain("doesn’t make any member or the manager personally responsible");
  });

  it("writes a partnership agreement with shares, the decision rule, and partners' own liability", () => {
    const profile = testProfile({ name: "Ruiz Woodworks", owners: { count: 2 } });
    const details: Details = [
      { key: "structure_choice", value: "partnership" },
      { key: "owner_names", value: "Dana Ruiz, Sam Ruiz" },
    ];
    const agreement = built(profile, details, pair("everyone"));
    const body = text(agreement);

    expect(agreement.title).toBe("Partnership Agreement of Ruiz Woodworks");
    expect(body).toContain("Ohio law governs it");
    expect(body).not.toContain("Texas");
    expect(body).toContain("A decision passes only when every partner agrees.");
    expect(body).toContain("Each partner can be personally responsible for the Partnership’s debts.");
    expect(body).not.toContain("fair value");
    expect(agreement.schedule.map((member) => [member.name, member.basisPoints])).toEqual([
      ["Dana Ruiz", 6000],
      ["Sam Ruiz", 4000],
    ]);
  });

  it("counts votes by ownership when owners holding more than half decide", () => {
    const profile = austin({ owners: { count: 2 } });
    const body = text(built(profile, llcDetails([{ key: "owner_names", value: "Dana Ruiz, Sam Ruiz" }]), pair("majority")));
    expect(body).toContain("Each member’s vote counts in proportion to what they own");
    expect(body).toContain("These always need every member’s written agreement: adding a new member;");
  });

  it("builds the same agreement again from the saved answers, so approving prints what the owner read", () => {
    const profile = austin({ owners: { count: 2 } });
    const details = llcDetails([{ key: "owner_names", value: "Dana Ruiz, Sam Ruiz" }]);
    const { basis } = ready(profile, details);
    const first = checkChoices(basis, pair("majority", ["66.67", "33.33"]));
    if (!first.ok) throw new Error(first.message);
    const saved = choicesToInputs(first.choices, "2026-10-28T12:00:00.000Z");
    expect(inputsToChoices(saved, ["Dana Ruiz", "Sam Ruiz"]).members[0].percent).toBe("66.67");
    const again = checkChoices(basis, inputsToChoices(saved, ["Dana Ruiz", "Sam Ruiz"]));
    if (!again.ok) throw new Error(again.message);
    expect(buildAgreement(basis, again.choices)).toEqual(buildAgreement(basis, first.choices));
  });

  it("keeps a one-owner contribution the same when it's checked again at approval", () => {
    const { basis } = ready(austin(), llcDetails());
    const first = checkChoices(basis, { ...solo, members: [{ percent: "", contribution: "$500 cash ." }] });
    if (!first.ok) throw new Error(first.message);
    const again = checkChoices(basis, inputsToChoices(choicesToInputs(first.choices, "2026-10-28T12:00:00.000Z"), ["Dana Ruiz"]));
    if (!again.ok) throw new Error(again.message);
    expect(buildAgreement(basis, again.choices).sections).toEqual(buildAgreement(basis, first.choices).sections);
    expect(text(buildAgreement(basis, first.choices))).toContain("starting contribution: $500 cash.");
  });

  it("prints a schedule of owners and a signature line for each", async () => {
    const profile = austin({ owners: { count: 2 } });
    const agreement = built(profile, llcDetails([{ key: "owner_names", value: "Dana Ruiz, Sam Ruiz" }]), pair("majority"));
    const printed = await pdfText(await writePdf(agreementPdf(agreement, "October 28, 2026", "October 28, 2026")), 100_000);
    expect(printed).toContain("Schedule A: Owners");
    expect(printed).toContain("Owns 60%");
    expect(printed).toContain("not legal advice");
    expect(printed.match(/Signature:/g)).toHaveLength(2);
  });
});

describe("agreementStepKey", () => {
  const steps = [
    { key: "structure", topic: "structure" as const, forStructures: [] },
    { key: "llc-formation", topic: "structure" as const, forStructures: ["llc" as const] },
    { key: "ein", topic: "tax_registration" as const, forStructures: [] },
  ];

  it("shows the agreement on the step that forms the business, or on the structure decision", () => {
    expect(agreementStepKey(steps, "llc")).toBe("llc-formation");
    expect(agreementStepKey(steps, "partnership")).toBe("structure");
    expect(agreementStepKey(steps.slice(2), "llc")).toBeNull();
  });
});

describe("agreementReasons", () => {
  it("cites only official .gov pages", () => {
    for (const reason of [...agreementReasons("llc", true), ...agreementReasons("partnership", true), ...agreementReasons("llc", false)]) {
      expect(governmentFor(reason.sourceUrl), reason.sourceUrl).not.toBeNull();
    }
  });
});
