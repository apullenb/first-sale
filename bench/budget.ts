import type { ChatMessage, CompletionRequest, TokenUsage } from "@/lib/ai/types";
import { hasPrices, type Prices } from "./pricing";

// Spend estimates and the live budget guard. Costs are USD; null when prices aren't checked.

// Rough size of a prompt: about four characters per token, plus a fixed allowance per image
export const CHARS_PER_TOKEN = 4;
export const TOKENS_PER_IMAGE = 1_600;

export interface Estimate {
  inputTokens: number;
  images: number;
}

export function estimateRequest(request: Pick<CompletionRequest, "messages" | "responseFormat">): Estimate {
  let chars = request.responseFormat ? JSON.stringify(request.responseFormat.schema).length : 0;
  let images = 0;
  for (const message of request.messages as ChatMessage[]) {
    if (typeof message.content === "string") {
      chars += message.content.length;
      continue;
    }
    for (const part of message.content) {
      if (part.type === "text") chars += part.text.length;
      else images++;
    }
  }
  return { inputTokens: Math.ceil(chars / CHARS_PER_TOKEN) + images * TOKENS_PER_IMAGE, images };
}

export const tokensIn = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);

// Cached input bills at the cached rate, the rest at the input rate; reasoning is counted in output
export function tokenCost(usage: TokenUsage, prices: Prices): number | null {
  if (!hasPrices(prices)) return null;
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  return (
    ((usage.inputTokens - cached) * prices.inputPerMTok! + cached * prices.cachedInputPerMTok! + usage.outputTokens * prices.outputPerMTok!) / 1_000_000
  );
}

export function searchCost(queries: number, usage: TokenUsage | null, prices: Prices): number | null {
  if (prices.searchPerQuery === null) return null;
  const tokens = usage ? tokenCost(usage, prices) : 0;
  return tokens === null ? null : queries * prices.searchPerQuery + tokens;
}

// The most a call could cost: its whole prompt uncached and every output token it's allowed
export function worstCaseCompletion(estimate: Estimate, maxOutputTokens: number, prices: Prices): number | null {
  return tokenCost({ inputTokens: estimate.inputTokens, cachedInputTokens: 0, outputTokens: maxOutputTokens, reasoningTokens: 0 }, prices);
}

// A search request may run a few queries and bring back pages of results as input
export const SEARCH_ALLOWANCE = { queries: 4, inputTokens: 20_000, outputTokens: 4_000 } as const;

export function worstCaseSearch(prices: Prices): number | null {
  const usage = { inputTokens: SEARCH_ALLOWANCE.inputTokens, cachedInputTokens: 0, outputTokens: SEARCH_ALLOWANCE.outputTokens, reasoningTokens: 0 };
  return searchCost(SEARCH_ALLOWANCE.queries, usage, prices);
}

export class BudgetReached extends Error {
  constructor(limitUsd: number, spentUsd: number) {
    super(`Budget reached: about $${spentUsd.toFixed(4)} of $${limitUsd.toFixed(2)} spent, so no new calls start.`);
    this.name = "BudgetReached";
  }
}

// Live runs only. A call starts only when what's spent, plus every call still running, plus this call's worst case
// stays within the limit; an unpriced call never starts.
export class Budget {
  spent = 0;
  private reserved = 0;
  stopped = false;

  constructor(readonly limitUsd: number) {}

  reserve(worstCaseUsd: number | null): () => void {
    if (worstCaseUsd === null || this.stopped || this.spent + this.reserved + worstCaseUsd > this.limitUsd) {
      this.stopped = true;
      throw new BudgetReached(this.limitUsd, this.spent);
    }
    this.reserved += worstCaseUsd;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.reserved -= worstCaseUsd;
    };
  }

  charge(usd: number): void {
    this.spent += usd;
    if (this.spent >= this.limitUsd) this.stopped = true;
  }
}
