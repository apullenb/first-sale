import { beforeEach, describe, expect, it, vi } from "vitest";

const takeAiRequest = vi.hoisted(() => vi.fn(async () => "owner_limit" as const));
const runs = vi.hoisted(() => ({
  last: vi.fn(async (): Promise<{ status: string } | null> => null),
  start: vi.fn(async (): Promise<{ ok: true; runId: string } | { ok: false; reason: string }> => ({ ok: true, runId: "run-1" })),
}));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
const user = vi.hoisted(() => ({ id: "owner-1", demo: false }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: async () => user }));
vi.mock("@/lib/data/ai-quota", () => ({ takeAiRequest }));
vi.mock("@/lib/data/my-business", () => ({
  startMyRun: runs.start,
  lastMyRun: runs.last,
  finishMyRun: async () => {},
}));

const { ALREADY_RUNNING, runWorkflow } = await import("./workflow-runner");
const { DEMO_REFUSAL } = await import("./demo");

describe("runWorkflow and the AI limit", () => {
  beforeEach(() => {
    takeAiRequest.mockClear();
    vi.unstubAllEnvs();
  });

  it("neither counts nor blocks practice-mode requests", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    expect(await runWorkflow("research", null, async () => 1)).toEqual({ ok: true, value: 1 });
    expect(takeAiRequest).not.toHaveBeenCalled();
  });

  it("counts real model requests and blocks them over the limit", async () => {
    vi.stubEnv("AI_PROVIDER", "muse");
    vi.stubEnv("MUSE_API_KEY", "test-key");
    const job = vi.fn(async () => 1);
    expect(await runWorkflow("research", null, job)).toMatchObject({ ok: false, message: expect.stringMatching(/a lot of AI requests/) });
    expect(takeAiRequest).toHaveBeenCalledOnce();
    expect(job).not.toHaveBeenCalled();
  });
});

describe("runWorkflow in the demo", () => {
  it("runs nothing, records nothing and never touches the AI limit", async () => {
    vi.stubEnv("AI_PROVIDER", "muse");
    vi.stubEnv("MUSE_API_KEY", "test-key");
    user.demo = true;
    takeAiRequest.mockClear();
    runs.start.mockClear();
    const job = vi.fn(async () => 1);
    try {
      expect(await runWorkflow("research", null, job)).toEqual(DEMO_REFUSAL);
    } finally {
      user.demo = false;
      vi.unstubAllEnvs();
    }
    expect(job).not.toHaveBeenCalled();
    expect(takeAiRequest).not.toHaveBeenCalled();
    expect(runs.start).not.toHaveBeenCalled();
  });
});

describe("runWorkflow with a copy already running", () => {
  beforeEach(() => {
    takeAiRequest.mockClear();
    vi.unstubAllEnvs();
  });

  it("says which job to follow, without charging the AI limit or starting another", async () => {
    vi.stubEnv("AI_PROVIDER", "muse");
    vi.stubEnv("MUSE_API_KEY", "test-key");
    runs.last.mockResolvedValueOnce({ status: "running" });
    const job = vi.fn(async () => 1);
    expect(await runWorkflow("follow_up", null, job)).toEqual({ ok: false, message: ALREADY_RUNNING, busy: { workflow: "follow_up", subjectId: null } });
    expect(takeAiRequest).not.toHaveBeenCalled();
    expect(job).not.toHaveBeenCalled();
  });

  it("reports a start that loses the race as running, not failed", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    runs.start.mockResolvedValueOnce({ ok: false, reason: "busy" });
    const result = await runWorkflow("insights", null, async () => 1);
    expect(result).toMatchObject({ ok: false, busy: { workflow: "insights", subjectId: null } });
    expect(result.ok ? "" : result.message).not.toMatch(/didn’t work|failed|reload/i);
  });
});
