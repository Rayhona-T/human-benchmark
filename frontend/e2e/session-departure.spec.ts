/**
 * Task 10.4 owner-approved behavior, in every browser project:
 *   - FR-PRI-03: "Clear this session's data" (confirmed) on ended sessions;
 *   - confirming departures from an ACTIVE session: in-app links and
 *     Back/Forward ask "Leave this session?" (the session pauses; Stay
 *     resumes, Leave goes); reload and close use the browser's own
 *     beforeunload prompt, whose text the app cannot set.
 * Clearing a COMPLETED session after export is covered in
 * experiments.spec.ts (all browsers).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  checkKeysAndBeginPractice,
  clearSessionData,
  exitSession,
  expectNoLeavePrompt,
  expectPaused,
  leaveDialog,
  openFromCatalogue,
  progress,
  runTrial,
  startPractice,
  type ExperimentDriver,
} from "./support/session";
import {
  answered,
  expectExportMatchesSession,
  type ExpectedTrial,
} from "./support/results";
import {
  NO_CLIENT_STORAGE,
  clientStorage,
  recordNetwork,
} from "./support/network";

function experimentsLink(page: Page) {
  return page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Experiments" });
}

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test.describe(`${driver.name} clearing and leaving`, () => {
    test("clear an incomplete session after export: nothing carries into the next session", async ({
      page,
      baseURL,
    }) => {
      const network = recordNetwork(page, baseURL ?? "");
      await startPractice(page, driver);
      // Not offered while the session runs.
      await expect(
        page.getByRole("button", { name: "Clear this session's data" }),
      ).toHaveCount(0);
      const first: ExpectedTrial[] = [
        answered("practice", 1, await runTrial(page, driver, "correct")),
        answered("practice", 2, await runTrial(page, driver, "wrong")),
      ];
      await exitSession(page);
      const before = await expectExportMatchesSession(
        page,
        driver,
        first,
        "incomplete",
      );

      // Cancel keeps everything.
      await page
        .getByRole("button", { name: "Clear this session's data" })
        .click();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("heading", { name: "Session ended" }),
      ).toBeVisible();

      // Confirm, then a repeated click on the (now absent) control does
      // nothing: the page is at the start with no session.
      await clearSessionData(page);
      await expect(
        page.getByRole("heading", { name: "Session ended" }),
      ).toHaveCount(0);
      // Focus moves to the start screen's heading, not a removed button.
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expectNoLeavePrompt(page);

      // Navigating away and back after clearing: still a fresh start.
      await experimentsLink(page).click();
      await expect(page).toHaveURL(/\/experiments$/);
      await expect(leaveDialog(page)).toHaveCount(0);
      await page.goBack();
      await expect(
        page.getByRole("button", { name: `Start ${driver.name}` }),
      ).toBeVisible();

      // The next session has only its own records.
      await page.getByRole("button", { name: `Start ${driver.name}` }).click();
      await checkKeysAndBeginPractice(page, driver);
      const second: ExpectedTrial[] = [
        answered("practice", 1, await runTrial(page, driver, "none")),
      ];
      await exitSession(page);
      const after = await expectExportMatchesSession(
        page,
        driver,
        second,
        "incomplete",
      );
      expect(after.records[0].seed).not.toBe(before.records[0].seed);

      expect(network.violations()).toEqual([]);
      expect(await clientStorage(page)).toEqual(NO_CLIENT_STORAGE);
    });

    test("in-app links, Back, and Forward ask before leaving an active session", async ({
      page,
    }) => {
      await openFromCatalogue(page, driver);
      await expectNoLeavePrompt(page); // nothing to lose yet
      await driver.completeMappingCheck(page);
      await page
        .getByRole("button", { name: "Begin 12 practice trials" })
        .click();
      await runTrial(page, driver, "correct");

      // A link: the session pauses behind the dialog; Stay resumes it.
      await experimentsLink(page).click();
      await expect(leaveDialog(page)).toBeVisible();
      await expect(
        leaveDialog(page).getByRole("button", { name: "Stay" }),
      ).toBeFocused();
      await expect(page).toHaveURL(new RegExp(`${driver.path}$`));
      await expect(
        page.getByRole("heading", { name: "Experiment paused" }),
      ).toBeAttached();
      await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
      await expect(leaveDialog(page)).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Experiment paused" }),
      ).toHaveCount(0);
      await expect(progress(page)).toHaveText(/^Practice [23] of 12$/);
      await runTrial(page, driver, "correct");

      // Escape is Stay too.
      await experimentsLink(page).click();
      await expect(leaveDialog(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(leaveDialog(page)).toHaveCount(0);

      // Back (history), on a manually paused session: asks; Stay keeps it
      // paused; then Leave goes back.
      await page
        .getByRole("group", { name: "Experiment controls" })
        .getByRole("button", { name: "Pause" })
        .click();
      await expectPaused(page, "no trial on screen");
      await page.goBack();
      await expect(leaveDialog(page)).toBeVisible();
      await leaveDialog(page).getByRole("button", { name: "Stay" }).click();
      await expectPaused(page, "no trial on screen");
      await page.goBack();
      await expect(leaveDialog(page)).toBeVisible();
      await leaveDialog(page).getByRole("button", { name: "Leave" }).click();
      await expect(page).toHaveURL(/\/experiments$/);

      // Forward returns to a fresh start: nothing was kept.
      await page.goForward();
      await expect(
        page.getByRole("button", { name: `Start ${driver.name}` }),
      ).toBeVisible();
      await expectNoLeavePrompt(page);
    });

    test("reload and close use the browser's prompt only while a session is active", async ({
      page,
      context,
    }) => {
      const dialogs: string[] = [];
      await startPractice(page, driver);
      await runTrial(page, driver, "correct");

      // Reload: the browser asks; dismissing keeps the session.
      page.once("dialog", (dialog) => {
        dialogs.push(dialog.type());
        void dialog.dismiss();
      });
      await page.reload({ timeout: 5_000 }).catch(() => undefined);
      expect(dialogs).toEqual(["beforeunload"]);
      await expect(progress(page)).toHaveText(/^Practice [23] of 12$/);

      // Close: the browser asks; dismissing keeps the page open.
      page.once("dialog", (dialog) => {
        dialogs.push(dialog.type());
        void dialog.dismiss();
      });
      await page.close({ runBeforeUnload: true });
      await expect.poll(() => dialogs.length).toBe(2);
      expect(page.isClosed()).toBe(false);
      await expect(progress(page)).toHaveText(/^Practice [23] of 12$/);

      // An ended session: no prompt (nothing would be lost).
      await exitSession(page);
      await expectNoLeavePrompt(page);
      page.on("dialog", (dialog) => {
        dialogs.push(`unexpected ${dialog.type()}`);
        void dialog.dismiss();
      });
      await page.reload();
      await expect(
        page.getByRole("button", { name: `Start ${driver.name}` }),
      ).toBeVisible();
      expect(dialogs).toEqual(["beforeunload", "beforeunload"]);

      // Closing a page at the start never asks.
      // (Playwright's WebKit leaves a page open after a beforeunload-running
      // close even when nothing objects, so the check is that no prompt
      // appears; the page is then closed normally.)
      const fresh = await context.newPage();
      const freshDialogs: string[] = [];
      fresh.on("dialog", (dialog) => {
        freshDialogs.push(dialog.type());
        void dialog.accept();
      });
      await fresh.goto(driver.path);
      await fresh.close({ runBeforeUnload: true });
      await page.waitForTimeout(500);
      expect(freshDialogs).toEqual([]);
      if (!fresh.isClosed()) await fresh.close();
    });
  });
}
