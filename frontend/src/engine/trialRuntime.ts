import type {
  EngineTrial,
  ResponseMapping,
  TimingMetadata,
  TrialOutcome,
} from "./contracts";
import type { MonotonicClock } from "./interfaces";
import type { DeadlineScheduler } from "./timing";
import { calculateElapsedMs, calculateReactionTimeMs } from "./timing";
import {
  ResponseInputController,
  type InputResult,
  type KeyboardInputSource,
} from "./input";
import type {
  InterruptionReason,
  InterruptionEventSource,
} from "./interruption";
import { InterruptionController } from "./interruption";
import { ExperimentLifecycle } from "./lifecycle";
import {
  classifyResponseOutcome,
  invalidOutcome,
  timeoutOutcome,
} from "./validity";

export type TrialRuntimeError = "lifecycle_rejected" | "timing_unavailable";

export type TrialRuntimeStartResult =
  { ok: true } | { ok: false; reason: TrialRuntimeError };

export class TrialRuntime<
  TStimulus = unknown,
  TCondition extends string = string,
  TResponse = string,
> {
  private status: "inactive" | "active" | "settled" = "inactive";
  private trial: EngineTrial<TStimulus, TCondition, TResponse> | null = null;
  private stimulusOnsetMs: number | null = null;
  private fixationOnsetMs: number | null = null;
  private deadlineMs: number | null = null;
  private deadlineHandle: unknown = null;
  private input: ResponseInputController<TResponse>;
  private interruptionController: InterruptionController;
  private readonly timingSource: "performance.now" | "injected";
  private readonly lifecycle: ExperimentLifecycle<
    TStimulus,
    TCondition,
    TResponse
  >;
  private readonly clock: MonotonicClock;
  private readonly scheduler: DeadlineScheduler;
  private readonly onSettled:
    ((outcome: TrialOutcome, trialId: string) => void) | null;

  constructor(
    lifecycle: ExperimentLifecycle<TStimulus, TCondition, TResponse>,
    clock: MonotonicClock,
    scheduler: DeadlineScheduler,
    keyboardSource: KeyboardInputSource,
    mappings: readonly ResponseMapping<TResponse>[],
    interruptionSource: InterruptionEventSource,
    timingSource: "performance.now" | "injected" = "injected",
    onSettled: ((outcome: TrialOutcome, trialId: string) => void) | null = null,
  ) {
    this.lifecycle = lifecycle;
    this.clock = clock;
    this.scheduler = scheduler;
    this.input = new ResponseInputController(keyboardSource, mappings);
    this.interruptionController = new InterruptionController(
      interruptionSource,
    );
    this.timingSource = timingSource;
    this.onSettled = onSettled;
  }

  start(
    trial: EngineTrial<TStimulus, TCondition, TResponse>,
    deadlineMs: number,
    stimulusOnsetOverrideMs?: number,
    fixationOnsetMs?: number,
  ): TrialRuntimeStartResult {
    if (this.status !== "inactive") {
      return { ok: false, reason: "lifecycle_rejected" };
    }
    const snapshotBeforeActivation = this.lifecycle.getSnapshot();
    if (
      snapshotBeforeActivation.state !== "practice" &&
      snapshotBeforeActivation.state !== "main"
    ) {
      return { ok: false, reason: "lifecycle_rejected" };
    }
    const activated = this.lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    if (!activated.ok) {
      return { ok: false, reason: "lifecycle_rejected" };
    }
    const activatedTrial = this.lifecycle.getSnapshot().activeTrial;
    if (
      !activatedTrial ||
      activatedTrial.trialIndex !== trial.index ||
      activatedTrial.trialId !== trial.trialId
    ) {
      this.lifecycle.dispatch({ type: "ABORT" });
      return { ok: false, reason: "lifecycle_rejected" };
    }

    const onset =
      stimulusOnsetOverrideMs === undefined
        ? this.clock.now()
        : stimulusOnsetOverrideMs;
    if (
      !Number.isFinite(onset) ||
      onset < 0 ||
      !Number.isFinite(deadlineMs) ||
      deadlineMs < 0
    ) {
      this.input.interrupt();
      this.lifecycle.dispatch({
        type: "COMPLETE_TRIAL",
        outcome: invalidOutcome("timing_error"),
      });
      this.lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
      this.lifecycle.dispatch({ type: "TECHNICAL_ERROR" });
      this.status = "settled";
      return { ok: false, reason: "timing_unavailable" };
    }

    this.trial = trial;
    this.status = "active";
    this.stimulusOnsetMs = onset;
    this.fixationOnsetMs =
      fixationOnsetMs !== undefined &&
      Number.isFinite(fixationOnsetMs) &&
      fixationOnsetMs <= onset
        ? fixationOnsetMs
        : null;
    this.deadlineMs = onset + deadlineMs;
    this.input.activate(this.stimulusOnsetMs, this.deadlineMs);
    this.input.attach(
      () => this.clock.now(),
      (result) => this.handleInputResult(result),
    );
    this.deadlineHandle = this.scheduler.schedule(() => {
      this.handleTimeout();
    }, deadlineMs);
    this.interruptionController.start((reason) => {
      this.handleInterruption(reason);
    });
    return { ok: true };
  }

  cancel(): void {
    if (this.status === "inactive") return;
    if (this.deadlineHandle !== null) {
      this.scheduler.cancel(this.deadlineHandle);
      this.deadlineHandle = null;
    }
    this.input.detach();
    this.input.interrupt();
    this.interruptionController.stop();
    this.status = "settled";
  }

  private handleInputResult(result: InputResult<TResponse>): void {
    if (!result.accepted) {
      if (result.reason === "at_or_after_deadline") {
        this.handleTimeout();
      } else if (result.reason === "timing_unavailable") {
        this.handleInvalid("timing_error");
      }
      return;
    }
    if (this.status !== "active" || !this.trial) return;

    const timestamp = result.response.timestampMs;
    if (this.deadlineMs !== null && timestamp >= this.deadlineMs) {
      this.handleTimeout();
      return;
    }
    const reactionTime = calculateReactionTimeMs(
      this.stimulusOnsetMs,
      timestamp,
    );
    if (reactionTime === null) {
      this.handleInvalid("timing_error");
      return;
    }

    const outcome = classifyResponseOutcome(
      result.response,
      this.trial.correctResponse,
    );
    this.settle(outcome, result.response, reactionTime);
  }

  private handleTimeout(): void {
    if (this.status !== "active" || !this.trial) return;
    const endMs = this.deadlineMs;
    const duration = calculateElapsedMs(this.stimulusOnsetMs, endMs);
    this.settle(timeoutOutcome(), undefined, null, duration);
  }

  private handleInvalid(
    reason:
      | "focus_lost"
      | "visibility_lost"
      | "presentation_failed"
      | "input_failed"
      | "timing_error"
      | "deadline_unavailable"
      | "interrupt"
      | "protocol_error",
    notify = true,
  ): boolean {
    if (this.status !== "active" || !this.trial) return false;
    return this.settle(invalidOutcome(reason), undefined, null, null, notify);
  }

  private handleInterruption(reason: InterruptionReason): void {
    if (this.status === "settled" || this.status === "inactive") return;
    const invalidReason =
      reason === "visibility_hidden"
        ? "visibility_lost"
        : reason === "window_blur"
          ? "interrupt"
          : "focus_lost";
    if (this.status === "active" && this.trial) {
      const trialId = this.trial.trialId;
      // Record the invalid trial and pause before notifying observers, so an
      // observer never sees the interrupted session as still running.
      if (!this.handleInvalid(invalidReason, false)) return;
      const snapshot = this.lifecycle.getSnapshot();
      if (snapshot.state === "practice" || snapshot.state === "main") {
        this.lifecycle.dispatch({
          type: "PAUSE",
          resumePhase: snapshot.state,
        });
      }
      this.onSettled?.(invalidOutcome(invalidReason), trialId);
    }
  }

  private settle(
    outcome: TrialOutcome,
    response?: import("./contracts").EngineResponse<TResponse>,
    reactionTime: number | null = null,
    durationOverride: number | null = null,
    notify = true,
  ): boolean {
    if (this.status !== "active" || !this.trial) return false;
    this.status = "settled";

    const trialEnd =
      response?.timestampMs ??
      (durationOverride !== null ? this.deadlineMs : this.clock.now());
    const duration =
      durationOverride ?? calculateElapsedMs(this.stimulusOnsetMs, trialEnd);
    const timing: Partial<TimingMetadata> = {
      fixationOnsetMs: this.fixationOnsetMs,
      stimulusOnsetMs: this.stimulusOnsetMs,
      responseTimestampMs: response?.timestampMs ?? null,
      deadlineMs: this.deadlineMs,
      trialEndMs:
        outcome.category === "timeout"
          ? this.deadlineMs
          : (response?.timestampMs ?? this.clock.now()),
      itiEndMs: null,
      reactionTimeMs: reactionTime,
      trialDurationMs: duration,
      timingSource: this.timingSource,
    };

    this.lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome,
      response,
      timing,
    });
    this.lifecycle.dispatch({ type: "ADVANCE_TRIAL" });

    if (this.deadlineHandle !== null) {
      this.scheduler.cancel(this.deadlineHandle);
      this.deadlineHandle = null;
    }
    if (outcome.category === "timeout") {
      this.input.timeout();
    } else if (outcome.category === "invalid") {
      this.input.interrupt();
    } else {
      this.input.complete();
    }
    this.interruptionController.stop();
    if (notify) this.onSettled?.(outcome, this.trial.trialId);
    return true;
  }

  dispose(): void {
    this.cancel();
  }
}
