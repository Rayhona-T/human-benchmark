/**
 * Viewports (NFR-RESP-01), in every browser project. Layout checks: no
 * horizontal page overflow, usable navigation, and, during timed trials,
 * whether the stimulus is fully inside the visible viewport at each size.
 *
 * The experiments are keyboard tasks (D F J K / F J). Phone and tablet sizes
 * here check layout only; they do not imply that touch-only devices can take
 * part (see TESTING.md).
 *
 * Flanker has a ratified width guard (HB-FLANKER-1.0 §14 decision 7): no
 * timed trial starts unless the whole 272 px array fits the viewport width.
 * Stroop's protocol specifies no guard; its behavior is measured here, not
 * changed (a guard would be a protocol decision).
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  FLANKER,
  STROOP,
  awaitStimulus,
  checkKeysAndBeginPractice,
  openWithFakeClock,
  type ExperimentDriver,
} from "./support/session";

const VIEWPORTS = [
  { name: "desktop 1440×900", width: 1440, height: 900 },
  { name: "laptop 1280×720", width: 1280, height: 720 },
  { name: "tablet portrait 768×1024", width: 768, height: 1024 },
  { name: "phone 390×844", width: 390, height: 844 },
  { name: "small phone 320×568", width: 320, height: 568 },
] as const;

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

/** How much of the element lies outside the visible viewport (px). */
async function outsideViewport(target: Locator) {
  return target.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return {
      left: Math.max(0, -box.left),
      right: Math.max(0, box.right - window.innerWidth),
      top: Math.max(0, -box.top),
      bottom: Math.max(0, box.bottom - window.innerHeight),
    };
  });
}

const FULLY_VISIBLE = { left: 0, right: 0, top: 0, bottom: 0 };

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("site pages fit the width and the navigation is usable", async ({
      page,
    }) => {
      for (const path of ["/", "/experiments", "/methodology"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await horizontalOverflow(page), `${path} overflow`).toBe(0);
      }
      // Narrow layouts use a disclosure menu; either way the links work.
      const menu = page.getByRole("button", { name: /menu/i });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Experiments" })
        .click();
      await expect(page).toHaveURL(/\/experiments$/);
    });

    for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
      test(`${driver.name}: briefing fits; the first stimulus is fully visible`, async ({
        page,
      }) => {
        await openWithFakeClock(page, driver);
        expect(await horizontalOverflow(page), "briefing overflow").toBe(0);
        await page
          .getByRole("button", { name: `Start ${driver.name}` })
          .click();
        expect(await horizontalOverflow(page), "instructions overflow").toBe(0);
        await checkKeysAndBeginPractice(page, driver);
        await awaitStimulus(page, driver);
        expect(await horizontalOverflow(page), "trial overflow").toBe(0);
        expect(
          await outsideViewport(driver.stimulus(page)),
          "stimulus outside the visible viewport",
        ).toEqual(FULLY_VISIBLE);
      });
    }
  });
}

test.describe("resizing and orientation", () => {
  test("Flanker: a too-narrow window blocks the next trial until it fits again", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openWithFakeClock(page, FLANKER);
    await page.getByRole("button", { name: "Start Flanker" }).click();
    await checkKeysAndBeginPractice(page, FLANKER);
    await awaitStimulus(page, FLANKER);
    await page.clock.runFor(380);
    await page.keyboard.press(await FLANKER.correctKey(page));

    // Narrower than the 272 px array: the next trial does not start.
    await page.setViewportSize({ width: 260, height: 720 });
    const paused = page.getByRole("heading", { name: "Experiment paused" });
    for (let step = 0; step < 60 && !(await paused.isVisible()); step++) {
      await page.clock.runFor(50);
    }
    await expect(paused).toBeVisible();
    await expect(FLANKER.stimulus(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Resume" })).toBeDisabled();

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole("button", { name: "Resume" })).toBeEnabled();
    await page.getByRole("button", { name: "Resume" }).click();
    await awaitStimulus(page, FLANKER);
  });

  test("phone landscape 844×390 and 568×320: where each stimulus appears", async ({
    browser,
  }) => {
    // Measurement, not a pass/fail rule on the protocol: records whether the
    // stimulus is fully visible without scrolling in short landscape windows
    // (reported in TESTING.md and the Task 10.4 report).
    const findings: string[] = [];
    for (const size of [
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]) {
      for (const driver of [STROOP, FLANKER] as ExperimentDriver[]) {
        const context = await browser.newContext({ viewport: size });
        const page = await context.newPage();
        await openWithFakeClock(page, driver);
        await page
          .getByRole("button", { name: `Start ${driver.name}` })
          .click();
        await checkKeysAndBeginPractice(page, driver);
        await awaitStimulus(page, driver);
        const outside = await outsideViewport(driver.stimulus(page));
        findings.push(
          `${driver.name} ${size.width}×${size.height}: ${JSON.stringify(outside)}`,
        );
        await context.close();
      }
    }
    test.info().annotations.push({
      type: "landscape stimulus visibility",
      description: findings.join("; "),
    });
    console.log(`LANDSCAPE ${findings.join(" | ")}`);
  });
});
