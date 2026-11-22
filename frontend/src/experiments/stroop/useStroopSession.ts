import {
  useExperimentSession,
  type ExperimentSessionDefinition,
  type ExperimentSessionHook,
  type SessionScreen,
  type SessionTrialStage,
} from "../shared/useExperimentSession";
import {
  STROOP_CONFIGURATION,
  type StroopCondition,
  type StroopResponse,
  type StroopSchedule,
  type StroopStimulus,
} from "./stroop";
import { createStroopSchedule } from "./stroopSchedule";

export type StroopScreen = SessionScreen;
export type StroopTrialStage = SessionTrialStage;
export type StroopSessionHook = ExperimentSessionHook<
  StroopStimulus,
  StroopCondition,
  StroopResponse
>;

/** HB-STROOP-1.0 session definition for the shared session flow. */
export const STROOP_SESSION_DEFINITION: ExperimentSessionDefinition<
  StroopStimulus,
  StroopCondition,
  StroopResponse
> = {
  configuration: STROOP_CONFIGURATION,
  createSchedule: createStroopSchedule,
  randomizationMetadata(schedule) {
    const { metadata } = schedule as StroopSchedule;
    return {
      seedUnsigned32: metadata.seedUnsigned32,
      prngAndScheduleId: metadata.prngAndScheduleId,
      randomizationConfigurationVersion:
        metadata.randomizationConfigurationVersion,
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: metadata.realizedPracticeOrder,
      realizedMainOrder: metadata.realizedMainOrder,
      allocationDetails: {
        selectedDerangement: metadata.selectedDerangement,
        practiceSeedUnsigned32: metadata.practiceSeedUnsigned32,
      },
    };
  },
};

export function useStroopSession(seedOverride?: number): StroopSessionHook {
  return useExperimentSession(STROOP_SESSION_DEFINITION, { seedOverride });
}
