/**
 * Flanker session results (HB-FLANKER-1.0 §9–§10), using the shared
 * calculations in `../shared/sessionAnalysis`.
 */
import {
  analysisDefinitionFrom,
  computeSessionResults,
  type ContrastDefinition,
  type SessionResults,
  type SessionResultsInput,
} from "../shared/sessionAnalysis";
import { FLANKER_CONFIGURATION, type FlankerCondition } from "./flanker";

export type FlankerContrastId = "interference" | "facilitation" | "congruency";
export type FlankerSessionResults = SessionResults<
  FlankerCondition,
  FlankerContrastId
>;

/**
 * Protocol §10 contrast table. RT: positive ⇒ the first RT operand was slower.
 * Rates: positive ⇒ the first rate operand had the higher rate. The rate
 * operands are deliberately the reverse of the RT operands.
 */
export const FLANKER_CONTRASTS: readonly ContrastDefinition<
  FlankerCondition,
  FlankerContrastId
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

export const FLANKER_ANALYSIS = analysisDefinitionFrom(
  FLANKER_CONFIGURATION,
  FLANKER_CONTRASTS,
);

export function computeFlankerResults(
  input: SessionResultsInput,
): FlankerSessionResults {
  return computeSessionResults(input, FLANKER_ANALYSIS);
}
