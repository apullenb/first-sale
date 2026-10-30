import { type AIEvent, type ImageModel, type ModelProvider, onAIEvent } from "@/lib/ai";
import type { TokenUsage } from "@/lib/ai/types";
import {
  type Budget,
  estimateRequest,
  searchCost,
  tokenCost,
  tokensIn,
  worstCaseCompletion,
  worstCaseSearch,
} from "./budget";
import type { Prices } from "./pricing";

// Wraps the model and image providers the tasks use: times each call, keeps its token counts and outcome,
// and asks the live budget before each one starts. Reply text stays in memory for the graders and is never saved.

export interface CallRecord {
  kind: "completion" | "search" | "image";
  // Schema name, "web_search", "image_generate" or "image_edit"
  name: string;
  // 0 for the first reply in generateObject, 1+ for repairs after a reply failed the schema
  attempt: number | null;
  ms: number;
  ok: boolean;
  error: string | null;
  finishReason: string | null;
  outcome: "ok" | "invalid" | "cut_off" | "error" | null;
  // What the schema check said, when a reply failed it
  problem: string | null;
  // As the provider reported; null for the mock
  usage: TokenUsage | null;
  // From text length, for runs without provider counts
  estimated: { inputTokens: number; outputTokens: number; images: number };
  maxOutputTokens: number | null;
  effort: string | null;
  // Temporary failures retried inside this call
  retries: number;
  queries: number | null;
  // Answered by a practice-mode fixture, not a model
  fixture: boolean;
  costUsd: number | null;
  // Cost from text-length estimates rather than provider counts
  costEstimated: boolean;
}

// Default cap when a call doesn't set one, for the worst-case estimate
const DEFAULT_MAX_OUTPUT = 16_000;

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 240);

export class Recorder {
  private calls: CallRecord[] = [];
  private replies = new Map<string, string[]>();
  private retries = 0;
  private readonly inFlight = new Set<CallRecord>();
  private readonly stop: () => void;

  constructor(
    private readonly prices: Prices,
    private readonly budget: Budget | null,
  ) {
    this.stop = onAIEvent((event) => this.onEvent(event));
  }

  beginRun(): void {
    this.calls = [];
    this.replies = new Map();
    this.retries = 0;
  }

  // Calls so far in the current run
  current(): { calls: CallRecord[]; retries: number } {
    return { calls: this.calls, retries: this.retries };
  }

  // Raw replies for one schema in this run, oldest first
  repliesFor(name: string): string[] {
    return this.replies.get(name) ?? [];
  }

  close(): void {
    this.stop();
  }

  private record(fields: Partial<CallRecord> & Pick<CallRecord, "kind" | "name">): CallRecord {
    const record: CallRecord = {
      attempt: null,
      ms: 0,
      ok: true,
      error: null,
      finishReason: null,
      outcome: null,
      problem: null,
      usage: null,
      estimated: { inputTokens: 0, outputTokens: 0, images: 0 },
      maxOutputTokens: null,
      effort: null,
      retries: 0,
      queries: null,
      fixture: false,
      costUsd: null,
      costEstimated: false,
      ...fields,
    };
    this.calls.push(record);
    return record;
  }

  private onEvent(event: AIEvent): void {
    if (event.type === "attempt") {
      const record = this.calls.find((each) => each.kind === "completion" && each.name === event.name && each.ok && each.outcome === null);
      if (!record) return;
      record.attempt = event.attempt;
      record.outcome = event.outcome;
      record.problem = event.problem;
      return;
    }
    if (event.type === "retry") {
      this.retries++;
      if (this.inFlight.size === 1) [...this.inFlight][0].retries++;
      return;
    }
    const cost = searchCost(event.queries, event.usage, this.prices);
    this.record({ kind: "search", name: "web_search", ms: event.ms, usage: event.usage, queries: event.queries, costUsd: cost });
    if (cost !== null) this.budget?.charge(cost);
  }

  wrapModel(inner: ModelProvider): ModelProvider {
    const search = inner.webSearch;
    return {
      name: inner.name,
      model: inner.model,
      capabilities: inner.capabilities,
      simulated: inner.simulated,
      dataHandling: inner.dataHandling,
      complete: async (request) => {
        const estimate = estimateRequest(request);
        const maxOutputTokens = request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT;
        const worst = worstCaseCompletion(estimate, maxOutputTokens, this.prices);
        const release = this.budget?.reserve(worst);
        const record = this.record({
          kind: "completion",
          name: request.responseFormat?.name ?? "text",
          estimated: { inputTokens: estimate.inputTokens, outputTokens: 0, images: estimate.images },
          maxOutputTokens: request.maxOutputTokens ?? null,
          effort: request.effort ?? null,
          fixture: inner.simulated,
        });
        this.inFlight.add(record);
        const started = Date.now();
        try {
          const result = await inner.complete(request);
          record.ms = Date.now() - started;
          record.finishReason = result.finishReason;
          record.usage = result.usage;
          record.estimated.outputTokens = tokensIn(result.text);
          const counted = result.usage ?? { inputTokens: estimate.inputTokens, cachedInputTokens: 0, outputTokens: record.estimated.outputTokens, reasoningTokens: 0 };
          record.costUsd = tokenCost(counted, this.prices);
          record.costEstimated = !result.usage;
          // Without provider counts, a live call is charged its worst case
          this.budget?.charge(result.usage ? (record.costUsd ?? 0) : (worst ?? 0));
          this.replies.set(record.name, [...(this.replies.get(record.name) ?? []), result.text]);
          return result;
        } catch (error) {
          record.ms = Date.now() - started;
          record.ok = false;
          record.outcome = "error";
          record.error = describe(error);
          // A failed call may still have been billed
          this.budget?.charge(worst ?? 0);
          throw error;
        } finally {
          this.inFlight.delete(record);
          release?.();
        }
      },
      webSearch: search
        ? async (request) => {
            const release = this.budget?.reserve(worstCaseSearch(this.prices));
            const started = Date.now();
            try {
              return await search.call(inner, request);
            } catch (error) {
              this.record({ kind: "search", name: "web_search", ms: Date.now() - started, ok: false, outcome: "error", error: describe(error) });
              this.budget?.charge(worstCaseSearch(this.prices) ?? 0);
              throw error;
            } finally {
              release?.();
            }
          }
        : undefined,
    };
  }

  wrapImage(inner: ImageModel): ImageModel {
    const price = this.prices.imagePerPicture;
    const run = async <T>(name: string, call: () => Promise<T>): Promise<T> => {
      const release = this.budget?.reserve(price);
      const record = this.record({ kind: "image", name, fixture: inner.simulated, costEstimated: inner.simulated });
      const started = Date.now();
      try {
        const result = await call();
        record.ms = Date.now() - started;
        record.estimated.images = 1;
        record.costUsd = price;
        this.budget?.charge(price ?? 0);
        return result;
      } catch (error) {
        record.ms = Date.now() - started;
        record.ok = false;
        record.outcome = "error";
        record.error = describe(error);
        // Meta doesn't bill failed or filtered images
        throw error;
      } finally {
        release?.();
      }
    };
    const generate = inner.generate;
    return {
      name: inner.name,
      model: inner.model,
      simulated: inner.simulated,
      edit: (request) => run("image_edit", () => inner.edit(request)),
      generate: generate ? (request) => run("image_generate", () => generate.call(inner, request)) : undefined,
    };
  }
}

