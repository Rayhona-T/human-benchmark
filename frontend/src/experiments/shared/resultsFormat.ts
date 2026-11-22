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
