import { afterEach, expect, it, vi } from "vitest";
import { emailAvailable, emailConfig } from "./client";
afterEach(() => vi.unstubAllEnvs());
it("needs the key, client id and a secure callback", () => {
  vi.stubEnv("NYLAS_API_KEY", "");
  vi.stubEnv("NYLAS_CLIENT_ID", "client");
  vi.stubEnv("NYLAS_REDIRECT_URI", "https://app.example/api/email/callback");
  expect(emailAvailable()).toBe(false);
  vi.stubEnv("NYLAS_API_KEY", "key");
  expect(emailAvailable()).toBe(true);
  vi.stubEnv("NYLAS_REGION", "eu");
  expect(emailConfig().base).toBe("https://api.eu.nylas.com");
  vi.stubEnv("NYLAS_REDIRECT_URI", "http://app.example/api/email/callback");
  expect(emailAvailable()).toBe(false);
});
