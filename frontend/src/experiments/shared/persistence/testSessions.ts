/**
 * TEST HELPER ONLY (imported by tests, never by the app).
 *
 * Builds engine-shaped records for a complete session from the REAL schedule
 * generator and randomization metadata of an experiment, with a fixed outcome
 * pattern and deterministic timestamps that follow the engine's rules:
 * deadline = onset + 2000, RT = response - onset, no response or RT for
 * timeouts and invalid trials.
 */
import type {
  EngineTrial,
  TrialOutcome,
  TrialRecord,
} from "../../../engine/contracts";
import type { ExperimentSessionDefinition } from "../useExperimentSession";

/** Engine session ID used in test records; it must never be transmitted. */
export const ENGINE_SESSION_SENTINEL = "ENGINE-SESSION-ID-MUST-NOT-BE-SENT";

export function buildTestRecords<
  TStimulus,
  TCondition extends string,
  TResponse,
>(
  definition: ExperimentSessionDefinition<TStimulus, TCondition, TResponse>,
  seed: number,
  options: { practice?: number; main?: number } = {},
): TrialRecord<TStimulus, TCondition, TResponse>[] {
  const configuration = definition.configuration;
  const schedule = definition.createSchedule(seed);
  const randomization = definition.randomizationMetadata(schedule);
  const keys = configuration.responseMapping.map(
    (mapping) => mapping.responseValue,
  );
  const identity = {
    experimentId: configuration.experimentId,
    protocolId: configuration.protocolId,
    protocolVersion: configuration.protocolVersion,
    configurationId: configuration.configurationId,
    configurationVersion: configuration.configurationVersion,
  };
  const trials: EngineTrial<TStimulus, TCondition, TResponse>[] = [
    ...schedule.practice.slice(0, options.practice ?? schedule.practice.length),
    ...schedule.main.slice(0, options.main ?? schedule.main.length),
  ];

  let clock = 1000;
  return trials.map((trial) => {
    const fixation = clock;
    const onset = clock + 500;
    const deadline = onset + configuration.main.responseDeadlineMs;
    clock += 3000;
    const index = trial.index;
    let outcome: TrialOutcome;
    let response: TrialRecord<TStimulus, TCondition, TResponse>["response"] =
      null;
    let responseTimestamp: number | null = null;
    let reactionTime: number | null = null;
    let offset: number | null;
    let itiEnd: number | null;
    if (index % 13 === 0) {
      outcome = { category: "invalid", reason: "visibility_lost" };
      offset = null;
      itiEnd = null;
    } else if (index % 11 === 0) {
      outcome = { category: "timeout" };
      offset = deadline + 4;
      itiEnd = offset + 500;
    } else {
      reactionTime = 400 + ((index * 7) % 300) + 0.125;
      responseTimestamp = onset + reactionTime;
      const incorrect = index % 7 === 0;
      const value = incorrect
        ? (keys.find((key) => key !== trial.correctResponse) as TResponse)
        : trial.correctResponse;
      response = {
        value,
        inputSource: "keyboard",
        timestampMs: responseTimestamp,
        accepted: true,
      };
      outcome = { category: incorrect ? "incorrect" : "correct" };
      offset = responseTimestamp + 10;
      itiEnd = offset + 500;
    }
    return {
      experiment: identity,
      sessionId: ENGINE_SESSION_SENTINEL,
      trialId: trial.trialId,
      phase: trial.phase,
      trialIndex: index,
      condition: trial.condition,
      stimulus: trial.stimulus,
      correctResponse: trial.correctResponse,
      response,
      lifecycleState: "completed",
      outcome,
      timing: {
        fixationOnsetMs: fixation,
        stimulusOnsetMs: onset,
        responseTimestampMs: responseTimestamp,
        deadlineMs: deadline,
        trialEndMs: responseTimestamp ?? deadline,
        stimulusOffsetMs: offset,
        itiEndMs: itiEnd,
        reactionTimeMs: reactionTime,
        trialDurationMs: reactionTime,
        timingSource: "performance.now",
      },
      randomization,
    };
  });
}
