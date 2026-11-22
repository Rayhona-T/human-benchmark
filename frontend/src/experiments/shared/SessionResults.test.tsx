import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  SessionRecordStatus,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";
import type { FlankerStimulus } from "../flanker/flanker";
import { computeFlankerResults } from "../flanker/flankerAnalysis";
import {
  FLANKER_EXPORT_COLUMNS,
  FLANKER_RESULTS_COPY,
} from "../flanker/flankerResultsCopy";
import { SessionResults } from "./SessionResults";

let index = 0;
function record(
  condition: string,
  outcome: TrialOutcome,
  reactionTimeMs: number | null,
  phase: "practice" | "main" = "main",
): TrialRecord<FlankerStimulus, string, unknown> {
  index += 1;
  return {
    experiment: {
      experimentId: "flanker",
      protocolId: "HB-FLANKER-1.0",
      protocolVersion: "1.0",
      configurationId: "HB-FLANKER-1.0",
      configurationVersion: "1.0",
    },
    sessionId: "s",
    trialId: `t${index}`,
    phase,
    trialIndex: index,
    condition,
    stimulus: {
      condition: "congruent",
      targetDirection: "left",
      flankerType: "left",
      cells: ["←", "←", "←", "←", "←"],
      text: "←←←←←",
    },
    correctResponse: "f",
    response: null,
    lifecycleState: "completed",
    outcome,
    timing: {
      fixationOnsetMs: null,
      stimulusOnsetMs: 0,
      responseTimestampMs: null,
      deadlineMs: 2000,
      trialEndMs: null,
      stimulusOffsetMs: null,
      itiEndMs: null,
      reactionTimeMs,
      trialDurationMs: null,
      timingSource: "injected",
    },
    randomization: {
      seedUnsigned32: 1,
      prngAndScheduleId: "HB-FLANKER-shuffle-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: [],
      realizedMainOrder: [],
    },
  };
}
const correct = (c: string, rt: number | null) =>
  record(c, { category: "correct" }, rt);
const incorrect = (c: string, rt: number) =>
  record(c, { category: "incorrect" }, rt);
const timeout = (c: string) => record(c, { category: "timeout" }, null);

/** Sorted: 390 410 445 455 480 505 530 560 620 700 (type 7: Q1 447.5, Q3 552.5). */
const TEN = [530, 410, 620, 480, 455, 700, 390, 505, 560, 445];

/**
 * congruent: the ten RTs above, all correct (accuracy 10/10)
 * incongruent: 12 correct at 600 ms + 3 incorrect (accuracy 12/15), 1 timeout
 * neutral: 6 correct at 550 ms (below the display rule), 2 timeouts
 */
function scenario() {
  return [
    record("congruent", { category: "correct" }, 300, "practice"),
    ...TEN.map((rt) => correct("congruent", rt)),
    ...Array.from({ length: 12 }, () => correct("incongruent", 600)),
    ...Array.from({ length: 3 }, () => incorrect("incongruent", 410)),
    timeout("incongruent"),
    ...Array.from({ length: 6 }, () => correct("neutral", 550)),
    timeout("neutral"),
    timeout("neutral"),
  ];
}

function renderResults(
  records = scenario(),
  status: SessionRecordStatus = "complete",
  withExport = true,
) {
  return render(
    <SessionResults
      copy={FLANKER_RESULTS_COPY}
      responseWindowMs={2000}
      results={computeFlankerResults({
        status,
        records,
        breakTaken: false,
        breakDurationMs: 0,
      })}
      exportData={
        withExport
          ? {
              experimentId: "flanker",
              records,
              stimulusColumns: FLANKER_EXPORT_COLUMNS,
            }
          : undefined
      }
    />,
  );
}

describe("SessionResults: response-time plot and distribution", () => {
  afterEach(cleanup);

  it("plots each correct and incorrect response with a labelled millisecond axis", () => {
    const { container } = renderResults();
    const plot = screen.getByRole("img", {
      name: /Response times by condition, in milliseconds/,
    });
    // 10 + 12 correct + 6 correct plotted; 3 incorrect as rings.
    expect(
      container.querySelectorAll(".rt-plot__dot--correct").length - 1,
    ).toBe(28);
    expect(
      container.querySelectorAll(".rt-plot__dot--incorrect").length - 1,
    ).toBe(3);
    expect(
      within(plot).getByText("Response time (ms) after the arrows appeared"),
    ).toBeInTheDocument();
    for (const tick of ["0", "500", "1,000", "1,500", "2,000"]) {
      expect(within(plot).getByText(tick)).toBeInTheDocument();
    }
    // Medians only where eligible; neutral (6 correct) shows why not.
    const median = (condition: string) =>
      container
        .querySelector(`[data-condition="${condition}"] .rt-plot__row-median`)
        ?.textContent?.trim();
    expect(median("congruent")).toBe("median 493 ms");
    expect(median("incongruent")).toBe("median 600 ms");
    expect(median("neutral")).toBe("median not shown (needs 10 correct)");
    expect(container.querySelectorAll(".rt-plot__median").length - 1).toBe(2);
    expect(
      within(plot).getByText(
        /12 correct · 3 incorrect · 1 timeout \(no time\)/,
      ),
    ).toBeInTheDocument();
  });

  it("describes the plot in text for screen readers", () => {
    renderResults();
    const plot = screen.getByRole("img", {
      name: /Response times by condition/,
    });
    expect(plot).toHaveAccessibleName(
      expect.stringContaining(
        "Congruent: 10 correct response times, from 390 ms to 700 ms, median 493 ms",
      ),
    );
    expect(plot).toHaveAccessibleName(
      expect.stringContaining("Neutral: 6 correct response times"),
    );
    expect(plot).toHaveAccessibleName(
      expect.stringContaining(
        "median not shown (needs at least 10 correct responses)",
      ),
    );
  });

  it("shows type 7 quartiles for eligible conditions and explains ineligible ones", () => {
    renderResults();
    const table = screen.getByRole("table", {
      name: "Spread of correct response times in this session (ms)",
    });
    const row = (label: string) =>
      Array.from(
        within(table)
          .getByRole("rowheader", { name: new RegExp(`^${label}`) })
          .closest("tr")!
          .querySelectorAll("td"),
      ).map((cell) => cell.textContent);
    // Displayed to the nearest ms: 447.5 → 448, 492.5 → 493, 552.5 → 553.
    expect(row("Fastest")).toEqual([
      "390 ms",
      "600 ms",
      "Not shown: 6 correct (minimum 10)",
    ]);
    expect(row("Lower quartile")).toEqual([
      "448 ms",
      "600 ms",
      "Not shown: 6 correct (minimum 10)",
    ]);
    expect(row("Median")).toEqual([
      "493 ms",
      "600 ms",
      "Not shown: 6 correct (minimum 10)",
    ]);
    expect(row("Upper quartile")).toEqual([
      "553 ms",
      "600 ms",
      "Not shown: 6 correct (minimum 10)",
    ]);
    expect(row("Slowest")).toEqual([
      "700 ms",
      "600 ms",
      "Not shown: 6 correct (minimum 10)",
    ]);
  });

  it("shows no plot, distribution, or speed–accuracy text for an incomplete session", () => {
    renderResults(scenario().slice(0, 12), "incomplete");
    expect(
      screen.queryByRole("img", { name: /Response times/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Speed and accuracy together"),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".session-results__headlines")).toBeNull();
  });
});

describe("SessionResults: narrow plot layout", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("wraps long row headers instead of letting them overflow the plot", () => {
    // Regression (browser-found): at a 390 px viewport a Flanker row header
    // ("14 correct · 3 incorrect · 2 timeouts (no time) · 1 invalid (not shown)")
    // ran past the plot's right edge.
    class NarrowObserver {
      private callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback(
          [{ contentRect: { width: 330 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        );
      }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", NarrowObserver);
    const { container } = renderResults([
      ...Array.from({ length: 14 }, () => correct("incongruent", 480)),
      ...Array.from({ length: 3 }, () => incorrect("incongruent", 420)),
      timeout("incongruent"),
      timeout("incongruent"),
      record("incongruent", { category: "invalid", reason: "interrupt" }, null),
      ...Array.from({ length: 10 }, () => correct("congruent", 450)),
      ...Array.from({ length: 10 }, () => correct("neutral", 470)),
    ]);
    const svg = container.querySelector(".rt-plot__svg") as SVGSVGElement;
    expect(svg.getAttribute("width")).toBe("330");
    const meta = Array.from(
      container.querySelectorAll(
        '[data-condition="incongruent"] .rt-plot__row-meta',
      ),
    ).map((line) => line.textContent ?? "");
    expect(meta.length).toBeGreaterThan(1);
    expect(meta.join(" · ")).toBe(
      "14 correct · 3 incorrect · 2 timeouts (no time) · 1 invalid (not shown)",
    );
    // Each line fits the 302 px text width at the conservative 6.8 px/char.
    for (const line of meta)
      expect(line.length * 6.8).toBeLessThanOrEqual(330 - 28);
  });
});

describe("SessionResults: overview and contrasts", () => {
  afterEach(cleanup);

  it("states each headline rate with its denominator", () => {
    renderResults();
    // Accuracy 28 of 31 key presses; success 28 of 34 analysable trials.
    expect(screen.getByText("90.3%")).toBeInTheDocument();
    expect(
      screen.getByText("28 of 31 key presses were correct"),
    ).toBeInTheDocument();
    expect(screen.getByText("82.4%")).toBeInTheDocument();
    expect(
      screen.getByText(
        "28 of 34 analysable trials ended in a correct response",
      ),
    ).toBeInTheDocument();
  });

  it("distinguishes 'Unavailable' (no denominator) from a real 0%", () => {
    renderResults([timeout("congruent"), timeout("neutral")]);
    const headlines = document.querySelector(
      ".session-results__headlines",
    ) as HTMLElement;
    // No key presses: accuracy has no denominator, so it is unavailable.
    expect(within(headlines).getByText("Unavailable")).toBeInTheDocument();
    expect(
      within(headlines).getByText("no key presses to score"),
    ).toBeInTheDocument();
    // Two analysable trials, none correct: a genuine 0 of 2.
    expect(within(headlines).getByText("0.0%")).toBeInTheDocument();
    expect(
      within(headlines).getByText(
        "0 of 2 analysable trials ended in a correct response",
      ),
    ).toBeInTheDocument();
  });

  it("describes the speed–accuracy pattern from the RT-first condition, with the caveat", () => {
    renderResults();
    // Overall congruency: incongruent 600 vs congruent 492.5 (slower);
    // accuracy incongruent 12/15 vs congruent 10/10 (less accurate): consistent.
    const card = screen
      .getByRole("heading", { name: "Overall congruency" })
      .closest("section") as HTMLElement;
    expect(
      within(card).getByText(
        "In this session, incongruent trials were both slower and less accurate than congruent trials: speed and accuracy pointed the same way.",
      ),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/not a stable characteristic/),
    ).toBeInTheDocument();
    // Interference needs the neutral median (6 correct): no pattern shown.
    const interference = screen
      .getByRole("heading", { name: "Flanker interference" })
      .closest("section") as HTMLElement;
    expect(
      within(interference).queryByText("Speed and accuracy together"),
    ).toBeNull();
  });

  it("describes a tradeoff when the slower condition was more accurate", () => {
    const records = [
      ...Array.from({ length: 10 }, () => correct("congruent", 500)),
      ...Array.from({ length: 4 }, () => incorrect("congruent", 450)),
      ...Array.from({ length: 10 }, () => correct("incongruent", 620)),
      ...Array.from({ length: 10 }, () => correct("neutral", 560)),
    ];
    renderResults(records);
    const card = screen
      .getByRole("heading", { name: "Overall congruency" })
      .closest("section") as HTMLElement;
    expect(
      within(card).getByText(
        "In this session, incongruent trials were slower but more accurate than congruent trials: speed and accuracy moved in opposite directions, so neither one alone describes the difference.",
      ),
    ).toBeInTheDocument();
  });

  it("contains no inferential, normative, or ranking language", () => {
    const { container } = renderResults();
    const text = container.textContent ?? "";
    for (const forbidden of [
      /p-value/i,
      /confidence interval/i,
      /statistically significant/i,
      /percentile/i,
      /\brank/i,
      /\bbetter\b/i,
      /\bworse\b/i,
      /\bIQ\b/,
      /effect size/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
    expect(text).toMatch(/not tests of statistical significance/);
    expect(text).toMatch(/Response times are usually skewed/);
    expect(text).toMatch(/no norms exist for this task/);
  });
});

describe("SessionResults: export", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("downloads a local CSV of the session's records when the participant asks", async () => {
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:local";
    });
    const revokeObjectURL = vi.fn();
    const original = {
      create: URL.createObjectURL,
      revoke: URL.revokeObjectURL,
    };
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    renderResults(scenario(), "complete");
    expect(createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Download trial data (CSV)" }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local");
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("human-benchmark-flanker-complete-trials.csv");

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    const lines = text
      .replace(String.fromCharCode(0xfeff), "")
      .trimEnd()
      .split("\r\n");
    expect(lines[0]).toContain(
      "stimulus_symbols,target_direction,flanker_direction",
    );
    // Header + 1 practice + 34 main trials.
    expect(lines).toHaveLength(1 + scenario().length);
    expect(lines.filter((line) => line.includes(",practice,"))).toHaveLength(1);
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it("lists every column in the on-screen data dictionary", () => {
    renderResults();
    for (const name of [
      "session_status",
      "rt_ms",
      "stimulus_symbols",
      "iti_end_ms",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(
      screen.getByText(/NA means the value does not apply or was not recorded/),
    ).toBeInTheDocument();
  });

  it("keeps the missing-response-time disclosure", () => {
    renderResults([
      ...Array.from({ length: 20 }, () => correct("congruent", 450)),
      correct("neutral", null),
    ]);
    expect(screen.getByText("Missing response times")).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 correct response\(s\) have no usable recorded response time/,
      ),
    ).toBeInTheDocument();
  });
});
