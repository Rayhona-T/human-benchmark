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
  PracticeOrMain,
  SessionRecordStatus,
  TrialOutcome,
} from "../../engine/contracts";

export type InvalidReason = Extract<
  TrialOutcome,
  { category: "invalid" }
>["reason"];

/**
 * Analysis definitions version. 1.0: Cycle 5/6 metrics and contrasts.
 * 1.1 (Cycle 7): adds missing-RT disclosure, an RT distribution summary, a
 * trial series, and corrects the "not presented" count for unattributable
 * records. No 1.0 value changes for engine-produced sessions.
 */
export const ANALYSIS_VERSION = "HB-ANALYSIS-1.1";

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

/**
 * Descriptive spread of correct-response RTs: minimum, quartiles (linear
 * interpolation, Hyndman & Fan type 7), and maximum. Same eligibility as the
 * median (display rule), so it is never derived from fewer observations.
 */
export type RtDistribution =
  | {
      available: true;
      count: number;
      minMs: number;
      q1Ms: number;
      medianMs: number;
      q3Ms: number;
      maxMs: number;
    }
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
  /**
   * Correct responses whose RT is missing or not a finite, non-negative
   * number. They count as correct for every rate but cannot enter RT
   * summaries; disclosed rather than silently dropped.
   */
  correctMissingRt: number;
  correctRtDistribution: RtDistribution;
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

/** One main trial, in presentation order, for trial-level description. */
export interface TrialPoint<TCondition extends string = string> {
  trialIndex: number;
  condition: TCondition;
  outcome: TrialOutcome["category"];
  /** RT for correct and incorrect responses with a usable value; else null. */
  reactionTimeMs: number | null;
  invalidReason: InvalidReason | null;
}

export interface SessionResults<
  TCondition extends string = string,
  TId extends string = string,
> {
  analysisVersion: string;
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
  /** Correct main responses without a usable RT, across conditions. */
  correctMissingRt: number;
  /**
   * Main trials in presentation order (complete sessions only; incomplete
   * sessions show counts only, per both protocols §7).
   */
  trialSeries: readonly TrialPoint<TCondition>[] | null;
}

/**
 * The fields of one trial record that the analysis reads, and nothing else
 * (Cycle 9 Task 9.3: type-only narrowing; no calculation changed). Engine
 * `TrialRecord`s satisfy it structurally, as do trials reloaded from the
 * backend (observatory/storedSession.ts). Records are analysed in the order
 * given.
 */
export interface AnalysableTrial {
  readonly phase: PracticeOrMain;
  readonly trialIndex: number;
  readonly condition: string;
  readonly outcome: TrialOutcome;
  readonly timing: { readonly reactionTimeMs: number | null };
}

export interface SessionResultsInput {
  status: SessionRecordStatus;
  records: readonly AnalysableTrial[];
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

/**
 * Sample quantile of ascending-sorted values by linear interpolation
 * (Hyndman & Fan 1996, type 7; the default in R, NumPy, and spreadsheet
 * QUARTILE.INC): h = (n − 1)p, interpolating between neighbors.
 */
export function quantileSorted(
  sorted: readonly number[],
  p: number,
): number | null {
  if (sorted.length === 0 || !(p >= 0 && p <= 1)) return null;
  const h = (sorted.length - 1) * p;
  const lower = Math.floor(h);
  const upper = Math.ceil(h);
  return sorted[lower] + (h - lower) * (sorted[upper] - sorted[lower]);
}

function rtDistribution(
  rts: readonly number[],
  minimumCorrect: number,
): RtDistribution {
  if (rts.length === 0) {
    return { available: false, reason: "no_correct_responses" };
  }
  if (rts.length < minimumCorrect) {
    return { available: false, reason: "below_display_minimum" };
  }
  const sorted = [...rts].sort((a, b) => a - b);
  return {
    available: true,
    count: sorted.length,
    minMs: sorted[0],
    q1Ms: quantileSorted(sorted, 0.25) as number,
    medianMs: quantileSorted(sorted, 0.5) as number,
    q3Ms: quantileSorted(sorted, 0.75) as number,
    maxMs: sorted[sorted.length - 1],
  };
}

const usableRt = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

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
  const correctMissing = new Map<TCondition, number>(
    definition.conditions.map((condition) => [condition, 0]),
  );
  const invalidReasons: Partial<Record<InvalidReason, number>> = {};
  const trialSeries: TrialPoint<TCondition>[] = [];
  let practiceRecorded = 0;
  let unrecognizedRecords = 0;
  let unrecognizedMainRecords = 0;

  for (const record of input.records) {
    if (record.phase === "practice") {
      practiceRecorded += 1;
      continue;
    }
    if (record.phase !== "main" || !isKnownCondition(record.condition)) {
      unrecognizedRecords += 1;
      // A main-phase record was presented even if it cannot be attributed;
      // it must not be reported as "not presented".
      if (record.phase === "main") unrecognizedMainRecords += 1;
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
    if (outcome.category === "correct") {
      if (usableRt(rt)) {
        correctRts.get(record.condition)?.push(rt);
      } else {
        correctMissing.set(
          record.condition,
          (correctMissing.get(record.condition) ?? 0) + 1,
        );
      }
    }
    trialSeries.push({
      trialIndex: record.trialIndex,
      condition: record.condition,
      outcome: outcome.category,
      reactionTimeMs:
        (outcome.category === "correct" || outcome.category === "incorrect") &&
        usableRt(rt)
          ? rt
          : null,
      invalidReason: outcome.category === "invalid" ? outcome.reason : null,
    });
  }

  const unpresentedMain = Math.max(
    0,
    plannedMainTrials - main.recorded - unrecognizedMainRecords,
  );
  const correctMissingRt = [...correctMissing.values()].reduce(
    (sum, count) => sum + count,
    0,
  );

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
        correctMissingRt: correctMissing.get(condition) ?? 0,
        correctRtDistribution: rtDistribution(rts, minimumCorrectForMedian),
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
    analysisVersion: ANALYSIS_VERSION,
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
    correctMissingRt,
    trialSeries: isComplete ? trialSeries : null,
  };
}

/**
 * Descriptive speed–accuracy pattern for one contrast, from the perspective
 * of its RT-first condition (Heitz 2014: speed and accuracy can trade off).
 *
 * - "consistent": that condition was slower and less accurate, or faster and
 *   more accurate.
 * - "tradeoff": slower but more accurate, or faster but less accurate.
 * - "indeterminate": no RT or no accuracy difference (to the displayed
 *   precision: 1 ms, 0.1 percentage points).
 * - "unavailable": either the RT or the accuracy contrast is unavailable.
 *
 * Purely descriptive: with at most 20 trials per condition, either pattern
 * can arise from trial-to-trial variation. No threshold or test is applied.
 */
export type SpeedAccuracyPattern =
  "consistent" | "tradeoff" | "indeterminate" | "unavailable";

/** Direction details behind a speed–accuracy pattern (RT-first condition's view). */
export interface SpeedAccuracyDetail {
  pattern: SpeedAccuracyPattern;
  /** +1 slower, −1 faster, 0 same (to 1 ms); null when unavailable. */
  speed: 1 | -1 | 0 | null;
  /** +1 more accurate, −1 less accurate, 0 same (to 0.1 points); null when unavailable. */
  accuracy: 1 | -1 | 0 | null;
}

export function speedAccuracyDetail<TCondition extends string>(
  contrast: ContrastResult<TCondition>,
): SpeedAccuracyDetail {
  const unavailable: SpeedAccuracyDetail = {
    pattern: "unavailable",
    speed: null,
    accuracy: null,
  };
  const rt = contrast.reactionTime;
  const accuracy = contrast.responseAccuracy;
  if (!rt.available || !accuracy.available) return unavailable;
  // Accuracy of the RT-first condition minus the RT-second condition,
  // whichever operand order the protocol uses for rates.
  let firstMinusSecond: number;
  if (
    contrast.rateFirst === contrast.rtFirst &&
    contrast.rateSecond === contrast.rtSecond
  ) {
    firstMinusSecond = accuracy.value;
  } else if (
    contrast.rateFirst === contrast.rtSecond &&
    contrast.rateSecond === contrast.rtFirst
  ) {
    firstMinusSecond = -accuracy.value;
  } else {
    return unavailable;
  }
  const rtMs = Math.round(rt.valueMs);
  const accuracyPoints = Math.round(firstMinusSecond * 1000) / 10;
  const speed = rtMs > 0 ? 1 : rtMs < 0 ? -1 : 0;
  const moreAccurate = accuracyPoints > 0 ? 1 : accuracyPoints < 0 ? -1 : 0;
  const pattern: SpeedAccuracyPattern =
    speed === 0 || moreAccurate === 0
      ? "indeterminate"
      : (speed === 1) === (moreAccurate === 1)
        ? "tradeoff"
        : "consistent";
  return { pattern, speed, accuracy: moreAccurate };
}

export function speedAccuracyPattern<TCondition extends string>(
  contrast: ContrastResult<TCondition>,
): SpeedAccuracyPattern {
  return speedAccuracyDetail(contrast).pattern;
}
