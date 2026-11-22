import type { ExportColumn } from "../shared/exportTrials";
import type { ResultsCopy } from "../shared/resultsFormat";
import {
  FLANKER_SYMBOLS,
  type FlankerCondition,
  type FlankerStimulus,
} from "./flanker";
import type { FlankerContrastId } from "./flankerAnalysis";

const L = FLANKER_SYMBOLS.left;
const R = FLANKER_SYMBOLS.right;
const D = FLANKER_SYMBOLS.neutral;

/** Participant-facing wording for Flanker results (HB-FLANKER-1.0 §4, §10, §11). */
export const FLANKER_RESULTS_COPY: ResultsCopy<
  FlankerCondition,
  FlankerContrastId
> = {
  conditionLabel: {
    congruent: "Congruent",
    incongruent: "Incongruent",
    neutral: "Neutral",
  },
  conditionExample: {
    congruent: `all five arrows point the same way (${R}${R}${R}${R}${R})`,
    incongruent: `the four surrounding arrows point the opposite way to the center arrow (${L}${L}${R}${L}${L})`,
    neutral: `dashes surround the center arrow (${D}${D}${R}${D}${D}); a chosen comparison baseline that is not perceptually matched to arrows`,
  },
  contrastTitle: {
    interference: "Flanker interference",
    facilitation: "Facilitation",
    congruency: "Overall congruency",
  },
  invalidReasonLabel: {
    visibility_lost: "page hidden during the arrows",
    interrupt: "window lost focus during the arrows",
    focus_lost: "page lost focus during the arrows",
    presentation_failed: "presentation failed",
    input_failed: "input failed",
    timing_error: "timing unavailable",
    deadline_unavailable: "deadline unavailable",
    protocol_error: "protocol error",
  },
  stimulusNoun: "the arrows",
  extraLimitations:
    "The arrows have a fixed size in screen pixels, so how large they look depends on your screen and viewing distance, and the spacing between arrows affects the size of the effect. Trials were shuffled in balanced sets, but how often each condition followed each other condition was not controlled, so effects of the previous trial can contribute to these results.",
};

/** Flanker stimulus columns for the participant-initiated CSV export. */
export const FLANKER_EXPORT_COLUMNS: readonly ExportColumn<FlankerStimulus>[] =
  [
    {
      name: "stimulus_symbols",
      description: "The five symbols shown; the center one is the target.",
      value: (record) => record.stimulus.text,
    },
    {
      name: "target_direction",
      description: "Direction of the center arrow (left or right).",
      value: (record) => record.stimulus.targetDirection,
    },
    {
      name: "flanker_direction",
      description:
        "What the four surrounding symbols indicate: left, right, or neutral (dashes).",
      value: (record) => record.stimulus.flankerType,
    },
  ];
