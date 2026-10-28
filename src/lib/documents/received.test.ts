import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { explainReceived, hideIdNumbers, sitesOn } from "./received";
import type { DocumentPage } from "./types";

const pages: DocumentPage[] = [
  {
    number: 1,
    text: [
      "Department of the Treasury, Internal Revenue Service",
      "WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER",
      "Your EIN is 12-3456789. Keep this notice in your permanent records.",
      "File Form 941 by April 30, 2027 if you have employees.",
      "Visit www.irs.gov/businesses or call us.",
    ].join("\n"),
  },
];

const steps = [
  { key: "llc-formation", title: "File a certificate of formation to form your LLC" },
  { key: "ein", title: "Employer Identification Number (EIN)" },
];

const reply = {
  whatItIs: "A letter from the IRS giving your business its EIN, 12-3456789.",
  whatItIsExcerpt: "WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER",
  from: "The Internal Revenue Service",
  meaning: "Your business now has a federal tax number. Keep the letter somewhere safe.",
  todo: [
    { text: "File Form 941 if you have employees.", deadline: "April 30, 2027", amount: "", excerpt: "File Form 941 by April 30, 2027 if you have employees." },
    { text: "Pay the filing fee.", deadline: "", amount: "$50", excerpt: "File Form 941 by April 30, 2027 if you have employees." },
    { text: "Send it in soon.", deadline: "May 1", amount: "", excerpt: "A quote the letter doesn't have" },
  ],
  stepKey: "ein",
  notGovernmentExcerpt: "",
};

const explain = (overrides: Partial<typeof reply> = {}) =>
  explainReceived(createMockProvider(() => JSON.stringify({ ...reply, ...overrides })), { pages, steps }, new Date("2026-10-28T12:00:00Z"));

describe("explainReceived", () => {
  it("keeps quotes found on the document and the step it belongs to", async () => {
    const guide = await explain();
    expect(guide.received?.whatItIsAnchor).toEqual({ page: 1, excerpt: "WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER", fieldId: null });
    expect(guide.received?.stepKey).toBe("ein");
    expect(guide.received?.todo[2].anchor).toBeNull();
    expect(guide).toMatchObject({ simulated: true, createdAt: "2026-10-28T12:00:00.000Z", gather: [], fieldHelp: [] });
  });

  it("keeps a deadline or amount only when it's in the quote, and flags the rest", async () => {
    const guide = await explain();
    expect(guide.received?.todo.map((entry) => [entry.deadline, entry.amount])).toEqual([
      ["April 30, 2027", null],
      [null, null],
      [null, null],
    ]);
    expect(guide.flags).toEqual(expect.arrayContaining(["Check “$50”: we couldn’t find it in the document’s own words.", "Check “May 1”: we couldn’t find it in the document’s own words."]));
  });

  it("doesn't take part of an amount or date for the whole", async () => {
    const bill = [{ number: 1, text: "Annual report notice\nPay $50.00 by May 15, 2027 to stay in good standing." }];
    const excerpt = "Pay $50.00 by May 15, 2027 to stay in good standing.";
    const guide = await explainReceived(
      createMockProvider(() =>
        JSON.stringify({
          ...reply,
          todo: [
            { text: "Pay it.", deadline: "May 1", amount: "$5", excerpt },
            { text: "Pay it.", deadline: "May 15, 2027", amount: "$50.00", excerpt },
          ],
        }),
      ),
      { pages: bill, steps },
    );
    expect(guide.received?.todo.map((entry) => [entry.deadline, entry.amount])).toEqual([
      [null, null],
      ["May 15, 2027", "$50.00"],
    ]);
  });

  it("leaves ID numbers out of the explanation", async () => {
    const guide = await explain({ todo: [{ text: "Write 12-3456789 on every return.", deadline: "", amount: "", excerpt: "Your EIN is 12-3456789. Keep this notice in your permanent records." }] });
    expect(guide.received?.whatItIs).toBe("A letter from the IRS giving your business its EIN, [number on the document].");
    expect(guide.received?.todo[0].text).toBe("Write [number on the document] on every return.");
    // Still checked against the real text, then shown without the number
    expect(guide.received?.todo[0].anchor).toEqual({ page: 1, excerpt: "Your EIN is [number on the document]. Keep this notice in your permanent records.", fieldId: null });
    expect(JSON.stringify(guide)).not.toContain("3456789");
  });

  it("drops a step that isn't in the plan", async () => {
    expect((await explain({ stepKey: "made-up" })).received?.stepKey).toBeNull();
  });

  it("keeps the document's own words saying it isn't from the government", async () => {
    const offer = [{ number: 1, text: "Annual Records Service\nThis company is not a government agency and is not affiliated with any government agency.\nFee: $125" }];
    const guide = await explainReceived(
      createMockProvider(() => JSON.stringify({ ...reply, stepKey: "", todo: [], notGovernmentExcerpt: "This company is not a government agency" })),
      { pages: offer, steps },
    );
    expect(guide.received?.notGovernment).toEqual({ page: 1, excerpt: "This company is not a government agency", fieldId: null });
  });

  it("names a common paper and its step in practice mode", async () => {
    const guide = await explainReceived(createMockProvider(), { pages, steps });
    expect(guide.received).toMatchObject({
      whatItIs: "This looks like a letter about an Employer Identification Number (EIN).",
      whatItIsAnchor: { page: 1, excerpt: "WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER" },
      stepKey: "ein",
      todo: [],
    });
    expect(guide.simulated).toBe(true);
  });
});

describe("sitesOn", () => {
  it("marks only sites in the official .gov registry as government", () => {
    const sites = sitesOn("Visit www.irs.gov/ein, or https://www.texas-filing-help.com/renew today. Also IRS.gov.");
    expect(sites.map((site) => site.host)).toEqual(["irs.gov", "texas-filing-help.com"]);
    expect(sites[0].government).toBeTruthy();
    expect(sites[1].government).toBeNull();
  });

  it("reads the whole host, so a .gov name at the start of another site isn't official", () => {
    expect(sitesOn("Pay at https://www.irs.gov.refund-center.io/pay or sos.texas.gov.claims.link")).toEqual([
      { host: "irs.gov.refund-center.io", government: null },
      { host: "sos.texas.gov.claims.link", government: null },
    ]);
  });

  it("lists addresses on any ending when they start with https:// or www.", () => {
    expect(sitesOn("Go to https://renew-now.example or www.filing.services").map((site) => site.host)).toEqual(["renew-now.example", "filing.services"]);
  });

  it("ignores words run together at the end of a sentence", () => {
    expect(sitesOn("Keep this notice in your records.Thank you. Form SS-4.Return it.")).toEqual([]);
  });
});

describe("hideIdNumbers", () => {
  it.each([
    ["an EIN", "EIN 12-3456789", "EIN [number on the document]"],
    ["a Social Security number", "SSN 123-45-6789", "SSN [number on the document]"],
    ["a long account number", "Account 32012345678", "Account [number on the document]"],
    ["an EIN run into its label", "EIN12-3456789", "EIN[number on the document]"],
    ["a number with spaced dashes", "SSN 123 - 45 - 6789", "SSN [number on the document]"],
    ["a card number", "Card 4111 1111 1111 1111", "Card [number on the document]"],
    ["an account number in groups", "Account 1234-5678-9012", "Account [number on the document]"],
  ])("hides %s", (_name, text, hidden) => {
    expect(hideIdNumbers(text)).toBe(hidden);
  });

  it("leaves dates, amounts, form numbers, phone numbers and ZIP codes alone", () => {
    const text = "File Form 941 by April 30, 2027 and pay $1,250.00. Call 800-829-4933 or (512) 854-9188. Austin, TX 78701-1234.";
    expect(hideIdNumbers(text)).toBe(text);
  });
});
