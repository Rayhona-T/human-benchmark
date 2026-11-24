/**
 * Automated accessibility checks with axe-core (Task 10.4, NFR-ACC-01).
 *
 * Rules: WCAG 2.0/2.1/2.2 levels A and AA, plus axe's best-practice rules.
 * Automated checks find only part of all accessibility problems; they do not
 * replace keyboard and screen-reader review (see TESTING.md).
 *
 * axe-core waits on timers internally. Session tests pause the page's fake
 * clock, so axe is started in the page without waiting on it, and the clock
 * is stepped 5 ms at a time until the result appears. That simulated time
 * also passes for the experiment: measured scans finish within about 10 ms,
 * well inside a trial's 2,000 ms response window. (Waiting on axe inside one
 * long page evaluation, as @axe-core/playwright does, never finished in
 * Firefox while the clock was being stepped.)
 */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { expect, type Page } from "@playwright/test";
import type { AxeResults } from "axe-core";

/** Only what the report needs; the full result (all passes, with HTML) is
 * large, and returning it after every scan crashed Firefox's page. */
interface Violation {
  id: string;
  impact: string | null;
  help: string;
  tags: string[];
  targets: string[];
}

const TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];
const STEP_MS = 5;
const MAX_STEPS = 50;

let axeSource: Promise<string> | null = null;
function loadAxeSource() {
  axeSource ??= readFile(
    createRequire(import.meta.url).resolve("axe-core/axe.min.js"),
    "utf-8",
  );
  return axeSource;
}

interface AxeWindow {
  axe?: { run: (context: Document, options: object) => Promise<AxeResults> };
  __hbAxe?: { result?: Violation[]; error?: string };
}

async function analyze(page: Page, fakeClock: boolean): Promise<Violation[]> {
  // CSS transitions run in real time (not on the fake clock). Scanning one
  // mid-way measures colors that never rest on screen, e.g. a button 60 ms
  // into its 120 ms change from the disabled style. Wait until none runs.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.playState === "running")
              .length,
        ),
      { message: "CSS transitions to finish before the axe scan" },
    )
    .toBe(0);
  if (!(await page.evaluate(() => "axe" in window))) {
    await page.addScriptTag({ content: await loadAxeSource() });
  }
  await page.evaluate((tags) => {
    const w = window as unknown as AxeWindow;
    const state: NonNullable<AxeWindow["__hbAxe"]> = {};
    w.__hbAxe = state;
    w.axe!.run(document, { runOnly: { type: "tag", values: tags } }).then(
      (result) =>
        (state.result = result.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          help: v.help,
          tags: v.tags,
          targets: v.nodes.map((node) => node.target.join(" ")),
        }))),
      (error: unknown) => (state.error = String(error)),
    );
  }, TAGS);
  for (let step = 0; ; step++) {
    const outcome = await page.evaluate(() => {
      const state = (window as unknown as AxeWindow).__hbAxe;
      return state?.result || state?.error ? state : null;
    });
    if (outcome?.error) throw new Error(`axe failed: ${outcome.error}`);
    if (outcome?.result) return outcome.result;
    if (step >= MAX_STEPS) {
      throw new Error(
        fakeClock
          ? `axe did not finish within ${MAX_STEPS * STEP_MS} ms of simulated time`
          : `axe did not finish after ${MAX_STEPS} checks`,
      );
    }
    if (fakeClock) await page.clock.runFor(STEP_MS);
    else await page.waitForTimeout(50);
  }
}

/** One line per violation: rule, impact, WCAG criteria, elements. */
export async function axeViolations(
  page: Page,
  { fakeClock = false } = {},
): Promise<string[]> {
  const violations = await analyze(page, fakeClock);
  return violations.map((violation) => {
    const criteria = violation.tags.filter((tag) => /^wcag\d/.test(tag));
    const targets = violation.targets.slice(0, 5).join(" | ");
    return `${violation.id} [${violation.impact}] ${violation.help} (${criteria.join(", ") || "best practice"}): ${targets}`;
  });
}

/** Fails with the full list of violations found in the current state. */
export async function expectNoAxeViolations(
  page: Page,
  state: string,
  { fakeClock = true } = {},
) {
  let violations: string[];
  try {
    violations = await axeViolations(page, { fakeClock });
  } catch (error) {
    throw new Error(`axe scan failed: ${state}: ${String(error)}`);
  }
  expect(violations, `axe violations: ${state}`).toEqual([]);
}
