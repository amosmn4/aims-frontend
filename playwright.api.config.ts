import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-api",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    ...devices["Desktop Edge"],
    channel: "msedge",
    headless: true,
    baseURL: "http://127.0.0.1:5176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node -r ts-node/register/transpile-only test/ops-browser-server.ts",
      cwd: "../backend",
      env: { OPS_LEDGER_TEST_GATEWAY: "1", OPS_WEEKLY_TEST_EMAIL: "1" },
      url: "http://127.0.0.1:4001/api/v1/ops/auth/status",
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command:
        "npm run build -- --outDir .api-e2e-dist && node node_modules/vite/bin/vite.js preview --outDir .api-e2e-dist --host 127.0.0.1 --port 5176 --strictPort",
      env: { OPS_API_PROXY: "http://127.0.0.1:4001", VITE_WORKSPACE_MODE: "api" },
      url: "http://127.0.0.1:5176",
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
});
