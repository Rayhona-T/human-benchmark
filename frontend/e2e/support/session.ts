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
  /**
   * The stimulus currently shown, as the values its CSV stimulus columns
   * must contain (read from the screen, not from application state).
   */
  observeStimulus: (page: Page) => Promise<Record<string, string>>;
  /** Intro → instructions → mapping check, leaving practice ready to begin. */
  completeMappingCheck: (page: Page) => Promise<void>;
}

/** Protocol ink colors (HB-STROOP-1.0 §4), their names, and their keys. */
const STROOP_INK_BY_COLOR: Record<string, { ink: string; key: string }> = {
  "rgb(248, 113, 113)": { ink: "red", key: "d" }, // #F87171
  "rgb(96, 165, 250)": { ink: "blue", key: "f" }, // #60A5FA
  "rgb(74, 222, 128)": { ink: "green", key: "j" }, // #4ADE80
  "rgb(250, 204, 21)": { ink: "yellow", key: "k" }, // #FACC15
};

async function stroopInk(page: Page) {
  const color = await STROOP.stimulus(page).evaluate(
    (element) => (element as HTMLElement).style.color,
  );
  const ink = STROOP_INK_BY_COLOR[color];
  if (!ink) throw new Error(`Unexpected Stroop ink color: ${color}`);
  return ink;
}

export const STROOP: ExperimentDriver = {
  name: "Stroop",
  path: "/experiments/stroop",
  keys: ["d", "f", "j", "k"],
  stimulus: (page) => page.locator(".experiment-trial-stage .stroop-stimulus"),
  correctKey: async (page) => (await stroopInk(page)).key,
  observeStimulus: async (page) => ({
    stimulus_word: ((await STROOP.stimulus(page).textContent()) ?? "").trim(),
    stimulus_ink: (await stroopInk(page)).ink,
  }),
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
  observeStimulus: async (page) => {
    const cells = await FLANKER.stimulus(page)
      .locator(".flanker-cell")
      .allTextContents();
    const symbols = cells.map((cell) => cell.trim());
    const flanker = symbols[0];
    return {
      stimulus_symbols: symbols.join(""),
      target_direction: symbols[2] === "←" ? "left" : "right",
      flanker_direction:
        flanker === "←" ? "left" : flanker === "→" ? "right" : "neutral",
    };
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
export function wrongKey(driver: ExperimentDriver, correct: string): string {
  const key = driver.keys.find((candidate) => candidate !== correct);
  if (!key) throw new Error("No alternative mapped key");
  return key;
}

/** Longer than one 60 Hz display frame (16.7 ms). */
export const ONE_FRAME_MS = 20;

/** What the test saw and did in one trial, for checking the export. */
export interface TrialObservation {
  correctKey: string;
  /** The mapped key the test pressed; null when it let the deadline pass. */
  pressedKey: string | null;
  /** Expected CSV stimulus columns, read from the screen. */
  stimulus: Record<string, string>;
}

/** Waits for the next timed stimulus and observes it, without responding. */
export async function awaitStimulus(
  page: Page,
  driver: ExperimentDriver,
): Promise<Omit<TrialObservation, "pressedKey">> {
  const stimulus = driver.stimulus(page);
  await advanceUntil(page, () => stimulus.isVisible(), "the next stimulus");
  // The stimulus is committed to the page just BEFORE its onset frame; the
  // trial is presented (onset recorded, response window open) only when that
  // animation frame runs (protocol §7 step 2). Advance one frame so it has.
  await page.clock.runFor(ONE_FRAME_MS);
  return {
    correctKey: await driver.correctKey(page),
    stimulus: await driver.observeStimulus(page),
  };
}

/**
 * Runs one timed trial: waits for the stimulus, then responds per `plan`
 * after 400 ms of simulated time, or lets the 2,000 ms deadline pass.
 */
export async function runTrial(
  page: Page,
  driver: ExperimentDriver,
  plan: Plan,
): Promise<TrialObservation> {
  const stimulus = driver.stimulus(page);
  const seen = await awaitStimulus(page, driver);
  let pressedKey: string | null = null;
  if (plan !== "none") {
    await page.clock.runFor(400 - ONE_FRAME_MS);
    pressedKey =
      plan === "correct" ? seen.correctKey : wrongKey(driver, seen.correctKey);
    await page.keyboard.press(pressedKey);
  }
  await advanceUntil(
    page,
    async () => !(await stimulus.isVisible()),
    "the stimulus to end",
    { maxMs: 3_000 },
  );
  return { ...seen, pressedKey };
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

/** Opens the experiment, completes the mapping check, and begins practice. */
export async function startPractice(page: Page, driver: ExperimentDriver) {
  await openWithFakeClock(page, driver);
  await driver.completeMappingCheck(page);
  await page.getByRole("button", { name: "Begin 12 practice trials" }).click();
}

/** Mapping check on an instructions screen already shown (e.g. after Restart). */
export async function checkKeysAndBeginPractice(
  page: Page,
  driver: ExperimentDriver,
) {
  for (const key of driver.keys) await page.keyboard.press(key);
  const begin = page.getByRole("button", { name: "Begin 12 practice trials" });
  await expect(begin).toBeEnabled();
  await begin.click();
}

/** The trial counter in the session bar, e.g. "Practice 3 of 12". */
export function progress(page: Page): Locator {
  return page.locator(".experiment-progress");
}

/** Waits for the ready screen after practice and starts the main trials. */
export async function startMain(page: Page) {
  const start = page.getByRole("button", { name: "Start 60 main trials" });
  await advanceUntil(page, () => start.isVisible(), "the ready screen");
  await start.click();
}

export type PauseKind = "trial invalidated" | "no trial on screen" | "break";

const PAUSE_TEXT: Record<PauseKind, string> = {
  "trial invalidated":
    "The trial on screen when the pause happened is recorded as invalid and will not be repeated.",
  "no trial on screen":
    "No trial was on screen. The session continues where it stopped.",
  break: "Your break is paused.",
};

/** The paused screen, with the explanation that matches what happened. */
export async function expectPaused(page: Page, kind: PauseKind) {
  await expect(
    page.getByRole("heading", { name: "Experiment paused" }),
  ).toBeVisible();
  await expect(
    page.getByText(PAUSE_TEXT[kind], { exact: false }),
  ).toBeVisible();
}

/** Exit → confirm, ending on the "Session ended" (incomplete) screen. */
export async function exitSession(page: Page) {
  await page
    .getByRole("group", { name: "Experiment controls" })
    .getByRole("button", { name: "Exit" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Exit this session?" })
    .getByRole("button", { name: "Exit session" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Session ended" }),
  ).toBeVisible();
}

/**
 * Reloads while a session is active. The app asks the browser to confirm
 * leaving (beforeunload, Task 10.4); the test checks that the prompt appears
 * and accepts it. Its text is the browser's own.
 */
export async function reloadConfirmingLeave(page: Page) {
  const prompt = page.waitForEvent("dialog");
  const reload = page.reload();
  const dialog = await prompt;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  await reload;
}

/** The in-app "Leave this session?" confirmation (Task 10.4). */
export function leaveDialog(page: Page): Locator {
  return page.getByRole("alertdialog", { name: "Leave this session?" });
}

/** FR-PRI-03: "Clear this session's data", confirmed, back at the start. */
export async function clearSessionData(page: Page) {
  const clear = page.getByRole("button", { name: "Clear this session's data" });
  await expect(clear).toBeVisible();
  await clear.click();
  const dialog = page.getByRole("alertdialog", {
    name: "Clear this session's data?",
  });
  await expect(dialog).toContainText(
    "Files you already downloaded are not affected.",
  );
  await dialog.getByRole("button", { name: "Clear data" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(clear).toHaveCount(0);
}

/**
 * Checks that the page would NOT ask before unloading: dispatches a
 * cancelable beforeunload event and checks no handler cancelled it.
 */
export async function expectNoLeavePrompt(page: Page) {
  const prompts = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prompts, "the page asks before unloading").toBe(false);
}

/**
 * Opens the experiment the way a participant usually does: from the
 * catalogue, through an in-app link, so Back and Forward are in-app history
 * entries that the app can confirm (a direct visit makes Back a browser-level
 * navigation, which only the browser's beforeunload prompt can confirm).
 */
export async function openFromCatalogue(page: Page, driver: ExperimentDriver) {
  const start = new Date("2026-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.goto("/experiments");
  await page.getByRole("link", { name: `Start ${driver.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`${driver.path}$`));
  await expect(
    page.getByRole("button", { name: `Start ${driver.name}` }),
  ).toBeVisible();
  // As in openWithFakeClock: time moves only when the test advances it.
  await page.clock.pauseAt(new Date(start.getTime() + 60 * 60 * 1000));
}
