import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (Cycle 10, Task 10.2). They run against the PRODUCTION build
 * served by `vite preview`, so they exercise the bundle that would be
 * released. `vite preview` is not the real host: hosting-specific behavior
 * (deep-link fallback rules, headers, caching) is not verified here.
 *
 * Chromium only for now; the wider browser/device matrix is Task 10.4.
 * See TESTING.md for commands and troubleshooting.
 */
const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  // Each spec is independent; full sessions are the slowest (fake clock,
  // 72 trials), so give them room without hiding hangs indefinitely.
  timeout: 120_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always test the current code: build, then serve the production bundle.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
