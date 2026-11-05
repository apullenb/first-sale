import { describe, expect, it } from "vitest";
import type { RequirementDraft } from "@/lib/domain";
import { requirementDraft } from "@/test/fixtures";
import { isAllowedHost } from "./source-pack";
import { amountInWords, pageWithExcerpt, verifyCitations, verifyRequirements } from "./verify";

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

describe("verifyRequirements", () => {
  const pages = [
    {
      id: "irs-ein",
      url: "https://www.irs.gov/ein",
      retrievedAt: "2026-10-26T00:00:00Z",
      level: "federal" as const,
      text: "Use this tool to get an EIN directly from the IRS in minutes for free.\nYou never have to pay a fee for an EIN.",
    },
    {
      id: "sos",
      url: "https://www.sos.example.gov/llc",
      retrievedAt: "2026-10-26T00:00:00Z",
      level: "state" as const,
      text: "The filing fee for Articles of Organization is $99.\nFile your annual report within 30 days of the anniversary.",
    },
  ];
  const hosts = ["irs.gov", "sos.example.gov"];
  const draft = (overrides: Partial<RequirementDraft>): RequirementDraft => ({
    key: "ein",
    title: "Get an EIN",
    topic: "tax_registration",
    whyItApplies: "",
    level: "federal",
    agency: "Internal Revenue Service",
    sourceIds: ["irs-ein"],
    evidence: "Use this tool to get an EIN directly from the IRS in minutes for free.",
    feeUsd: null,
    deadline: null,
    needsProfessional: false,
    whoToCall: "the IRS",
    whatToAsk: [],
    gather: [],
    doneWhen: "",
    dependsOn: [],
    applicability: "applies",
    condition: "",
    timing: "before_selling",
    forStructures: [],
    renewal: null,
    renewalFeeUsd: null,
    ownerAction: null,
    ...overrides,
  });

  it("marks a requirement sourced when its quote is on a cited page", () => {
    const [result] = verifyRequirements([draft({ feeUsd: 0 })], pages, hosts);
    expect(result).toMatchObject({ verification: "sourced", problems: [], feeUsd: 0 });
  });

  describe("whole sentences quoted together", () => {
    const faq = [
      "Do I need a permit? As a seller, you must have a tax permit for each active place of business.",
      "Can I sell from home? Yes, if your home is your place of business.",
      "What does it cost? There is no fee for the permit, but you may be required to post a security bond.",
    ].join(" ");
    const page = () => ({ ...pages[1], text: faq });
    const quote = (evidence: string, extra: Partial<RequirementDraft> = {}) => verifyRequirements([draft({ ...sos, evidence, ...extra })], [page()], hosts)[0];

    it("accepts sentences that are each on the page word for word, near each other, and keeps a fee one of them states", () => {
      const result = quote("As a seller, you must have a tax permit for each active place of business. There is no fee for the permit, but you may be required to post a security bond.", { feeUsd: 0 });
      expect(result).toMatchObject({ verification: "sourced", feeUsd: 0, problems: [] });
    });

    it("rejects a sentence that isn't on the page, such as a fee from somewhere else", () => {
      const result = quote("As a seller, you must have a tax permit for each active place of business. Filing fee is $23.00 for business names.", { feeUsd: 23 });
      expect(result).toMatchObject({ verification: "needs_verification", feeUsd: null });
      expect(result.problems).toContain("Quote not found on the cited pages");
    });

    it("rejects sentences from far apart on the page, and too many, or too short to mean anything", () => {
      const far = { ...pages[1], text: `As a seller, you must have a tax permit for each active place of business. ${"Other text. ".repeat(250)}There is no fee for the permit, but you may be required to post a security bond.` };
      expect(verifyRequirements([draft({ ...sos, evidence: "As a seller, you must have a tax permit for each active place of business. There is no fee for the permit, but you may be required to post a security bond." })], [far], hosts)[0].verification).toBe("needs_verification");
      expect(quote("Yes. As a seller, you must have a tax permit for each active place of business.").verification).toBe("needs_verification");
    });
  });

  it("matches quotes despite case and spacing, and joins pieces around an ellipsis", () => {
    const [result] = verifyRequirements([draft({ evidence: "use this TOOL to get an EIN …  in minutes for free." })], pages, hosts);
    expect(result.verification).toBe("sourced");
  });

  it("treats curly and straight apostrophes as the same", () => {
    const page = { ...pages[0], text: "It’s free to apply for an EIN, and you should do it right after you register." };
    const [result] = verifyRequirements([draft({ evidence: "It's free to apply for an EIN" })], [page], hosts);
    expect(result.verification).toBe("sourced");
  });

  it("flags a quote that isn't on the cited page", () => {
    const [result] = verifyRequirements([draft({ evidence: "An EIN costs $50 and takes a week." })], pages, hosts);
    expect(result).toMatchObject({ verification: "needs_verification", problems: ["Quote not found on the cited pages"] });
  });

  it("flags a quote that's too short to prove anything", () => {
    const [result] = verifyRequirements([draft({ evidence: "for free." })], pages, hosts);
    expect(result.verification).toBe("needs_verification");
  });

  const sos = {
    level: "state" as const,
    sourceIds: ["sos"],
    evidence: "The filing fee for Articles of Organization is $99. File your annual report within 30 days of the anniversary.",
  };

  it("keeps fees and deadlines in the quote, and drops ones that aren't", () => {
    const [kept] = verifyRequirements([draft({ ...sos, feeUsd: 99, deadline: "within 30 days" })], pages, hosts);
    expect(kept).toMatchObject({ verification: "sourced", feeUsd: 99, deadline: "within 30 days" });

    const [dropped] = verifyRequirements([draft({ ...sos, feeUsd: 9, deadline: "within 60 days" })], pages, hosts);
    expect(dropped).toMatchObject({
      verification: "needs_verification",
      feeUsd: null,
      deadline: null,
      problems: ["Fee not found in the quote", "Deadline not found in the quote"],
    });
  });

  it("needs the fee inside the quote, not just somewhere on the page", () => {
    const [result] = verifyRequirements(
      [draft({ ...sos, evidence: "File your annual report within 30 days of the anniversary.", feeUsd: 99 })],
      pages,
      hosts,
    );
    expect(result).toMatchObject({ feeUsd: null, problems: ["Fee not found in the quote"] });
  });

  it("doesn't call it free because \"free\" appears elsewhere on the page", () => {
    const page = { ...pages[0], text: "Call our toll-free line.\nAn EIN application takes about 15 minutes online." };
    const [result] = verifyRequirements(
      [draft({ evidence: "An EIN application takes about 15 minutes online.", feeUsd: 0 })],
      [page],
      hosts,
    );
    expect(result).toMatchObject({ feeUsd: null, verification: "needs_verification" });
  });

  it("accepts a fee followed by a comma", () => {
    const page = { ...pages[1], text: "The fee is $50, payable online when you file." };
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence: "The fee is $50, payable online when you file.", feeUsd: 50 })],
      [page],
      hosts,
    );
    expect(result).toMatchObject({ feeUsd: 50, verification: "sourced" });
  });

  it.each([
    ["a word inside another word", "File your report now and keep a copy so you know what you sent.", "now"],
    ["part of a larger number", "Renew your permit within 130 days of the notice from the county.", "30 days"],
  ])("won't match a deadline that's %s", (_name, text, deadline) => {
    const page = { ...pages[1], text };
    const [result] = verifyRequirements([draft({ level: "state", sourceIds: ["sos"], evidence: text, deadline })], [page], hosts);
    expect(result.deadline).toBeNull();
  });

  it.each([
    ["$990", "The filing fee is $990 for each business.", "The filing fee is $99", 99, null],
    ["$5.50", "The filing fee is $5.50 per copy you order.", "The filing fee is $5", 5, null],
    ["$1,000", "The filing fee is $1,000 for corporations.", "The filing fee is $1", 1, null],
    ["130 days", "Renew within 130 days of opening the business.", "30 days of opening the business", null, "30 days"],
  ])("won't take a quote cut off partway through %s", (_name, text, evidence, feeUsd, deadline) => {
    const page = { ...pages[1], text };
    const [result] = verifyRequirements([draft({ level: "state", sourceIds: ["sos"], evidence, feeUsd, deadline })], [page], hosts);
    expect(result).toMatchObject({ verification: "needs_verification", feeUsd: null, deadline: null });
  });

  it("doesn't read \"toll-free\" in a quote as no fee", () => {
    const text = "Register with the state for a fee. See our toll-free number for help.";
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence: text, feeUsd: 0 })],
      [{ ...pages[1], text }],
      hosts,
    );
    expect(result.feeUsd).toBeNull();
  });

  it("won't take a fee from the text an ellipsis skips", () => {
    const text = "The filing fee for corporations is $990. Sole proprietors pay $50 when they register with the county clerk office.";
    const evidence = "The filing fee for corporations ... when they register with the county clerk office";
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence, feeUsd: 50 })],
      [{ ...pages[1], text }],
      hosts,
    );
    expect(result).toMatchObject({ feeUsd: null, verification: "needs_verification" });
  });

  it("doesn't read free help as a free filing", () => {
    const text = "SBA resource partners offer free business counseling to help you register your business.";
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence: text, feeUsd: 0 })],
      [{ ...pages[1], text }],
      hosts,
    );
    expect(result.feeUsd).toBeNull();
  });

  it("accepts a quote that starts or ends with an ellipsis", () => {
    const text = "Employers must file Form 941 within 30 days of the end of each quarter.";
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence: "...file Form 941 within 30 days of the end of each quarter...", deadline: "within 30 days" })],
      [{ ...pages[1], text }],
      hosts,
    );
    expect(result).toMatchObject({ verification: "sourced", deadline: "within 30 days" });
  });

  it("accepts a quote of a page that has its own ellipsis", () => {
    const text = "Bring two forms of ID... and your lease or deed to the county office.";
    const [result] = verifyRequirements([draft({ level: "state", sourceIds: ["sos"], evidence: text })], [{ ...pages[1], text }], hosts);
    expect(result.verification).toBe("sourced");
  });

  it("won't stitch far-apart or tiny pieces together with an ellipsis", () => {
    const page = {
      ...pages[0],
      text: `Most businesses need to register with their state government. ${"Other guidance. ".repeat(30)}You'll need a federal license if you sell alcohol.`,
    };
    const far = draft({ evidence: "Most businesses need to register with ... a federal license if you sell alcohol." });
    const tiny = draft({ evidence: "Most businesses need ... a federal license" });
    for (const result of verifyRequirements([far, tiny], [page], hosts)) {
      expect(result.problems).toContain("Quote not found on the cited pages");
    }
  });

  it("doesn't take $990 or $9.90 for a $99 fee", () => {
    const page = { ...pages[1], text: "Fees: $990 for corporations, $9.90 per copy." };
    const [result] = verifyRequirements(
      [draft({ level: "state", sourceIds: ["sos"], evidence: "Fees: $990 for corporations, $9.90 per copy.", feeUsd: 99 })],
      [page],
      hosts,
    );
    expect(result.feeUsd).toBeNull();
  });

  it("won't count federal guidance as a source for a state requirement", () => {
    const [result] = verifyRequirements([draft({ level: "state" })], pages, hosts);
    expect(result).toMatchObject({
      verification: "needs_verification",
      problems: ["Only federal pages were cited for a state requirement"],
    });
  });

  it("drops fees from requirements with no source, without inventing problems", () => {
    const [result] = verifyRequirements([draft({ sourceIds: [], evidence: null, feeUsd: 25, level: "city" })], pages, hosts);
    expect(result).toMatchObject({ verification: "needs_verification", feeUsd: null, problems: ["No source cited"] });
  });
});

describe("pageWithExcerpt", () => {
  const pages = [
    { number: 1, text: "Applicant information\nName of business:" },
    { number: 2, text: "Sign and date this form. It’s required for every applicant." },
  ];

  it("finds the page an excerpt is on, ignoring case, spacing and curly quotes", () => {
    expect(pageWithExcerpt(pages, "it's   REQUIRED for every applicant")).toBe(2);
    expect(pageWithExcerpt(pages, "...Name of business:")).toBe(1);
  });

  it("returns null for text that isn't on any page, or is too short to mean anything", () => {
    expect(pageWithExcerpt(pages, "Not on this form at all")).toBeNull();
    expect(pageWithExcerpt(pages, "Sign")).toBeNull();
  });
});

describe("verifyRequirements: the quote's government", () => {
  const pages = [
    { id: "irs", url: "https://www.irs.gov/ein", retrievedAt: "2026-10-26T00:00:00Z", level: "federal" as const, text: "You never have to pay a fee for an EIN." },
    { id: "ohio", url: "https://www.ohiosos.gov/llc", retrievedAt: "2026-10-26T00:00:00Z", level: "state" as const, text: "File your articles online with the Secretary of State." },
  ];
  const hosts = ["irs.gov", "ohiosos.gov"];
  const base: RequirementDraft = {
    key: "llc",
    title: "Form an LLC",
    topic: "structure",
    whyItApplies: "",
    level: "state",
    agency: "Ohio Secretary of State",
    sourceIds: ["irs", "ohio"],
    evidence: "You never have to pay a fee for an EIN.",
    feeUsd: null,
    deadline: null,
    needsProfessional: false,
    whoToCall: "",
    whatToAsk: [],
    gather: [],
    doneWhen: "",
    dependsOn: [],
    applicability: "applies",
    condition: "",
    timing: "before_selling",
    forStructures: [],
    renewal: null,
    renewalFeeUsd: null,
    ownerAction: null,
  };

  it("doesn't count a quote from another government's page", () => {
    const [result] = verifyRequirements([base], pages, hosts);
    expect(result.verification).toBe("needs_verification");
    expect(result.confirmedBy).toEqual([]);
  });

  it("names the page the quote was found on", () => {
    const [result] = verifyRequirements([{ ...base, evidence: "File your articles online with the Secretary of State." }], pages, hosts);
    expect(result).toMatchObject({ verification: "sourced", confirmedBy: ["ohio"] });
  });
});

describe("isAllowedHost ports", () => {
  it("refuses any port but the standard one", () => {
    expect(isAllowedHost("https://www.irs.gov/ein", ["irs.gov"])).toBe(true);
    expect(isAllowedHost("https://www.irs.gov:443/ein", ["irs.gov"])).toBe(true);
    expect(isAllowedHost("https://intranet.irs.gov:8443/", ["irs.gov"])).toBe(false);
  });
});

describe("verifyRequirements: amounts in words and renewals", () => {
  const pages = [
    {
      id: "orc",
      url: "https://codes.ohio.gov/ohio-revised-code/section-911.02",
      retrievedAt: "2026-10-27T00:00:00Z",
      level: "state" as const,
      text: "Any person who owns or operates a home bakery shall pay a sum of ten dollars annually for registration. The registration shall be renewed annually by the thirtieth day of September.\nThe fee is one hundred fifty dollars for a wholesale bakery.",
    },
  ];
  const draft = (overrides: Partial<RequirementDraft>) => ({
    ...requirementDraft({ key: "home-bakery", level: "state", sourceIds: ["orc"], evidence: "shall pay a sum of ten dollars annually for registration. The registration shall be renewed annually by the thirtieth day of September." }),
    ...overrides,
  });

  it("finds a fee written in words, as Ohio law writes them", () => {
    const [checked] = verifyRequirements([draft({ feeUsd: 10, renewal: "renewed annually by the thirtieth day of September", renewalFeeUsd: 10 })], pages, ["codes.ohio.gov"]);
    expect(checked).toMatchObject({ verification: "sourced", feeUsd: 10, renewal: "renewed annually by the thirtieth day of September", renewalFeeUsd: 10 });
  });

  it("doesn't read “one hundred fifty dollars” as fifty", () => {
    const [checked] = verifyRequirements([draft({ evidence: "The fee is one hundred fifty dollars for a wholesale bakery.", feeUsd: 50 })], pages, ["codes.ohio.gov"]);
    expect(checked).toMatchObject({ feeUsd: null, verification: "needs_verification" });
    expect(verifyRequirements([draft({ evidence: "The fee is one hundred fifty dollars for a wholesale bakery.", feeUsd: 150 })], pages, ["codes.ohio.gov"])[0].feeUsd).toBe(150);
  });

  it("drops a renewal the quote doesn't show, without doubting the requirement", () => {
    const [checked] = verifyRequirements([draft({ feeUsd: 10, renewal: "every two years", renewalFeeUsd: 20 })], pages, ["codes.ohio.gov"]);
    expect(checked).toMatchObject({ verification: "sourced", renewal: null, renewalFeeUsd: null });
  });

  it("spells whole amounts the way laws do", () => {
    expect(amountInWords(39)).toBe("thirty-nine");
    expect(amountInWords(99)).toBe("ninety-nine");
    expect(amountInWords(200)).toBe("two hundred");
    expect(amountInWords(1250)).toBe("one thousand two hundred fifty");
    expect(amountInWords(12.5)).toBeNull();
  });
});

describe("verifyRequirements: amounts in words, edge cases", () => {
  const page = (text: string) => [{ id: "orc", url: "https://codes.ohio.gov/x", retrievedAt: "2026-10-27T00:00:00Z", level: "state" as const, text }];
  const check = (text: string, overrides: Partial<RequirementDraft>) =>
    verifyRequirements([{ ...requirementDraft({ level: "state", sourceIds: ["orc"], evidence: text }), ...overrides }], page(text), ["codes.ohio.gov"])[0];

  it("doesn't take part of a larger amount, or dollars with cents, for a whole fee", () => {
    expect(check("The license fee is ninety nine dollars for each place.", { feeUsd: 9 }).feeUsd).toBeNull();
    expect(check("The license fee is twenty-five dollars for each place.", { feeUsd: 5 }).feeUsd).toBeNull();
    expect(check("The license fee is twenty dollars and fifty cents each year.", { feeUsd: 20 }).feeUsd).toBeNull();
    expect(check("The license fee is one dollar for each place.", { feeUsd: 1 }).feeUsd).toBe(1);
  });

  it("only takes a renewal fee from a sentence about renewing", () => {
    const text = "The filing fee is $99 for the application. The registration must be renewed every two years.";
    expect(check(text, { feeUsd: 99, renewal: "renewed every two years", renewalFeeUsd: 99 })).toMatchObject({ feeUsd: 99, renewal: "renewed every two years", renewalFeeUsd: null });
    const yearly = "The registration costs ten dollars annually. It must be renewed by September 30.";
    expect(check(yearly, { feeUsd: 10, renewal: "renewed by September 30", renewalFeeUsd: 10 })).toMatchObject({ renewalFeeUsd: 10 });
  });
});
