/**
 * Stroop wording for the shared results presentation. Formatting and sentence
 * logic live in `../shared/resultsFormat`; these exports keep the names the
 * Stroop UI and tests use.
 */
import {
  describeRateContrastWith,
  describeRtContrastWith,
  type ResultsCopy,
} from "../shared/resultsFormat";
import type { InvalidReason } from "../shared/sessionAnalysis";
import type { ExportColumn } from "../shared/exportTrials";
import type { ApiStimulus } from "../shared/persistence/sessionPayload";
import type { StroopCondition, StroopStimulus } from "./stroop";
import {
  RT_DISPLAY_MINIMUM_CORRECT,
  type ContrastId,
  type ContrastResult,
  type RateContrastValue,
  type RtContrastValue,
} from "./stroopAnalysis";

export {
  MINUS,
  formatMs,
  formatPercent,
  formatSignedMs,
  formatSignedPoints,
} from "../shared/resultsFormat";

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

export const CONTRAST_TITLE: Record<ContrastId, string> = {
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

export const STROOP_RESULTS_COPY: ResultsCopy<StroopCondition, ContrastId> = {
  conditionLabel: CONDITION_LABEL,
  conditionExample: CONDITION_EXAMPLE,
  contrastTitle: CONTRAST_TITLE,
  invalidReasonLabel: INVALID_REASON_LABEL,
  stimulusNoun: "the word",
};

export function describeRtContrast(
  contrast: ContrastResult,
  value: RtContrastValue,
): string {
  return describeRtContrastWith(
    contrast,
    value,
    CONDITION_LABEL,
    RT_DISPLAY_MINIMUM_CORRECT,
  );
}

export function describeRateContrast(
  contrast: ContrastResult,
  measure: string,
  value: RateContrastValue,
): string {
  return describeRateContrastWith(contrast, measure, value, CONDITION_LABEL);
}

/** Stroop stimulus columns for the participant-initiated CSV export. */
export const STROOP_EXPORT_COLUMNS: readonly ExportColumn<StroopStimulus>[] = [
  {
    name: "stimulus_word",
    description:
      "Word shown: RED, BLUE, GREEN, or YELLOW, or a neutral word (BOOK, CHAIR, HOUSE, TABLE, MUSIC).",
    value: (record) => record.stimulus.word,
  },
  {
    name: "stimulus_ink",
    description:
      "Ink color of the word, which is what the response should match.",
    value: (record) => record.stimulus.inkColor,
  },
];

/**
 * Stimulus attributes sent when a session is saved (backend StroopStimulus).
 * Presentation constants (hex color, font, size, background) are fixed by the
 * protocol ID and are not sent.
 */
export function stroopStimulusToApi(stimulus: StroopStimulus): ApiStimulus {
  return { word: stimulus.word, ink_color: stimulus.inkColor };
}
