import { describe, expect, it } from "vitest";
import type { SessionResults } from "./sessionAnalysis";
import { buildRtPlotData, dodgeLanes, wrapTokens } from "./rtPlotData";

type C = "congruent" | "incongruent" | "neutral";

function results(
  overrides: Partial<SessionResults<C>> = {},
): SessionResults<C> {
  const condition = (
    name: C,
    correctMissingRt = 0,
    timeout = 0,
    invalid = 0,
  ) => ({
    condition: name,
    counts: {
      correct: 0,
      incorrect: 0,
      timeout,
      invalid,
      analysable: 0,
      responded: 0,
      recorded: 0,
    },
    rates: {
      responseAccuracy: {
        available: false as const,
        reason: "zero_denominator" as const,
      },
      successfulResponseRate: {
        available: false as const,
        reason: "zero_denominator" as const,
      },
      timeoutRate: {
        available: false as const,
        reason: "zero_denominator" as const,
      },
    },
    medianCorrectRt:
      name === "congruent"
        ? { available: true as const, valueMs: 505, count: 3 }
        : {
            available: false as const,
            reason: "below_display_minimum" as const,
          },
    correctRtCount: 0,
    correctMissingRt,
    correctRtDistribution: {
      available: false as const,
      reason: "below_display_minimum" as const,
    },
  });
  return {
    analysisVersion: "HB-ANALYSIS-1.1",
    status: "complete",
    isComplete: true,
    plannedMainTrials: 60,
    plannedPracticeTrials: 12,
    minimumCorrectForMedian: 10,
    practiceRecorded: 12,
    main: {
      correct: 0,
      incorrect: 0,
      timeout: 0,
      invalid: 0,
      analysable: 0,
      responded: 0,
      recorded: 0,
    },
    unpresentedMain: 0,
    invalidReasons: {},
    overallRates: null,
    conditions: [
      condition("congruent"),
      condition("incongruent", 1, 2, 1),
      condition("neutral"),
    ],
    contrasts: [],
    breakTaken: false,
    breakDurationMs: 0,
    unrecognizedRecords: 0,
    correctMissingRt: 1,
    trialSeries: [
      {
        trialIndex: 1,
        condition: "congruent",
        outcome: "correct",
        reactionTimeMs: 505,
        invalidReason: null,
      },
      {
        trialIndex: 2,
        condition: "incongruent",
        outcome: "incorrect",
        reactionTimeMs: 380,
        invalidReason: null,
      },
      {
        trialIndex: 3,
        condition: "incongruent",
        outcome: "timeout",
        reactionTimeMs: null,
        invalidReason: null,
      },
      {
        trialIndex: 4,
        condition: "incongruent",
        outcome: "invalid",
        reactionTimeMs: null,
        invalidReason: "interrupt",
      },
      {
        trialIndex: 5,
        condition: "congruent",
        outcome: "correct",
        reactionTimeMs: 610,
        invalidReason: null,
      },
      {
        trialIndex: 6,
        condition: "incongruent",
        outcome: "correct",
        reactionTimeMs: null,
        invalidReason: null,
      },
      {
        trialIndex: 7,
        condition: "congruent",
        outcome: "correct",
        reactionTimeMs: 470,
        invalidReason: null,
      },
    ],
    ...overrides,
  };
}

describe("buildRtPlotData", () => {
  it("maps each condition's own correct and incorrect RTs and carries counts and medians", () => {
    const data = buildRtPlotData(results(), 2000)!;
    expect(data.domainMaxMs).toBe(2000);
    const [congruent, incongruent, neutral] = data.rows;
    expect(congruent.condition).toBe("congruent");
    expect(congruent.correctMs).toEqual([505, 610, 470]);
    expect(congruent.incorrectMs).toEqual([]);
    expect(congruent.median).toEqual({
      available: true,
      valueMs: 505,
      count: 3,
    });
    // Missing RT (trial 6) is not plotted; timeouts and invalid trials have no RT.
    expect(incongruent.correctMs).toEqual([]);
    expect(incongruent.incorrectMs).toEqual([380]);
    expect(incongruent.timeouts).toBe(2);
    expect(incongruent.invalid).toBe(1);
    expect(incongruent.correctMissingRt).toBe(1);
    expect(incongruent.median.available).toBe(false);
    expect(neutral.correctMs).toEqual([]);
  });

  it("extends the axis instead of hiding a response slower than the window", () => {
    const base = results();
    const data = buildRtPlotData(
      results({
        trialSeries: [
          ...base.trialSeries!,
          {
            trialIndex: 8,
            condition: "neutral",
            outcome: "incorrect",
            reactionTimeMs: 2350,
            invalidReason: null,
          },
        ],
      }),
      2000,
    )!;
    expect(data.domainMaxMs).toBe(2350);
    expect(data.rows[2].incorrectMs).toEqual([2350]);
  });

  it("returns null for incomplete sessions (counts-only rule)", () => {
    expect(
      buildRtPlotData(
        results({ isComplete: false, status: "incomplete" }),
        2000,
      ),
    ).toBeNull();
    expect(buildRtPlotData(results({ trialSeries: null }), 2000)).toBeNull();
    expect(buildRtPlotData(results({ conditions: null }), 2000)).toBeNull();
  });
});

describe("dodgeLanes", () => {
  it("keeps well-separated points in lane 0", () => {
    expect(dodgeLanes([10, 40, 80], 11)).toEqual([0, 0, 0]);
  });

  it("alternates lanes 0, +1, −1, +2 for points closer than the gap", () => {
    // Sorted by x: all within 11 px of each other.
    expect(dodgeLanes([100, 102, 104, 106], 11)).toEqual([0, 1, -1, 2]);
  });

  it("reuses a lane once points are far enough apart, in input order", () => {
    // 50 and 55 collide (lane 0, +1); 70 is 20 px from 50, so it returns to lane 0.
    expect(dodgeLanes([70, 50, 55], 11)).toEqual([0, 0, 1]);
  });

  it("handles empty input and identical values deterministically", () => {
    expect(dodgeLanes([], 11)).toEqual([]);
    expect(dodgeLanes([5, 5, 5], 11)).toEqual([0, 1, -1]);
  });
});

describe("wrapTokens", () => {
  it("keeps tokens on one line while they fit", () => {
    expect(wrapTokens(["14 correct", "3 incorrect"], " · ", 40)).toEqual([
      "14 correct · 3 incorrect",
    ]);
  });

  it("breaks between tokens, never inside one", () => {
    // "14 correct · 3 incorrect" is 24 characters; adding the next token exceeds 30.
    expect(
      wrapTokens(
        [
          "14 correct",
          "3 incorrect",
          "2 timeouts (no time)",
          "1 invalid (not shown)",
        ],
        " · ",
        30,
      ),
    ).toEqual([
      "14 correct · 3 incorrect",
      "2 timeouts (no time)",
      "1 invalid (not shown)",
    ]);
  });

  it("puts an over-long single token on its own line rather than cutting it", () => {
    expect(wrapTokens(["a", "very long token here", "b"], " · ", 5)).toEqual([
      "a",
      "very long token here",
      "b",
    ]);
    expect(wrapTokens([], " · ", 10)).toEqual([]);
  });
});
