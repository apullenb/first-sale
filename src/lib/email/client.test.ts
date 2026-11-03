import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { validSignature, workerAuthorized } from "./client";
afterEach(() => vi.unstubAllEnvs());
it("checks raw webhook bytes and rejects changed payloads", () => {
  const secret = "test-secret",
    body = '{"type":"message.created"}';
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  expect(validSignature(body, signature, secret)).toBe(true);
  expect(validSignature(`${body} `, signature, secret)).toBe(false);
  expect(validSignature(body, "bad", secret)).toBe(false);
  expect(validSignature(body, signature, "")).toBe(false);
});
it("requires a configured strong worker secret", () => {
  vi.stubEnv("CRON_SECRET", "");
  expect(workerAuthorized("Bearer ")).toBe(false);
  vi.stubEnv("CRON_SECRET", "a".repeat(32));
  expect(workerAuthorized(`Bearer ${"a".repeat(32)}`)).toBe(true);
  expect(workerAuthorized(`Bearer ${"b".repeat(32)}`)).toBe(false);
});
