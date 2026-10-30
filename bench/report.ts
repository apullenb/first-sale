import type { Grade } from "./graders";
import type { Prices } from "./pricing";
import type { CallRecord } from "./recorder";

// Turns every run into results.json and a summary table per task

export interface RunRecord {
  task: string;
  case: string;
  repeat: number;
  status: "ok" | "failed" | "skipped";
  // Why it failed or was skipped
  reason: string | null;
  ms: number;
  fallback: string | null;
  grade: Grade | null;
  // Temporary provider failures retried during the run
  transportRetries: number;
  calls: CallRecord[];
}

export interface RunInfo {
  startedAt: string;
  finishedAt: string;
  provider: { name: string; model: string; simulated: boolean };
  options: Record<string, unknown>;
  prices: Prices;
  budget: { limitUsd: number; spentUsd: number } | null;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const mean = (values: readonly number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

// Provider counts when there are any; otherwise the text-length estimate
function tokens(call: CallRecord) {
  if (call.usage) return { input: call.usage.inputTokens, cached: call.usage.cachedInputTokens, output: call.usage.outputTokens, reasoning: call.usage.reasoningTokens, estimated: false };
  return { input: call.estimated.inputTokens, cached: 0, output: call.estimated.outputTokens, reasoning: 0, estimated: true };
}

export interface TaskStats {
  task: string;
  title: string;
  runs: number;
  skipped: number;
  ok: number;
  calls: number;
  modelCalls: number;
  cutOffs: number;
  invalid: number;
  repairs: number;
  transportRetries: number;
  fallbacks: number;
  runMs: { p50: number | null; p95: number | null };
  avgIn: number | null;
  avgCached: number | null;
  avgOut: number | null;
  cacheHit: number | null;
  estimatedTokens: boolean;
  costPerCall: number | null;
  costPerRun: number | null;
  quality: number | null;
  graded: number;
  weakChecks: string[];
}

export function taskStats(task: string, title: string, runs: readonly RunRecord[]): TaskStats {
  const attempted = runs.filter((run) => run.status !== "skipped");
  const calls = attempted.flatMap((run) => run.calls);
  const model = calls.filter((call) => call.kind !== "image");
  const counted = model.map(tokens);
  const real = counted.filter((each) => !each.estimated);
  const costs = calls.flatMap((call) => (call.costUsd === null ? [] : [call.costUsd]));
  const scores = attempted.flatMap((run) => (run.grade?.score === null || run.grade?.score === undefined ? [] : [run.grade.score]));
  const okRuns = attempted.filter((run) => run.status === "ok");
  // Checks that failed most often, for "weakest quality"
  const failed = new Map<string, number>();
  for (const run of attempted) {
    for (const [name, value] of Object.entries(run.grade?.checks ?? {})) {
      if (value === false || (typeof value === "number" && value < 1 && /^(recall|precision|citationAccuracy|unsureKeptOpen|blanksFound|everyBlankExplained|deadlinesKept|sectionsWritten|sectionsWithoutUnknownNumbers|wordRecall|highConfidence)$/.test(name))) {
        failed.set(name, (failed.get(name) ?? 0) + 1);
      }
    }
  }
  const inputTotal = sum(real.map((each) => each.input));
  return {
    task,
    title,
    runs: attempted.length,
    skipped: runs.length - attempted.length,
    ok: okRuns.length,
    calls: calls.length,
    modelCalls: model.length,
    cutOffs: calls.filter((call) => call.finishReason === "length" || call.outcome === "cut_off").length,
    invalid: calls.filter((call) => call.outcome === "invalid").length,
    repairs: calls.filter((call) => (call.attempt ?? 0) > 0).length,
    transportRetries: sum(attempted.map((run) => run.transportRetries)),
    fallbacks: attempted.filter((run) => run.fallback).length,
    runMs: { p50: percentile(okRuns.map((run) => run.ms), 50), p95: percentile(okRuns.map((run) => run.ms), 95) },
    avgIn: mean(counted.map((each) => each.input)),
    avgCached: mean(counted.map((each) => each.cached)),
    avgOut: mean(counted.map((each) => each.output)),
    cacheHit: real.length && inputTotal ? sum(real.map((each) => each.cached)) / inputTotal : null,
    estimatedTokens: counted.some((each) => each.estimated),
    costPerCall: costs.length ? sum(costs) / costs.length : null,
    costPerRun: costs.length && attempted.length ? sum(costs) / attempted.length : null,
    quality: mean(scores),
    graded: scores.length,
    weakChecks: [...failed].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => `${name} (${count})`),
  };
}

export interface CallStats {
  name: string;
  calls: number;
  failed: number;
  invalid: number;
  cutOffs: number;
  p50: number | null;
  p95: number | null;
  avgIn: number | null;
  avgCached: number | null;
  avgOut: number | null;
  avgReasoning: number | null;
  costPerCall: number | null;
}

export function callStats(runs: readonly RunRecord[]): CallStats[] {
  const byName = new Map<string, CallRecord[]>();
  for (const call of runs.flatMap((run) => run.calls)) byName.set(call.name, [...(byName.get(call.name) ?? []), call]);
  return [...byName].map(([name, calls]) => {
    const counted = calls.map(tokens);
    const costs = calls.flatMap((call) => (call.costUsd === null ? [] : [call.costUsd]));
    const ms = calls.filter((call) => call.ok).map((call) => call.ms);
    return {
      name,
      calls: calls.length,
      failed: calls.filter((call) => !call.ok).length,
      invalid: calls.filter((call) => call.outcome === "invalid").length,
      cutOffs: calls.filter((call) => call.finishReason === "length" || call.outcome === "cut_off").length,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      avgIn: calls[0].kind === "image" ? null : mean(counted.map((each) => each.input)),
      avgCached: calls[0].kind === "image" ? null : mean(counted.map((each) => each.cached)),
      avgOut: calls[0].kind === "image" ? null : mean(counted.map((each) => each.output)),
      avgReasoning: calls[0].kind === "image" ? null : mean(counted.map((each) => each.reasoning)),
      costPerCall: costs.length ? sum(costs) / costs.length : null,
    };
  });
}

const pct = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`);
const num = (value: number | null) => (value === null ? "–" : Math.round(value).toLocaleString("en-US"));
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`);
const usd = (value: number | null, priced: boolean) => (!priced ? "price not checked" : value === null ? "–" : `$${value < 0.01 ? value.toFixed(5) : value.toFixed(4)}`);

export function summaryMarkdown(info: RunInfo, runs: readonly RunRecord[], titles: ReadonlyMap<string, string>): string {
  const priced = info.prices.inputPerMTok !== null;
  const tasks = [...new Set(runs.map((run) => run.task))].map((task) =>
    taskStats(task, titles.get(task) ?? task, runs.filter((run) => run.task === task)),
  );
  const mock = info.provider.simulated;
  const lines: string[] = [];
  lines.push(`# First Sale AI benchmark`);
  lines.push("");
  if (mock) {
    lines.push(
      "> **Practice mode (mock provider).** Every answer comes from a built-in fixture, so quality, latency and cut-off numbers here are not meaningful.",
      "> Tokens are estimated from text length (about 4 characters a token), and costs are what those prompts would cost on Muse; mock replies are short, so output is understated.",
      "",
    );
  }
  lines.push(`- Provider: ${info.provider.name} (${info.provider.model})`);
  lines.push(`- Started ${info.startedAt}, finished ${info.finishedAt}`);
  lines.push(
    priced
      ? `- Prices: ${info.prices.model}, $${info.prices.inputPerMTok}/M input, $${info.prices.cachedInputPerMTok}/M cached, $${info.prices.outputPerMTok}/M output, $${info.prices.searchPerQuery} per search query, $${info.prices.imagePerPicture} per image (${info.prices.source}, checked ${info.prices.checked})`
      : `- Prices: not checked for ${info.prices.model}; tokens only`,
  );
  if (info.budget) lines.push(`- Budget: $${info.budget.spentUsd.toFixed(4)} of $${info.budget.limitUsd.toFixed(2)} spent (estimated)`);
  const allCalls = runs.flatMap((run) => run.calls);
  const totalCost = sum(allCalls.flatMap((call) => (call.costUsd === null ? [] : [call.costUsd])));
  lines.push(`- Runs: ${runs.filter((run) => run.status !== "skipped").length} (${runs.filter((run) => run.status === "skipped").length} skipped), calls: ${allCalls.length}, est. total: ${usd(totalCost, priced)}`);
  lines.push("");

  const costly = tasks.filter((stats) => (priced ? stats.costPerRun !== null : stats.avgIn !== null)).sort((a, b) =>
    priced ? (b.costPerRun ?? 0) - (a.costPerRun ?? 0) : (b.avgIn ?? 0) * b.modelCalls - (a.avgIn ?? 0) * a.modelCalls,
  );
  lines.push("## Biggest costs");
  lines.push("");
  for (const stats of costly.slice(0, 5)) {
    lines.push(`- **${stats.task}**: ${usd(stats.costPerRun, priced)} a run, ${(stats.calls / Math.max(1, stats.runs)).toFixed(1)} calls, ~${num(stats.avgIn)} tokens in and ${num(stats.avgOut)} out per call`);
  }
  lines.push("");
  const weakest = tasks.filter((stats) => stats.quality !== null).sort((a, b) => (a.quality ?? 0) - (b.quality ?? 0));
  lines.push("## Weakest quality");
  lines.push("");
  if (!weakest.length) lines.push("- No graded runs.");
  for (const stats of weakest.slice(0, 5)) {
    lines.push(`- **${stats.task}**: ${pct(stats.quality)}${stats.weakChecks.length ? `, most often failed: ${stats.weakChecks.join(", ")}` : ""}`);
  }
  const failedRuns = runs.filter((run) => run.status === "failed");
  if (failedRuns.length) {
    lines.push("");
    lines.push("## Failed runs");
    lines.push("");
    for (const run of failedRuns.slice(0, 12)) lines.push(`- ${run.task} × ${run.case}: ${run.reason}`);
  }
  lines.push("");

  lines.push("## By task");
  lines.push("");
  lines.push(`Tokens are per model call${tasks.some((stats) => stats.estimatedTokens) ? " (~ = estimated from text length)" : ""}. Latency is the whole task, as an owner waits for it. Quality is graded in code, 0–100%.`);
  lines.push("");
  lines.push("| Task | Runs | Success | Cut-off | Retries | p50 | p95 | Tokens in | Cached | Out | Cache hit | Est. cost / call | Quality |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const stats of tasks) {
    const tilde = stats.estimatedTokens ? "~" : "";
    const quality = stats.quality === null ? (stats.runs ? "not graded" : "skipped") : `${pct(stats.quality)} (${stats.graded})`;
    lines.push(
      `| ${stats.task} | ${stats.runs}${stats.skipped ? ` (+${stats.skipped} skipped)` : ""} | ${pct(stats.runs ? stats.ok / stats.runs : null)} | ${pct(stats.modelCalls ? stats.cutOffs / stats.modelCalls : null)} | ${stats.repairs + stats.transportRetries} | ${secs(stats.runMs.p50)} | ${secs(stats.runMs.p95)} | ${tilde}${num(stats.avgIn)} | ${num(stats.avgCached)} | ${tilde}${num(stats.avgOut)} | ${pct(stats.cacheHit)} | ${usd(stats.costPerCall, priced)} | ${quality} |`,
    );
  }
  lines.push("");
  lines.push("Retries count schema repairs plus retried provider errors. Fallbacks (rules or a fixture standing in for the model) per task:");
  lines.push("");
  for (const stats of tasks.filter((each) => each.fallbacks)) lines.push(`- ${stats.task}: ${stats.fallbacks} of ${stats.runs} runs`);
  if (!tasks.some((each) => each.fallbacks)) lines.push("- None.");
  lines.push("");

  lines.push("## By call");
  lines.push("");
  lines.push("| Call | Calls | Failed | Schema fails | Cut-off | p50 | p95 | In | Cached | Out | Reasoning | Est. cost / call |");
  lines.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const stats of callStats(runs)) {
    lines.push(
      `| ${stats.name} | ${stats.calls} | ${stats.failed} | ${stats.invalid} | ${stats.cutOffs} | ${secs(stats.p50)} | ${secs(stats.p95)} | ${num(stats.avgIn)} | ${num(stats.avgCached)} | ${num(stats.avgOut)} | ${num(stats.avgReasoning)} | ${usd(stats.costPerCall, priced)} |`,
    );
  }
  lines.push("");

  const notes = [...new Set(runs.flatMap((run) => (run.grade?.note ? [`${run.task}: ${run.grade.note}`] : [])))];
  const skipped = [...new Set(runs.filter((run) => run.status === "skipped").map((run) => `${run.task}: ${run.reason}`))];
  if (notes.length || skipped.length) {
    lines.push("## Notes");
    lines.push("");
    for (const note of [...skipped, ...notes]) lines.push(`- ${note}`);
    lines.push("");
  }
  return lines.join("\n");
}
