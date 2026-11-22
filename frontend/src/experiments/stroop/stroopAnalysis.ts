/**
 * Stroop session results (HB-STROOP-1.0 §9–§10).
 *
 * The calculations are the shared, experiment-agnostic ones in
 * `../shared/sessionAnalysis`; this module supplies Stroop's conditions,
 * protocol §10 contrast table, and configuration, and keeps the names the
 * Stroop UI and tests use.
 */
import {
  analysisDefinitionFrom,
  computeSessionResults,
  type ConditionResult as SharedConditionResult,
  type ContrastDefinition,
  type ContrastResult as SharedContrastResult,
  type SessionResults,
  type SessionResultsInput,
} from "../shared/sessionAnalysis";
import { STROOP_CONFIGURATION, type StroopCondition } from "./stroop";

export {
  median,
  rate,
  rateSet,
  type InvalidReason,
  type MedianValue,
  type OutcomeCounts,
  type RateContrastValue,
  type RateSet,
  type RateValue,
  type RtContrastValue,
  type Unavailable,
} from "../shared/sessionAnalysis";

export const STROOP_CONDITIONS: readonly StroopCondition[] =
  STROOP_CONFIGURATION.conditions;

/** Protocol §10: pragmatic product display rule, not a validated threshold. */
export const RT_DISPLAY_MINIMUM_CORRECT =
  STROOP_CONFIGURATION.minimumCorrectResponsesForMedian;

export type ContrastId = "interference" | "facilitation" | "congruency";
export type ConditionResult = SharedConditionResult<StroopCondition>;
export type ContrastResult = SharedContrastResult<StroopCondition, ContrastId>;
export type StroopSessionResults = SessionResults<StroopCondition, ContrastId>;
export type StroopResultsInput = SessionResultsInput;

/**
 * Protocol §10 contrast table. RT and rate operands are deliberately listed
 * separately because the protocol orders rate contrasts so that a positive
 * value means the less-conflicting condition had the higher rate.
 */
export const STROOP_CONTRASTS: readonly ContrastDefinition<
  StroopCondition,
  ContrastId
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

export const STROOP_ANALYSIS = analysisDefinitionFrom(
  STROOP_CONFIGURATION,
  STROOP_CONTRASTS,
);

export function computeStroopResults(
  input: StroopResultsInput,
): StroopSessionResults {
  return computeSessionResults(input, STROOP_ANALYSIS);
}
