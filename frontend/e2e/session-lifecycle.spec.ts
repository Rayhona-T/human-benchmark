/**
 * Leaving, reloading, exiting, and restarting a session, for both
 * experiments, in a real browser against the production build
 * (FR-PAR-07, FR-PAR-08, FR-PAR-09, FR-PRI-01/02, Option A client-only scope).
 *
 * Observed design (useExperimentSession.ts; nothing here changes it): a
 * session lives only in the page's memory. Reloading, closing, or navigating
 * away discards it; nothing is restored; the browser stores nothing.
 * Exiting through the Exit control ends it as "incomplete": counts and
 * status only, and an export labelled incomplete. Restart begins a new
 * session that shares no records with the ended one.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  advanceUntil,
  checkKeysAndBeginPractice,
  exitSession,
  mainPlan,
  openWithFakeClock,
  progress,
  runTrial,
  startMain,
  startPractice,
  type ExperimentDriver,
} from "./support/session";
import {
  PRACTICE_TRIALS,
  answered,
  expectExportMatchesSession,
  type ExpectedTrial,
} from "./support/results";
import {
  NO_CLIENT_STORAGE,
  clientStorage,
  recordNetwork,
} from "./support/network";

const BREAK_AFTER = 30;

/** A fresh, not-yet-started session: the briefing, and nothing else. */
async function expectFreshStart(page: Page, driver: ExperimentDriver) {
  await expect(
    page.getByRole("button", { name: `Start ${driver.name}` }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Experiment controls" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Experiment paused" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Session overview" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Download trial data (CSV)" }),
  ).toHaveCount(0);
  expect(await clientStorage(page)).toEqual(NO_CLIENT_STORAGE);
}

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test.describe(`${driver.name} session lifecycle`, () => {
    test("reload before starting, during practice, during the main task, and during the break restores nothing", async ({
      page,
      baseURL,
    }) => {
      // 12 practice + 30 main trials in simulated time: long, not flaky.
      test.slow();
      const network = recordNetwork(page, baseURL ?? "");
      await openWithFakeClock(page, driver);
      await page.reload();
      await expectFreshStart(page, driver);

      // During practice (after two recorded trials).
      await driver.completeMappingCheck(page);
      await page
        .getByRole("button", { name: "Begin 12 practice trials" })
        .click();
      await runTrial(page, driver, "correct");
      await runTrial(page, driver, "wrong");
      await page.reload();
      await expectFreshStart(page, driver);

      // During the main task (after two main trials).
      await driver.completeMappingCheck(page);
      await page
        .getByRole("button", { name: "Begin 12 practice trials" })
        .click();
      for (let trial = 1; trial <= PRACTICE_TRIALS; trial++) {
        await runTrial(page, driver, "correct");
      }
      await startMain(page);
      await runTrial(page, driver, "correct");
      await runTrial(page, driver, "none");
      await expect(progress(page)).toHaveText(/^Trial \d+ of 60$/);
      await page.reload();
      await expectFreshStart(page, driver);

      // During the optional break.
      await driver.completeMappingCheck(page);
      await page
        .getByRole("button", { name: "Begin 12 practice trials" })
        .click();
      for (let trial = 1; trial <= PRACTICE_TRIALS; trial++) {
        await runTrial(page, driver, "correct");
      }
      await startMain(page);
      for (let trial = 1; trial <= BREAK_AFTER; trial++) {
        await runTrial(page, driver, mainPlan(trial));
      }
      const rest = page.getByRole("heading", {
        name: "Rest before continuing",
      });
      await advanceUntil(page, () => rest.isVisible(), "the optional break");
      await page.reload();
      await expectFreshStart(page, driver);

      expect(network.violations()).toEqual([]);
    });

    test("navigating away, Back, and Forward never restore a session in progress", async ({
      page,
      baseURL,
    }) => {
      const network = recordNetwork(page, baseURL ?? "");
      await startPractice(page, driver);
      await runTrial(page, driver, "correct");
      await expect(progress(page)).toHaveText(/^Practice [12] of 12$/);

      // Leave through the site navigation, in the middle of practice.
      await page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Experiments" })
        .click();
      await expect(page).toHaveURL(/\/experiments$/);

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${driver.path}$`));
      await expectFreshStart(page, driver);

      await page.goForward();
      await expect(page).toHaveURL(/\/experiments$/);
      await page.goBack();
      await expectFreshStart(page, driver);

      expect(network.violations()).toEqual([]);
    });

    test("exit, then restart: the ended session is incomplete, and the new one shares no records", async ({
      page,
      baseURL,
    }) => {
      const network = recordNetwork(page, baseURL ?? "");
      const ended: ExpectedTrial[] = [];
      await startPractice(page, driver);
      ended.push(
        answered("practice", 1, await runTrial(page, driver, "correct")),
      );
      ended.push(answered("practice", 2, await runTrial(page, driver, "none")));

      await exitSession(page);
      // Labelled incomplete; never presented as a completed result.
      await expect(
        page.getByRole("heading", { name: `${driver.name} session complete` }),
      ).toHaveCount(0);
      await expect(
        page.getByText(
          "This session was exited before completion. Uncompleted trials are not represented as timeouts or valid outcomes.",
        ),
      ).toBeVisible();
      const first = await expectExportMatchesSession(
        page,
        driver,
        ended,
        "incomplete",
      );

      await page.getByRole("button", { name: "Restart" }).click();
      await checkKeysAndBeginPractice(page, driver);
      await expect(progress(page)).toHaveText("Practice 1 of 12");
      const restarted = [
        answered("practice", 1, await runTrial(page, driver, "wrong")),
      ];
      await exitSession(page);
      const second = await expectExportMatchesSession(
        page,
        driver,
        restarted,
        "incomplete",
      );
      // A new session: its own trial order (a fresh random seed), and none of
      // the ended session's records.
      expect(second.records[0].seed).not.toBe(first.records[0].seed);

      expect(network.violations()).toEqual([]);
      expect(await clientStorage(page)).toEqual(NO_CLIENT_STORAGE);
    });

    test("closing the page mid-session leaves nothing behind", async ({
      context,
    }) => {
      const page = await context.newPage();
      await startPractice(page, driver);
      await runTrial(page, driver, "correct");
      await page.close({ runBeforeUnload: true });

      const reopened = await context.newPage();
      await reopened.goto(driver.path);
      await expectFreshStart(reopened, driver);
    });
  });
}
