/**
 * Stroop session results (HB-STROOP-1.0 §9–§10).
 *
 * Pure, presentation-free calculations derived only from recorded trial
 * records. Every value carries the counts it was computed from, and anything
 * that cannot be computed under the approved rules is returned as
 * `unavailable` with a reason rather than as zero or an estimate.
 */
import type {
  SessionRecordStatus,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";
import {
  STROOP_CONFIGURATION,
  type StroopCondition,
  type StroopResponse,
} from "./stroop";

export const STROOP_CONDITIONS: readonly StroopCondition[] = [
  "congruent",
  "incongruent",
  "neutral",
];

/** Protocol §10: pragmatic product display rule, not a validated threshold. */
export const RT_DISPLAY_MINIMUM_CORRECT =
  STROOP_CONFIGURATION.minimumCorrectResponsesForMedian;

export type InvalidReason = Extract<
  TrialOutcome,
  { category: "invalid" }
>["reason"];

export type Unavailable<TReason extends string> = {
  available: false;
  reason: TReason;
};

export type RateValue =
  | { available: true; numerator: number; denominator: number; value: number }
  | Unavailable<"zero_denominator">;

export type MedianValue =
  | { available: true; valueMs: number; count: number }
  | Unavailable<"below_display_minimum" | "no_correct_responses">;

export interface OutcomeCounts {
  correct: number;
  incorrect: number;
  timeout: number;
  invalid: number;
  /** correct + incorrect + timeout (protocol "analysable" trials). */
  analysable: number;
  /** correct + incorrect (trials with a valid mapped response). */
  responded: number;
  /** All recorded (presented) trials, including invalid ones. */
  recorded: number;
}

export interface RateSet {
  responseAccuracy: RateValue;
  successfulResponseRate: RateValue;
  timeoutRate: RateValue;
}

export interface ConditionResult {
  condition: StroopCondition;
  counts: OutcomeCounts;
  rates: RateSet;
  medianCorrectRt: MedianValue;
  /** Number of correct responses with a usable RT (median input size). */
  correctRtCount: number;
}

export type ContrastId = "interference" | "facilitation" | "congruency";

export type RtContrastValue =
  | {
      available: true;
      valueMs: number;
      firstMedianMs: number;
      secondMedianMs: number;
    }
  | Unavailable<"below_display_minimum">;

export type RateContrastValue =
  | {
      available: true;
      /** Difference in proportions (first − second), range −1..1. */
      value: number;
      first: number;
      second: number;
    }
  | Unavailable<"zero_denominator">;

export interface ContrastResult {
  id: ContrastId;
  /** RT operands in protocol order: positive ⇒ `rtFirst` was slower. */
  rtFirst: StroopCondition;
  rtSecond: StroopCondition;
  /** Rate operands in protocol order: positive ⇒ `rateFirst` was higher. */
  rateFirst: StroopCondition;
  rateSecond: StroopCondition;
  reactionTime: RtContrastValue;
  responseAccuracy: RateContrastValue;
  successfulResponseRate: RateContrastValue;
}

export interface StroopSessionResults {
  status: SessionRecordStatus;
  isComplete: boolean;
  plannedMainTrials: number;
  plannedPracticeTrials: number;
  /** Practice trials are counted for context only; never analysed. */
  practiceRecorded: number;
  main: OutcomeCounts;
  /** Scheduled main trials that were never presented (not outcomes). */
  unpresentedMain: number;
  invalidReasons: Readonly<Partial<Record<InvalidReason, number>>>;
  /** Present only for complete sessions (protocol §6/§7). */
  overallRates: RateSet | null;
  conditions: readonly ConditionResult[] | null;
  contrasts: readonly ContrastResult[] | null;
  breakTaken: boolean;
  breakDurationMs: number | null;
  /** Records that could not be attributed to a known condition/phase. */
  unrecognizedRecords: number;
}

export interface StroopResultsInput {
  status: SessionRecordStatus;
  records: readonly TrialRecord<unknown, string, StroopResponse>[];
  breakTaken: boolean;
  breakDurationMs: number | null;
}

/**
 * Protocol §10 contrast table. RT and rate operands are deliberately listed
 * separately because the protocol orders rate contrasts so that a positive
 * value means the less-conflicting condition had the higher rate.
 */
const CONTRAST_DEFINITIONS: readonly Omit<
  ContrastResult,
  "reactionTime" | "responseAccuracy" | "successfulResponseRate"
>[] = [
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
];

function isStroopCondition(value: string): value is StroopCondition {
  return (STROOP_CONDITIONS as readonly string[]).includes(value);
}

export function rate(numerator: number, denominator: number): RateValue {
  if (denominator === 0) {
    return { available: false, reason: "zero_denominator" };
  }
  return {
    available: true,
    numerator,
    denominator,
    value: numerator / denominator,
  };
}

/** Median; for an even count, the mean of the two middle values. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function emptyCounts(): OutcomeCounts {
  return {
    correct: 0,
    incorrect: 0,
    timeout: 0,
    invalid: 0,
    analysable: 0,
    responded: 0,
    recorded: 0,
  };
}

function addOutcome(counts: OutcomeCounts, outcome: TrialOutcome): void {
  counts.recorded += 1;
  counts[outcome.category] += 1;
  if (outcome.category !== "invalid") counts.analysable += 1;
  if (outcome.category === "correct" || outcome.category === "incorrect") {
    counts.responded += 1;
  }
}

export function rateSet(counts: OutcomeCounts): RateSet {
  return {
    responseAccuracy: rate(counts.correct, counts.responded),
    successfulResponseRate: rate(counts.correct, counts.analysable),
    timeoutRate: rate(counts.timeout, counts.analysable),
  };
}

function medianCorrectRt(rts: readonly number[]): MedianValue {
  if (rts.length === 0) {
    return { available: false, reason: "no_correct_responses" };
  }
  if (rts.length < RT_DISPLAY_MINIMUM_CORRECT) {
    return { available: false, reason: "below_display_minimum" };
  }
  return { available: true, valueMs: median(rts) as number, count: rts.length };
}

function rateContrast(first: RateValue, second: RateValue): RateContrastValue {
  if (!first.available || !second.available) {
    return { available: false, reason: "zero_denominator" };
  }
  return {
    available: true,
    value: first.value - second.value,
    first: first.value,
    second: second.value,
  };
}

function rtContrast(first: MedianValue, second: MedianValue): RtContrastValue {
  if (!first.available || !second.available) {
    return { available: false, reason: "below_display_minimum" };
  }
  return {
    available: true,
    valueMs: first.valueMs - second.valueMs,
    firstMedianMs: first.valueMs,
    secondMedianMs: second.valueMs,
  };
}

export function computeStroopResults(
  input: StroopResultsInput,
): StroopSessionResults {
  const plannedMainTrials = STROOP_CONFIGURATION.main.trialCount;
  const plannedPracticeTrials = STROOP_CONFIGURATION.practice.trialCount;
  const isComplete = input.status === "complete";

  const main = emptyCounts();
  const byCondition = new Map<StroopCondition, OutcomeCounts>(
    STROOP_CONDITIONS.map((condition) => [condition, emptyCounts()]),
  );
  const correctRts = new Map<StroopCondition, number[]>(
    STROOP_CONDITIONS.map((condition) => [condition, []]),
  );
  const invalidReasons: Partial<Record<InvalidReason, number>> = {};
  let practiceRecorded = 0;
  let unrecognizedRecords = 0;

  for (const record of input.records) {
    if (record.phase === "practice") {
      practiceRecorded += 1;
      continue;
    }
    if (record.phase !== "main" || !isStroopCondition(record.condition)) {
      unrecognizedRecords += 1;
      continue;
    }
    const { outcome } = record;
    addOutcome(main, outcome);
    addOutcome(byCondition.get(record.condition) as OutcomeCounts, outcome);
    if (outcome.category === "invalid") {
      invalidReasons[outcome.reason] =
        (invalidReasons[outcome.reason] ?? 0) + 1;
    }
    const rt = record.timing.reactionTimeMs;
    if (
      outcome.category === "correct" &&
      rt !== null &&
      Number.isFinite(rt) &&
      rt >= 0
    ) {
      correctRts.get(record.condition)?.push(rt);
    }
  }

  const unpresentedMain = Math.max(0, plannedMainTrials - main.recorded);

  let conditions: ConditionResult[] | null = null;
  let contrasts: ContrastResult[] | null = null;
  if (isComplete) {
    conditions = STROOP_CONDITIONS.map((condition) => {
      const counts = byCondition.get(condition) as OutcomeCounts;
      const rts = correctRts.get(condition) as number[];
      return {
        condition,
        counts,
        rates: rateSet(counts),
        medianCorrectRt: medianCorrectRt(rts),
        correctRtCount: rts.length,
      };
    });
    const lookup = (condition: StroopCondition) =>
      (conditions as ConditionResult[]).find(
        (entry) => entry.condition === condition,
      ) as ConditionResult;
    contrasts = CONTRAST_DEFINITIONS.map((definition) => ({
      ...definition,
      reactionTime: rtContrast(
        lookup(definition.rtFirst).medianCorrectRt,
        lookup(definition.rtSecond).medianCorrectRt,
      ),
      responseAccuracy: rateContrast(
        lookup(definition.rateFirst).rates.responseAccuracy,
        lookup(definition.rateSecond).rates.responseAccuracy,
      ),
      successfulResponseRate: rateContrast(
        lookup(definition.rateFirst).rates.successfulResponseRate,
        lookup(definition.rateSecond).rates.successfulResponseRate,
      ),
    }));
  }

  return {
    status: input.status,
    isComplete,
    plannedMainTrials,
    plannedPracticeTrials,
    practiceRecorded,
    main,
    unpresentedMain,
    invalidReasons,
    overallRates: isComplete ? rateSet(main) : null,
    conditions,
    contrasts,
    breakTaken: input.breakTaken,
    breakDurationMs: input.breakDurationMs,
    unrecognizedRecords,
  };
}
