import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { getModel, MUSE_DEFAULTS } from "@/lib/ai";
import { classify, placeOf, structureOf } from "@/lib/research/applicability";
import { followUpCandidates, type FollowUpResult, followUpRequirements } from "@/lib/research/follow-up";
import { type ResearchedRequirement, researchRequirements, TIME_LIMIT_MS } from "@/lib/research/requirements";
import { buildPlan } from "@/lib/rules/plan";
import { Budget } from "./budget";
import { pricesFor } from "./pricing";
import { Recorder } from "./recorder";
import { VALIDATION_CASES } from "./validation-cases";

// npx tsx bench/validate.ts --case <id> --live --yes [--budget 3] [--env-file .env.validation.local]: runs one business through the requirements check the way
// the app does (research, then the deeper look that follows it, then the plan) and saves what the owner would see to
// docs/validation/runs/<date>/<case>.json. Only what's shown to the owner is kept: no page text, no prompts.

const ROOT = path.resolve(__dirname, "..");

function arg(name: string): string | null {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? (process.argv[at + 1] ?? null) : null;
}

// Mirrors saveFollowUpForOwner (src/lib/data/research.ts): re-read quotes, then confirmations, then decisions
export function applyFollowUp(requirements: readonly ResearchedRequirement[], result: FollowUpResult | null) {
  const rows = new Map(requirements.map((each) => [each.key, { ...each, verdict: null as string | null, background: "", trail: null as unknown }]));
  if (!result) return [...rows.values()];
  for (const each of result.rechecked) {
    const row = rows.get(each.key);
    if (row) Object.assign(row, { verification: each.verification, claimsChecked: each.claimsChecked ?? false, problems: each.problems, feeUsd: each.feeUsd, deadline: each.deadline, renewal: each.renewal, renewalFeeUsd: each.renewalFeeUsd });
  }
  const settled = { applicability: "applies" as const, condition: "" };
  for (const each of result.confirmed) {
    const row = rows.get(each.key);
    if (row) Object.assign(row, { ...settled, sourceIds: each.sourceIds, evidence: each.evidence, feeUsd: each.feeUsd, deadline: each.deadline, verification: "sourced", claimsChecked: each.claimsChecked ?? false, problems: [], background: "", verdict: "applies", trail: null });
  }
  for (const note of result.notes) {
    const row = rows.get(note.key);
    if (!row) continue;
    const quoted = note.evidence ? { sourceIds: note.sourceIds, evidence: note.evidence, verification: "sourced" as const, claimsChecked: true, problems: [] } : {};
    Object.assign(row, { ...settled, ...quoted, background: note.background, verdict: note.verdict, trail: note.trail, ...(note.questions.length ? { whatToAsk: note.questions } : {}) });
  }
  return [...rows.values()];
}

// Each model call and search in order: what it was, how long it took, and how it ended
function callLog(calls: ReturnType<Recorder["current"]>["calls"]) {
  return calls.map((call) => ({ kind: call.kind, name: call.name, effort: call.effort, ms: call.ms, ok: call.ok, error: call.error?.slice(0, 120) ?? null }));
}

async function main(): Promise<number> {
  const id = arg("case");
  const each = VALIDATION_CASES.find((candidate) => candidate.id === id);
  if (!each) {
    console.error(`Pass --case with one of: ${VALIDATION_CASES.map((candidate) => candidate.id).join(", ")}`);
    return 2;
  }
  const live = process.argv.includes("--live");
  if (live && !process.argv.includes("--yes")) {
    console.error("A live run calls the AI service and is billed. Add --yes to go ahead.");
    return 1;
  }
  if (live) {
    (await import("@next/env")).loadEnvConfig(ROOT, false, { info: () => {}, error: console.error });
    // A key kept apart from .env.local for this run only, such as a temporary one
    const file = arg("env-file");
    if (file) Object.assign(process.env, parseEnv(readFileSync(path.resolve(ROOT, file), "utf8")));
  }
  const env: Record<string, string | undefined> = { ...process.env, AI_PROVIDER: live ? "muse" : "mock" };
  const prices = pricesFor(live ? env.MUSE_MODEL || MUSE_DEFAULTS.model : MUSE_DEFAULTS.model);
  const budget = new Budget(Number(arg("budget") ?? 3));
  const recorder = new Recorder(prices, budget);
  const model = recorder.wrapModel(getModel(env));
  const now = new Date();
  const place = placeOf(each.profile);
  // --time-limit raises the app's time limits for this run only; the default is what the requirements page allows
  const timeLimitMs = arg("time-limit") ? Number(arg("time-limit")) * 1000 : undefined;
  const decision = structureOf(each.profile, each.details);

  const info = console.info;
  console.info = () => {};
  recorder.beginRun();
  const started = Date.now();
  let output: Record<string, unknown>;
  try {
    const research = await researchRequirements(model, each.profile, { details: each.details, now, timeLimitMs });
    const researchMs = Date.now() - started;
    const candidates = followUpCandidates(research.requirements);
    const open = research.openQuestions.filter((question) => !question.answer);
    // As in the app: research is kept when the deeper look fails, and the deeper look runs again later
    let followUpError: string | null = null;
    const followUp =
      candidates.length || open.length
        ? await followUpRequirements(model, each.profile, place, candidates, { open, now, budgetMs: timeLimitMs }).catch((error: unknown) => {
            followUpError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
            return null;
          })
        : null;
    const followUpMs = Date.now() - started - researchMs;

    const pages = [...research.pages, ...(followUp?.pages ?? [])];
    const applied = applyFollowUp(research.requirements, followUp).map((row) => ({ ...row, ...classify(row as Parameters<typeof classify>[0], each.profile, place, decision) }));
    const plan = buildPlan(
      applied as Parameters<typeof buildPlan>[0],
      pages.map((page) => ({ id: page.id, title: page.title, url: page.url, government: page.government, retrievedAt: page.retrievedAt })),
      model.simulated,
      { place, offices: followUp?.offices ?? [] },
    );
    const urlOf = new Map(pages.map((page) => [page.id, page.url]));
    const answered = new Map((followUp?.answers ?? []).map((answer) => [answer.question, answer.answer]));
    const { calls, fallbacks } = recorder.current();
    const usd = calls.reduce((sum, call) => sum + (call.costUsd ?? 0), 0);
    output = {
      case: each.id,
      label: each.label,
      model: `${model.name} (${model.model})`,
      simulated: model.simulated,
      ranAt: now.toISOString(),
      timeLimitSeconds: (timeLimitMs ?? TIME_LIMIT_MS) / 1000,
      ms: { research: researchMs, followUp: followUpMs, total: Date.now() - started },
      cost: {
        usd: Math.round(usd * 10_000) / 10_000,
        modelCalls: calls.filter((call) => call.kind === "completion").length,
        searches: calls.filter((call) => call.kind === "search").length,
        inputTokens: calls.reduce((sum, call) => sum + (call.usage?.inputTokens ?? 0), 0),
        outputTokens: calls.reduce((sum, call) => sum + (call.usage?.outputTokens ?? 0), 0),
        failedCalls: calls.filter((call) => !call.ok).map((call) => `${call.name}: ${call.error ?? call.outcome}`),
        // Slow calls that got a lower-effort backup (generateObjectInTime)
        fallbacks,
      },
      calls: callLog(calls),
      claimsCheckedInResearch: research.claimsChecked,
      followUp: followUp ? { candidates: candidates.length, rounds: followUp.rounds, confirmed: followUp.confirmed.length, rechecked: followUp.rechecked.length } : null,
      followUpError,
      pages: pages.map((page) => ({ id: page.id, title: page.title, url: page.url, level: page.level, government: page.government, discovered: page.discovered })),
      unread: research.unread.map(({ title, url, reason }) => ({ title, url, reason })),
      requirements: applied.map((row) => ({
        key: row.key,
        title: row.title,
        level: row.level,
        topic: row.topic,
        agency: row.agency,
        status: row.status,
        verification: row.verification,
        claimsChecked: row.claimsChecked ?? null,
        verdict: row.verdict,
        timing: row.timing,
        fitsStructure: row.fitsStructure,
        conditions: row.conditions,
        feeUsd: row.feeUsd,
        deadline: row.deadline,
        sources: row.sourceIds.map((sourceId) => urlOf.get(sourceId) ?? sourceId),
        evidence: row.evidence,
        why: row.whyItApplies,
        background: row.background,
        problems: row.problems,
        trail: row.trail,
      })),
      plan: plan.map((step) => ({ key: step.key, title: step.title, status: step.requirementStatus, level: step.level, timing: step.timing, feeCents: step.feeCents, deadline: step.deadline, links: step.links.map((link) => ({ url: link.url, confirms: link.confirms })) })),
      openQuestions: research.openQuestions.map((question) => ({ question: question.question, answer: answered.get(question.question) ?? null })),
      coverage: research.coverage,
      conflicts: research.conflicts,
    };
  } catch (error) {
    const { calls } = recorder.current();
    output = { case: each.id, label: each.label, failed: error instanceof Error ? `${error.name}: ${error.message}` : String(error), ms: { total: Date.now() - started }, calls: callLog(calls) };
  } finally {
    console.info = info;
    recorder.close();
  }

  const dir = path.join(ROOT, "docs", "validation", "runs", now.toISOString().slice(0, 10));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${each.id}.json`), `${JSON.stringify(output, null, 2)}\n`);
  console.log(`${each.id}: ${"failed" in output ? `FAILED ${output.failed}` : `${(output.requirements as unknown[]).length} requirements, ${(output.plan as unknown[]).length} steps`} in ${Math.round(((output.ms as { total: number }).total) / 1000)} s`);
  return "failed" in output ? 1 : 0;
}

main().then((code) => process.exit(code));
