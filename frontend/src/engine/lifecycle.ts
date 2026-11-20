import type {
  EngineResponse,
  EngineTrial,
  ExperimentConfiguration,
  PracticeOrMain,
  RandomizationMetadata,
  SessionLifecycleState,
  SessionRecord,
  SessionRecordStatus,
  TimingMetadata,
  TrialLifecycleState,
  TrialOutcome,
  TrialRecord,
} from "./contracts";
import type { Schedule } from "./interfaces";

export type LifecycleAction<TResponse = string> =
  | { type: "OPEN_INSTRUCTIONS" }
  | { type: "BEGIN_PRACTICE" }
  | { type: "ACTIVATE_TRIAL" }
  | {
      type: "COMPLETE_TRIAL";
      outcome: TrialOutcome;
      response?: EngineResponse<TResponse>;
      timing?: Partial<TimingMetadata>;
    }
  | { type: "ADVANCE_TRIAL" }
  | { type: "BEGIN_MAIN" }
  | { type: "OFFER_BREAK" }
  | { type: "TAKE_BREAK"; durationMs: number }
  | { type: "SKIP_BREAK" }
  | { type: "CONTINUE_AFTER_BREAK" }
  | { type: "PAUSE"; resumePhase?: PracticeOrMain }
  | { type: "RESUME" }
  | { type: "TECHNICAL_ERROR" }
  | { type: "ABORT" }
  | { type: "INTERRUPT" }
  | { type: "COMPLETE" }
  | { type: "SCHEDULE_ERROR" };

export type LifecycleErrorReason =
  | "invalid_transition"
  | "invalid_trial_action"
  | "invalid_trial_index"
  | "invalid_schedule"
  | "premature_completion"
  | "break_not_configured"
  | "break_not_at_boundary";

export type LifecycleResult =
  | { ok: true }
  | {
      ok: false;
      reason: LifecycleErrorReason;
      state: SessionLifecycleState;
    };

interface ActiveTrialContext {
  trialIndex: number;
  trialId: string;
  trialLifecycle: TrialLifecycleState;
}

export interface LifecycleSnapshot<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  sessionId: string;
  state: SessionLifecycleState;
  phase: PracticeOrMain | "idle" | "instructions" | "break" | "ready";
  practiceIndex: number;
  mainIndex: number;
  activeTrial: ActiveTrialContext | null;
  records: readonly TrialRecord<TStimulus, TCondition, TResponse>[];
  breakTaken: boolean;
  breakDurationMs: number | null;
  status: SessionRecordStatus;
}

export class ExperimentLifecycle<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  private state: SessionLifecycleState = "idle";
  private phase: PracticeOrMain | "idle" | "instructions" | "break" | "ready" =
    "idle";
  private practiceIndex = 0;
  private mainIndex = 0;
  private activeTrial: ActiveTrialContext | null = null;
  private resumePhase: PracticeOrMain | "break" | null = null;
  private resumeActiveTrial: ActiveTrialContext | null = null;
  private breakTaken = false;
  private breakDurationMs: number | null = null;
  private status: SessionRecordStatus = "incomplete";
  private records: TrialRecord<TStimulus, TCondition, TResponse>[] = [];
  private readonly sessionId: string;
  private readonly configuration: ExperimentConfiguration<
    TStimulus,
    TCondition,
    TResponse
  >;
  private readonly schedule: Schedule<
    EngineTrial<TStimulus, TCondition, TResponse>
  >;
  private readonly randomization: RandomizationMetadata;

  constructor(
    sessionId: string,
    configuration: ExperimentConfiguration<TStimulus, TCondition, TResponse>,
    schedule: Schedule<EngineTrial<TStimulus, TCondition, TResponse>>,
    randomization: RandomizationMetadata,
  ) {
    this.sessionId = sessionId;
    this.configuration = configuration;
    this.schedule = schedule;
    this.randomization = randomization;
  }

  dispatch(action: LifecycleAction<TResponse>): LifecycleResult {
    switch (action.type) {
      case "OPEN_INSTRUCTIONS":
        return this.requireState("idle", () => {
          this.state = "instructions";
          this.phase = "instructions";
        });
      case "BEGIN_PRACTICE":
        if (
          this.schedule.practice.length !==
          this.configuration.practice.trialCount
        ) {
          return this.error("invalid_schedule");
        }
        return this.requireState("instructions", () => {
          if (this.schedule.practice.length === 0) {
            this.state = "ready";
            this.phase = "ready";
          } else {
            this.state = "practice";
            this.phase = "practice";
          }
        });
      case "ACTIVATE_TRIAL":
        return this.activateTrial();
      case "COMPLETE_TRIAL":
        return this.completeTrial(action);
      case "ADVANCE_TRIAL":
        return this.advanceTrial();
      case "BEGIN_MAIN":
        if (this.schedule.main.length !== this.configuration.main.trialCount) {
          return this.error("invalid_schedule");
        }
        return this.requireState("ready", () => {
          if (this.schedule.main.length === 0) {
            this.state = "ready";
            this.phase = "ready";
          } else {
            this.state = "main";
            this.phase = "main";
          }
        });
      case "OFFER_BREAK":
        return this.offerBreak();
      case "TAKE_BREAK":
        return this.requireState("break", () => {
          this.breakTaken = true;
          this.breakDurationMs = Math.max(0, action.durationMs);
        });
      case "SKIP_BREAK":
        return this.requireState("break", () => {
          this.breakTaken = false;
          this.breakDurationMs = 0;
          this.state = "main";
          this.phase = "main";
        });
      case "CONTINUE_AFTER_BREAK":
        return this.requireState("break", () => {
          this.state = "main";
          this.phase = "main";
        });
      case "PAUSE":
        return this.pause(action.resumePhase);
      case "RESUME":
        return this.resume();
      case "TECHNICAL_ERROR":
        return this.technicalError();
      case "ABORT":
        return this.abort();
      case "INTERRUPT":
        return this.interrupt();
      case "COMPLETE":
        return this.completeSession();
      case "SCHEDULE_ERROR":
        return this.requireState("idle", () => {
          this.state = "technical_error";
          this.phase = "idle";
          this.status = "technical_error";
        });
    }
  }

  getSnapshot(): LifecycleSnapshot<TStimulus, TCondition, TResponse> {
    return {
      sessionId: this.sessionId,
      state: this.state,
      phase: this.phase,
      practiceIndex: this.practiceIndex,
      mainIndex: this.mainIndex,
      activeTrial: this.activeTrial ? { ...this.activeTrial } : null,
      records: this.records.map((record) => ({ ...record })),
      breakTaken: this.breakTaken,
      breakDurationMs: this.breakDurationMs,
      status: this.status,
    };
  }

  toSessionRecord(): SessionRecord<TStimulus, TCondition, TResponse> {
    return {
      identity: {
        experimentId: this.configuration.experimentId,
        protocolId: this.configuration.protocolId,
        protocolVersion: this.configuration.protocolVersion,
        configurationId: this.configuration.configurationId,
        configurationVersion: this.configuration.configurationVersion,
      },
      sessionId: this.sessionId,
      status: this.status,
      lifecycleState:
        this.state === "completed"
          ? "completed"
          : this.state === "technical_error"
            ? "technical_error"
            : "aborted",
      practiceTrialCount: this.practiceIndex,
      mainTrialCount: this.mainIndex,
      breakTaken: this.breakTaken,
      breakDurationMs: this.breakDurationMs,
      randomization: this.randomization,
      trialRecords: this.records.map((record) => ({ ...record })),
    };
  }

  private requireState(
    expected: SessionLifecycleState,
    operation: () => void,
  ): LifecycleResult {
    if (this.state !== expected) {
      return this.error("invalid_transition");
    }
    operation();
    return { ok: true };
  }

  private error(reason: LifecycleErrorReason): LifecycleResult {
    return { ok: false, reason, state: this.state };
  }

  private get practiceTrials() {
    return this.schedule.practice;
  }

  private get mainTrials() {
    return this.schedule.main;
  }

  private activateTrial(): LifecycleResult {
    if (this.state !== "practice" && this.state !== "main") {
      return this.error("invalid_trial_action");
    }
    if (this.activeTrial) {
      return this.error("invalid_trial_action");
    }

    const trials =
      this.state === "practice" ? this.practiceTrials : this.mainTrials;
    const index =
      this.state === "practice" ? this.practiceIndex : this.mainIndex;
    const trial = trials[index];
    if (!trial) {
      return this.error("invalid_trial_index");
    }
    this.activeTrial = {
      trialIndex: trial.index,
      trialId: trial.trialId,
      trialLifecycle: "active",
    };
    return { ok: true };
  }

  private completeTrial(
    action: Extract<LifecycleAction<TResponse>, { type: "COMPLETE_TRIAL" }>,
  ): LifecycleResult {
    if (!this.activeTrial) {
      return this.error("invalid_trial_action");
    }
    if (this.state !== "practice" && this.state !== "main") {
      return this.error("invalid_trial_action");
    }

    const trials =
      this.state === "practice" ? this.practiceTrials : this.mainTrials;
    const index =
      this.state === "practice" ? this.practiceIndex : this.mainIndex;
    const trial = trials[index];
    if (!trial || trial.index !== this.activeTrial.trialIndex) {
      return this.error("invalid_trial_index");
    }

    const timing: TimingMetadata = {
      fixationOnsetMs: null,
      stimulusOnsetMs: null,
      responseTimestampMs: action.response?.timestampMs ?? null,
      deadlineMs: null,
      trialEndMs: null,
      itiEndMs: null,
      reactionTimeMs: null,
      trialDurationMs: null,
      timingSource: null,
      ...action.timing,
    };
    const record: TrialRecord<TStimulus, TCondition, TResponse> = {
      experiment: {
        experimentId: this.configuration.experimentId,
        protocolId: this.configuration.protocolId,
        protocolVersion: this.configuration.protocolVersion,
        configurationId: this.configuration.configurationId,
        configurationVersion: this.configuration.configurationVersion,
      },
      sessionId: this.sessionId,
      trialId: trial.trialId,
      phase: trial.phase,
      trialIndex: trial.index,
      condition: trial.condition,
      stimulus: trial.stimulus,
      correctResponse: trial.correctResponse,
      response: action.response ?? null,
      lifecycleState: "completed",
      outcome: action.outcome,
      timing,
      randomization: this.randomization,
    };

    this.records = [...this.records, record];
    this.activeTrial = {
      trialIndex: trial.index,
      trialId: trial.trialId,
      trialLifecycle: "responded",
    };
    return { ok: true };
  }

  private advanceTrial(): LifecycleResult {
    if (!this.activeTrial || this.activeTrial.trialLifecycle !== "responded") {
      return this.error("invalid_trial_action");
    }
    const phase = this.state === "practice" ? "practice" : "main";
    this.activeTrial = null;
    if (phase === "practice") {
      this.practiceIndex += 1;
      if (this.practiceIndex === this.practiceTrials.length) {
        this.state = "ready";
        this.phase = "ready";
      }
    } else {
      this.mainIndex += 1;
    }
    return { ok: true };
  }

  private offerBreak(): LifecycleResult {
    if (this.state !== "main") {
      return this.error("invalid_transition");
    }
    const boundary = this.configuration.main.breakAfterTrialIndex;
    if (boundary === undefined) {
      return this.error("break_not_configured");
    }
    if (this.activeTrial || this.mainIndex !== boundary) {
      return this.error("break_not_at_boundary");
    }
    this.state = "break";
    this.phase = "break";
    return { ok: true };
  }

  private pause(resumePhase?: PracticeOrMain): LifecycleResult {
    if (
      this.state !== "practice" &&
      this.state !== "main" &&
      this.state !== "break"
    ) {
      return this.error("invalid_transition");
    }
    this.resumePhase =
      resumePhase ??
      (this.state === "break"
        ? "break"
        : this.state === "practice"
          ? "practice"
          : "main");
    this.resumeActiveTrial = this.activeTrial ? { ...this.activeTrial } : null;
    this.state = "paused";
    this.phase = "idle";
    return { ok: true };
  }

  private resume(): LifecycleResult {
    if (this.state !== "paused" || !this.resumePhase) {
      return this.error("invalid_transition");
    }
    this.state = this.resumePhase;
    this.phase = this.resumePhase;
    this.activeTrial = this.resumeActiveTrial
      ? { ...this.resumeActiveTrial }
      : null;
    this.resumePhase = null;
    this.resumeActiveTrial = null;
    return { ok: true };
  }

  private abort(): LifecycleResult {
    if (
      this.state === "completed" ||
      this.state === "aborted" ||
      this.state === "technical_error"
    ) {
      return this.error("invalid_transition");
    }
    this.state = "aborted";
    this.phase = "idle";
    this.status = "incomplete";
    this.activeTrial = null;
    return { ok: true };
  }

  private interrupt(): LifecycleResult {
    if (
      this.state === "completed" ||
      this.state === "aborted" ||
      this.state === "technical_error"
    ) {
      return this.error("invalid_transition");
    }
    this.state = "aborted";
    this.phase = "idle";
    this.status = "interrupted";
    this.activeTrial = null;
    return { ok: true };
  }

  private technicalError(): LifecycleResult {
    if (this.state === "completed" || this.state === "technical_error") {
      return this.error("invalid_transition");
    }
    this.state = "technical_error";
    this.phase = "idle";
    this.status = "technical_error";
    this.activeTrial = null;
    return { ok: true };
  }

  private completeSession(): LifecycleResult {
    if (this.state !== "main" && this.state !== "ready") {
      return this.error("invalid_transition");
    }
    if (this.activeTrial) {
      return this.error("premature_completion");
    }
    const practiceComplete =
      this.practiceTrials.length === 0 ||
      this.practiceIndex === this.practiceTrials.length;
    const mainComplete =
      this.mainTrials.length > 0 && this.mainIndex === this.mainTrials.length;
    if (!practiceComplete || !mainComplete) {
      return this.error("premature_completion");
    }
    this.state = "completed";
    this.phase = "idle";
    this.status = "complete";
    return { ok: true };
  }
}
