import type { EngineResponse, TrialOutcome } from "../../engine/contracts";
import type { ExperimentAdapter } from "../../engine/interfaces";
import {
  STROOP_CONFIGURATION,
  type StroopStimulus,
  type StroopCondition,
  type StroopResponse,
  type StroopTrial,
} from "./stroop";
import {
  createStroopSchedule,
  getCorrectKey,
  validateSeed,
} from "./stroopSchedule";

export const stroopAdapter: ExperimentAdapter<
  StroopStimulus,
  StroopCondition,
  StroopResponse,
  StroopTrial
> = {
  configuration: STROOP_CONFIGURATION,
  createSchedule(seed) {
    validateSeed(seed);
    return createStroopSchedule(seed);
  },
  getCorrectResponse(trial) {
    return getCorrectKey(trial.stimulus.inkColor);
  },
  classifyResponse(
    trial: StroopTrial,
    response: EngineResponse<StroopResponse>,
  ): TrialOutcome {
    if (!response.accepted) {
      return { category: "invalid", reason: "protocol_error" };
    }
    return response.value === getCorrectKey(trial.stimulus.inkColor)
      ? { category: "correct" }
      : { category: "incorrect" };
  },
  getStimulusPresentation(trial) {
    return trial.stimulus;
  },
};
