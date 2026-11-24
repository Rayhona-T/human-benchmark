/**
 * Page visibility and window focus changes for the interruption tests.
 *
 * Focus loss is REAL: with Playwright's focus emulation turned off, the
 * browser window is minimized through the Chrome DevTools Protocol, so
 * Chromium itself fires `blur` and document.hasFocus() becomes false;
 * restoring the window fires `focus`. (Chromium only.)
 *
 * Hiding the page is EMULATED: headless Chromium keeps every page visible
 * (document.hidden stays false even when the window is minimized or another
 * tab is brought to the front; checked while writing these tests). The test
 * therefore overrides document.hidden / visibilityState on the document
 * instance and dispatches `visibilitychange`, which is what the app listens
 * to. The application code is not changed; removing the override restores
 * the browser's own values.
 */
import { expect, type CDPSession, type Page } from "@playwright/test";

export async function hideDocument(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

export async function showDocument(page: Page) {
  await page.evaluate(() => {
    // Removing the instance overrides restores the browser's own getters.
    Reflect.deleteProperty(document, "visibilityState");
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.evaluate(() => document.hidden)).toBe(false);
}

const focusSessions = new WeakMap<Page, CDPSession>();

/**
 * A DevTools session for the page with Chromium's focus emulation turned
 * off. Playwright normally makes every page report focus regardless of its
 * window; with emulation off, focus follows the real window state. The
 * session stays attached for the page's lifetime, so the setting persists.
 */
async function focusSession(page: Page): Promise<CDPSession> {
  let session = focusSessions.get(page);
  if (!session) {
    session = await page.context().newCDPSession(page);
    await session.send("Emulation.setFocusEmulationEnabled", {
      enabled: false,
    });
    focusSessions.set(page, session);
  }
  return session;
}

async function setWindowState(page: Page, windowState: "minimized" | "normal") {
  const session = await focusSession(page);
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", {
    windowId,
    bounds: { windowState },
  });
}

/** Real focus loss: minimizes the window and waits until the page sees it. */
export async function loseWindowFocus(page: Page) {
  await setWindowState(page, "minimized");
  await expect
    .poll(() => page.evaluate(() => document.hasFocus()), {
      message: "the page to lose focus after minimizing its window",
    })
    .toBe(false);
}

/** Restores the window and waits until the page has focus again. */
export async function restoreWindowFocus(page: Page) {
  await setWindowState(page, "normal");
  await expect
    .poll(() => page.evaluate(() => document.hasFocus()), {
      message: "the page to regain focus after restoring its window",
    })
    .toBe(true);
}
