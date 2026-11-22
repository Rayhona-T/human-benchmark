import { describe, expect, it } from "vitest";
import type {
  SessionRecordStatus,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";
import { computeFlankerResults } from "../flanker/flankerAnalysis";
import { computeStroopResults } from "../stroop/stroopAnalysis";
import {
  ANALYSIS_VERSION,
  computeSessionResults,
  quantileSorted,
  speedAccuracyPattern,
  type AnalysisDefinition,
  type ContrastResult,
} from "./sessionAnalysis";

type Condition = "congruent" | "incongruent" | "neutral";

const DEFINITION: AnalysisDefinition<
  Condition,
  "interference" | "facilitation" | "congruency"
> = {
  conditions: ["congruent", "incongruent", "neutral"],
  contrasts: [
    {
      id: "interference",
      rtFirst: "incongruent",
      rtSecond: "neutral",
      rateFirst: "neutral",
      rateSecond: "incongruent",
    },
    {
      id: "facilitation",
      rtFirst: "neutral",
      rtSecond: "congruent",
      rateFirst: "congruent",
      rateSecond: "neutral",
    },
    {
      id: "congruency",
      rtFirst: "incongruent",
      rtSecond: "congruent",
      rateFirst: "congruent",
      rateSecond: "incongruent",
    },
  ],
  plannedMainTrials: 60,
  plannedPracticeTrials: 12,
  minimumCorrectForMedian: 10,
};

let index = 0;
function record(
  condition: string,
  outcome: TrialOutcome,
  reactionTimeMs: number | null = null,
  phase: "practice" | "main" = "main",
): TrialRecord<unknown, string, unknown> {
  index += 1;
  return {
    experiment: {
      experimentId: "test",
      protocolId: "T",
      protocolVersion: "1",
      configurationId: "T",
      configurationVersion: "1",
    },
    sessionId: "s",
    trialId: `t${index}`,
    phase,
    trialIndex: index,
    condition,
    stimulus: null,
    correctResponse: "a",
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
      prngAndScheduleId: "x",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: [],
      realizedMainOrder: [],
    },
  };
}
const correct = (c: string, rt: number | null) =>
  record(c, { category: "correct" }, rt);
const incorrect = (c: string, rt: number | null) =>
  record(c, { category: "incorrect" }, rt);
const timeout = (c: string) => record(c, { category: "timeout" });
const invalid = (c: string) =>
  record(c, { category: "invalid", reason: "focus_lost" });

function analyse(
  records: TrialRecord<unknown, string, unknown>[],
  status: SessionRecordStatus = "complete",
) {
  return computeSessionResults(
    { status, records, breakTaken: false, breakDurationMs: 0 },
    DEFINITION,
  );
}

describe("quantileSorted (Hyndman & Fan type 7)", () => {
  it("matches hand-calculated linear-interpolation quartiles", () => {
    // n = 4: h = 3p → p=.25: 1 + .75(2−1) = 1.75; .5: 2.5; .75: 3.25.
    expect(quantileSorted([1, 2, 3, 4], 0.25)).toBe(1.75);
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3, 4], 0.75)).toBe(3.25);
    // n = 5: h = 4p lands on elements.
    expect(quantileSorted([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantileSorted([10, 20, 30, 40, 50], 0.5)).toBe(30);
    expect(quantileSorted([10, 20, 30, 40, 50], 1)).toBe(50);
    expect(quantileSorted([7], 0.25)).toBe(7);
  });

  it("returns null for empty input or an invalid probability", () => {
    expect(quantileSorted([], 0.5)).toBeNull();
    expect(quantileSorted([1, 2], -0.1)).toBeNull();
    expect(quantileSorted([1, 2], 1.1)).toBeNull();
    expect(quantileSorted([1, 2], Number.NaN)).toBeNull();
  });
});

describe("RT distribution summary", () => {
  // Unsorted on purpose. Sorted: 390 410 445 455 480 505 530 560 620 700.
  const rts = [530, 410, 620, 480, 455, 700, 390, 505, 560, 445];

  it("summarises correct RTs with min, quartiles, median, and max", () => {
    const results = analyse([
      ...rts.map((rt) => correct("congruent", rt)),
      incorrect("congruent", 100), // excluded from the correct-RT summary
      ...Array.from({ length: 20 }, () => timeout("incongruent")),
      ...Array.from({ length: 20 }, () => timeout("neutral")),
    ]);
    const congruent = results.conditions!.find(
      (c) => c.condition === "congruent",
    )!;
    // h = 9p: q1 = 445 + .25·10 = 447.5; median = 480 + .5·25 = 492.5;
    // q3 = 530 + .75·30 = 552.5.
    expect(congruent.correctRtDistribution).toEqual({
      available: true,
      count: 10,
      minMs: 390,
      q1Ms: 447.5,
      medianMs: 492.5,
      q3Ms: 552.5,
      maxMs: 700,
    });
    // Consistent with the approved median definition (mean of middle two).
    expect(congruent.medianCorrectRt).toEqual({
      available: true,
      valueMs: 492.5,
      count: 10,
    });
  });

  it("follows the same 10-correct display rule as the median", () => {
    const results = analyse([
      ...rts.slice(0, 9).map((rt) => correct("congruent", rt)),
      ...Array.from({ length: 20 }, () => invalid("incongruent")),
    ]);
    const byName = (name: Condition) =>
      results.conditions!.find((c) => c.condition === name)!;
    expect(byName("congruent").correctRtDistribution).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
    expect(byName("incongruent").correctRtDistribution).toEqual({
      available: false,
      reason: "no_correct_responses",
    });
    expect(byName("neutral").correctRtDistribution).toEqual({
      available: false,
      reason: "no_correct_responses",
    });
  });
});

describe("missing reaction times (disclosed, never invented)", () => {
  it("counts correct responses without a usable RT as correct but excludes them from RT summaries", () => {
    const results = analyse([
      ...Array.from({ length: 9 }, (_, i) => correct("congruent", 400 + i)),
      correct("congruent", null),
      correct("congruent", Number.NaN),
      correct("congruent", -5),
      correct("congruent", Number.POSITIVE_INFINITY),
    ]);
    const congruent = results.conditions!.find(
      (c) => c.condition === "congruent",
    )!;
    expect(congruent.counts.correct).toBe(13);
    expect(congruent.rates.responseAccuracy).toMatchObject({
      numerator: 13,
      denominator: 13,
    });
    expect(congruent.correctRtCount).toBe(9);
    expect(congruent.correctMissingRt).toBe(4);
    expect(results.correctMissingRt).toBe(4);
    // 13 correct, but only 9 usable RTs: below the display rule.
    expect(congruent.medianCorrectRt).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
  });

  it("reports zero when every correct response has an RT", () => {
    expect(analyse([correct("neutral", 500)]).correctMissingRt).toBe(0);
  });
});

describe("unpresented trials", () => {
  it("does not count presented-but-unattributable main records as not presented", () => {
    const results = analyse(
      [
        ...Array.from({ length: 10 }, () => correct("congruent", 500)),
        correct("mystery", 500),
        correct("mystery", 500),
        record("congruent", { category: "correct" }, 500, "practice"),
      ],
      "incomplete",
    );
    expect(results.main.recorded).toBe(10);
    expect(results.unrecognizedRecords).toBe(2);
    // 60 planned − 10 attributed − 2 presented but unattributable.
    expect(results.unpresentedMain).toBe(48);
    expect(results.practiceRecorded).toBe(1);
  });

  it("treats an empty complete session as having every rate unavailable", () => {
    const results = analyse([]);
    expect(results.unpresentedMain).toBe(60);
    expect(results.overallRates).toEqual({
      responseAccuracy: { available: false, reason: "zero_denominator" },
      successfulResponseRate: { available: false, reason: "zero_denominator" },
      timeoutRate: { available: false, reason: "zero_denominator" },
    });
    expect(
      results.contrasts!.every(
        (c) => !c.reactionTime.available && !c.responseAccuracy.available,
      ),
    ).toBe(true);
    expect(results.trialSeries).toEqual([]);
  });
});

describe("trial series", () => {
  it("lists main trials in order with RTs only for responses", () => {
    const records = [
      record("neutral", { category: "correct" }, 300, "practice"),
      correct("neutral", 512),
      incorrect("congruent", 388),
      timeout("incongruent"),
      invalid("congruent"),
      incorrect("neutral", Number.NaN),
    ];
    const results = analyse(records);
    expect(results.trialSeries).toEqual([
      {
        trialIndex: records[1].trialIndex,
        condition: "neutral",
        outcome: "correct",
        reactionTimeMs: 512,
        invalidReason: null,
      },
      {
        trialIndex: records[2].trialIndex,
        condition: "congruent",
        outcome: "incorrect",
        reactionTimeMs: 388,
        invalidReason: null,
      },
      {
        trialIndex: records[3].trialIndex,
        condition: "incongruent",
        outcome: "timeout",
        reactionTimeMs: null,
        invalidReason: null,
      },
      {
        trialIndex: records[4].trialIndex,
        condition: "congruent",
        outcome: "invalid",
        reactionTimeMs: null,
        invalidReason: "focus_lost",
      },
      {
        trialIndex: records[5].trialIndex,
        condition: "neutral",
        outcome: "incorrect",
        reactionTimeMs: null,
        invalidReason: null,
      },
    ]);
  });

  it("is withheld for incomplete, interrupted, and technical-error sessions", () => {
    for (const status of [
      "incomplete",
      "interrupted",
      "technical_error",
    ] as const) {
      const results = analyse([correct("neutral", 500)], status);
      expect(results.trialSeries, status).toBeNull();
      expect(results.conditions, status).toBeNull();
    }
  });
});

describe("speedAccuracyPattern", () => {
  const contrast = (
    rtMs: number | null,
    accuracy: number | null,
    operands: Partial<ContrastResult<Condition>> = {},
  ): ContrastResult<Condition> => ({
    id: "interference",
    rtFirst: "incongruent",
    rtSecond: "neutral",
    rateFirst: "neutral",
    rateSecond: "incongruent",
    reactionTime:
      rtMs === null
        ? { available: false, reason: "below_display_minimum" }
        : {
            available: true,
            valueMs: rtMs,
            firstMedianMs: 0,
            secondMedianMs: 0,
          },
    responseAccuracy:
      accuracy === null
        ? { available: false, reason: "zero_denominator" }
        : { available: true, value: accuracy, first: 0, second: 0 },
    successfulResponseRate: { available: false, reason: "zero_denominator" },
    ...operands,
  });

  it("interprets the reversed rate operands from the RT-first condition's view", () => {
    // Incongruent slower (+50 ms); neutral − incongruent accuracy +0.10 means
    // incongruent was LESS accurate: slower and less accurate.
    expect(speedAccuracyPattern(contrast(50, 0.1))).toBe("consistent");
    // Incongruent slower but MORE accurate.
    expect(speedAccuracyPattern(contrast(50, -0.1))).toBe("tradeoff");
    // Incongruent faster and more accurate.
    expect(speedAccuracyPattern(contrast(-30, -0.1))).toBe("consistent");
    // Incongruent faster but less accurate.
    expect(speedAccuracyPattern(contrast(-30, 0.1))).toBe("tradeoff");
  });

  it("handles same-order operands, zero differences, and unavailable values", () => {
    const sameOrder = {
      rateFirst: "incongruent",
      rateSecond: "neutral",
    } as const;
    // rateFirst = rtFirst: +0.1 means incongruent MORE accurate.
    expect(speedAccuracyPattern(contrast(50, 0.1, sameOrder))).toBe("tradeoff");
    expect(speedAccuracyPattern(contrast(0.4, 0.1))).toBe("indeterminate");
    expect(speedAccuracyPattern(contrast(50, 0.0004))).toBe("indeterminate");
    expect(speedAccuracyPattern(contrast(null, 0.1))).toBe("unavailable");
    expect(speedAccuracyPattern(contrast(50, null))).toBe("unavailable");
    expect(
      speedAccuracyPattern(
        contrast(50, 0.1, { rateFirst: "congruent", rateSecond: "neutral" }),
      ),
    ).toBe("unavailable");
  });
});

describe("cross-experiment consistency", () => {
  it("gives Stroop and Flanker identical analysis for identical records", () => {
    const records = [
      ...Array.from({ length: 12 }, (_, i) =>
        correct("congruent", 420 + 7 * i),
      ),
      incorrect("congruent", 390),
      timeout("congruent"),
      ...Array.from({ length: 10 }, (_, i) =>
        correct("incongruent", 510 + 11 * i),
      ),
      ...Array.from({ length: 5 }, () => incorrect("incongruent", 480)),
      invalid("incongruent"),
      ...Array.from({ length: 15 }, (_, i) => correct("neutral", 470 + 5 * i)),
      timeout("neutral"),
    ];
    const input = {
      status: "complete" as const,
      records,
      breakTaken: false,
      breakDurationMs: 0,
    };
    const stroop = computeStroopResults(input);
    const flanker = computeFlankerResults(input);
    expect(flanker).toEqual(stroop);
    expect(stroop.analysisVersion).toBe(ANALYSIS_VERSION);
    expect(ANALYSIS_VERSION).toBe("HB-ANALYSIS-1.1");
  });
});
