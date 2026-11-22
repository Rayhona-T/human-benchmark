import {
  useExperimentSession,
  type ExperimentSessionDefinition,
  type ExperimentSessionHook,
} from "../shared/useExperimentSession";
import {
  FLANKER_CONFIGURATION,
  type FlankerCondition,
  type FlankerResponse,
  type FlankerSchedule,
  type FlankerStimulus,
} from "./flanker";
import { flankerRandomizationMetadata } from "./flankerAdapter";
import { createFlankerSchedule } from "./flankerSchedule";

export type FlankerSessionHook = ExperimentSessionHook<
  FlankerStimulus,
  FlankerCondition,
  FlankerResponse
>;

/** HB-FLANKER-1.0 session definition for the shared session flow. */
export const FLANKER_SESSION_DEFINITION: ExperimentSessionDefinition<
  FlankerStimulus,
  FlankerCondition,
  FlankerResponse
> = {
  configuration: FLANKER_CONFIGURATION,
  createSchedule: createFlankerSchedule,
  randomizationMetadata: (schedule) =>
    flankerRandomizationMetadata(schedule as FlankerSchedule),
};

/**
 * @param canPresentStimulus Protocol §4: returns false when the full 272 px
 *   array cannot be shown, so no timed trial starts.
 */
export function useFlankerSession(
  seedOverride?: number,
  canPresentStimulus?: () => boolean,
): FlankerSessionHook {
  return useExperimentSession(FLANKER_SESSION_DEFINITION, {
    seedOverride,
    canPresentStimulus,
  });
}
