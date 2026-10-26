import type { CompletionRequest, ModelProvider } from "../types";

export type MockResponder = (request: CompletionRequest) => string;

// No network, no key. Tests and saved demo fixtures pass their own responder.
export function createMockProvider(respond: MockResponder = defaultResponder): ModelProvider {
  return {
    name: "Mock",
    model: "mock",
    capabilities: { vision: true, jsonSchema: true, reasoningEffort: true },
    async complete(request) {
      return { text: respond(request), finishReason: "stop", usage: null };
    },
  };
}

const fixtures = new Map<string, MockResponder>();

// Offline answers for structured calls, keyed by schema name, so features work without an API key
export function registerMockFixture(schemaName: string, respond: MockResponder): void {
  fixtures.set(schemaName, respond);
}

function defaultResponder(request: CompletionRequest): string {
  if (request.responseFormat) {
    const fixture = fixtures.get(request.responseFormat.name);
    if (fixture) return fixture(request);
    throw new Error(
      `No mock fixture for "${request.responseFormat.name}". Set AI_PROVIDER in .env.local or pass a responder.`,
    );
  }
  return "[mock reply] Set AI_PROVIDER=muse in .env.local to use a real model.";
}
