import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrialOutcome, TrialRecord } from "../../engine/contracts";
import type { StroopResponse } from "./stroop";
import { computeStroopResults } from "./stroopAnalysis";
import { StroopExperimentPage } from "./StroopExperimentPage";
import { StroopResults } from "./StroopResults";
import {
  formatPercent,
  formatSignedMs,
  formatSignedPoints,
} from "./stroopResultsFormat";

function record(
  condition: string,
  outcome: TrialOutcome,
  reactionTimeMs: number | null = null,
  phase: "practice" | "main" = "main",
): TrialRecord<unknown, string, StroopResponse> {
  return {
    experiment: {
      experimentId: "stroop",
      protocolId: "HB-STROOP-1.0",
      protocolVersion: "1.0",
      configurationId: "HB-STROOP-1.0",
      configurationVersion: "1.0",
    },
    sessionId: "s",
    trialId: Math.random().toString(36),
    phase,
    trialIndex: 1,
    condition,
    stimulus: null,
    correctResponse: "d",
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
      prngAndScheduleId: "HB-STROOP-shuffle-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: [],
      realizedMainOrder: [],
    },
  };
}

const many = <T,>(count: number, make: () => T) =>
  Array.from({ length: count }, make);

function completeRecords() {
  return [
    ...many(20, () => record("congruent", { category: "correct" }, 550)),
    ...many(16, () => record("incongruent", { category: "correct" }, 700)),
    ...many(4, () => record("incongruent", { category: "incorrect" }, 650)),
    ...many(9, () => record("neutral", { category: "correct" }, 600)),
    ...many(10, () => record("neutral", { category: "timeout" })),
    record("neutral", { category: "invalid", reason: "visibility_lost" }),
  ];
}

describe("results formatting", () => {
  it("formats signed values with explicit sign and a true minus", () => {
    expect(formatSignedMs(42.4)).toBe("+42 ms");
    expect(formatSignedMs(-42.6)).toBe("−43 ms");
    expect(formatSignedMs(0.2)).toBe("0 ms");
    expect(formatSignedPoints(0.15)).toBe("+15.0 percentage points");
    expect(formatSignedPoints(-0.05)).toBe("−5.0 percentage points");
    expect(formatSignedPoints(0)).toBe("0.0 percentage points");
    expect(formatPercent(12 / 15)).toBe("80.0%");
  });
});

describe("StroopResults", () => {
  afterEach(cleanup);

  it("presents a complete session with counts, denominators, and withheld values", () => {
    const results = computeStroopResults({
      status: "complete",
      records: completeRecords(),
      breakTaken: true,
      breakDurationMs: 12_400,
    });
    render(<StroopResults results={results} />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("Taken (about 12 s)")).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "Main-trial results by condition (practice excluded)",
    });
    // Incongruent response accuracy and success rate are both 16 of 20.
    expect(within(table).getAllByText("16 of 20")).toHaveLength(2);
    // Neutral has only 9 correct: median withheld with its count.
    expect(
      within(table).getByText("Not shown: 9 correct (minimum 10)"),
    ).toBeInTheDocument();
    // Neutral response accuracy uses 9 of 9 (timeouts excluded), success 9 of 19.
    expect(within(table).getByText("9 of 9")).toBeInTheDocument();
    expect(within(table).getAllByText("9 of 19").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/1 × page hidden during the word/),
    ).toBeInTheDocument();

    const congruency = screen.getByRole("heading", {
      name: "Overall congruency effect",
    }).parentElement as HTMLElement;
    expect(within(congruency).getByText("+150 ms")).toBeInTheDocument();
    expect(
      within(congruency).getByText(
        "In this session, the median correct response on incongruent trials was 150 ms slower than on congruent trials.",
      ),
    ).toBeInTheDocument();
    // Accuracy and success contrasts: congruent 1.0 − incongruent 0.8 (both).
    expect(
      within(congruency).getAllByText("+20.0 percentage points"),
    ).toHaveLength(2);

    const interference = screen.getByRole("heading", { name: "Interference" })
      .parentElement as HTMLElement;
    expect(
      within(interference).getByText(
        "Not shown: both incongruent and neutral trials need at least 10 correct responses.",
      ),
    ).toBeInTheDocument();
  });

  it("shows only counts and status for an incomplete session", () => {
    const results = computeStroopResults({
      status: "incomplete",
      records: completeRecords().slice(0, 25),
      breakTaken: false,
      breakDurationMs: null,
    });
    render(<StroopResults results={results} />);
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Condition comparisons" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/ms slower|ms faster/)).not.toBeInTheDocument();
    expect(screen.getByText("25 of 60")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("Not reached")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Condition results and comparisons are calculated only for complete sessions/,
      ),
    ).toBeInTheDocument();
  });

  it("contains no ranking, grade, or comparative-ability language", () => {
    const results = computeStroopResults({
      status: "complete",
      records: completeRecords(),
      breakTaken: false,
      breakDurationMs: 0,
    });
    const { container } = render(<StroopResults results={results} />);
    const text = container.textContent ?? "";
    for (const forbidden of [
      /\brank/i,
      /percentile/i,
      /(?<!-)\bgrade/i, // allows "laboratory-grade" in the timing caveat
      /\bbetter\b/i,
      /\bworse\b/i,
      /\bscore:/i,
      /\byour (attention|ability|intelligence) (is|was)/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
    expect(text).toMatch(
      /does not\s+measure intelligence, diagnose any condition/,
    );
  });
});

const INK_TO_KEY: Record<string, string> = {
  "rgb(248, 113, 113)": "d",
  "rgb(96, 165, 250)": "f",
  "rgb(74, 222, 128)": "j",
  "rgb(250, 204, 21)": "k",
};

describe("StroopResults accuracy-contrast presentation (protocol §10 operand order)", () => {
  afterEach(cleanup);

  const MINUS = "\u2212";
  const sessions = {
    // congruent 1.00, incongruent 0.75, neutral 0.90: all rate contrasts positive.
    positive: [
      ...many(20, () => record("congruent", { category: "correct" }, 500)),
      ...many(15, () => record("incongruent", { category: "correct" }, 600)),
      ...many(5, () => record("incongruent", { category: "incorrect" }, 600)),
      ...many(18, () => record("neutral", { category: "correct" }, 550)),
      ...many(2, () => record("neutral", { category: "incorrect" }, 550)),
    ],
    // congruent 0.80, incongruent 0.95, neutral 0.90: all rate contrasts negative.
    negative: [
      ...many(16, () => record("congruent", { category: "correct" }, 500)),
      ...many(4, () => record("congruent", { category: "incorrect" }, 500)),
      ...many(19, () => record("incongruent", { category: "correct" }, 600)),
      record("incongruent", { category: "incorrect" }, 600),
      ...many(18, () => record("neutral", { category: "correct" }, 550)),
      ...many(2, () => record("neutral", { category: "incorrect" }, 550)),
    ],
  };

  const cases = [
    {
      session: "positive",
      title: "Interference",
      rt: ["Incongruent", "Neutral"],
      rate: ["Neutral", "Incongruent"],
      points: "15.0",
      direction: "higher",
    },
    {
      session: "positive",
      title: "Facilitation",
      rt: ["Neutral", "Congruent"],
      rate: ["Congruent", "Neutral"],
      points: "10.0",
      direction: "higher",
    },
    {
      session: "positive",
      title: "Overall congruency effect",
      rt: ["Incongruent", "Congruent"],
      rate: ["Congruent", "Incongruent"],
      points: "25.0",
      direction: "higher",
    },
    {
      session: "negative",
      title: "Interference",
      rt: ["Incongruent", "Neutral"],
      rate: ["Neutral", "Incongruent"],
      points: "5.0",
      direction: "lower",
    },
    {
      session: "negative",
      title: "Facilitation",
      rt: ["Neutral", "Congruent"],
      rate: ["Congruent", "Neutral"],
      points: "10.0",
      direction: "lower",
    },
    {
      session: "negative",
      title: "Overall congruency effect",
      rt: ["Incongruent", "Congruent"],
      rate: ["Congruent", "Incongruent"],
      points: "15.0",
      direction: "lower",
    },
  ] as const;

  for (const item of cases) {
    it(`${item.title} (${item.session}): rate formula, sign, and sentence follow the rate operand order`, () => {
      render(
        <StroopResults
          results={computeStroopResults({
            status: "complete",
            records: sessions[item.session],
            breakTaken: false,
            breakDurationMs: 0,
          })}
        />,
      );
      const card = screen.getByRole("heading", { name: item.title })
        .parentElement as HTMLElement;
      const [rateFirst, rateSecond] = item.rate;
      const [rtFirst, rtSecond] = item.rt;

      // Both rate rows show the rate order; only the RT row shows the RT order.
      expect(
        within(card).getAllByText(`${rateFirst} ${MINUS} ${rateSecond}`),
      ).toHaveLength(2);
      expect(
        within(card).getAllByText(`${rtFirst} ${MINUS} ${rtSecond}`),
      ).toHaveLength(1);

      const sign = item.direction === "higher" ? "+" : MINUS;
      expect(
        within(card).getAllByText(`${sign}${item.points} percentage points`),
      ).toHaveLength(2);

      const first = rateFirst.toLowerCase();
      const second = rateSecond.toLowerCase();
      expect(
        within(card).getByText(
          `In this session, response accuracy was ${item.points} percentage points ${item.direction} on ${first} than on ${second} trials.`,
        ),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          `In this session, the successful response rate was ${item.points} percentage points ${item.direction} on ${first} than on ${second} trials.`,
        ),
      ).toBeInTheDocument();
    });
  }
});

describe("StroopExperimentPage results integration", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  function answerTrial(useCorrectKey: boolean) {
    advance(500); // fixation
    act(() => {
      vi.advanceTimersToNextFrame(); // onset frame
    });
    advance(420);
    const stimulus = document.querySelector(".stroop-stimulus") as HTMLElement;
    const key = INK_TO_KEY[stimulus.style.color];
    act(() => {
      fireEvent.keyDown(window, {
        key: useCorrectKey ? key : key === "d" ? "f" : "d",
      });
    });
    act(() => {
      vi.advanceTimersToNextFrame(); // offset frame
    });
    advance(500); // ITI
  }

  it("shows results computed from the session's own recorded trials", () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    render(
      <MemoryRouter>
        <StroopExperimentPage seedOverride={1234} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
    for (const key of ["d", "f", "j", "k"]) fireEvent.keyDown(window, { key });
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    for (let index = 0; index < 12; index++) answerTrial(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Start 60 main trials" }),
    );
    for (let index = 1; index <= 60; index++) {
      answerTrial(index % 6 !== 0); // 10 incorrect, 50 correct
      if (index === 30) {
        fireEvent.click(screen.getByRole("button", { name: "Skip break" }));
      }
    }

    expect(
      screen.getByRole("heading", { name: "Stroop session complete" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("60 of 60")).toBeInTheDocument();
    expect(screen.getByText("12 of 12")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(
      screen.getByText(/response accuracy 83\.3% \(50 of 60\)/),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "Main-trial results by condition (practice excluded)",
    });
    // Every correct RT is 420 ms after the recorded onset frame.
    expect(within(table).getAllByText("420 ms").length).toBe(3);
    expect(screen.getAllByText("0 ms").length).toBe(3);
    // Full 72-trial session plus the results page: allow time when the
    // suite runs in parallel (assertions unchanged).
  }, 30_000);
});
