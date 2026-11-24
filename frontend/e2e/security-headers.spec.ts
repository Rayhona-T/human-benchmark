/**
 * The RECOMMENDED security headers (support/securityHeaders.ts) do not break
 * the production build. Every response from the preview server is served
 * with them added, then the test browses every page and runs a session of
 * each experiment, including the CSV download and clearing, collecting any
 * Content Security Policy violation the browser reports.
 *
 * This verifies the recommendation against the real bundle in three engines.
 * It does not verify any host: no host is chosen, and these headers are not
 * active anywhere until configured there (docs/HOSTING.md).
 */
import { expect, test, type Page } from "@playwright/test";
import { SECURITY_HEADERS } from "./support/securityHeaders";
import {
  FLANKER,
  STROOP,
  clearSessionData,
  exitSession,
  runTrial,
  startPractice,
  type ExperimentDriver,
} from "./support/session";
import { downloadExport } from "./support/results";

async function serveWithRecommendedHeaders(page: Page) {
  await page.route("**/*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), ...SECURITY_HEADERS },
    });
  });
  // Collected in the page from the first script on, on every document.
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations =
      violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(
        `${event.effectiveDirective} blocked ${event.blockedURI || "(inline)"}`,
      );
    });
  });
}

async function cspViolations(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
  );
}

test("site pages work under the recommended headers", async ({ page }) => {
  const consoleCsp: string[] = [];
  page.on("console", (message) => {
    if (/content.security.policy|CSP/i.test(message.text())) {
      consoleCsp.push(message.text());
    }
  });
  await serveWithRecommendedHeaders(page);
  for (const path of ["/", "/experiments", "/methodology", "/no-such-page"]) {
    const response = await page.goto(path);
    expect(response?.headers()["content-security-policy"]).toBe(
      SECURITY_HEADERS["Content-Security-Policy"],
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await cspViolations(page), path).toEqual([]);
  }
  expect(consoleCsp).toEqual([]);
});

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test(`${driver.name}: a session, CSV download, and clearing work under the recommended headers`, async ({
    page,
  }) => {
    await serveWithRecommendedHeaders(page);
    await startPractice(page, driver);
    // Styles set by the app (stimulus colors, Flanker geometry) still apply.
    await runTrial(page, driver, "correct");
    await runTrial(page, driver, "wrong");
    await exitSession(page);
    const { fileName, table } = await downloadExport(page);
    expect(fileName).toBe(
      `human-benchmark-${driver.name.toLowerCase()}-incomplete-trials.csv`,
    );
    expect(table.records).toHaveLength(2);
    await clearSessionData(page);
    expect(await cspViolations(page)).toEqual([]);
  });
}

test("self-test: the policy is enforced and violations are recorded", async ({
  page,
}) => {
  await serveWithRecommendedHeaders(page);
  await page.goto("/");
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "body { outline: 1px solid red; }";
    document.head.append(style);
  });
  await expect
    .poll(() => cspViolations(page))
    .toContainEqual(expect.stringMatching(/^style-src/));
});
