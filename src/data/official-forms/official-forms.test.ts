import { describe, expect, it } from "vitest";
import type { BusinessStructure } from "@/lib/domain";
import { autofillContext } from "@/lib/documents/autofill";
import { formsFor } from "@/lib/documents/form-catalog";
import { governmentFor } from "@/lib/research/official-sites";
import { testProfile } from "@/test/fixtures";
import { amountInWords } from "@/lib/research/verify";
import { TEXAS_PAGES } from "@/test/texas-pages";
import { OFFICIAL_FORMS } from "./index";

const facts = (form: (typeof OFFICIAL_FORMS)[number]) =>
  [form.fee, form.renewal, form.deadline, form.signature, ...form.before, ...form.afterward, ...form.submit.flatMap((method) => (method.timing ? [method.timing] : []))].filter(
    (fact) => fact !== null,
  );

describe("official forms catalog", () => {
  it("uses each key once", () => {
    const keys = OFFICIAL_FORMS.map((form) => form.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(OFFICIAL_FORMS.map((form) => [form.key, form] as const))("%s links only to its agency's official .gov sites", (_key, form) => {
    if (form.pdfUrl) expect(governmentFor(form.pdfUrl)?.domain).toBe(form.domain);
    expect(governmentFor(form.pageUrl)).not.toBeNull();
    for (const fact of facts(form)) expect(governmentFor(fact.sourceUrl), fact.sourceUrl).not.toBeNull();
    for (const url of [form.onlineUrl, form.selfDownload?.url, ...(form.handChecked ?? [])].filter((each) => each !== null && each !== undefined)) {
      expect(governmentFor(url), url).not.toBeNull();
    }
  });

  it.each(OFFICIAL_FORMS.map((form) => [form.key, form] as const))("%s states each fee in its own quote", (_key, form) => {
    for (const fee of [form.fee, form.renewal]) {
      if (!fee?.cents) continue;
      const dollars = fee.cents / 100;
      expect(fee.quote.includes(`$${dollars}`) || fee.quote.includes(`${amountInWords(dollars)} dollars`), fee.quote).toBe(true);
    }
  });

  // Texas quotes must still match the page text the research tests read
  it("quotes the Texas pages word for word", () => {
    for (const form of OFFICIAL_FORMS.filter((each) => each.state === "TX")) {
      for (const fact of facts(form).filter((each) => !each.byHand)) {
        const page = TEXAS_PAGES[fact.sourceUrl];
        expect(page, fact.sourceUrl).toBeDefined();
        expect(page.join("\n").replace(/\s+/g, " "), fact.quote).toContain(fact.quote.replace(/\s+/g, " "));
      }
    }
  });

  // Every rule runs against a full set of details; a sensitive blank must still come back empty
  it("never fills ID numbers or signatures by rule", () => {
    const ctx = autofillContext(testProfile({ name: "Rise Bakery", owners: { count: 1 } }), [
      { key: "structure_choice", value: "sole_proprietorship" },
      { key: "owner_names", value: "Dana Ruiz" },
      { key: "principal_address", value: "12 Elm St\nAustin, TX 78701" },
      { key: "business_purpose", value: "Cookies" },
      { key: "start_date", value: "11/01/2026" },
      { key: "business_phone", value: "512-555-0100" },
      { key: "registered_agent", value: "Dana Ruiz, 12 Elm St, Austin, TX 78701" },
    ]);
    for (const form of OFFICIAL_FORMS) {
      for (const rule of [...form.fields, ...(form.guide ?? [])].filter((each) => /\bssn\b|social security|\bitin\b|\bein\b|signature|signed/i.test(each.label))) {
        expect("value" in rule.answer(ctx), `${form.key} ${rule.fieldId}`).toBe(false);
      }
    }
  });
});

describe("formsFor", () => {
  const name = (level: "state" | "county", forStructures: BusinessStructure[] = []) => ({ topic: "name_registration" as const, key: "assumed-name", title: "File an assumed name certificate", level, forStructures });
  const keys = (step: ReturnType<typeof name>, county: string | null, structure: BusinessStructure | null = null) =>
    formsFor(OFFICIAL_FORMS, step, { state: "TX", county }, structure).map((form) => form.key);

  it("offers the Travis County form only in Travis County, however the county is written", () => {
    expect(keys(name("county"), "Travis")).toEqual(["tx-travis-assumed-name"]);
    expect(keys(name("county"), " travis county ")).toEqual(["tx-travis-assumed-name"]);
    expect(keys(name("county"), "Williamson")).toEqual([]);
    expect(keys(name("county"), null)).toEqual([]);
  });

  it("offers only the forms for the owner's structure, or for the step's", () => {
    expect(keys(name("state"), "Travis", "llc")).toEqual(["tx-assumed-name-503"]);
    expect(keys(name("state"), "Travis", "sole_proprietorship")).toEqual([]);
    expect(keys(name("county"), "Travis", "llc")).toEqual([]);
    // Structure undecided: a step for sole proprietors and partnerships gets no LLC form
    expect(keys(name("state", ["sole_proprietorship", "partnership"]), "Travis")).toEqual([]);
    expect(keys(name("state"), "Travis")).toEqual(["tx-assumed-name-503"]);
  });
});
