/**
 * Experiment-agnostic formatting and plain-language sentences for session
 * results. Sentences always use the contrast's own operands: RT operands for
 * RT, rate operands for accuracy and successful response rate.
 */
import type {
  ContrastDefinition,
  InvalidReason,
  RateContrastValue,
  RtContrastValue,
  SpeedAccuracyDetail,
} from "./sessionAnalysis";

export const MINUS = "−";

/** Participant-facing wording supplied by each experiment. */
export interface ResultsCopy<
  TCondition extends string = string,
  TId extends string = string,
> {
  conditionLabel: Record<TCondition, string>;
  /** Short description completing "Congruent: …". */
  conditionExample: Record<TCondition, string>;
  contrastTitle: Record<TId, string>;
  invalidReasonLabel: Record<InvalidReason, string>;
  /** What appears on screen, e.g. "the word" or "the arrows". */
  stimulusNoun: string;
  /** Experiment-specific limitations appended to the shared limits text. */
  extraLimitations?: string;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMs(value: number): string {
  return `${Math.round(value)} ms`;
}

function signed(text: string, value: number): string {
  if (value > 0) return `+${text}`;
  if (value < 0) return `${MINUS}${text}`;
  return text;
}

export function formatSignedMs(value: number): string {
  return signed(`${Math.abs(Math.round(value))} ms`, Math.round(value));
}

export function formatSignedPoints(value: number): string {
  const points = Math.abs(value * 100).toFixed(1);
  const rounded = Number((value * 100).toFixed(1));
  return signed(`${points} percentage points`, rounded);
}

export function describeRtContrastWith<TCondition extends string>(
  contrast: ContrastDefinition<TCondition>,
  value: RtContrastValue,
  conditionLabel: Record<TCondition, string>,
  minimumCorrect: number,
): string {
  const first = conditionLabel[contrast.rtFirst].toLowerCase();
  const second = conditionLabel[contrast.rtSecond].toLowerCase();
  if (!value.available) {
    return `Not shown: both ${first} and ${second} trials need at least ${minimumCorrect} correct responses.`;
  }
  const rounded = Math.round(value.valueMs);
  if (rounded === 0) {
    return `In this session, median correct response times on ${first} and ${second} trials were the same (to the nearest millisecond).`;
  }
  return `In this session, the median correct response on ${first} trials was ${Math.abs(rounded)} ms ${rounded > 0 ? "slower" : "faster"} than on ${second} trials.`;
}

export function describeRateContrastWith<TCondition extends string>(
  contrast: ContrastDefinition<TCondition>,
  measure: string,
  value: RateContrastValue,
  conditionLabel: Record<TCondition, string>,
): string {
  const first = conditionLabel[contrast.rateFirst].toLowerCase();
  const second = conditionLabel[contrast.rateSecond].toLowerCase();
  if (!value.available) {
    return `Not shown: ${measure} is unavailable for ${first} or ${second} trials (no trials in its denominator).`;
  }
  const points = Number((value.value * 100).toFixed(1));
  if (points === 0) {
    return `In this session, ${measure} was the same on ${first} and ${second} trials.`;
  }
  return `In this session, ${measure} was ${Math.abs(points).toFixed(1)} percentage points ${points > 0 ? "higher" : "lower"} on ${first} than on ${second} trials.`;
}

/** Shown with every speed–accuracy sentence. */
export const SPEED_ACCURACY_CAVEAT =
  "This describes a small number of trials from one session. It is not a stable characteristic, an ability measure, or an assessment.";

/**
 * Plain-language speed–accuracy sentence for one contrast, from the
 * RT-first condition's point of view; null when it cannot be described.
 */
export function describeSpeedAccuracyWith<TCondition extends string>(
  contrast: ContrastDefinition<TCondition>,
  detail: SpeedAccuracyDetail,
  conditionLabel: Record<TCondition, string>,
): string | null {
  if (detail.pattern === "unavailable") return null;
  const first = conditionLabel[contrast.rtFirst].toLowerCase();
  const second = conditionLabel[contrast.rtSecond].toLowerCase();
  if (detail.pattern === "indeterminate") {
    const same =
      detail.speed === 0 && detail.accuracy === 0
        ? "median response time and response accuracy were the same"
        : detail.speed === 0
          ? "median response time was the same"
          : "response accuracy was the same";
    return `In this session, ${same} on ${first} and ${second} trials, so no speed–accuracy pattern can be described.`;
  }
  const speed = detail.speed === 1 ? "slower" : "faster";
  const accuracy = detail.accuracy === 1 ? "more accurate" : "less accurate";
  if (detail.pattern === "consistent") {
    return `In this session, ${first} trials were both ${speed} and ${accuracy} than ${second} trials: speed and accuracy pointed the same way.`;
  }
  return `In this session, ${first} trials were ${speed} but ${accuracy} than ${second} trials: speed and accuracy moved in opposite directions, so neither one alone describes the difference.`;
}
