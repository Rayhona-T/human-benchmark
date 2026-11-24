/**
 * Participant journeys for both experiments in a real browser (Chromium),
 * against the production build. Protocol, trial counts and timing are the
 * production ones; only the clock is simulated (see support/session.ts).
 *
 * Expected counts below are not scientific claims: the test itself decides
 * every response, so the totals it checks are fully controlled.
 */
import { expect, test } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  advanceUntil,
  expectedMainTotals,
  mainPlan,
  openWithFakeClock,
  runTrial,
  statValue,
  type ExperimentDriver,
} from "./support/session";
import { recordNetwork } from "./support/network";
import {
  MAIN_TRIALS,
  PRACTICE_TRIALS,
  answered,
  expectExportMatchesSession,
  type ExpectedTrial,
} from "./support/results";

const BREAK_AFTER = 30;

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test.describe(driver.name, () => {
    test("briefing, mapping check, and first practice responses", async ({
      page,
    }) => {
      await openWithFakeClock(page, driver);
      // The data notice is shown before any trial (FR-PAR-02).
      await expect(
        page.getByText(/Nothing is saved or sent anywhere/),
      ).toBeVisible();

      const begin = page.getByRole("button", {
        name: "Begin 12 practice trials",
      });
      await page.getByRole("button", { name: `Start ${driver.name}` }).click();
      await expect(begin).toBeDisabled();
      if (driver === FLANKER) {
        // A wrong mapped key repeats the prompt; an unmapped key is ignored.
        await page.keyboard.press("j");
        await expect(page.getByText(/That key means Right/)).toBeVisible();
        await page.keyboard.press("x");
        await expect(page.getByText(/That key means Right/)).toBeVisible();
        await page.keyboard.press("f");
        await page.keyboard.press("j");
        await expect(
          page.getByText("Both keys recognized.", { exact: false }),
        ).toBeVisible();
      } else {
        await page.keyboard.press("x"); // unmapped: nothing recognized
        await expect(begin).toBeDisabled();
        for (const key of driver.keys) await page.keyboard.press(key);
      }
      await expect(begin).toBeEnabled();
      await begin.click();

      // Trial 1: an unmapped key is ignored, then a correct response.
      const stimulus = driver.stimulus(page);
      await advanceUntil(
        page,
        () => stimulus.isVisible(),
        "the first stimulus",
      );
      await expect(page.getByText("Practice", { exact: true })).toBeVisible();
      await page.keyboard.press("x");
      await page.clock.runFor(100);
      await expect(stimulus).toBeVisible();
      const correct = await driver.correctKey(page);
      await page.clock.runFor(300);
      await page.keyboard.press(correct);
      const feedback = page.locator(".experiment-feedback");
      await advanceUntil(page, () => feedback.isVisible(), "practice feedback");
      await expect(feedback.getByRole("heading")).toHaveText("Correct");

      // Trial 2: a wrong mapped key gives "Incorrect" feedback.
      await runTrial(page, driver, "wrong");
      await advanceUntil(page, () => feedback.isVisible(), "practice feedback");
      await expect(feedback.getByRole("heading")).toHaveText("Incorrect");
    });

    test("complete session: results, CSV download, and export consistency", async ({
      page,
      baseURL,
    }) => {
      // 72 trials driven step by step in simulated time: long, not flaky.
      test.slow();
      // Privacy (client-only scope): record every request from the start.
      const network = recordNetwork(page, baseURL ?? "");
      await openWithFakeClock(page, driver);
      await driver.completeMappingCheck(page);
      await page
        .getByRole("button", { name: "Begin 12 practice trials" })
        .click();

      const trials: ExpectedTrial[] = [];
      for (let trial = 1; trial <= PRACTICE_TRIALS; trial++) {
        // Practice mixes correct, wrong, and no response too.
        const plan =
          trial % 4 === 0 ? "wrong" : trial === 6 ? "none" : "correct";
        trials.push(
          answered("practice", trial, await runTrial(page, driver, plan)),
        );
      }
      const startMain = page.getByRole("button", {
        name: "Start 60 main trials",
      });
      await advanceUntil(page, () => startMain.isVisible(), "the ready screen");
      await startMain.click();

      for (let trial = 1; trial <= MAIN_TRIALS; trial++) {
        trials.push(
          answered(
            "main",
            trial,
            await runTrial(page, driver, mainPlan(trial)),
          ),
        );
        if (trial === BREAK_AFTER) {
          const skip = page.getByRole("button", { name: "Skip break" });
          await advanceUntil(
            page,
            () => skip.isVisible(),
            "the optional break",
          );
          await skip.click();
        }
      }

      const complete = page.getByRole("heading", {
        name: `${driver.name} session complete`,
      });
      await advanceUntil(
        page,
        () => complete.isVisible(),
        "the completion screen",
      );

      // Results structure, with counts the test itself controlled.
      const expected = expectedMainTotals(MAIN_TRIALS);
      await expect(
        page.getByRole("heading", { name: "Session overview" }),
      ).toBeVisible();
      await expect(statValue(page, "Main trials presented")).toHaveText(
        "60 of 60",
      );
      await expect(statValue(page, "Correct")).toHaveText(
        String(expected.correct),
      );
      await expect(statValue(page, "Incorrect")).toHaveText(
        String(expected.wrong),
      );
      await expect(statValue(page, "Timeouts")).toHaveText(
        String(expected.none),
      );
      await expect(statValue(page, "Invalid")).toHaveText("0");
      await expect(statValue(page, "Practice trials")).toHaveText("12 of 12");
      await expect(statValue(page, "Optional break")).toContainText(/skipped/i);
      for (const heading of [
        "Response times",
        "Results by condition",
        "Condition comparisons",
        "How to read these results",
      ]) {
        await expect(
          page.getByRole("heading", { name: heading }),
        ).toBeVisible();
      }
      // Production build: no save panel (saving is development-only).
      await expect(
        page.getByRole("heading", { name: /Save this session/ }),
      ).toHaveCount(0);

      // CSV export: a real browser download, parsed as RFC 4180 and
      // compared row by row with what the test did and with every count,
      // rate and median the results page shows (NFR-DATA-01).
      await expectExportMatchesSession(page, driver, trials, "complete");

      // Nothing about the session left the browser: only the app's own
      // static assets were requested, from the same origin.
      expect(network.violations()).toEqual([]);
      expect(
        network.requests.some((request) => request.resourceType === "document"),
      ).toBe(true);
    });
  });
}
