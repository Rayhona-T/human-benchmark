/**
 * Experiment-agnostic session results (shared data conventions §1–§2; the
 * analysis plans of HB-STROOP-1.0 §10 and HB-FLANKER-1.0 §10).
 *
 * Pure calculations from recorded trial records. Each experiment supplies its
 * own conditions, contrast definitions (operand order is protocol-defined),
 * planned counts, and RT display minimum. Anything not computable under the
 * rules is returned as `unavailable` with a reason, never as zero.
 */
import type {
  ExperimentConfiguration,
  SessionRecordStatus,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";

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

export interface ConditionResult<TCondition extends string = string> {
  condition: TCondition;
  counts: OutcomeCounts;
  rates: RateSet;
  medianCorrectRt: MedianValue;
  /** Number of correct responses with a usable RT (median input size). */
  correctRtCount: number;
}

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

/** One protocol contrast; RT and rate operand orders are defined separately. */
export interface ContrastDefinition<
  TCondition extends string = string,
  TId extends string = string,
> {
  id: TId;
  /** RT operands in protocol order: positive ⇒ `rtFirst` was slower. */
  rtFirst: TCondition;
  rtSecond: TCondition;
  /** Rate operands in protocol order: positive ⇒ `rateFirst` was higher. */
  rateFirst: TCondition;
  rateSecond: TCondition;
}

export interface ContrastResult<
  TCondition extends string = string,
  TId extends string = string,
> extends ContrastDefinition<TCondition, TId> {
  reactionTime: RtContrastValue;
  responseAccuracy: RateContrastValue;
  successfulResponseRate: RateContrastValue;
}

export interface SessionResults<
  TCondition extends string = string,
  TId extends string = string,
> {
  status: SessionRecordStatus;
  isComplete: boolean;
  plannedMainTrials: number;
  plannedPracticeTrials: number;
  /** RT display rule used for medians and RT contrasts. */
  minimumCorrectForMedian: number;
  /** Practice trials are counted for context only; never analysed. */
  practiceRecorded: number;
  main: OutcomeCounts;
  /** Scheduled main trials that were never presented (not outcomes). */
  unpresentedMain: number;
  invalidReasons: Readonly<Partial<Record<InvalidReason, number>>>;
  /** Present only for complete sessions. */
  overallRates: RateSet | null;
  conditions: readonly ConditionResult<TCondition>[] | null;
  contrasts: readonly ContrastResult<TCondition, TId>[] | null;
  breakTaken: boolean;
  breakDurationMs: number | null;
  /** Records that could not be attributed to a known condition/phase. */
  unrecognizedRecords: number;
}

export interface SessionResultsInput {
  status: SessionRecordStatus;
  records: readonly TrialRecord<unknown, string, unknown>[];
  breakTaken: boolean;
  breakDurationMs: number | null;
}

export interface AnalysisDefinition<
  TCondition extends string = string,
  TId extends string = string,
> {
  conditions: readonly TCondition[];
  contrasts: readonly ContrastDefinition<TCondition, TId>[];
  plannedMainTrials: number;
  plannedPracticeTrials: number;
  minimumCorrectForMedian: number;
}

/** Builds an analysis definition from a protocol's engine configuration. */
export function analysisDefinitionFrom<
  TCondition extends string,
  TId extends string,
>(
  configuration: ExperimentConfiguration<unknown, TCondition, unknown>,
  contrasts: readonly ContrastDefinition<TCondition, TId>[],
): AnalysisDefinition<TCondition, TId> {
  return {
    conditions: configuration.conditions,
    contrasts,
    plannedMainTrials: configuration.main.trialCount,
    plannedPracticeTrials: configuration.practice.trialCount,
    minimumCorrectForMedian: configuration.minimumCorrectResponsesForMedian,
  };
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

function medianCorrectRt(
  rts: readonly number[],
  minimumCorrect: number,
): MedianValue {
  if (rts.length === 0) {
    return { available: false, reason: "no_correct_responses" };
  }
  if (rts.length < minimumCorrect) {
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

export function computeSessionResults<
  TCondition extends string,
  TId extends string,
>(
  input: SessionResultsInput,
  definition: AnalysisDefinition<TCondition, TId>,
): SessionResults<TCondition, TId> {
  const { plannedMainTrials, plannedPracticeTrials, minimumCorrectForMedian } =
    definition;
  const isComplete = input.status === "complete";
  const isKnownCondition = (value: string): value is TCondition =>
    (definition.conditions as readonly string[]).includes(value);

  const main = emptyCounts();
  const byCondition = new Map<TCondition, OutcomeCounts>(
    definition.conditions.map((condition) => [condition, emptyCounts()]),
  );
  const correctRts = new Map<TCondition, number[]>(
    definition.conditions.map((condition) => [condition, []]),
  );
  const invalidReasons: Partial<Record<InvalidReason, number>> = {};
  let practiceRecorded = 0;
  let unrecognizedRecords = 0;

  for (const record of input.records) {
    if (record.phase === "practice") {
      practiceRecorded += 1;
      continue;
    }
    if (record.phase !== "main" || !isKnownCondition(record.condition)) {
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

  let conditions: ConditionResult<TCondition>[] | null = null;
  let contrasts: ContrastResult<TCondition, TId>[] | null = null;
  if (isComplete) {
    const computed = definition.conditions.map((condition) => {
      const counts = byCondition.get(condition) as OutcomeCounts;
      const rts = correctRts.get(condition) as number[];
      return {
        condition,
        counts,
        rates: rateSet(counts),
        medianCorrectRt: medianCorrectRt(rts, minimumCorrectForMedian),
        correctRtCount: rts.length,
      };
    });
    conditions = computed;
    const lookup = (condition: TCondition) =>
      computed.find(
        (entry) => entry.condition === condition,
      ) as ConditionResult<TCondition>;
    contrasts = definition.contrasts.map((contrast) => ({
      ...contrast,
      reactionTime: rtContrast(
        lookup(contrast.rtFirst).medianCorrectRt,
        lookup(contrast.rtSecond).medianCorrectRt,
      ),
      responseAccuracy: rateContrast(
        lookup(contrast.rateFirst).rates.responseAccuracy,
        lookup(contrast.rateSecond).rates.responseAccuracy,
      ),
      successfulResponseRate: rateContrast(
        lookup(contrast.rateFirst).rates.successfulResponseRate,
        lookup(contrast.rateSecond).rates.successfulResponseRate,
      ),
    }));
  }

  return {
    status: input.status,
    isComplete,
    plannedMainTrials,
    plannedPracticeTrials,
    minimumCorrectForMedian,
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
