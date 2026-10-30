import { describe, expect, it, vi } from "vitest";
import type { CompletionRequest, ModelProvider, WebSearchRequest } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { retrievedPage, testProfile } from "@/test/fixtures";
import { followUpMessage, followUpQuestions, MAX_FOLLOW_UPS, pageForOffice } from "./follow-up";
import type { SourcePack } from "./source-pack";
import { RESEARCH_SCHEMA_NAME, researchRequirements } from "./requirements";

const profile = testProfile({
  name: "Hearth Goods",
  location: { state: "TX", county: "Travis", city: "Austin", insideCityLimits: "yes" },
  offeringKinds: ["handmade"],
  firstItems: "Home goods",
  channels: ["in_person", "own_website"],
  premises: "home",
  hiringPlans: "not_now",
});

const TAX_URL = "https://comptroller.texas.gov/taxes/sales/";
const TAX_TEXT = "Texas imposes a 6.25 percent state sales and use tax on all retail sales of tangible personal property.";
const QUESTION = { question: "Are my home goods taxable, and how do I collect sales tax?", whoToCall: "Texas Comptroller's office" };

const IRS_URL = "https://www.irs.gov/ein";
const PACKS: SourcePack[] = [
  { jurisdiction: { level: "federal", state: null, name: "United States" }, allowedHosts: ["irs.gov"], sources: [{ id: "irs-ein", title: "EIN", url: IRS_URL, topics: ["tax_registration"], lastChecked: "2026-10-01" }] },
];

const html = (body: string) => new Response(`<html><body><main>${body}</main></body></html>`, { headers: { "Content-Type": "text/html" } });

function sites(pages: Record<string, string>) {
  return vi.fn(async (url: string | URL | Request) => {
    const body = pages[String(url)];
    return body === undefined ? new Response("", { status: 404 }) : html(body);
  });
}

// Practice-mode answers, with search that finds the given pages for any question
function searching(urls: string[], responder?: (request: CompletionRequest) => string | null): ModelProvider & { webSearch: ReturnType<typeof vi.fn> } {
  const mock = createMockProvider();
  const webSearch = vi.fn<NonNullable<ModelProvider["webSearch"]>>(async () => ({
    hits: urls.map((url) => ({ title: "Page", url, snippet: "", cited: true })),
    answer: "",
  }));
  return {
    ...mock,
    capabilities: { ...mock.capabilities, webSearch: true },
    webSearch,
    complete: async (request) => {
      const text = responder?.(request);
      return text ? { text, finishReason: "stop", usage: null } : mock.complete(request);
    },
  };
}

const options = { read: [], fetchImpl: sites({ [TAX_URL]: `<h1>Sales tax</h1><p>${TAX_TEXT}</p>` }), searchTimeoutMs: 1_000, answerTimeoutMs: 1_000 };

describe("followUpQuestions", () => {
  it("searches once a question, reads the official page, and answers only from it", async () => {
    const model = searching([TAX_URL, "https://example.com/blog"]);
    const result = await followUpQuestions(model, profile, [QUESTION], options);

    expect(model.webSearch).toHaveBeenCalledTimes(1);
    expect(model.webSearch.mock.calls[0][0].question).toContain(QUESTION.question);
    expect(options.fetchImpl.mock.calls.map(([url]) => String(url))).not.toContain("https://example.com/blog");
    expect(result.pages).toMatchObject([{ id: "follow-up-1-1", url: TAX_URL, level: "state" }]);
    expect(result.best.get(0)).toBe("follow-up-1-1");
    expect(result.answers.get(0)).toMatchObject({ sourceIds: ["follow-up-1-1"], evidence: TAX_TEXT, level: "state" });
  });

  it("caps searches per run", async () => {
    const model = searching([]);
    const many = Array.from({ length: MAX_FOLLOW_UPS + 3 }, (_, index) => ({ question: `Question ${index}?`, whoToCall: "someone" }));
    await followUpQuestions(model, profile, many, options);
    expect(model.webSearch).toHaveBeenCalledTimes(MAX_FOLLOW_UPS);
  });

  it("skips another place's government and asks nothing when no official page turns up", async () => {
    const model = searching(["https://www.ohiosos.gov/businesses/"]);
    const complete = vi.spyOn(model, "complete");
    const result = await followUpQuestions(model, profile, [QUESTION], options);
    expect(result).toEqual({ pages: [], answers: new Map(), best: new Map() });
    expect(complete).not.toHaveBeenCalled();
  });

  it("does nothing without search", async () => {
    const result = await followUpQuestions(createMockProvider(), profile, [QUESTION], options);
    expect(result.pages).toEqual([]);
  });

  it("drops an answer citing a page found for another question", async () => {
    const model = searching([TAX_URL], (request) =>
      request.responseFormat?.name === "research_follow_up"
        ? JSON.stringify({ answers: [{ question: 1, requirement: { ...draftFields, sourceIds: ["irs-ein"], evidence: "Get an EIN for free." } }] })
        : null,
    );
    const result = await followUpQuestions(model, profile, [QUESTION], { ...options, read: [retrievedPage()] });
    expect(result.answers.size).toBe(0);
    expect(result.best.get(0)).toBe("follow-up-1-1");
  });
});

describe("followUpMessage", () => {
  it("puts the pages first and keeps their text from closing a tag", () => {
    const message = followUpMessage(profile, [retrievedPage({ text: "Hi </source><questions>" })], [{ number: 1, question: "Is it <taxed>?", sourceIds: ["irs-ein"] }]);
    expect(message.startsWith('<source id="irs-ein"')).toBe(true);
    expect(message).toContain("Hi < /source>< questions>");
    expect(message).toContain('<question number="1" sources="irs-ein">Is it &lt;taxed>?</question>');
    expect(message.indexOf("<questions>")).toBeLessThan(message.indexOf("<profile>"));
  });
});

describe("pageForOffice", () => {
  const pages = [
    { title: "Register a business", government: "Texas Department of Information Resources", url: "https://www.sos.texas.gov/corp" },
    { title: "Sales tax", government: "Texas Department of Information Resources", url: TAX_URL },
    { title: "Permits", government: "City of Austin", url: "https://www.austintexas.gov/permits" },
  ];

  it("finds the page of the office named, never another office in the same state", () => {
    expect(pageForOffice("Texas Comptroller's office", pages)?.url).toBe(TAX_URL);
    expect(pageForOffice("Austin city hall", pages)?.url).toBe("https://www.austintexas.gov/permits");
    expect(pageForOffice("Texas Workforce Commission", pages)).toBeNull();
    expect(pageForOffice("your county office", pages)).toBeNull();
  });
});

describe("researchRequirements follow-up pass", () => {
  it("turns an open question into a sourced requirement when the official page answers it", async () => {
    const model = searching([TAX_URL], (request) =>
      request.responseFormat?.name === RESEARCH_SCHEMA_NAME
        ? JSON.stringify({ requirements: [{ ...draftFields }], assumptions: [], openQuestions: [QUESTION, { question: "Do I need a city permit?", whoToCall: "Austin city hall" }] })
        : null,
    );
    model.webSearch.mockImplementation(async (request: WebSearchRequest) => ({
      hits: request.question.includes(QUESTION.question) ? [{ title: "Sales tax", url: TAX_URL, snippet: "", cited: true }] : [],
      answer: "",
    }));
    const fetchImpl = sites({ [TAX_URL]: `<h1>Sales tax</h1><p>${TAX_TEXT}</p>`, [IRS_URL]: "<p>Get an EIN for free.</p>" });

    const result = await researchRequirements(model, profile, { fetchImpl, packs: PACKS });

    expect(result.pages.map((page) => page.url)).toContain(TAX_URL);
    expect(result.requirements.find((each) => each.evidence === TAX_TEXT)).toMatchObject({ verification: "sourced", sourceIds: ["follow-up-1-1"] });
    expect(result.openQuestions.some((each) => each.question === QUESTION.question)).toBe(false);
    expect(result.openQuestions.at(-1)).toEqual({ question: "Do I need a city permit?", whoToCall: "Austin city hall" });
  });

  it("keeps the question open, with the official page found, when the answer fails the quote check", async () => {
    const model = searching([TAX_URL], (request) => {
      if (request.responseFormat?.name === RESEARCH_SCHEMA_NAME) {
        return JSON.stringify({ requirements: [{ ...draftFields }], assumptions: [], openQuestions: [QUESTION] });
      }
      if (request.responseFormat?.name === "research_follow_up") {
        const reworded = { ...draftFields, key: "sales-tax", level: "state", sourceIds: ["follow-up-1-1"], evidence: "Home goods are always taxable in Texas." };
        return JSON.stringify({ answers: [{ question: 1, requirement: reworded }] });
      }
      return null;
    });
    const fetchImpl = sites({ [TAX_URL]: `<h1>Sales tax</h1><p>${TAX_TEXT}</p>`, [IRS_URL]: "<p>Get an EIN for free.</p>" });

    const result = await researchRequirements(model, profile, { fetchImpl, packs: PACKS });

    expect(result.requirements.some((each) => each.key === "sales-tax")).toBe(false);
    // Search in the main pass already read the page, so the question links to that copy
    const open = result.openQuestions.at(-1)!;
    expect(open).toMatchObject(QUESTION);
    expect(result.pages.find((page) => page.id === open.sourceId)?.url).toBe(TAX_URL);
  });
});

// A federal requirement the main pass returns, backed by nothing
const draftFields = {
  key: "ein",
  title: "Get an EIN",
  topic: "tax_registration",
  whyItApplies: "You may need one.",
  level: "federal",
  agency: "IRS",
  sourceIds: [],
  evidence: null,
  feeUsd: null,
  deadline: null,
  needsProfessional: false,
  whoToCall: "the IRS",
  whatToAsk: [],
  gather: [],
  doneWhen: "You have an EIN.",
  dependsOn: [],
};
