import { describe, expect, it } from "vitest";
import type { TrialOutcome, TrialRecord } from "../../engine/contracts";
import { FLANKER_CONTRASTS, computeFlankerResults } from "./flankerAnalysis";

function record(
  condition: string,
  outcome: TrialOutcome,
  reactionTimeMs: number | null = null,
  phase: "practice" | "main" = "main",
): TrialRecord<unknown, string, unknown> {
  return {
    experiment: {
      experimentId: "flanker",
      protocolId: "HB-FLANKER-1.0",
      protocolVersion: "1.0",
      configurationId: "HB-FLANKER-1.0",
      configurationVersion: "1.0",
    },
    sessionId: "s",
    trialId: `${condition}-${Math.random()}`,
    phase,
    trialIndex: 1,
    condition,
    stimulus: null,
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

const many = <T>(count: number, make: (index: number) => T) =>
  Array.from({ length: count }, (_, index) => make(index));

/**
 * congruent: 18 correct (RT 400, 410, …, 570), 1 incorrect, 1 timeout
 * incongruent: 14 correct (RT 500, …, 630), 4 incorrect, 1 timeout, 1 invalid
 * neutral: 9 correct (RT 450), 1 incorrect, 10 timeouts
 * plus 12 practice trials that must be ignored.
 */
function scenario() {
  return [
    ...many(12, () =>
      record("congruent", { category: "correct" }, 1, "practice"),
    ),
    ...many(18, (i) =>
      record("congruent", { category: "correct" }, 400 + 10 * i),
    ),
    record("congruent", { category: "incorrect" }, 300),
    record("congruent", { category: "timeout" }),
    ...many(14, (i) =>
      record("incongruent", { category: "correct" }, 500 + 10 * i),
    ),
    ...many(4, () => record("incongruent", { category: "incorrect" }, 350)),
    record("incongruent", { category: "timeout" }),
    record("incongruent", { category: "invalid", reason: "visibility_lost" }),
    ...many(9, () => record("neutral", { category: "correct" }, 450)),
    record("neutral", { category: "incorrect" }, 450),
    ...many(10, () => record("neutral", { category: "timeout" })),
  ];
}

describe("Flanker contrast definitions (protocol §10 table)", () => {
  it("matches the protocol's RT and rate operand orders exactly", () => {
    expect(
      FLANKER_CONTRASTS.map((c) => [
        c.id,
        `RT ${c.rtFirst} - ${c.rtSecond}`,
        `rate ${c.rateFirst} - ${c.rateSecond}`,
      ]),
    ).toEqual([
      [
        "interference",
        "RT incongruent - neutral",
        "rate neutral - incongruent",
      ],
      ["facilitation", "RT neutral - congruent", "rate congruent - neutral"],
      [
        "congruency",
        "RT incongruent - congruent",
        "rate congruent - incongruent",
      ],
    ]);
  });
});

describe("computeFlankerResults against hand-calculated values", () => {
  const results = computeFlankerResults({
    status: "complete",
    records: scenario(),
    breakTaken: false,
    breakDurationMs: 0,
  });
  const condition = (name: string) =>
    results.conditions!.find((entry) => entry.condition === name)!;
  const contrast = (id: string) =>
    results.contrasts!.find((entry) => entry.id === id)!;
  const value = (
    v: { available: boolean } & Partial<{ value: number; valueMs: number }>,
  ) => {
    expect(v.available).toBe(true);
    return v.value ?? v.valueMs;
  };

  it("separates practice and counts every outcome category", () => {
    expect(results.practiceRecorded).toBe(12);
    expect(results.main).toMatchObject({
      recorded: 60,
      correct: 41,
      incorrect: 6,
      timeout: 12,
      invalid: 1,
      analysable: 59,
      responded: 47,
    });
    expect(results.unpresentedMain).toBe(0);
    expect(results.invalidReasons).toEqual({ visibility_lost: 1 });
  });

  it("uses the three approved denominators per condition", () => {
    expect(condition("congruent").rates.responseAccuracy).toMatchObject({
      numerator: 18,
      denominator: 19,
    });
    expect(condition("congruent").rates.successfulResponseRate).toMatchObject({
      numerator: 18,
      denominator: 20,
    });
    expect(condition("congruent").rates.timeoutRate).toMatchObject({
      numerator: 1,
      denominator: 20,
    });
    // Invalid trial excluded from every incongruent denominator.
    expect(condition("incongruent").rates.responseAccuracy).toMatchObject({
      numerator: 14,
      denominator: 18,
    });
    expect(condition("incongruent").rates.successfulResponseRate).toMatchObject(
      { numerator: 14, denominator: 19 },
    );
    expect(condition("neutral").rates.responseAccuracy).toMatchObject({
      numerator: 9,
      denominator: 10,
    });
    expect(condition("neutral").rates.timeoutRate).toMatchObject({
      numerator: 10,
      denominator: 20,
    });
  });

  it("computes median correct RT and applies the 10-correct display rule", () => {
    // 18 values 400..570: mean of the 9th and 10th = (480 + 490) / 2.
    expect(condition("congruent").medianCorrectRt).toEqual({
      available: true,
      valueMs: 485,
      count: 18,
    });
    // 14 values 500..630: (560 + 570) / 2.
    expect(condition("incongruent").medianCorrectRt).toEqual({
      available: true,
      valueMs: 565,
      count: 14,
    });
    expect(condition("neutral").medianCorrectRt).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
  });

  it("computes all nine contrasts with protocol signs", () => {
    // RT: neutral below the display rule, so only overall congruency is shown.
    expect(contrast("interference").reactionTime.available).toBe(false);
    expect(contrast("facilitation").reactionTime.available).toBe(false);
    expect(value(contrast("congruency").reactionTime)).toBe(565 - 485);

    // Accuracy: first rate operand minus second.
    expect(value(contrast("interference").responseAccuracy)).toBeCloseTo(
      9 / 10 - 14 / 18,
      12,
    );
    expect(value(contrast("facilitation").responseAccuracy)).toBeCloseTo(
      18 / 19 - 9 / 10,
      12,
    );
    expect(value(contrast("congruency").responseAccuracy)).toBeCloseTo(
      18 / 19 - 14 / 18,
      12,
    );

    // Successful response rate (timeouts in the denominator): mixed signs.
    expect(value(contrast("interference").successfulResponseRate)).toBeCloseTo(
      9 / 20 - 14 / 19,
      12,
    );
    expect(value(contrast("interference").successfulResponseRate)).toBeLessThan(
      0,
    );
    expect(value(contrast("facilitation").successfulResponseRate)).toBeCloseTo(
      18 / 20 - 9 / 20,
      12,
    );
    expect(value(contrast("congruency").successfulResponseRate)).toBeCloseTo(
      18 / 20 - 14 / 19,
      12,
    );
  });

  it("shows only counts for an incomplete session", () => {
    const incomplete = computeFlankerResults({
      status: "incomplete",
      records: scenario().slice(0, 30),
      breakTaken: false,
      breakDurationMs: null,
    });
    expect(incomplete.conditions).toBeNull();
    expect(incomplete.contrasts).toBeNull();
    expect(incomplete.overallRates).toBeNull();
    expect(incomplete.main.recorded).toBe(18);
    expect(incomplete.unpresentedMain).toBe(42);
  });
});
