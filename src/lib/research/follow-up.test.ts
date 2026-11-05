import { describe, expect, it, vi } from "vitest";
import { AIProviderError, type CompletionRequest, type ModelProvider, type WebSearchRequest } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { buildPlan } from "@/lib/rules/plan";
import { requirementDraft, testProfile } from "@/test/fixtures";
import { classify, placeOf, structureOf } from "./applicability";
import { CLAIMS_SCHEMA_NAME } from "./claims";
import { decide, FOLLOW_UP_SCHEMA_NAME, type FollowUpResult, followUpCandidates, followUpRequirements, safeBackground, verdictOf } from "./follow-up";
import { officeOf } from "./office";

const profile = testProfile({ location: { state: "TX", county: "Denton County", city: "Aubrey", insideCityLimits: "yes" } });
const place = placeOf(profile);

describe("followUpCandidates", () => {
  const row = (overrides: Partial<{ verification: string; status: string; applicability: string; condition: string; fitsStructure: boolean; claimsChecked: boolean | null }>) => ({
    verification: "needs_verification",
    status: "needs_confirmation",
    applicability: "applies",
    condition: "",
    fitsStructure: true,
    ...overrides,
  });

  it("takes what no page confirmed, and old questions about what a government requires, never the owner's own questions", () => {
    expect(followUpCandidates([row({})])).toHaveLength(1);
    expect(followUpCandidates([row({ status: "conditional", applicability: "conditional", condition: "Whether Aubrey requires a home-based permit" })])).toHaveLength(1);
    expect(followUpCandidates([row({ status: "conditional", applicability: "conditional", condition: "Will customers come to your home?" })])).toHaveLength(0);
    expect(followUpCandidates([row({ verification: "sourced", status: "verified", claimsChecked: true })])).toHaveLength(0);
    expect(followUpCandidates([row({ fitsStructure: false })])).toHaveLength(0);
  });

  it("takes a quote the claims check never read, so it gets another try", () => {
    expect(followUpCandidates([row({ verification: "sourced", status: "quote_unchecked", claimsChecked: false })])).toHaveLength(1);
    // Saved before this was recorded
    expect(followUpCandidates([row({ verification: "sourced", status: "verified", claimsChecked: null })])).toHaveLength(0);
  });
});

describe("safeBackground", () => {
  it("keeps general background and drops anything that reads like a specific fact", () => {
    expect(safeBackground("  Most small Texas cities  don’t license home sellers.  ")).toBe("Most small Texas cities don’t license home sellers.");
    for (const text of ["The fee is $50.", "Apply within 30 days.", "Email clerk@aubreytx.gov.", "See https://x.gov.", "Too short."]) {
      expect(safeBackground(text)).toBe("");
    }
  });
});

describe("officeOf", () => {
  it("sends a city's rules to city hall, and others to the office named, in the owner's own place names", () => {
    expect(officeOf({ level: "city", agency: "Planning department" }, place)).toMatchObject({ key: "city:city-of-aubrey", name: "City of Aubrey" });
    expect(officeOf({ level: "county", agency: "Your county health department" }, place).name).toBe("Denton County health department");
    expect(officeOf({ level: "state", agency: "Your state’s department of revenue" }, place).name).toBe("Texas department of revenue");
    expect(officeOf({ level: "county", agency: "" }, place).name).toBe("Denton County");
  });
});

describe("decide and verdictOf", () => {
  const result = (outcome: "confirmed" | "not_needed" | "likely_applies" | "likely_not_needed" | "unclear", evidence: string | null = null, worthChecking = "") => ({
    key: "license",
    outcome,
    sourceIds: evidence ? ["fu-license-1"] : [],
    evidence,
    reason: "A reason that is long enough to show.",
    found: "",
    missing: "",
    worthChecking,
    questions: [],
  });
  const verified = (claimsChecked: boolean | undefined, verification: "sourced" | "needs_verification" = "sourced") => ({
    ...requirementDraft({ key: "license" }),
    verification,
    problems: [],
    claimsChecked,
  });
  const MOWERS = "You’ll keep mowers and a work trailer at home, and cities often limit commercial equipment at homes.";

  it("settles a rule only with a quote: confirmed on the page, or not needed once the claims check read it too", () => {
    expect(decide(result("confirmed", "A license is required."), verified(true)).decision).toBe("confirmed");
    expect(decide(result("not_needed", "Homes are exempt."), verified(true)).decision).toBe("not_needed");
  });

  it("never says 'not needed' when a quote doesn't hold up: at most 'likely doesn't apply'", () => {
    expect(decide(result("confirmed", "Made up."), verified(undefined, "needs_verification"))).toMatchObject({ decision: "applies", quoteSetAside: true });
    expect(decide(result("not_needed", "Made up."), verified(undefined, "needs_verification"))).toMatchObject({ decision: "unlikely", quoteSetAside: true, verified: null });
    // On the page, but the claims check didn't finish
    expect(decide(result("not_needed", "Homes are exempt."), verified(false))).toMatchObject({ decision: "unlikely", quoteSetAside: true });
  });

  it("keeps what businesses like this usually need as a step, and 'probably not' as a note", () => {
    expect(verdictOf(decide(result("likely_applies"), undefined))).toBe("applies");
    expect(verdictOf(decide(result("likely_not_needed"), undefined))).toBe("unlikely");
  });

  it("makes a step to confirm only when the AI reasonably thinks it could apply but isn't sure", () => {
    // Nothing on the pages, quiet work at home: a note, never a chase
    expect(verdictOf(decide(result("unclear"), undefined))).toBe("unlikely");
    // A page names the permit for this place, and it could cover this owner
    const permit = "A home occupation permit is required for some home businesses.";
    expect(verdictOf(decide(result("unclear", permit), undefined, permit))).toBe("unclear");
    // A page names a rule that sounds related, but logic says it can't cover them: a marine animal ban and a goldfish
    const ban = "Marine animals may not be kept in residences.";
    expect(verdictOf(decide(result("likely_not_needed"), undefined, ban))).toBe("unlikely");
    // Mowers and a trailer at home are what home business rules exist to control
    expect(verdictOf(decide(result("unclear", null, MOWERS), undefined))).toBe("unclear");
    expect(verdictOf(decide(result("likely_not_needed", null, MOWERS), undefined))).toBe("unclear");
    // A vague or numeric reason doesn't count
    expect(verdictOf(decide(result("unclear", null, "Maybe."), undefined))).toBe("unlikely");
  });

  it("keeps a rule as the first check had it, a step, when no answer came back for it", () => {
    expect(verdictOf(decide(undefined, undefined))).toBe("applies");
  });
});

// A searching model on Aubrey's own site: each look and each claims check answers in turn
const AUBREY = "https://www.aubreytx.gov";
function deeperLook(options: { looks: (object | Error)[]; claims?: (object | Error)[]; pages?: Record<string, string> }) {
  const pages: Record<string, string> = {
    [`${AUBREY}/business`]: "<h1>Doing business in Aubrey</h1><p>Every business operating in the city must register with the City Secretary.</p>",
    [`${AUBREY}/faq`]: "<h1>Business FAQ</h1><p>A home-based business with no customer visits does not need a certificate of occupancy.</p>",
    ...options.pages,
  };
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    const html = pages[String(url)];
    return html ? new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }) : new Response("Not found", { status: 404 });
  });
  const webSearch = vi.fn(async (request: WebSearchRequest) => ({
    hits: /who needs/.test(request.question)
      ? [{ title: "Business FAQ", url: `${AUBREY}/faq`, snippet: "", cited: true }]
      : /email address and phone/.test(request.question)
        ? []
        : [{ title: "Doing business in Aubrey", url: `${AUBREY}/business`, snippet: "", cited: true }],
    answer: "",
  }));
  const asked: CompletionRequest[] = [];
  let look = 0;
  let claim = 0;
  const base = createMockProvider();
  const model: ModelProvider = {
    ...base,
    simulated: false,
    capabilities: { ...base.capabilities, webSearch: true },
    webSearch,
    async complete(request) {
      asked.push(request);
      const claims = request.responseFormat?.name === CLAIMS_SCHEMA_NAME;
      const replies = claims ? (options.claims ?? [{ unsupported: [] }]) : options.looks;
      const reply = replies[Math.min(claims ? claim++ : look++, replies.length - 1)];
      if (reply instanceof Error) throw reply;
      return { text: JSON.stringify(reply), finishReason: "stop", usage: null };
    },
  };
  const looks = () => asked.filter((request) => request.responseFormat?.name === FOLLOW_UP_SCHEMA_NAME);
  return { model, fetchImpl, webSearch, looks };
}

const license = { ...requirementDraft({ key: "license", title: "City business license", level: "city", agency: "City secretary", whatToAsk: ["Does Aubrey license home businesses?"] }), verification: "needs_verification" };
const look = (results: object[]) => ({ results, answers: [] });
const answer = (outcome: string, extra: object = {}) => ({
  key: "license",
  outcome,
  sourceIds: [],
  evidence: null,
  reason: "Small Texas cities handle home businesses in different ways.",
  found: "Aubrey’s business page asks every business operating in the city to register.",
  missing: "No Aubrey page says whether a home business with no visitors counts.",
  questions: ["Does a home business with no customer visits need to register?"],
  ...extra,
});

// What the owner ends up with: the step's status and whether it's in their plan
function outcomeFor(result: FollowUpResult) {
  const note = result.notes.find((each) => each.key === "license")!;
  const requirement = {
    ...license,
    problems: [],
    sourceIds: note.sourceIds,
    evidence: note.evidence,
    verification: note.evidence ? ("sourced" as const) : ("needs_verification" as const),
    claimsChecked: note.evidence ? true : null,
    verdict: note.verdict,
    background: note.background,
    trail: note.trail,
  };
  const classified = { ...requirement, ...classify(requirement, profile, place, structureOf(profile, [])) };
  const plan = buildPlan([classified], result.pages.map((page) => ({ ...page, retrievedAt: page.retrievedAt })), false, { place });
  return { note, status: classified.status, step: plan.find((each) => each.key === "license") ?? null };
}

describe("followUpRequirements", () => {
  it("runs offline in practice mode: no search, a decision and reason for each rule and open question, no made-up contacts", async () => {
    const unconfirmed = [
      { ...requirementDraft({ key: "license", title: "City business license", level: "city", agency: "City clerk" }), verification: "needs_verification" },
      { ...requirementDraft({ key: "home", title: "Home business permit", level: "city", agency: "Planning" }), verification: "needs_verification" },
    ];
    const fetchImpl = async () => {
      throw new Error("nothing is fetched without search");
    };
    const result = await followUpRequirements(createMockProvider(), profile, place, unconfirmed, { fetchImpl, open: [{ question: "Do markets need their own permit?" }] });
    expect(result.pages).toEqual([]);
    expect(result.confirmed).toEqual([]);
    expect(result.rounds).toBe(1);
    expect(result.notes.map((note) => note.key)).toEqual(["license", "home"]);
    expect(result.notes[0]).toMatchObject({ verdict: "applies", evidence: null, trail: null });
    expect(result.notes[0].background).toMatch(/^Practice reason/);
    expect(result.answers).toEqual([{ question: "Do markets need their own permit?", answer: expect.stringMatching(/^Practice answer/) }]);
    expect(result.offices).toEqual([{ key: "city:city-of-aubrey", name: "City of Aubrey", level: "city", contacts: { emails: [], phones: [] }, site: null }]);
  });

  // Regression: a made-up exemption used to come back "not needed" with no quote, and the plan dropped the step
  it("never calls a rule 'not needed' on a made-up exemption quote: after searching again, it's at most a note that it likely doesn't apply", async () => {
    const madeUp = answer("not_needed", { sourceIds: ["nonexistent-source"], evidence: "Home businesses in Aubrey are exempt from all licensing.", found: "", missing: "" });
    const madeUpAgain = answer("not_needed", { sourceIds: ["fu-again-license-1"], evidence: "Home-based businesses never need to register." });
    const { model, fetchImpl, webSearch, looks } = deeperLook({ looks: [look([madeUp]), look([madeUpAgain])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    // Listed with its reason as "likely doesn't apply", never "not needed", and not a step to chase
    expect(note).toMatchObject({ verdict: "unlikely", evidence: null, sourceIds: [], questions: [] });
    expect(status).toBe("unlikely");
    expect(step).toBeNull();
    // It looked a third time, aimed at who needs it, before settling on that
    expect(result.rounds).toBe(2);
    expect(looks()).toHaveLength(2);
    expect(webSearch.mock.calls.map(([request]) => request.question).filter((question) => !/email address/.test(question))).toEqual([
      expect.stringMatching(/web page about city business license/),
      expect.stringMatching(/ordinance, code section or application form/),
      expect.stringMatching(/who needs city business license and who doesn't.*It should answer: Does a home business with no customer visits need to register\?/),
    ]);
    expect(String(looks()[1].messages[1].content)).toContain("<earlier>");
    // The owner sees where SnapStart looked, what it read and found, its best read, and that the quote was set aside
    expect(note.trail).toEqual({
      searched: [
        { where: "Aubrey", what: "a page about city business license", pages: 1 },
        { where: "Aubrey", what: "the ordinance, code section or application form that covers it", pages: 1 },
        { where: "Aubrey", what: "who needs it and who doesn’t, such as exemptions or answers to common questions", pages: 1 },
      ],
      read: [
        { title: "Doing business in Aubrey", url: `${AUBREY}/business` },
        { title: "Business FAQ", url: `${AUBREY}/faq` },
      ],
      unread: [],
      found: "Aubrey’s business page asks every business operating in the city to register.",
      missing: "No Aubrey page says whether a home business with no visitors counts.",
      leaning: "not_needed",
      quoteSetAside: true,
      rounds: 2,
    });
  });

  it("keeps a rule the owner's business makes worth checking as a step, saying why, even with a made-up exemption", async () => {
    const mowers = "You’ll keep mowers and a work trailer at home, and cities often limit commercial equipment at homes.";
    const madeUp = answer("not_needed", { sourceIds: ["nonexistent-source"], evidence: "Home businesses in Aubrey are exempt from all licensing.", worthChecking: mowers });
    const { model, fetchImpl } = deeperLook({ looks: [look([madeUp]), look([madeUp])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(note).toMatchObject({ verdict: "unclear", evidence: null, trail: { worthChecking: mowers, quoteSetAside: true } });
    expect(status).toBe("to_find_out");
    expect(step).toMatchObject({ requirementStatus: "to_find_out" });
  });

  // Regression: no result for a rule used to fall to "applies" with a made-up reason; now it plainly stays as the first check had it
  it("keeps a rule as the first check had it, a step, when the model returns nothing for it, never 'not needed'", async () => {
    const { model, fetchImpl, looks } = deeperLook({ looks: [look([]), look([])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(looks()).toHaveLength(2);
    expect(note).toMatchObject({ verdict: "applies", evidence: null, trail: null, background: "Businesses like yours usually need this, so it’s in your plan to keep you covered." });
    expect(status).toBe("needs_confirmation");
    expect(step).toMatchObject({ requirementStatus: "needs_confirmation" });
  });

  // Regression: a quote the claims check never read could still mark a rule "not needed"
  it("never calls a rule 'not needed' when the claims check fails on its exemption quote", async () => {
    const real = answer("not_needed", { sourceIds: ["fu-again-license-1"], evidence: "A home-based business with no customer visits does not need a certificate of occupancy." });
    const { model, fetchImpl } = deeperLook({ looks: [look([answer("likely_not_needed")]), look([real])], claims: [new Error("service down")] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(note).toMatchObject({ verdict: "unlikely", evidence: null, sourceIds: [] });
    expect(note.trail).toMatchObject({ leaning: "not_needed", quoteSetAside: true, rounds: 2 });
    expect(status).toBe("unlikely");
    expect(step).toBeNull();
  });

  it("makes a rule a page names here a step to confirm, with the page's sentence, when it could cover this owner", async () => {
    const sentence = "Every business operating in the city must register with the City Secretary.";
    const named = answer("unclear", { sourceIds: ["fu-license-1"], evidence: sentence });
    const { model, fetchImpl } = deeperLook({ looks: [look([named]), look([named])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(note).toMatchObject({ verdict: "unclear", questions: ["Does a home business with no customer visits need to register?"], trail: { officialQuote: sentence } });
    expect(status).toBe("to_find_out");
    expect(step).toMatchObject({ requirementStatus: "to_find_out" });
  });

  it("drops the step when logic shows a rule a page names can't really cover this owner", async () => {
    const goldfish = answer("likely_not_needed", { reason: "The city's ban covers marine animals kept as a business, and a pet goldfish isn't one." });
    const { model, fetchImpl } = deeperLook({ looks: [look([goldfish]), look([goldfish])] });

    const { note, status, step } = outcomeFor(await followUpRequirements(model, profile, place, [license], { fetchImpl }));
    expect(note).toMatchObject({ verdict: "unlikely", background: "The city's ban covers marine animals kept as a business, and a pet goldfish isn't one." });
    expect(status).toBe("unlikely");
    expect(step).toBeNull();
  });

  it("settles it on the second search when a page there shows it, so the owner isn't sent to ask", async () => {
    const real = answer("not_needed", { sourceIds: ["fu-again-license-1"], evidence: "A home-based business with no customer visits does not need a certificate of occupancy." });
    const { model, fetchImpl } = deeperLook({ looks: [look([answer("likely_not_needed")]), look([real])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(note).toMatchObject({ verdict: "not_needed", sourceIds: ["fu-again-license-1"], evidence: real.evidence, trail: null });
    expect(status).toBe("not_needed");
    expect(step).toBeNull();
  });

  it("keeps what businesses like this usually need as a plain step, with no second search and nothing for the owner to research", async () => {
    const { model, fetchImpl, looks } = deeperLook({ looks: [look([answer("likely_applies")])] });

    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    const { note, status, step } = outcomeFor(result);

    expect(looks()).toHaveLength(1);
    expect(result.rounds).toBe(1);
    expect(note).toMatchObject({ verdict: "applies", trail: null, questions: [] });
    expect(status).toBe("needs_confirmation");
    expect(step).toMatchObject({ requirementStatus: "needs_confirmation" });
  });

  it("confirms with a quote on the page, and records whether the claims check read it", async () => {
    const quote = "Every business operating in the city must register with the City Secretary.";
    const confirmed = answer("confirmed", { sourceIds: ["fu-license-1"], evidence: quote });

    const checked = await followUpRequirements(deeperLook({ looks: [look([confirmed])] }).model, profile, place, [license], { fetchImpl: deeperLook({ looks: [] }).fetchImpl });
    expect(checked.confirmed).toMatchObject([{ key: "license", verification: "sourced", evidence: quote, claimsChecked: true }]);

    const unread = await followUpRequirements(deeperLook({ looks: [look([confirmed])], claims: [new Error("down")] }).model, profile, place, [license], {
      fetchImpl: deeperLook({ looks: [] }).fetchImpl,
    });
    expect(unread.confirmed).toMatchObject([{ key: "license", verification: "sourced", claimsChecked: false }]);
  });

  it("reads a quote the claims check missed again before searching for anything", async () => {
    const quoted = { ...license, verification: "sourced", claimsChecked: false, sourceIds: ["city-page"], evidence: "Every business must register." };
    const { model, fetchImpl, webSearch, looks } = deeperLook({ looks: [look([])] });

    const result = await followUpRequirements(model, profile, place, [quoted], { fetchImpl });
    expect(result.rechecked).toMatchObject([{ key: "license", verification: "sourced", claimsChecked: true }]);
    expect(result.notes).toEqual([]);
    expect(webSearch).not.toHaveBeenCalled();
    expect(looks()[0].messages[1].content).not.toContain('"key": "license"');
  });

  it("says when a search didn't finish, rather than that it found nothing", async () => {
    const { model, fetchImpl, webSearch } = deeperLook({ looks: [look([answer("unclear")]), look([answer("unclear")])] });
    webSearch.mockImplementation(async (request: WebSearchRequest) => {
      if (/ordinance/.test(request.question)) throw new AIProviderError("Search timed out", null, true);
      return { hits: [{ title: "Doing business in Aubrey", url: `${AUBREY}/business`, snippet: "", cited: true }], answer: "" };
    });
    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    expect(result.notes[0].trail!.searched).toEqual([
      { where: "Aubrey", what: "a page about city business license", pages: 1 },
      { where: "Aubrey", what: "the ordinance, code section or application form that covers it", pages: 0, failed: true },
      { where: "Aubrey", what: "who needs it and who doesn’t, such as exemptions or answers to common questions", pages: 1 },
    ]);
  });

  it("answers again at low effort when its first look runs out of time", async () => {
    const timedOut = new AIProviderError("Meta Muse stream failed: The operation was aborted due to timeout", null, true, null, true);
    const { model, fetchImpl, looks } = deeperLook({ looks: [timedOut, look([answer("likely_applies")])] });
    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl });
    expect(looks().map((request) => request.effort)).toEqual(["medium", "low"]);
    expect(result.notes[0]).toMatchObject({ verdict: "applies" });
  });

  it("skips the second search when there isn't time for it", async () => {
    const { model, fetchImpl, looks } = deeperLook({ looks: [look([answer("unclear")])] });
    const result = await followUpRequirements(model, profile, place, [license], { fetchImpl, budgetMs: 50_000 });
    expect(looks()).toHaveLength(1);
    expect(result.rounds).toBe(1);
    expect(result.notes[0]).toMatchObject({ verdict: "unlikely", trail: { rounds: 1, leaning: null } });
  });
});
