import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateObject, StructuredOutputError } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import type { ModelProvider } from "@/lib/ai/types";
import { imageInfo } from "@/lib/photos/image-info";
import { researchRequirements } from "@/lib/research/requirements";
import { researchedRequirement } from "@/test/fixtures";
import { liveRefusal, parseArgs } from "./args";
import { Budget, BudgetReached, estimateRequest, tokenCost } from "./budget";
import { caseById, CASES, type ExpectedRequirement } from "./cases";
import {
  gradeBios,
  gradeBusinessPlan,
  gradeClaims,
  gradeDocumentRead,
  gradeExplain,
  gradeFormDraft,
  gradeInsights,
  gradeIntake,
  gradeLettering,
  gradeReceived,
  gradeResearch,
  gradeStory,
  gradeTaglines,
  gradeWebsite,
  scoreOf,
} from "./graders";
import { Canvas, logoImage } from "./images";
import { savedPages } from "./pages";
import { pricesFor } from "./pricing";
import { Recorder } from "./recorder";
import { percentile, type RunRecord, summaryMarkdown } from "./report";

const MUSE = pricesFor("muse-spark-1.3");
const UNPRICED = pricesFor("some-other-model");

describe("flags and live guards", () => {
  it("defaults to the free mock", () => {
    const options = parseArgs([]);
    expect(options).toMatchObject({ provider: "mock", repeat: 1, live: false, budgetUsd: null });
    expect(liveRefusal(options, MUSE)).toBeNull();
  });

  it("refuses a Muse run unless --live, --yes and --budget are all given", () => {
    expect(liveRefusal(parseArgs(["--provider", "muse"]), MUSE)).toMatch(/--live, --yes, --budget/);
    expect(liveRefusal(parseArgs(["--live", "--budget", "2"]), MUSE)).toMatch(/--yes/);
    expect(liveRefusal(parseArgs(["--live", "--yes"]), MUSE)).toMatch(/--budget/);
    expect(liveRefusal(parseArgs(["--live", "--yes", "--budget", "2"]), MUSE)).toBeNull();
  });

  it("treats --live alone as Muse, and --live with the mock as a mistake", () => {
    expect(parseArgs(["--live"]).provider).toBe("muse");
    expect(liveRefusal(parseArgs(["--live", "--provider", "mock"]), MUSE)).toMatch(/needs --provider muse/);
  });

  it("refuses a live run when prices aren't checked, since spend can't be estimated", () => {
    expect(liveRefusal(parseArgs(["--live", "--yes", "--budget", "2"]), UNPRICED)).toMatch(/aren't checked/);
    expect(liveRefusal(parseArgs(["--live", "--yes", "--budget", "2", "--images"]), { ...MUSE, imagePerPicture: null })).toMatch(/per-image/);
  });

  it("rejects bad values and unknown flags", () => {
    expect(() => parseArgs(["--budget", "0"])).toThrow(/positive/);
    expect(() => parseArgs(["--repeat", "1.5"])).toThrow(/whole number/);
    expect(() => parseArgs(["--provider", "openai"])).toThrow(/mock" or "muse/);
    expect(() => parseArgs(["--tasks"])).toThrow(/needs a value/);
    expect(() => parseArgs(["--fast"])).toThrow(/Unknown flag/);
    expect(parseArgs(["--tasks", "intake, taglines", "--repeat", "3"])).toMatchObject({ tasks: ["intake", "taglines"], repeat: 3 });
  });
});

describe("costs", () => {
  it("bills cached input at the cached rate and reasoning as output", () => {
    const cost = tokenCost({ inputTokens: 1_000_000, cachedInputTokens: 200_000, outputTokens: 100_000, reasoningTokens: 80_000 }, MUSE);
    expect(cost).toBeCloseTo(0.8 * 1.25 + 0.2 * 0.15 + 0.1 * 4.25, 6);
    expect(tokenCost({ inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, reasoningTokens: 0 }, UNPRICED)).toBeNull();
  });

  it("estimates a prompt from its text, schema and pictures", () => {
    const estimate = estimateRequest({
      messages: [
        { role: "system", content: "x".repeat(400) },
        { role: "user", content: [{ type: "text", text: "y".repeat(40) }, { type: "image", url: "data:image/png;base64,AA" }] },
      ],
      responseFormat: { name: "n", schema: {} },
    });
    expect(estimate).toEqual({ inputTokens: Math.ceil((400 + 40 + 2) / 4) + 1_600, images: 1 });
  });
});

describe("budget guard", () => {
  it("starts a call only while spend, running calls and its worst case fit the limit", () => {
    const budget = new Budget(1);
    const release = budget.reserve(0.6);
    expect(() => budget.reserve(0.5)).toThrow(BudgetReached);
    // Once refused, nothing new starts
    release();
    expect(() => budget.reserve(0.1)).toThrow(BudgetReached);
  });

  it("stops once the estimated spend reaches the limit", () => {
    const budget = new Budget(1);
    budget.reserve(0.4)();
    budget.charge(0.4);
    budget.reserve(0.5)();
    budget.charge(0.6);
    expect(budget.stopped).toBe(true);
    expect(() => budget.reserve(0.0001)).toThrow(/Budget reached/);
  });

  it("never starts a call it can't price", () => {
    expect(() => new Budget(5).reserve(null)).toThrow(BudgetReached);
  });

  it("refuses the call before it reaches the provider", async () => {
    let sent = 0;
    const inner: ModelProvider = { ...createMockProvider(() => JSON.stringify({ ok: true })), simulated: false };
    const counting: ModelProvider = {
      ...inner,
      complete: async (request) => {
        sent++;
        return { ...(await inner.complete(request)), usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 100, reasoningTokens: 0 } };
      },
    };
    // Room for one call's worst case (about $0.0043), not for that plus the first call's cost
    const recorder = new Recorder(MUSE, new Budget(0.0044));
    const model = recorder.wrapModel(counting);
    const ask = () => generateObject(model, { name: "probe", schema: z.object({ ok: z.boolean() }), maxOutputTokens: 1_000, messages: [{ role: "user", content: "hi" }] });
    recorder.beginRun();
    await expect(ask()).resolves.toEqual({ ok: true });
    await expect(ask()).rejects.toThrow(BudgetReached);
    expect(sent).toBe(1);
    expect(recorder.current().calls).toHaveLength(1);
    recorder.close();
  });
});

describe("recorder", () => {
  it("records each attempt with its schema outcome, and repairs", async () => {
    const replies = ["not json", JSON.stringify({ ok: true })];
    const recorder = new Recorder(MUSE, null);
    const model = recorder.wrapModel(createMockProvider(() => replies.shift()!));
    recorder.beginRun();
    await generateObject(model, { name: "probe", schema: z.object({ ok: z.boolean() }), messages: [{ role: "user", content: "hi" }] });
    const { calls } = recorder.current();
    expect(calls.map((call) => [call.attempt, call.outcome, call.fixture])).toEqual([
      [0, "invalid", true],
      [1, "ok", true],
    ]);
    expect(calls[0].problem).toMatch(/not valid JSON/);
    expect(recorder.repliesFor("probe")).toEqual(["not json", JSON.stringify({ ok: true })]);
    recorder.close();
  });

  it("counts a reply cut off at the token limit", async () => {
    const recorder = new Recorder(MUSE, null);
    const cut: ModelProvider = { ...createMockProvider(), complete: async () => ({ text: '{"ok":', finishReason: "length", usage: { inputTokens: 5, cachedInputTokens: 0, outputTokens: 50, reasoningTokens: 40 } }) };
    const model = recorder.wrapModel(cut);
    recorder.beginRun();
    await expect(generateObject(model, { name: "probe", schema: z.object({ ok: z.boolean() }), messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(StructuredOutputError);
    expect(recorder.current().calls[0]).toMatchObject({ outcome: "cut_off", finishReason: "length", costEstimated: false });
    recorder.close();
  });
});

describe("graders", () => {
  const bakery = caseById("home-bakery")!;

  it("averages the checks that apply", () => {
    expect(scoreOf({ a: true, b: false, c: 0.5, d: null })).toBeCloseTo(0.5);
    expect(scoreOf({ a: null })).toBeNull();
  });

  it("grades intake answers, accepting any fair reading", () => {
    const right = { category: "baked_goods", state: "TX", owners: "me", stage: "idea", registeredAs: null, offeringKinds: ["food"], channels: ["social_media", "in_person"], premises: "home" } as const;
    expect(gradeIntake({ ...right, offeringKinds: [...right.offeringKinds], channels: [...right.channels] }, bakery.intake.expected).score).toBe(1);
    // A guessed state and an extra channel are both wrong
    const guessed = gradeIntake({ ...right, state: "OH", offeringKinds: ["food"], channels: ["social_media", "markets"] }, bakery.intake.expected);
    expect(guessed.checks).toMatchObject({ state: false, channels: false, category: true });
    const unsure = caseById("not-sure")!.intake.expected;
    expect(gradeIntake({ ...right, category: "packaged_food", state: null, owners: null, premises: null, offeringKinds: ["food"], channels: ["markets"] }, unsure).score).toBe(1);
  });

  it("grades research recall, precision, quotes, sources and unsure answers", () => {
    const expected: ExpectedRequirement[] = [
      { id: "ein", pattern: /\bein\b/i },
      { id: "home-business", pattern: /home/i, level: "city" },
    ];
    const requirements = [
      researchedRequirement({ key: "ein", title: "Get an EIN", sourceIds: ["irs-ein"], verification: "sourced" }),
      researchedRequirement({ key: "home-business", title: "Home business rules", level: "city", sourceIds: ["x"], verification: "needs_verification", problems: ['Cited source "x" was not retrieved'] }),
      researchedRequirement({ key: "made-up", title: "Something else", sourceIds: ["irs-ein"], verification: "sourced", status: "verified" }),
    ];
    const grade = gradeResearch(requirements, { expected, allowed: [], unsure: ["ein"] });
    expect(grade.checks).toMatchObject({ recall: 0.5, precision: 0.5, citationAccuracy: 2 / 3, noInventedSources: false, inventedSources: 1, unsureKeptOpen: 0, missing: "home-business" });
  });

  it("finds every expected requirement in the practice research for each case", async () => {
    for (const each of CASES) {
      const result = await researchRequirements(createMockProvider(), each.profile, { fetchImpl: savedPages, now: new Date("2026-10-30T12:00:00Z"), details: each.details });
      const grade = gradeResearch(result.requirements, each.research);
      // The practice rules don't cover a home business when where they'll work is "not sure"
      if (each.id !== "not-sure") expect([each.id, grade.checks.recall]).toEqual([each.id, 1]);
      expect(grade.checks.noInventedSources).toBe(true);
    }
  });

  it("grades the claims check against the known unsupported claims", () => {
    const flagged = (key: string) => researchedRequirement({ key, verification: "needs_verification", problems: ["The quote doesn’t show this requirement: no"] });
    const kept = (key: string) => researchedRequirement({ key, verification: "sourced" });
    const grade = gradeClaims([flagged("bad"), kept("good"), kept("bad-2"), flagged("good-2")], new Set(["bad", "bad-2"]), true);
    expect(grade).toMatchObject({ score: 0.5, checks: { right: 2, missed: 1, wronglyFlagged: 1 } });
    expect(gradeClaims([], new Set(), false).score).toBe(0);
  });

  it("grades taglines, insights and bios by what the app's own checks kept", () => {
    expect(gradeTaglines(["a", "b", "c", "d", "e"], ["a", "b", "c"]).score).toBeCloseTo(0.6);
    expect(gradeInsights({ items: new Array(6).fill(null), removed: 2 }).score).toBeCloseTo(0.75);
    const bios = gradeBios(
      {
        instagram: { bio: "Fresh bread in Austin.", by: "ai", notes: [] },
        facebook: { bio: "Bread.", by: "ai", notes: ["Took out a price or discount you didn’t give."] },
        google_business: { bio: "Plain.", by: "rule", notes: [] },
      },
      ["instagram", "facebook", "google_business"],
    );
    expect(bios).toMatchObject({ checks: { clean: 1, cleanerChanged: 1, replacedByRule: 1 } });
    expect(bios.score).toBeCloseTo(1 / 3);
  });

  it("grades the brand picture against its prompt's rules", () => {
    const good = gradeStory("Rise Bakery is a porch swing on a warm evening. A customer smells bread through the screen door.", { name: "Rise Bakery", tagline: "" });
    expect(good.score).toBe(1);
    const bad = gradeStory("The best bakery in town.", { name: "Rise Bakery", tagline: "" });
    expect(bad.checks).toMatchObject({ startsWithName: false, noClaims: false, twoOrThreeSentences: false });
  });

  it("flags numbers, money, contact details and ID numbers the inputs don't contain", () => {
    expect(gradeBusinessPlan([{ key: "money", heading: "", body: "", flags: ["Check “$5,000”"] }, { key: "summary", heading: "", body: "", flags: [] }], 10).checks).toMatchObject({ sectionsWritten: 0.2, sectionsWithoutUnknownNumbers: 0.5, unknownNumbers: 1 });
    expect(gradeExplain(["It costs $29 a month.", "Easy to use."], []).checks).toMatchObject({ noMoneyInReply: false, partsWithMoney: 1 });
    expect(gradeExplain(["Easy to use."], []).score).toBe(1);
    const copy = { headline: "", subheadline: "", intro: "Call 512-555-0199.", about: "", offerings: [], howToBuy: "", contact: "hello@risebakery.example", faq: [{ question: "q", answer: "a" }, { question: "q", answer: "a" }, { question: "q", answer: "a" }], seoTitle: "", seoDescription: "", flags: [], platform: "square" as const, generatedAt: "", simulated: false };
    expect(gradeWebsite(copy, ["hello@risebakery.example"]).checks).toMatchObject({ noInventedContact: false, faqThreeToSix: true });
    const guide = {
      purpose: "",
      purposeAnchor: null,
      whoFilesIt: "",
      gather: [],
      fieldHelp: [],
      guidance: [],
      createdAt: "",
      simulated: false,
      flags: [],
      received: { whatItIs: "Your EIN 12-3456789", whatItIsAnchor: { page: 1, excerpt: "x", fieldId: null }, from: "", meaning: "", todo: [{ text: "", deadline: "April 30, 2027", amount: null, anchor: null }], stepKey: "ein", notGovernment: null, sites: [] },
    };
    expect(gradeReceived(guide, bakery.received.expected).checks).toMatchObject({ noIdNumbers: false, rightStep: true, deadlinesKept: 1, notGovernmentSpotted: true });
  });

  it("grades drafted form answers against the facts each blank should use", () => {
    const answer = (source: string) => ({ value: "v", source, state: source ? ("suggested" as const) : ("unanswered" as const), note: "" });
    const grade = gradeFormDraft({ f1: answer("profile.name"), f2: answer("profile.name"), f3: answer("") }, { f1: "profile.name", f2: null, f3: null, f4: "profile.county" });
    expect(grade).toMatchObject({ score: 0.5, checks: { right: 2, wrongFills: 1, missed: 1 } });
  });

  it("passes a lettering check only when it agrees with the spelling", () => {
    const check = (status: "matches" | "misspelled") => ({ checkedAt: "", method: "ai" as const, lettering: { status, read: [], problems: [], note: null }, drift: [] });
    expect(gradeLettering(check("matches"), true).score).toBe(1);
    expect(gradeLettering(check("matches"), false).score).toBe(0);
    expect(gradeLettering(check("misspelled"), false).score).toBe(1);
    expect(gradeLettering({ checkedAt: "", method: "skipped", lettering: null, drift: [] }, true).score).toBeNull();
  });

  it("grades a transcription by the words it got right", () => {
    const content = { readMethod: "ai_reading" as const, pages: [{ number: 1, text: "Franchise Tax Notice. Due May 15." }], fields: [], unclear: [], readAt: null, simulated: false };
    // franchise, tax, notice, due, may found; 2027 missing
    expect(gradeDocumentRead(content, ["FRANCHISE TAX NOTICE", "DUE MAY 15, 2027"]).score).toBeCloseTo(5 / 6);
    expect(gradeDocumentRead({ ...content, readMethod: "none" }, ["x"]).score).toBeNull();
  });
});

describe("synthetic pictures", () => {
  it("draws real PNGs at the size asked", () => {
    const logo = logoImage("RISE BAKERY", "#1F3A2E");
    expect(imageInfo(logo.data)).toMatchObject({ type: "image/png", width: 1024, height: 640 });
    const canvas = new Canvas(4, 2, [0, 0, 0]);
    canvas.fillRect(0, 0, 1, 1, [255, 0, 0]);
    expect([...canvas.pixels.slice(0, 6)]).toEqual([255, 0, 0, 0, 0, 0]);
  });
});

describe("report", () => {
  it("takes nearest-rank percentiles", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBeNull();
  });

  it("labels practice runs and unchecked prices", () => {
    const run: RunRecord = { task: "intake", case: "home-bakery", repeat: 1, status: "ok", reason: null, ms: 10, fallback: null, grade: { score: 1, checks: {} }, transportRetries: 0, calls: [] };
    const info = { startedAt: "", finishedAt: "", provider: { name: "Mock", model: "mock", simulated: true }, options: {}, prices: UNPRICED, budget: null };
    const text = summaryMarkdown(info, [run], new Map());
    expect(text).toMatch(/Practice mode \(mock provider\)/);
    expect(text).toMatch(/not checked for some-other-model/);
    expect(text).toMatch(/\| intake \| 1 \| 100% \|/);
  });
});
