import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["OPS_DEMO_TEST_PORT"] || 5175);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    ...devices["Desktop Edge"],
    channel: "msedge",
    headless: true,
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build -- --mode demo --outDir .e2e-dist && node node_modules/vite/bin/vite.js preview --outDir .e2e-dist --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    timeout: 120000,
    reuseExistingServer: false,
  },
});
