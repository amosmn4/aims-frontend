import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env["OPS_UI_TEST_PORT"] || 5179);

export default defineConfig({
  testDir: "./e2e-ui",
  workers: 1,
  timeout: 90000,
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
    command: `node node_modules/vite/bin/vite.js build --outDir .ui-test-dist && node node_modules/vite/bin/vite.js preview --outDir .ui-test-dist --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    timeout: 180000,
    reuseExistingServer: false,
  },
});
