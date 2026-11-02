import { defineConfig, devices } from "@playwright/test";

const PORT = 3117;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  // Each scenario is one owner whose steps build on each other
  fullyParallel: false,
  workers: 3,
  // One retry for timing slips under load; real failures still fail and flakes are reported
  retries: 1,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: "e2e/.report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node e2e/server.mjs",
    url: `${BASE_URL}/login`,
    timeout: 240_000,
    // Always its own server, so the run can never reach a hosted database
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      // Empty, not missing: Next would otherwise fill these from .env.local
      DATABASE_URL: "",
      DATABASE_URL_UNPOOLED: "",
      MUSE_API_KEY: "",
      AI_API_KEY: "",
      AI_PROVIDER: "mock",
      SQUARE_APPLICATION_ID: "",
      SQUARE_APPLICATION_SECRET: "",
      SQUARE_TOKEN_ENCRYPTION_KEY: "",
      SQUARE_REDIRECT_URI: "",
      SQUARE_ENVIRONMENT: "sandbox",
      PGLITE_DIR: "./.pglite-e2e",
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET: "e2e-secret-that-is-at-least-thirty-two-characters",
      E2E_PORT: String(PORT),
      // The account e2e/demo.spec.ts builds and opens through /demo
      DEMO_OWNER_EMAIL: "demo-owner@example.test",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
