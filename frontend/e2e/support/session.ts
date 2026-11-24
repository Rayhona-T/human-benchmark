/**
 * Drives a real experiment session in the browser the way a participant
 * would: it reads the stimulus shown on screen, presses keys, and advances
 * Playwright's fake clock (page.clock). The application is unchanged: the
 * same protocol, trial counts, timing parameters and schedules as in
 * production. Nothing here reaches into application state.
 *
 * Time only moves when a test advances the clock, in small steps, until
 * the screen shows what the test is waiting for. No real-time sleeps.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export type Plan = "correct" | "wrong" | "none";

export interface ExperimentDriver {
  name: "Stroop" | "Flanker";
  path: string;
  keys: readonly string[];
  /** The timed stimulus on the trial stage (not the mapping-check example). */
  stimulus: (page: Page) => Locator;
  /** The correct key for the stimulus currently shown, read from the page. */
  correctKey: (page: Page) => Promise<string>;
  /** Intro → instructions → mapping check, leaving practice ready to begin. */
  completeMappingCheck: (page: Page) => Promise<void>;
}

/** Protocol ink colors (HB-STROOP-1.0 §4) and their keys. */
const STROOP_KEY_BY_COLOR: Record<string, string> = {
  "rgb(248, 113, 113)": "d", // red #F87171
  "rgb(96, 165, 250)": "f", // blue #60A5FA
  "rgb(74, 222, 128)": "j", // green #4ADE80
  "rgb(250, 204, 21)": "k", // yellow #FACC15
};

export const STROOP: ExperimentDriver = {
  name: "Stroop",
  path: "/experiments/stroop",
  keys: ["d", "f", "j", "k"],
  stimulus: (page) => page.locator(".experiment-trial-stage .stroop-stimulus"),
  correctKey: async (page) => {
    const color = await STROOP.stimulus(page).evaluate(
      (element) => (element as HTMLElement).style.color,
    );
    const key = STROOP_KEY_BY_COLOR[color];
    if (!key) throw new Error(`Unexpected Stroop ink color: ${color}`);
    return key;
  },
  completeMappingCheck: async (page) => {
    await page.getByRole("button", { name: "Start Stroop" }).click();
    for (const key of STROOP.keys) await page.keyboard.press(key);
  },
};

/** Center arrow of the five-symbol array (HB-FLANKER-1.0 §4–§5). */
const FLANKER_KEY_BY_ARROW: Record<string, string> = { "←": "f", "→": "j" };

export const FLANKER: ExperimentDriver = {
  name: "Flanker",
  path: "/experiments/flanker",
  keys: ["f", "j"],
  stimulus: (page) => page.locator(".experiment-trial-stage .flanker-array"),
  correctKey: async (page) => {
    const center = await FLANKER.stimulus(page)
      .locator(".flanker-cell")
      .nth(2)
      .textContent();
    const key = FLANKER_KEY_BY_ARROW[(center ?? "").trim()];
    if (!key) throw new Error(`Unexpected Flanker target: ${center}`);
    return key;
  },
  completeMappingCheck: async (page) => {
    await page.getByRole("button", { name: "Start Flanker" }).click();
    await page.keyboard.press("f");
    await page.keyboard.press("j");
  },
};

/**
 * Advances the fake clock in small steps until `done()` is true. Fails with
 * a clear message instead of hanging when the expected state never comes.
 */
export async function advanceUntil(
  page: Page,
  done: () => Promise<boolean>,
  what: string,
  { stepMs = 50, maxMs = 10_000 } = {},
): Promise<void> {
  for (let elapsed = 0; elapsed <= maxMs; elapsed += stepMs) {
    if (await done()) return;
    await page.clock.runFor(stepMs);
  }
  throw new Error(
    `Gave up after ${maxMs} ms of simulated time waiting for: ${what}`,
  );
}

/** The wrong mapped key for a trial (a key the participant could press). */
function wrongKey(driver: ExperimentDriver, correct: string): string {
  const key = driver.keys.find((candidate) => candidate !== correct);
  if (!key) throw new Error("No alternative mapped key");
  return key;
}

/**
 * Runs one timed trial: waits for the stimulus, then responds per `plan`
 * after 400 ms of simulated time, or lets the 2,000 ms deadline pass.
 * Returns the correct key that was shown.
 */
export async function runTrial(
  page: Page,
  driver: ExperimentDriver,
  plan: Plan,
): Promise<string> {
  const stimulus = driver.stimulus(page);
  await advanceUntil(page, () => stimulus.isVisible(), "the next stimulus");
  const correct = await driver.correctKey(page);
  if (plan !== "none") {
    await page.clock.runFor(400);
    await page.keyboard.press(
      plan === "correct" ? correct : wrongKey(driver, correct),
    );
  }
  await advanceUntil(
    page,
    async () => !(await stimulus.isVisible()),
    "the stimulus to end",
    { maxMs: 3_000 },
  );
  return correct;
}

/** Main-trial plan with known totals: every 7th no response, every 5th wrong. */
export function mainPlan(trialNumber: number): Plan {
  if (trialNumber % 7 === 0) return "none";
  if (trialNumber % 5 === 0) return "wrong";
  return "correct";
}

export function expectedMainTotals(trials: number) {
  const totals = { correct: 0, wrong: 0, none: 0 };
  for (let trial = 1; trial <= trials; trial++) {
    const plan = mainPlan(trial);
    if (plan === "correct") totals.correct += 1;
    else if (plan === "wrong") totals.wrong += 1;
    else totals.none += 1;
  }
  return totals;
}

/** The value shown next to a label in the results overview. */
export function statValue(page: Page, label: string): Locator {
  return (
    page
      .locator(".session-results__stats > div")
      // Anchored: "Correct" must not also match "Incorrect".
      .filter({ has: page.locator("dt", { hasText: new RegExp(`^${label}`) }) })
      .locator("dd")
  );
}

/** Opens an experiment with the fake clock installed before any page code runs. */
export async function openWithFakeClock(page: Page, driver: ExperimentDriver) {
  const start = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.goto(driver.path);
  await expect(
    page.getByRole("button", { name: `Start ${driver.name}` }),
  ).toBeVisible();
  // install() alone lets simulated time keep flowing with real time, so slow
  // machines or long assertion waits would move the experiment on by
  // themselves (an observed flake). Pause now, before any timed screen: from
  // here on, time moves only when the test advances it.
  await page.clock.pauseAt(new Date(start.getTime() + 60 * 60 * 1000));
}
