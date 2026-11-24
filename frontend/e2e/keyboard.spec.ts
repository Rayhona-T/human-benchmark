/**
 * Keyboard-only participant journey (NFR-ACC-01), in every browser project:
 * no mouse from the home page to the start of practice, through trials,
 * pause/resume, the Exit and leave/clear confirmations, and back to the
 * start. Every focused control must show a visible focus indicator, and
 * modal dialogs must keep focus inside until closed.
 *
 * Response keys (D F J K / F J) are handled on the window during trials and
 * never activate controls; Enter and Space only operate the focused control.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  advanceUntil,
  awaitStimulus,
  progress,
  type ExperimentDriver,
} from "./support/session";

/**
 * Presses Tab (or Shift+Tab) until `target` has focus, checking each stop
 * shows focus.
 *
 * During a session, tabbing past the last control moves focus into the
 * browser's own interface: a real loss of page focus, which pauses the
 * session (protocol §7). Each stop checks that this did not happen, so the
 * journey stays a deliberate one.
 */
async function tabTo(
  page: Page,
  target: Locator,
  { backward = false, maxPresses = 40 } = {},
) {
  const key = backward ? "Shift+Tab" : "Tab";
  for (let press = 0; press < maxPresses; press++) {
    if (await target.evaluate((el) => el === document.activeElement)) {
      await expectVisibleFocus(page);
      await expect(
        page.getByText(/triggered because the page was hidden or lost focus/),
      ).toHaveCount(0);
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error(`${key} never reached ${target.toString()}`);
}

/** The focused element has a visible indicator (outline or box shadow). */
async function expectVisibleFocus(page: Page) {
  const indicator = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "no focused element";
    const style = getComputedStyle(el);
    const outline =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
    const shadow = style.boxShadow !== "none";
    return outline || shadow
      ? "visible"
      : `no indicator on ${el.tagName} "${el.textContent?.trim()}"`;
  });
  expect(indicator).toBe("visible");
}

/** Tab and Shift+Tab never move focus out of an open modal dialog. */
async function expectFocusContained(page: Page, dialog: Locator) {
  const start = await page.evaluateHandle(() => document.activeElement);
  // Forward past the end and back past the start: ends where it began.
  for (const key of [
    "Tab",
    "Tab",
    "Tab",
    "Shift+Tab",
    "Shift+Tab",
    "Shift+Tab",
  ]) {
    await page.keyboard.press(key);
    expect(
      await dialog.evaluate((d) => d.contains(document.activeElement)),
      `focus left the dialog after ${key}`,
    ).toBe(true);
    await expectVisibleFocus(page);
  }
  expect(
    await page.evaluate((el) => el === document.activeElement, start),
    "focus returned to where it started",
  ).toBe(true);
}

for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
  test(`${driver.name}: the whole participant journey works without a mouse`, async ({
    page,
    browserName,
  }) => {
    // Headless WebKit (Playwright) never puts links in the Tab order, like
    // Safari's default; even Alt/Option+Tab did not reach them here. Link
    // keyboard access is checked in Chromium and Firefox; in WebKit the
    // journey opens the experiment directly and covers every button and
    // dialog.
    const linksTabbable = browserName !== "webkit";
    // After the focused control is removed (Resume, Continue, Stay),
    // Chromium and Firefox continue the Tab sequence from where it was, so
    // the session bar is reached backward; WebKit restarts at the start of
    // the page, so forward. Either way the wrong direction leaves the page
    // (a real focus loss, which pauses the session).
    const fromRemoved = { backward: browserName !== "webkit" };
    const start = new Date("2026-01-01T00:00:00Z");
    await page.clock.install({ time: start });
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    if (linksTabbable) {
      await page.goto("/");
      await page.clock.pauseAt(new Date(start.getTime() + 60 * 60 * 1000));
      // Site navigation to the experiment, by keyboard.
      await tabTo(page, nav.getByRole("link", { name: "Experiments" }));
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/experiments$/);
      await tabTo(
        page,
        page.getByRole("link", { name: `Start ${driver.name}` }),
      );
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${driver.path}$`));
    } else {
      await page.goto(driver.path);
      await page.clock.pauseAt(new Date(start.getTime() + 60 * 60 * 1000));
    }

    // Briefing → instructions; focus moves to the instructions heading.
    await tabTo(
      page,
      page.getByRole("button", { name: `Start ${driver.name}` }),
    );
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Check the response keys" }),
    ).toBeFocused();
    for (const key of driver.keys) await page.keyboard.press(key);
    await tabTo(
      page,
      page.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    await page.keyboard.press("Enter");

    // During trials focus is on no control, so Enter/Space cannot activate
    // anything and response keys only answer the trial.
    const seen = await awaitStimulus(page, driver);
    expect(
      await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);
    await page.keyboard.press(seen.correctKey);
    const feedback = page.locator(".experiment-feedback");
    await advanceUntil(page, () => feedback.isVisible(), "feedback");
    await expect(feedback.getByRole("heading")).toHaveText("Correct");

    // Pause and resume by keyboard (between trials).
    const controls = page.getByRole("group", { name: "Experiment controls" });
    await tabTo(page, controls.getByRole("button", { name: "Pause" }));
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Experiment paused" }),
    ).toBeFocused();
    await tabTo(page, page.getByRole("button", { name: "Resume" }));
    await page.keyboard.press("Enter");
    await expect(progress(page)).toHaveText("Practice 2 of 12");

    // Exit confirmation: focus starts on the safe choice and stays inside.
    // Escape cancels and the session resumes; focus then goes to no control
    // (by design), so Enter/Space cannot operate a control during trials.
    const exit = controls.getByRole("button", { name: "Exit" });
    await tabTo(page, exit, fromRemoved);
    await page.keyboard.press("Enter");
    const exitDialog = page.getByRole("alertdialog", {
      name: "Exit this session?",
    });
    await expect(
      exitDialog.getByRole("button", { name: "Continue" }),
    ).toBeFocused();
    await expectFocusContained(page, exitDialog);
    await page.keyboard.press("Escape");
    await expect(exitDialog).toHaveCount(0);
    expect(
      await page.evaluate(() => document.activeElement === document.body),
    ).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Experiment paused" }),
    ).toHaveCount(0);

    // Leave confirmation from the site navigation, by keyboard.
    if (linksTabbable) {
      await tabTo(page, nav.getByRole("link", { name: "Methodology" }), {
        backward: true,
      });
      await page.keyboard.press("Enter");
      const leave = page.getByRole("alertdialog", {
        name: "Leave this session?",
      });
      await expect(leave.getByRole("button", { name: "Stay" })).toBeFocused();
      await expectFocusContained(page, leave);
      await page.keyboard.press("Enter"); // Stay (focused)
      await expect(leave).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`${driver.path}$`));
    }

    // Exit for real, then clear the data by keyboard.
    await tabTo(page, exit, fromRemoved);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab"); // to "Exit session"
    await expect(
      exitDialog.getByRole("button", { name: "Exit session" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Session ended" }),
    ).toBeFocused();

    await tabTo(
      page,
      page.getByRole("button", { name: "Clear this session's data" }),
    );
    await page.keyboard.press("Enter");
    const clear = page.getByRole("alertdialog", {
      name: "Clear this session's data?",
    });
    await expect(clear.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expectFocusContained(page, clear);
    await clear.getByRole("button", { name: "Clear data" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(
      page.getByRole("button", { name: `Start ${driver.name}` }),
    ).toBeVisible();
  });
}
