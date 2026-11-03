import type { TokenUsage } from "./types";

// Per-call counts for measuring tools such as the benchmark. Never prompt or reply text.

export type AIEvent =
  // One model reply inside generateObject, and whether it passed the schema
  | {
      type: "attempt";
      name: string;
      attempt: number;
      ms: number;
      finishReason: string | null;
      usage: TokenUsage | null;
      outcome: "ok" | "invalid" | "cut_off";
      problem: string | null;
    }
  // A temporary provider failure about to be tried again
  | { type: "retry"; status: number | null; waitMs: number }
  // One web search request; Meta bills each query on top of tokens
  | { type: "search"; ms: number; queries: number; usage: TokenUsage | null };

type Listener = (event: AIEvent) => void;

const listeners = new Set<Listener>();

export function onAIEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A listener's own failure never changes the call it measures
export function emitAIEvent(event: AIEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {}
  }
}
