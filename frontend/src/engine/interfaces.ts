import type {
  EngineResponse,
  ExperimentConfiguration,
  SessionRecord,
  TrialOutcome,
  TrialRecord,
} from "./contracts";

export interface MonotonicClock {
  now(): number;
  readonly isMonotonic: true;
}

export interface Schedule<TTrial> {
  practice: readonly TTrial[];
  main: readonly TTrial[];
  metadata: {
    seedUnsigned32: number | null;
    prngAndScheduleId: string | null;
    randomizationConfigurationVersion: string | null;
    scheduleGenerationStatus: "not_started" | "generated" | "failed";
  };
}

export interface ExperimentAdapter<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
  TTrial = {
    stimulus: TStimulus;
    condition: TCondition;
  },
> {
  readonly configuration: ExperimentConfiguration<
    TStimulus,
    TCondition,
    TResponse
  >;
  createSchedule(seed: number): Schedule<TTrial>;
  getCorrectResponse(trial: TTrial): TResponse;
  classifyResponse(
    trial: TTrial,
    response: EngineResponse<TResponse>,
  ): TrialOutcome;
  getStimulusPresentation(trial: TTrial): TStimulus;
}

export interface EngineObservation<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  onTrialEnded(record: TrialRecord<TStimulus, TCondition, TResponse>): void;
  onSessionEnded(record: SessionRecord<TStimulus, TCondition, TResponse>): void;
}
