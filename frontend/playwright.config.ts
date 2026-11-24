import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (Cycle 10, Task 10.2). They run against the PRODUCTION build
 * served by `vite preview`, so they exercise the bundle that would be
 * released. `vite preview` is not the real host: hosting-specific behavior
 * (deep-link fallback rules, headers, caching) is not verified here.
 *
 * Browsers (Task 10.4): Chromium, Firefox, and WebKit run every spec except
 *   - tests tagged @chromium-only: real window focus loss uses the Chrome
 *     DevTools Protocol, and one long multi-reload journey;
 *   - specs that need no browser (CSV parser, bundle contents), which run
 *     once, in the Chromium project.
 * HB_HEADED=1 adds "chromium-headed", which repeats the real focus-loss
 * tests in a visible window (needs a display; not run in CI).
 * See TESTING.md for commands and troubleshooting.
 */
const PORT = 4173;

/** Specs that do not depend on the browser engine. */
const ENGINE_INDEPENDENT = ["**/csv.spec.ts", "**/bundle.spec.ts"];

export default defineConfig({
  testDir: "./e2e",
  // Each spec is independent; full sessions are the slowest (fake clock,
  // 72 trials), so give them room without hiding hangs indefinitely.
  timeout: 120_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Headed real-focus tests share the operating system's single window
  // focus, so they run one at a time.
  workers: process.env.HB_HEADED ? 1 : process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grepInvert: /@chromium-only/,
      testIgnore: ENGINE_INDEPENDENT,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      grepInvert: /@chromium-only/,
      testIgnore: ENGINE_INDEPENDENT,
    },
    ...(process.env.HB_HEADED
      ? [
          {
            name: "chromium-headed",
            use: { ...devices["Desktop Chrome"], headless: false },
            grep: /@real-focus/,
          },
        ]
      : []),
  ],
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
