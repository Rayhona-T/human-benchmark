/**
 * Automated accessibility scans (axe-core) of every participant-facing state,
 * in every browser project. The break and completed-results states are
 * scanned inside the complete-session test (experiments.spec.ts), which
 * already reaches them. Keyboard-only use is checked in keyboard.spec.ts.
 */
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./support/a11y";
import {
  FLANKER,
  STROOP,
  advanceUntil,
  awaitStimulus,
  exitSession,
  leaveDialog,
  openWithFakeClock,
  runTrial,
  startMain,
  type ExperimentDriver,
} from "./support/session";

test("site pages have no automatically detectable violations", async ({
  page,
}) => {
  for (const [path, state] of [
    ["/", "home"],
    ["/experiments", "experiment catalogue"],
    ["/methodology", "methodology"],
    ["/no-such-page", "not-found page"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page, state, { fakeClock: false });
  }
});

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test(`${driver.name}: every session state has no automatically detectable violations`, async ({
    page,
    browserName,
  }) => {
    await openWithFakeClock(page, driver);
    await expectNoAxeViolations(page, "briefing");

    await page.getByRole("button", { name: `Start ${driver.name}` }).click();
    await expectNoAxeViolations(page, "instructions and mapping check");
    for (const key of driver.keys) await page.keyboard.press(key);
    // The state under test: every key recognized, so practice can begin.
    await expect(
      page.getByRole("button", { name: "Begin 12 practice trials" }),
    ).toBeEnabled();
    await expectNoAxeViolations(page, "mapping check complete");
    await page
      .getByRole("button", { name: "Begin 12 practice trials" })
      .click();

    await expect(page.locator(".experiment-fixation")).toBeVisible();
    await expectNoAxeViolations(page, "practice fixation");
    await awaitStimulus(page, driver);
    await expectNoAxeViolations(page, "practice stimulus");
    await page.clock.runFor(380);
    await page.keyboard.press(await driver.correctKey(page));
    const feedback = page.locator(".experiment-feedback");
    await advanceUntil(page, () => feedback.isVisible(), "practice feedback");
    await expectNoAxeViolations(page, "practice feedback");

    // Leave confirmation (in-app link) over the paused session.
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Methodology" })
      .click();
    await expect(leaveDialog(page)).toBeVisible();
    // Firefox: running axe in exactly this state crashed the page in every
    // attempt (Playwright's Firefox build, Windows; the dialog itself works in
    // Firefox, see session-departure.spec.ts and keyboard.spec.ts). It is the
    // same SessionDialog component as the exit and clear confirmations, which
    // Firefox does scan; Chromium and WebKit scan this one.
    if (browserName !== "firefox") {
      await expectNoAxeViolations(page, "leave confirmation");
    }
    await leaveDialog(page).getByRole("button", { name: "Stay" }).click();

    for (let trial = 2; trial <= 12; trial++) {
      await runTrial(page, driver, "correct");
    }
    await advanceUntil(
      page,
      () =>
        page.getByRole("button", { name: "Start 60 main trials" }).isVisible(),
      "the ready screen",
    );
    await expectNoAxeViolations(page, "ready for the main task");
    await startMain(page);
    await awaitStimulus(page, driver);
    await expectNoAxeViolations(page, "main stimulus");
    await page.clock.runFor(2_100);

    await page
      .getByRole("group", { name: "Experiment controls" })
      .getByRole("button", { name: "Pause" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Experiment paused" }),
    ).toBeVisible();
    await expectNoAxeViolations(page, "paused");

    await page
      .getByRole("group", { name: "Experiment controls" })
      .getByRole("button", { name: "Exit" })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectNoAxeViolations(page, "exit confirmation");
    await page.getByRole("button", { name: "Continue" }).click();

    await exitSession(page);
    await expectNoAxeViolations(page, "incomplete results");
    await page
      .getByRole("button", { name: "Clear this session's data" })
      .click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expectNoAxeViolations(page, "clear confirmation");
  });
}
