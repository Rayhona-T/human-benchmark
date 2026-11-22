export type ExperimentId = "stroop" | "flanker" | (string & {});

export type PracticeOrMain = "practice" | "main";
export type SessionPhase =
  "idle" | "instructions" | PracticeOrMain | "ready" | "break";

export interface ExperimentIdentity {
  experimentId: ExperimentId;
  protocolId: string;
  protocolVersion: string;
  configurationId: string;
  configurationVersion: string;
}

export interface PhaseConfiguration {
  trialCount: number;
  responseDeadlineMs: number;
  fixationMs: number;
  interTrialIntervalMs: number;
  feedbackEnabled: boolean;
  breakAfterTrialIndex?: number;
}

export interface ExperimentConfiguration<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> extends ExperimentIdentity {
  practice: PhaseConfiguration;
  main: PhaseConfiguration;
  stimulusDefinition: TStimulus;
  conditions: readonly TCondition[];
  responseMapping: readonly ResponseMapping<TResponse>[];
  minimumCorrectResponsesForMedian: number;
  neutralCondition: TCondition | null;
}

export interface ResponseMapping<TResponse = string> {
  responseValue: TResponse;
  logicalKey: string;
  label: string;
}

export type SessionLifecycleState =
  | "idle"
  | "instructions"
  | "practice"
  | "ready"
  | "main"
  | "break"
  | "paused"
  | "completed"
  | "aborted"
  | "technical_error";

export type SessionRecordStatus =
  "complete" | "incomplete" | "interrupted" | "technical_error";

export type TrialLifecycleState =
  "preparing" | "ready" | "active" | "responded" | "completed";

export interface EngineTrial<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  trialId: string;
  index: number;
  phase: PracticeOrMain;
  condition: TCondition;
  stimulus: TStimulus;
  correctResponse: TResponse;
}

export type TrialOutcome =
  | { category: "correct" }
  | { category: "incorrect" }
  | { category: "timeout" }
  | {
      category: "invalid";
      reason:
        | "focus_lost"
        | "visibility_lost"
        | "presentation_failed"
        | "input_failed"
        | "timing_error"
        | "deadline_unavailable"
        | "interrupt"
        | "protocol_error";
    };

export type ResponseRejectionReason =
  | "before_activation"
  | "trial_completed"
  | "trial_timed_out"
  | "trial_interrupted"
  | "repeat"
  | "unmapped"
  | "at_or_after_deadline"
  | "duplicate_response"
  | "timing_unavailable";

export interface EngineResponse<TResponse = string> {
  value: TResponse;
  inputSource: "keyboard";
  timestampMs: number;
  accepted: boolean;
  rejectionReason?: ResponseRejectionReason;
}

export interface TimingMetadata {
  fixationOnsetMs: number | null;
  stimulusOnsetMs: number | null;
  responseTimestampMs: number | null;
  deadlineMs: number | null;
  /** Engine settle time: response handler timestamp, or the deadline. */
  trialEndMs: number | null;
  /**
   * Animation-frame callback timestamp of the frame that removed the stimulus
   * after a response or timeout (the protocol's stimulus offset / "trial end").
   * Null when no such frame occurred (e.g. trial invalidated by interruption,
   * or the session ended before it).
   */
  stimulusOffsetMs: number | null;
  /** Monotonic time the inter-trial interval completed; null if it did not. */
  itiEndMs: number | null;
  reactionTimeMs: number | null;
  trialDurationMs: number | null;
  timingSource: "performance.now" | "injected" | null;
}

export interface RandomizationMetadata {
  seedUnsigned32: number | null;
  prngAndScheduleId: string | null;
  randomizationConfigurationVersion: string | null;
  scheduleGenerationStatus: "not_started" | "generated" | "failed";
  realizedPracticeOrder: readonly unknown[];
  realizedMainOrder: readonly unknown[];
  /**
   * Experiment-specific stimulus-allocation details needed to reproduce the
   * schedule (e.g. Stroop's selected derangement). Optional and read-only.
   */
  allocationDetails?: Readonly<Record<string, unknown>>;
}

export interface TrialRecord<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  experiment: ExperimentIdentity;
  sessionId: string;
  trialId: string;
  phase: PracticeOrMain;
  trialIndex: number;
  condition: TCondition;
  stimulus: TStimulus;
  correctResponse: TResponse;
  response: EngineResponse<TResponse> | null;
  lifecycleState: "completed";
  outcome: TrialOutcome;
  timing: TimingMetadata;
  randomization: RandomizationMetadata;
}

export interface SessionRecord<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  identity: ExperimentIdentity;
  sessionId: string;
  status: SessionRecordStatus;
  lifecycleState: "completed" | "aborted" | "technical_error";
  practiceTrialCount: number;
  mainTrialCount: number;
  breakTaken: boolean;
  breakDurationMs: number | null;
  randomization: RandomizationMetadata;
  trialRecords: readonly TrialRecord<TStimulus, TCondition, TResponse>[];
}
