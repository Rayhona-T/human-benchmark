import type {
  EngineResponse,
  RandomizationMetadata,
  TrialOutcome,
} from "../../engine/contracts";
import type { ExperimentAdapter } from "../../engine/interfaces";
import {
  FLANKER_CONFIGURATION,
  getFlankerCorrectKey,
  type FlankerCondition,
  type FlankerResponse,
  type FlankerSchedule,
  type FlankerStimulus,
  type FlankerTrial,
} from "./flanker";
import { createFlankerSchedule } from "./flankerSchedule";

/** Engine adapter for HB-FLANKER-1.0. No React, no DOM. */
export const flankerAdapter: ExperimentAdapter<
  FlankerStimulus,
  FlankerCondition,
  FlankerResponse,
  FlankerTrial
> = {
  configuration: FLANKER_CONFIGURATION,
  createSchedule(seed) {
    return createFlankerSchedule(seed);
  },
  getCorrectResponse(trial) {
    return getFlankerCorrectKey(trial.stimulus.targetDirection);
  },
  classifyResponse(
    trial: FlankerTrial,
    response: EngineResponse<FlankerResponse>,
  ): TrialOutcome {
    if (!response.accepted) {
      return { category: "invalid", reason: "protocol_error" };
    }
    return response.value ===
      getFlankerCorrectKey(trial.stimulus.targetDirection)
      ? { category: "correct" }
      : { category: "incorrect" };
  },
  getStimulusPresentation(trial) {
    return trial.stimulus;
  },
};

/**
 * Session randomization metadata for `ExperimentLifecycle`, carrying what
 * protocol §8.6 and the data conventions require to reproduce or audit a
 * session (seed, identifiers, realized orders, practice stream seed, base
 * item order).
 */
export function flankerRandomizationMetadata(
  schedule: FlankerSchedule,
): RandomizationMetadata {
  return {
    seedUnsigned32: schedule.metadata.seedUnsigned32,
    prngAndScheduleId: schedule.metadata.prngAndScheduleId,
    randomizationConfigurationVersion:
      schedule.metadata.randomizationConfigurationVersion,
    scheduleGenerationStatus: "generated",
    realizedPracticeOrder: schedule.metadata.realizedPracticeOrder,
    realizedMainOrder: schedule.metadata.realizedMainOrder,
    allocationDetails: {
      practiceSeedUnsigned32: schedule.metadata.practiceSeedUnsigned32,
      baseItemOrder: schedule.metadata.baseItemOrder,
    },
  };
}
