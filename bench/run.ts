import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getImageModel, getModel, type ImageModel, type ModelProvider, MUSE_DEFAULTS } from "@/lib/ai";
import { ArgsError, liveRefusal, parseArgs, USAGE } from "./args";
import { Budget, BudgetReached } from "./budget";
import { type BenchCase, CASES } from "./cases";
import { runScenario, type ScenarioResult, totalsLine, totalsOf, writeIndex } from "./image-quality";
import { IMAGE_SCENARIOS, type ImageScenario } from "./image-scenarios";
import { type Prices, pricesFor } from "./pricing";
import { Recorder } from "./recorder";
import { type RunInfo, type RunRecord, summaryMarkdown } from "./report";
import { type Task, TASKS } from "./tasks";

// npm run bench: calls each AI feature the way its server action does, records every call, grades the output in code,
// and writes bench/results/<timestamp>/. Mock by default; Muse only with --live, --yes and --budget.

const ROOT = path.resolve(__dirname, "..");
const SHARED: BenchCase = { ...CASES[0], id: "shared", label: "Same input for every case" };

function pick<T extends { id: string }>(all: readonly T[], wanted: string[] | null, what: string): T[] {
  if (!wanted) return [...all];
  const unknown = wanted.filter((id) => !all.some((each) => each.id === id));
  if (unknown.length) throw new ArgsError(`Unknown ${what}: ${unknown.join(", ")}. Known: ${all.map((each) => each.id).join(", ")}`);
  return all.filter((each) => wanted.includes(each.id));
}

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).replace(/\s+/g, " ").slice(0, 300);

async function main(): Promise<number> {
  let options;
  let tasks: Task[];
  let cases: BenchCase[];
  let scenarios: ImageScenario[];
  try {
    options = parseArgs(process.argv.slice(2));
    tasks = pick(TASKS, options.tasks, "task");
    cases = pick(CASES, options.cases, "case");
    scenarios = pick(IMAGE_SCENARIOS, options.scenarios, "scenario");
  } catch (error) {
    if (!(error instanceof ArgsError)) throw error;
    console.error(`${error.message}\n\n${USAGE}`);
    return 2;
  }
  if (options.help) {
    console.log(`${USAGE}\n\nTasks: ${TASKS.map((task) => task.id).join(", ")}\nCases: ${CASES.map((each) => each.id).join(", ")}\nScenarios: ${IMAGE_SCENARIOS.map((each) => each.id).join(", ")}`);
    return 0;
  }

  const live = options.provider === "muse";
  // The key is read from .env.local only for a live run, and never printed
  if (live) (await import("@next/env")).loadEnvConfig(ROOT, false, { info: () => {}, error: console.error });
  const env: Record<string, string | undefined> = { ...process.env, AI_PROVIDER: options.provider };
  // The mock is priced as Muse would be, so its estimates show what a live run might cost
  const prices = pricesFor(live ? env.MUSE_MODEL || MUSE_DEFAULTS.model : MUSE_DEFAULTS.model);
  const refusal = liveRefusal(options, prices);
  if (refusal) {
    console.error(refusal);
    return 1;
  }

  const budget = live ? new Budget(options.budgetUsd!) : null;
  const recorder = new Recorder(prices, budget);
  const model = recorder.wrapModel(getModel(env));
  const innerImage = getImageModel(env);
  const image = innerImage ? recorder.wrapImage(innerImage) : null;
  if (options.imageQuality) {
    try {
      return await imageQualityRun({ model, image, recorder, budget, prices, scenarios });
    } finally {
      recorder.close();
    }
  }
  // Pictures are free in practice mode; live, each is billed
  const imagesOn = !live || options.images;
  const now = new Date();
  const startedAt = now.toISOString();
  const runs: RunRecord[] = [];

  const plan = Array.from({ length: options.repeat }, (_, index) => index + 1).flatMap((repeat) =>
    tasks.flatMap((task) => (task.shared ? [SHARED] : cases).map((each) => ({ task, each, repeat }))),
  );
  console.log(`SnapStart AI benchmark: ${plan.length} runs on ${model.name} (${model.model})${live ? `, budget $${options.budgetUsd}` : ", practice mode"}\n`);

  // The app's own per-call log lines repeat what's recorded here
  const info = console.info;
  console.info = () => {};
  try {
    for (const [index, { task, each, repeat }] of plan.entries()) {
      const base = { task: task.id, case: each.id, repeat, ms: 0, fallback: null, grade: null, transportRetries: 0, calls: [] };
      const skip =
        budget?.stopped ? "Budget reached" : task.kind === "image" && !imagesOn ? "Image tasks are off; pass --images (billed per picture)" : task.kind === "image" && !image ? "No image model for this provider" : null;
      if (skip) {
        runs.push({ ...base, status: "skipped", reason: skip });
        continue;
      }
      recorder.beginRun();
      const started = Date.now();
      let record: RunRecord;
      try {
        const result = await task.run(
          {
            model,
            image,
            now,
            replies: (name) => recorder.repliesFor(name),
            succeeded: (name) => recorder.current().calls.some((call) => call.name === name && call.outcome === "ok"),
          },
          each,
        );
        const { calls, retries } = recorder.current();
        record = result.skipped
          ? { ...base, status: "skipped", reason: result.skipped, ms: Date.now() - started, transportRetries: retries, calls }
          : { ...base, status: "ok", reason: null, ms: Date.now() - started, fallback: result.fallback ?? null, grade: result.grade, transportRetries: retries, calls };
      } catch (error) {
        const { calls, retries } = recorder.current();
        const budgetHit = error instanceof BudgetReached || budget?.stopped;
        record = { ...base, status: budgetHit && !calls.length ? "skipped" : "failed", reason: describe(error), ms: Date.now() - started, transportRetries: retries, calls };
      }
      runs.push(record);
      const score = record.grade?.score;
      console.log(
        `[${index + 1}/${plan.length}] ${task.id} × ${each.id}${options.repeat > 1 ? ` #${repeat}` : ""}: ${record.status}, ${(record.ms / 1000).toFixed(2)} s, ${record.calls.length} calls${score === null || score === undefined ? "" : `, quality ${Math.round(score * 100)}%`}${record.reason ? ` (${record.reason})` : ""}`,
      );
    }
  } finally {
    console.info = info;
    recorder.close();
  }

  const runInfo: RunInfo = {
    startedAt,
    finishedAt: new Date().toISOString(),
    provider: { name: model.name, model: model.model, simulated: model.simulated },
    options: { ...options },
    prices,
    budget: budget ? { limitUsd: budget.limitUsd, spentUsd: budget.spent } : null,
  };
  const dir = path.join(ROOT, "bench", "results", startedAt.replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "results.json"), `${JSON.stringify({ ...runInfo, runs }, null, 2)}\n`);
  const summary = summaryMarkdown(runInfo, runs, new Map(TASKS.map((task) => [task.id, task.title])));
  writeFileSync(path.join(dir, "summary.md"), `${summary}\n`);
  console.log(`\n${summary}\nWrote ${path.relative(ROOT, dir)}/results.json and summary.md`);
  return 0;
}

async function imageQualityRun(input: {
  model: ModelProvider;
  image: ImageModel | null;
  recorder: Recorder;
  budget: Budget | null;
  prices: Prices;
  scenarios: ImageScenario[];
}): Promise<number> {
  const { model, image, recorder, budget, prices, scenarios } = input;
  if (!image?.generate) {
    console.error("This provider has no image model that can draw, so there's nothing to judge.");
    return 1;
  }
  const now = new Date();
  const startedAt = now.toISOString();
  const dir = path.join(ROOT, "bench", "results", startedAt.replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  console.log(`SnapStart image-quality run: ${scenarios.length} scenarios, pictures by ${image.name} (${image.model})${budget ? `, budget $${budget.limitUsd}` : ", practice mode"}\n`);

  const results: ScenarioResult[] = [];
  const info = console.info;
  console.info = () => {};
  recorder.beginRun();
  try {
    for (const scenario of scenarios) {
      const started = Date.now();
      const result = await runScenario({ model, image, prices, budget, now, dir }, scenario);
      results.push(result);
      const made = result.pictures.filter((picture) => picture.status === "made").length;
      console.log(`${scenario.id}: ${made} of ${result.pictures.length} pictures, ${((Date.now() - started) / 1000).toFixed(1)} s${result.notes.length ? ` (${result.notes.join("; ")})` : ""}`);
    }
  } finally {
    console.info = info;
  }

  const finishedAt = new Date().toISOString();
  const totals = totalsOf(results, recorder.current().calls, Date.parse(finishedAt) - now.getTime());
  writeIndex(
    dir,
    {
      startedAt,
      finishedAt,
      provider: { name: model.name, model: model.model, simulated: model.simulated },
      imageModel: { name: image.name, model: image.model, simulated: image.simulated },
      prices,
      budget: budget ? { limitUsd: budget.limitUsd, spentUsd: budget.spent } : null,
    },
    results,
    totals,
  );
  console.log(`\n${totalsLine(totals, model.simulated || image.simulated)}\nWrote ${path.relative(ROOT, dir)}/index.md, images.json and images/`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(describe(error));
    process.exitCode = 1;
  },
);
