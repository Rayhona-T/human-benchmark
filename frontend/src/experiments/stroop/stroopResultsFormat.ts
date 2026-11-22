import type { StroopCondition } from "./stroop";
import {
  RT_DISPLAY_MINIMUM_CORRECT,
  type ContrastResult,
  type InvalidReason,
  type RateContrastValue,
  type RtContrastValue,
} from "./stroopAnalysis";

export const MINUS = "−";

export const CONDITION_LABEL: Record<StroopCondition, string> = {
  congruent: "Congruent",
  incongruent: "Incongruent",
  neutral: "Neutral",
};

export const CONDITION_EXAMPLE: Record<StroopCondition, string> = {
  congruent: "the word names its own ink color (RED shown in red)",
  incongruent: "the word names a different color (RED shown in blue)",
  neutral:
    "a non-color word shown in one of the colors (BOOK shown in green); a practical comparison baseline, not a validated one",
};

export const CONTRAST_TITLE: Record<ContrastResult["id"], string> = {
  interference: "Interference",
  facilitation: "Facilitation",
  congruency: "Overall congruency effect",
};

export const INVALID_REASON_LABEL: Record<InvalidReason, string> = {
  visibility_lost: "page hidden during the word",
  interrupt: "window lost focus during the word",
  focus_lost: "page lost focus during the word",
  presentation_failed: "presentation failed",
  input_failed: "input failed",
  timing_error: "timing unavailable",
  deadline_unavailable: "deadline unavailable",
  protocol_error: "protocol error",
};

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

export function describeRtContrast(
  contrast: ContrastResult,
  value: RtContrastValue,
): string {
  const first = CONDITION_LABEL[contrast.rtFirst].toLowerCase();
  const second = CONDITION_LABEL[contrast.rtSecond].toLowerCase();
  if (!value.available) {
    return `Not shown: both ${first} and ${second} trials need at least ${RT_DISPLAY_MINIMUM_CORRECT} correct responses.`;
  }
  const rounded = Math.round(value.valueMs);
  if (rounded === 0) {
    return `In this session, median correct response times on ${first} and ${second} trials were the same (to the nearest millisecond).`;
  }
  return `In this session, the median correct response on ${first} trials was ${Math.abs(rounded)} ms ${rounded > 0 ? "slower" : "faster"} than on ${second} trials.`;
}

export function describeRateContrast(
  contrast: ContrastResult,
  measure: string,
  value: RateContrastValue,
): string {
  const first = CONDITION_LABEL[contrast.rateFirst].toLowerCase();
  const second = CONDITION_LABEL[contrast.rateSecond].toLowerCase();
  if (!value.available) {
    return `Not shown: ${measure} is unavailable for ${first} or ${second} trials (no trials in its denominator).`;
  }
  const points = Number((value.value * 100).toFixed(1));
  if (points === 0) {
    return `In this session, ${measure} was the same on ${first} and ${second} trials.`;
  }
  return `In this session, ${measure} was ${Math.abs(points).toFixed(1)} percentage points ${points > 0 ? "higher" : "lower"} on ${first} than on ${second} trials.`;
}
