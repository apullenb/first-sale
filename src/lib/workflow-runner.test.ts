import { beforeEach, describe, expect, it, vi } from "vitest";

const takeAiRequest = vi.hoisted(() => vi.fn(async () => "owner_limit" as const));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/auth/server", () => ({ getCurrentUser: async () => ({ id: "owner-1" }) }));
vi.mock("@/lib/data/ai-quota", () => ({ takeAiRequest }));
vi.mock("@/lib/data/my-business", () => ({
  startMyRun: async () => ({ ok: true, runId: "run-1" }),
  finishMyRun: async () => {},
}));

const { runWorkflow } = await import("./workflow-runner");

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
