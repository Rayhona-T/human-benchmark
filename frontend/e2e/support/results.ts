/**
 * Export and results consistency checks (NFR-DATA-01, FR-DAT-03, FR-DAT-08).
 *
 * After a session ends, the test downloads the CSV the app produces, parses
 * it with a strict RFC 4180 parser, and compares it three ways:
 *   1. with what the test itself did in each trial (stimulus seen on screen,
 *      key pressed or not, interruption), row by row and in order;
 *   2. with the counts shown in the results overview;
 *   3. for complete sessions, with every cell of the "Results by condition"
 *      table and the headline rates.
 * The expected values in (2) and (3) are computed here from the CSV rows
 * with the documented formulas (ANALYSIS_METHODOLOGY.md), independently of
 * the app's analysis code.
 */
import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { parseCsvTable, type CsvTable } from "./csv";
import type { ExperimentDriver, TrialObservation } from "./session";

export const PRACTICE_TRIALS = 12;
export const MAIN_TRIALS = 60;
const MINIMUM_CORRECT_FOR_MEDIAN = 10;
const RESPONSE_DEADLINE_MS = 2000;
const ANALYSIS_VERSION = "HB-ANALYSIS-1.1";
const NA = "NA";

export type Outcome = "correct" | "incorrect" | "timeout" | "invalid";
export type InvalidReason = "visibility_lost" | "interrupt" | "focus_lost";

export interface ExpectedTrial {
  phase: "practice" | "main";
  trialIndex: number;
  outcome: Outcome;
  invalidReason: InvalidReason | null;
  correctKey: string;
  pressedKey: string | null;
  stimulus: Record<string, string>;
}

/** The expected record for a trial the test answered (or let time out). */
export function answered(
  phase: ExpectedTrial["phase"],
  trialIndex: number,
  observation: TrialObservation,
): ExpectedTrial {
  const outcome: Outcome =
    observation.pressedKey === null
      ? "timeout"
      : observation.pressedKey === observation.correctKey
        ? "correct"
        : "incorrect";
  return { phase, trialIndex, outcome, invalidReason: null, ...observation };
}

/** The expected record for a trial interrupted while its stimulus was shown. */
export function interrupted(
  phase: ExpectedTrial["phase"],
  trialIndex: number,
  observation: Omit<TrialObservation, "pressedKey">,
  invalidReason: InvalidReason,
): ExpectedTrial {
  return {
    phase,
    trialIndex,
    outcome: "invalid",
    invalidReason,
    pressedKey: null,
    ...observation,
  };
}

const PROTOCOL_ID: Record<ExperimentDriver["name"], string> = {
  Stroop: "HB-STROOP-1.0",
  Flanker: "HB-FLANKER-1.0",
};

const STROOP_COLOR_WORDS = new Set(["RED", "BLUE", "GREEN", "YELLOW"]);

/** Condition implied by the stimulus, per the protocols' definitions. */
function conditionOf(
  driver: ExperimentDriver,
  stimulus: Record<string, string>,
): string {
  if (driver.name === "Stroop") {
    const word = stimulus.stimulus_word;
    if (!STROOP_COLOR_WORDS.has(word)) return "neutral";
    return word.toLowerCase() === stimulus.stimulus_ink
      ? "congruent"
      : "incongruent";
  }
  if (stimulus.flanker_direction === "neutral") return "neutral";
  return stimulus.flanker_direction === stimulus.target_direction
    ? "congruent"
    : "incongruent";
}

export async function downloadExport(
  page: Page,
): Promise<{ fileName: string; table: CsvTable }> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download trial data (CSV)" }).click();
  const download = await downloadPromise;
  const text = await readFile(await download.path(), "utf-8");
  return { fileName: download.suggestedFilename(), table: parseCsvTable(text) };
}

function num(value: string, what: string): number {
  const parsed = Number(value);
  expect(
    value !== "" && value !== NA && Number.isFinite(parsed),
    `${what} should be a number, got ${JSON.stringify(value)}`,
  ).toBe(true);
  return parsed;
}

function percent(numerator: number, denominator: number) {
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

interface Counts {
  recorded: number;
  correct: number;
  incorrect: number;
  timeout: number;
  invalid: number;
}

function countOutcomes(rows: Record<string, string>[]): Counts {
  const count = (outcome: Outcome) =>
    rows.filter((row) => row.outcome === outcome).length;
  return {
    recorded: rows.length,
    correct: count("correct"),
    incorrect: count("incorrect"),
    timeout: count("timeout"),
    invalid: count("invalid"),
  };
}

function overviewSection(page: Page) {
  return page.locator(".session-results__overview");
}

/** The value shown next to each label in the results overview. */
async function readOverview(page: Page): Promise<Record<string, string>> {
  return page.locator(".session-results__stats").evaluate((list) => {
    const values: Record<string, string> = {};
    for (const item of list.querySelectorAll(":scope > div")) {
      const label = item.querySelector("dt")?.textContent?.trim() ?? "";
      values[label] = item.querySelector("dd")?.textContent?.trim() ?? "";
    }
    return values;
  });
}

interface TableCell {
  text: string;
  value: string | null;
  count: string | null;
}

async function readConditionTable(page: Page) {
  return page
    .getByRole("region", { name: "Results by condition table" })
    .getByRole("table")
    .evaluate((table) => {
      const text = (node: Element | null | undefined) =>
        node?.textContent?.trim() ?? null;
      const headers = [...table.querySelectorAll("thead th")].map(
        (th) => text(th) ?? "",
      );
      const rows = [...table.querySelectorAll("tbody tr")].map((tr) => ({
        // The row header's first text node is its label (a hint follows).
        label: tr.querySelector("th")?.childNodes[0]?.textContent?.trim() ?? "",
        cells: [...tr.querySelectorAll("td")].map((td) => ({
          text: text(td) ?? "",
          value: text(td.querySelector(".session-results__value")),
          count: text(td.querySelector(".session-results__count")),
        })),
      }));
      return { headers, rows };
    });
}

function expectRateCell(
  cell: TableCell,
  numerator: number,
  denominator: number,
  where: string,
) {
  if (denominator === 0) {
    expect(cell.text, where).toBe("Unavailable (0 trials)");
    return;
  }
  expect(cell.value, where).toBe(percent(numerator, denominator));
  expect(cell.count, where).toBe(`${numerator} of ${denominator}`);
}

/**
 * Checks the downloaded export against the test's own record of the
 * session and against everything the results page displays.
 */
export async function expectExportMatchesSession(
  page: Page,
  driver: ExperimentDriver,
  expected: readonly ExpectedTrial[],
  status: "complete" | "incomplete",
): Promise<CsvTable> {
  const experimentId = driver.name.toLowerCase();
  const { fileName, table } = await downloadExport(page);

  // File: name, encoding marker, and one row per presented trial.
  expect(fileName).toBe(`human-benchmark-${experimentId}-${status}-trials.csv`);
  expect(table.hadByteOrderMark, "UTF-8 byte-order mark").toBe(true);
  expect(table.records, "one CSV row per presented trial").toHaveLength(
    expected.length,
  );

  // Session-level columns are identical on every row.
  const first = table.records[0];
  num(first.seed, "seed");
  expect(first.prng_id).not.toBe(NA);
  for (const [index, row] of table.records.entries()) {
    const where = `CSV row ${index + 1}`;
    expect(row.experiment, where).toBe(experimentId);
    expect(row.protocol_id, where).toBe(PROTOCOL_ID[driver.name]);
    expect(row.analysis_version, where).toBe(ANALYSIS_VERSION);
    expect(row.session_status, where).toBe(status);
    expect(row.seed, where).toBe(first.seed);
    expect(row.prng_id, where).toBe(first.prng_id);
  }

  // Each row is the trial the test saw, in the order it was presented.
  for (const [index, trial] of expected.entries()) {
    const row = table.records[index];
    const where = `CSV row ${index + 1} (${trial.phase} trial ${trial.trialIndex})`;
    expect(row.phase, where).toBe(trial.phase);
    expect(row.trial_index, where).toBe(String(trial.trialIndex));
    for (const [column, value] of Object.entries(trial.stimulus)) {
      expect(row[column], `${where}: ${column}`).toBe(value);
    }
    expect(row.condition, `${where}: condition`).toBe(
      conditionOf(driver, trial.stimulus),
    );
    expect(row.correct_key, `${where}: correct_key`).toBe(trial.correctKey);
    expect(row.response_key, `${where}: response_key`).toBe(
      trial.pressedKey ?? NA,
    );
    expect(row.outcome, `${where}: outcome`).toBe(trial.outcome);
    expect(row.invalid_reason, `${where}: invalid_reason`).toBe(
      trial.invalidReason ?? NA,
    );
    expect(row.correct, `${where}: correct`).toBe(
      trial.outcome === "correct"
        ? "1"
        : trial.outcome === "incorrect"
          ? "0"
          : NA,
    );

    // Timing: every presented trial has an onset and a deadline; a response
    // time exists only for a scored key press and equals press − onset.
    const onset = num(row.stimulus_onset_ms, `${where}: stimulus_onset_ms`);
    const deadline = num(row.deadline_ms, `${where}: deadline_ms`);
    expect(deadline - onset, `${where}: deadline − onset`).toBeCloseTo(
      RESPONSE_DEADLINE_MS,
      2,
    );
    if (trial.outcome === "correct" || trial.outcome === "incorrect") {
      const press = num(
        row.response_timestamp_ms,
        `${where}: response_timestamp_ms`,
      );
      const rt = num(row.rt_ms, `${where}: rt_ms`);
      expect(rt, `${where}: rt_ms ≥ 0`).toBeGreaterThanOrEqual(0);
      expect(rt, `${where}: rt_ms < deadline`).toBeLessThan(
        RESPONSE_DEADLINE_MS,
      );
      expect(rt, `${where}: rt_ms = press − onset`).toBeCloseTo(
        press - onset,
        2,
      );
    } else {
      // Missing values stay missing (never 0 or a plausible number).
      expect(row.rt_ms, `${where}: rt_ms`).toBe(NA);
      expect(row.response_timestamp_ms, `${where}: response_timestamp_ms`).toBe(
        NA,
      );
    }
    if (trial.outcome === "invalid") {
      expect(row.stimulus_offset_ms, `${where}: stimulus_offset_ms`).toBe(NA);
    }
  }

  // Practice and main are distinguished, with consecutive trial numbers.
  const practice = table.records.filter((row) => row.phase === "practice");
  const main = table.records.filter((row) => row.phase === "main");
  expect(practice.length + main.length).toBe(table.records.length);
  expect(practice.map((row) => Number(row.trial_index))).toEqual(
    practice.map((_, i) => i + 1),
  );
  expect(main.map((row) => Number(row.trial_index))).toEqual(
    main.map((_, i) => i + 1),
  );

  // The results overview shows the same counts (main trials only).
  const counts = countOutcomes(main);
  const overview = await readOverview(page);
  const shown = (prefix: string) => {
    const label = Object.keys(overview).find((key) => key.startsWith(prefix));
    expect(label, `overview row "${prefix}…"`).toBeDefined();
    return overview[label ?? ""];
  };
  expect(shown("Main trials presented")).toBe(
    `${main.length} of ${MAIN_TRIALS}`,
  );
  expect(shown("Correct")).toBe(String(counts.correct));
  expect(shown("Incorrect")).toBe(String(counts.incorrect));
  expect(shown("Timeouts")).toBe(String(counts.timeout));
  expect(shown("Invalid")).toBe(String(counts.invalid));
  expect(shown("Not presented")).toBe(String(MAIN_TRIALS - main.length));
  expect(shown("Practice trials")).toBe(
    `${practice.length} of ${PRACTICE_TRIALS}`,
  );

  if (status === "complete") {
    await expectConditionResultsMatch(page, main);
  } else {
    // Incomplete sessions show counts and status only (ANALYSIS_METHODOLOGY §4).
    await expect(
      overviewSection(page).getByText("Incomplete", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Results by condition" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Response times" }),
    ).toHaveCount(0);
  }
  return table;
}

async function expectConditionResultsMatch(
  page: Page,
  main: Record<string, string>[],
) {
  await expect(
    overviewSection(page).getByText("Complete", { exact: true }),
  ).toBeVisible();

  // Headline rates and the "Across all main trials" sentence.
  const all = countOutcomes(main);
  const scored = all.correct + all.incorrect;
  const analysable = scored + all.timeout;
  const headlines = page.locator(".session-results__headlines");
  await expect(headlines).toContainText(
    `Response accuracy${percent(all.correct, scored)}${all.correct} of ${scored} key presses were correct`,
  );
  await expect(headlines).toContainText(
    `Successful response rate${percent(all.correct, analysable)}${all.correct} of ${analysable} analysable trials ended in a correct response`,
  );
  const summary = page
    .locator("p")
    .filter({ hasText: "Across all main trials" });
  await expect(summary).toContainText(
    `response accuracy ${percent(all.correct, scored)} (${all.correct} of ${scored})`,
  );
  await expect(summary).toContainText(
    `successful response rate ${percent(all.correct, analysable)} (${all.correct} of ${analysable})`,
  );
  await expect(summary).toContainText(
    `timeout rate ${percent(all.timeout, analysable)} (${all.timeout} of ${analysable})`,
  );

  // Every cell of the condition table.
  const { headers, rows } = await readConditionTable(page);
  expect(headers[0]).toBe("Measure");
  const conditions = headers.slice(1).map((label) => label.toLowerCase());
  expect([...conditions].sort()).toEqual([
    "congruent",
    "incongruent",
    "neutral",
  ]);
  const row = (label: string) => {
    const found = rows.find((r) => r.label === label);
    expect(found, `condition table row "${label}"`).toBeDefined();
    return found?.cells ?? [];
  };
  for (const [column, condition] of conditions.entries()) {
    const trials = main.filter((r) => r.condition === condition);
    const c = countOutcomes(trials);
    const where = (measure: string) => `${condition}: ${measure}`;
    expect(row("Recorded trials")[column].text, where("recorded")).toBe(
      String(c.recorded),
    );
    expect(row("Correct")[column].text, where("correct")).toBe(
      String(c.correct),
    );
    expect(row("Incorrect")[column].text, where("incorrect")).toBe(
      String(c.incorrect),
    );
    expect(row("Timeouts")[column].text, where("timeouts")).toBe(
      String(c.timeout),
    );
    expect(row("Invalid (excluded)")[column].text, where("invalid")).toBe(
      String(c.invalid),
    );
    expectRateCell(
      row("Response accuracy")[column],
      c.correct,
      c.correct + c.incorrect,
      where("response accuracy"),
    );
    expectRateCell(
      row("Successful response rate")[column],
      c.correct,
      c.correct + c.incorrect + c.timeout,
      where("successful response rate"),
    );
    expectRateCell(
      row("Timeout rate")[column],
      c.timeout,
      c.correct + c.incorrect + c.timeout,
      where("timeout rate"),
    );
    const correctRts = trials
      .filter((r) => r.outcome === "correct" && r.rt_ms !== NA)
      .map((r) => Number(r.rt_ms));
    const medianCell = row("Median correct response time")[column];
    if (correctRts.length >= MINIMUM_CORRECT_FOR_MEDIAN) {
      expect(medianCell.value, where("median")).toBe(
        `${Math.round(median(correctRts))} ms`,
      );
      expect(medianCell.count, where("median basis")).toBe(
        `from ${correctRts.length} correct`,
      );
    } else {
      expect(medianCell.text, where("median")).toBe(
        `Not shown: ${correctRts.length} correct (minimum ${MINIMUM_CORRECT_FOR_MEDIAN})`,
      );
    }
  }
}
