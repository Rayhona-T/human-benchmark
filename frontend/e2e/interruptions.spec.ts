/**
 * Interruptions in a real browser (Chromium, production build), for both
 * experiments: the page being hidden and the window losing focus, at every
 * point of a trial and during the break (FR-PAR-07, FR-DAT-03, NFR-REL-01).
 *
 * Expected behavior comes from the protocols (HB-STROOP-1.0 / HB-FLANKER-1.0
 * §7) and the session implementation, not from this test:
 *   - stimulus on screen: that trial is recorded once as invalid (reason
 *     visibility_lost for a hidden page, interrupt for window blur), the
 *     session pauses, and the trial is not repeated;
 *   - fixation, feedback, interval, or break: the session pauses and nothing
 *     is recorded; an unpresented trial is shown again after Resume;
 *   - the session never resumes by itself.
 * Every test ends by checking the exported CSV and the displayed results
 * against what the test did (support/results.ts).
 *
 * Focus loss is real (the window is minimized); a hidden page is emulated,
 * because headless Chromium never hides a page (support/interruptions.ts).
 */
import { expect, test } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  advanceUntil,
  awaitStimulus,
  exitSession,
  expectPaused,
  mainPlan,
  progress,
  runTrial,
  startMain,
  startPractice,
  type ExperimentDriver,
} from "./support/session";
import {
  hideDocument,
  loseWindowFocus,
  restoreWindowFocus,
  showDocument,
} from "./support/interruptions";
import {
  MAIN_TRIALS,
  PRACTICE_TRIALS,
  answered,
  expectExportMatchesSession,
  interrupted,
  type ExpectedTrial,
} from "./support/results";
import {
  NO_CLIENT_STORAGE,
  clientStorage,
  recordNetwork,
} from "./support/network";

const BREAK_AFTER = 30;

async function resume(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(
    page.getByRole("heading", { name: "Experiment paused" }),
  ).toHaveCount(0);
}

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test.describe(`${driver.name} interruptions`, () => {
    test("hidden page during a practice stimulus: one invalid trial, no auto-resume, not repeated", async ({
      page,
      baseURL,
    }) => {
      const network = recordNetwork(page, baseURL ?? "");
      const trials: ExpectedTrial[] = [];
      await startPractice(page, driver);
      trials.push(
        answered("practice", 1, await runTrial(page, driver, "correct")),
      );

      const shown = await awaitStimulus(page, driver);
      await expect(progress(page)).toHaveText("Practice 2 of 12");
      await hideDocument(page);
      await expectPaused(page, "trial invalidated");
      await expect(
        page.getByText(/the page was hidden or lost focus/),
      ).toBeVisible();
      await expect(driver.stimulus(page)).toHaveCount(0);
      trials.push(interrupted("practice", 2, shown, "visibility_lost"));

      // A key pressed while paused is not a response to anything.
      await page.keyboard.press(shown.correctKey);
      // Returning to the page does not resume the session, however long
      // the participant waits.
      await showDocument(page);
      await page.clock.runFor(10_000);
      await expectPaused(page, "trial invalidated");
      await expect(driver.stimulus(page)).toHaveCount(0);

      await resume(page);
      // The invalid trial is not repeated: the next trial is number 3.
      await expect(progress(page)).toHaveText("Practice 3 of 12");
      trials.push(
        answered("practice", 3, await runTrial(page, driver, "wrong")),
      );

      await exitSession(page);
      await expectExportMatchesSession(page, driver, trials, "incomplete");
      expect(network.violations()).toEqual([]);
      expect(await clientStorage(page)).toEqual(NO_CLIENT_STORAGE);
    });

    test("real focus loss in the main task: during a stimulus, repeated while paused, and during fixation", async ({
      page,
    }) => {
      const trials: ExpectedTrial[] = [];
      await startPractice(page, driver);
      for (let trial = 1; trial <= PRACTICE_TRIALS; trial++) {
        trials.push(
          answered("practice", trial, await runTrial(page, driver, "correct")),
        );
      }
      await startMain(page);
      trials.push(answered("main", 1, await runTrial(page, driver, "correct")));

      // Focus lost while the stimulus of main trial 2 is on screen.
      const shown = await awaitStimulus(page, driver);
      await loseWindowFocus(page);
      await expectPaused(page, "trial invalidated");
      trials.push(interrupted("main", 2, shown, "interrupt"));

      // More focus and visibility changes while already paused add nothing.
      await restoreWindowFocus(page);
      await loseWindowFocus(page);
      await restoreWindowFocus(page);
      await hideDocument(page);
      await showDocument(page);
      await page.clock.runFor(5_000);
      await expectPaused(page, "trial invalidated");

      // Resume starts main trial 3 with its fixation cross. Focus lost now,
      // before the stimulus: nothing was shown, so nothing is recorded and
      // trial 3 is shown again after Resume.
      await resume(page);
      await expect(progress(page)).toHaveText("Trial 3 of 60");
      await expect(page.locator(".experiment-fixation")).toBeVisible();
      await loseWindowFocus(page);
      await expectPaused(page, "no trial on screen");
      await restoreWindowFocus(page);
      await resume(page);
      await expect(progress(page)).toHaveText("Trial 3 of 60");
      trials.push(answered("main", 3, await runTrial(page, driver, "correct")));
      trials.push(answered("main", 4, await runTrial(page, driver, "none")));

      await exitSession(page);
      await expectExportMatchesSession(page, driver, trials, "incomplete");
    });

    test("transitions: feedback, two events at once, response at the instant of focus loss, and before onset", async ({
      page,
    }) => {
      const trials: ExpectedTrial[] = [];
      await startPractice(page, driver);

      // 1. A correct response, then the page is hidden during the feedback:
      // the trial is already recorded; the pause records nothing more.
      const first = await awaitStimulus(page, driver);
      await page.clock.runFor(400);
      await page.keyboard.press(first.correctKey);
      const feedback = page.locator(".experiment-feedback");
      await advanceUntil(page, () => feedback.isVisible(), "practice feedback");
      await expect(feedback.getByRole("heading")).toHaveText("Correct");
      await hideDocument(page);
      await expectPaused(page, "no trial on screen");
      await showDocument(page);
      await resume(page);
      trials.push(
        answered("practice", 1, { ...first, pressedKey: first.correctKey }),
      );

      // 2. Window blur and a hidden page in the same instant (as when
      // switching tabs) during a stimulus: one invalid record, not two. The
      // first event wins, so the reason is "interrupt" (blur).
      await expect(progress(page)).toHaveText("Practice 2 of 12");
      const second = await awaitStimulus(page, driver);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
        Object.defineProperty(document, "hidden", {
          configurable: true,
          get: () => true,
        });
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expectPaused(page, "trial invalidated");
      trials.push(interrupted("practice", 2, second, "interrupt"));
      await showDocument(page);
      await resume(page);

      // 3. A response, then focus lost before any time passes (the stimulus
      // is still on screen until the next frame). The response stands, the
      // trial is not reopened or invalidated, and the session pauses before
      // the next trial because the page has no focus.
      await expect(progress(page)).toHaveText("Practice 3 of 12");
      const third = await awaitStimulus(page, driver);
      await page.clock.runFor(400);
      await page.keyboard.press(third.correctKey);
      await loseWindowFocus(page);
      const paused = page.getByRole("heading", { name: "Experiment paused" });
      await advanceUntil(page, () => paused.isVisible(), "the pause");
      await expectPaused(page, "no trial on screen");
      trials.push(
        answered("practice", 3, { ...third, pressedKey: third.correctKey }),
      );
      await restoreWindowFocus(page);
      await resume(page);
      await expect(progress(page)).toHaveText("Practice 4 of 12");

      // 4. Focus lost after the stimulus is committed to the page but before
      // its onset frame runs: the trial was never presented, so nothing is
      // recorded, the stimulus is removed, and the same trial is shown again.
      // Resume starts the 500 ms fixation (protocol §6); 1 ms steps near its
      // end stop as soon as the stimulus is committed, before the next frame.
      await expect(page.locator(".experiment-fixation")).toBeVisible();
      await page.clock.runFor(450);
      const committed = driver.stimulus(page);
      await advanceUntil(
        page,
        () => committed.isVisible(),
        "the stimulus to be committed",
        { stepMs: 1, maxMs: 200 },
      );
      await loseWindowFocus(page);
      await expectPaused(page, "no trial on screen");
      await expect(committed).toHaveCount(0);
      await restoreWindowFocus(page);
      await resume(page);
      await expect(progress(page)).toHaveText("Practice 4 of 12");
      trials.push(
        answered("practice", 4, await runTrial(page, driver, "correct")),
      );

      await exitSession(page);
      await expectExportMatchesSession(page, driver, trials, "incomplete");
    });

    test("break interruptions and a main-trial interruption in a session that is then completed", async ({
      page,
      baseURL,
    }) => {
      // 72 trials driven step by step in simulated time: long, not flaky.
      test.slow();
      const network = recordNetwork(page, baseURL ?? "");
      const INTERRUPTED_MAIN_TRIAL = 45;
      const trials: ExpectedTrial[] = [];
      await startPractice(page, driver);
      for (let trial = 1; trial <= PRACTICE_TRIALS; trial++) {
        trials.push(
          answered("practice", trial, await runTrial(page, driver, "correct")),
        );
      }
      await startMain(page);

      for (let trial = 1; trial <= MAIN_TRIALS; trial++) {
        if (trial === INTERRUPTED_MAIN_TRIAL) {
          const shown = await awaitStimulus(page, driver);
          await hideDocument(page);
          await expectPaused(page, "trial invalidated");
          trials.push(interrupted("main", trial, shown, "visibility_lost"));
          await showDocument(page);
          await resume(page);
          continue;
        }
        trials.push(
          answered(
            "main",
            trial,
            await runTrial(page, driver, mainPlan(trial)),
          ),
        );
        if (trial !== BREAK_AFTER) continue;

        // The optional break: hidden page, then real focus loss. Each
        // pauses the break; Resume returns to the break, not to a trial.
        const rest = page.getByRole("heading", {
          name: "Rest before continuing",
        });
        await advanceUntil(page, () => rest.isVisible(), "the optional break");
        await hideDocument(page);
        await expectPaused(page, "break");
        await showDocument(page);
        await resume(page);
        await expect(rest).toBeVisible();
        await loseWindowFocus(page);
        await expectPaused(page, "break");
        await restoreWindowFocus(page);
        await resume(page);
        await expect(rest).toBeVisible();
        await page.clock.runFor(3_000);
        await page.getByRole("button", { name: "Continue" }).click();
      }

      const complete = page.getByRole("heading", {
        name: `${driver.name} session complete`,
      });
      await advanceUntil(page, () => complete.isVisible(), "completion");
      // The break was taken (not skipped) and counts as no trial.
      await expect(
        page
          .locator(".session-results__stats > div")
          .filter({ hasText: "Optional break" })
          .locator("dd"),
      ).toHaveText(/^Taken/);
      await expect(
        page.getByText(/Invalid trials and reasons: 1 ×/),
      ).toBeVisible();
      await expectExportMatchesSession(page, driver, trials, "complete");
      expect(network.violations()).toEqual([]);
    });
  });
}
