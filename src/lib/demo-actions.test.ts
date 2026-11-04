import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DEMO_REFUSAL } from "./demo";

vi.mock("@/lib/auth/server", () => ({
  getCurrentUser: async () => ({ id: "owner-1", name: "Demo Owner", email: "demo@example.test", demo: true }),
  isDemoSession: async () => true,
}));
vi.mock("@/db/client", () => ({
  getDb: () => {
    throw new Error("database touched");
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {}, updateTag: () => {} }));

// Read-only actions; any other action must answer a demo session with the demo note
const READ_ONLY = new Set(["jobsRunningAction", "placeOptionsAction", "explainOptionAction", "socialIdeasAction"]);

const APP = join(__dirname, "..", "app");
function serverActionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return serverActionFiles(path);
    return /\.tsx?$/.test(entry.name) && readFileSync(path, "utf8").startsWith('"use server"') ? [path] : [];
  });
}

const files = serverActionFiles(APP);

describe("server actions in a demo session", () => {
  it("finds the action files", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files.map((file) => relative(APP, file)))("%s refuses every change", async (file) => {
    const actions = (await import(join(APP, file))) as Record<string, (...args: unknown[]) => Promise<unknown>>;
    for (const [name, action] of Object.entries(actions)) {
      if (READ_ONLY.has(name)) continue;
      const form = new FormData();
      expect(await action(form, "x"), name).toEqual(DEMO_REFUSAL);
    }
  });

  it("refuses the AI-backed read-only one through runWorkflow", async () => {
    const { explainOptionAction } = await import("@/app/(app)/website/option-actions");
    await expect(explainOptionAction("platform:squarespace")).rejects.toThrow("database touched");
  });
});
