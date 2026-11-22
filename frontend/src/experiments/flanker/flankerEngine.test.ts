import { describe, expect, it } from "vitest";
import type {
  InterruptionEventSource,
  InterruptionReason,
} from "../../engine/interruption";
import type {
  KeyboardEventLike,
  KeyboardInputSource,
} from "../../engine/input";
import { ExperimentLifecycle } from "../../engine/lifecycle";
import { FakeDeadlineScheduler, FakeMonotonicClock } from "../../engine/timing";
import { TrialRuntime } from "../../engine/trialRuntime";
import {
  FLANKER_CONFIGURATION,
  FLANKER_RESPONSE_MAPPING,
  type FlankerCondition,
  type FlankerResponse,
  type FlankerStimulus,
  type FlankerTrial,
} from "./flanker";
import { flankerAdapter, flankerRandomizationMetadata } from "./flankerAdapter";
import { createFlankerSchedule } from "./flankerSchedule";

class TestKeyboard implements KeyboardInputSource {
  private listener: ((event: KeyboardEventLike) => void) | null = null;
  subscribe(listener: (event: KeyboardEventLike) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(key: string, repeat = false): void {
    this.listener?.({ key, repeat });
  }
}

class TestInterruptions implements InterruptionEventSource {
  private listener: ((reason: InterruptionReason) => void) | null = null;
  subscribe(listener: (reason: InterruptionReason) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(reason: InterruptionReason): void {
    this.listener?.(reason);
  }
}

type Plan =
  | { kind: "correct"; rt: number }
  | { kind: "flanker-key"; rt: number }
  | { kind: "timeout" }
  | { kind: "interrupt" };

function planFor(index: number): Plan {
  if (index === 9) return { kind: "interrupt" };
  if (index % 10 === 7) return { kind: "timeout" };
  if (index % 8 === 5) return { kind: "flanker-key", rt: 700 };
  return { kind: "correct", rt: 450 + index };
}

function runSession(stopAfterMain?: number) {
  const schedule = createFlankerSchedule(1234);
  const lifecycle = new ExperimentLifecycle<
    FlankerStimulus,
    FlankerCondition,
    FlankerResponse
  >(
    "flanker-integration",
    flankerAdapter.configuration,
    schedule,
    flankerRandomizationMetadata(schedule),
  );
  const clock = new FakeMonotonicClock(0);
  const scheduler = new FakeDeadlineScheduler(0);
  let now = 1000;

  const runTrial = (trial: FlankerTrial, plan: Plan) => {
    const keyboard = new TestKeyboard();
    const interruptions = new TestInterruptions();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      scheduler,
      keyboard,
      FLANKER_RESPONSE_MAPPING,
      interruptions,
    );
    clock.set(now);
    scheduler.setNow(now);
    expect(runtime.start(trial, 2000, now, now - 500)).toEqual({ ok: true });
    keyboard.emit("x"); // unmapped: ignored
    if (plan.kind === "correct" || plan.kind === "flanker-key") {
      clock.set(now + plan.rt);
      const flankerKey = trial.stimulus.flankerType === "left" ? "f" : "j";
      // An incongruent trial's flanker key is the wrong answer; for other
      // conditions use the opposite of the correct key.
      const wrong = trial.correctResponse === "f" ? "j" : "f";
      keyboard.emit(
        plan.kind === "correct"
          ? trial.correctResponse.toUpperCase()
          : trial.condition === "incongruent"
            ? flankerKey
            : wrong,
      );
      keyboard.emit(trial.correctResponse); // second key ignored
    } else if (plan.kind === "timeout") {
      scheduler.advanceTo(now + 2000);
      keyboard.emit(trial.correctResponse); // late key ignored
    } else {
      clock.set(now + 300);
      interruptions.emit("visibility_hidden");
      expect(lifecycle.dispatch({ type: "RESUME" })).toEqual({ ok: true });
    }
    if (plan.kind !== "interrupt") {
      const end = plan.kind === "timeout" ? now + 2000 : now + plan.rt;
      expect(
        lifecycle.dispatch({
          type: "RECORD_TRIAL_TIMING",
          trialId: trial.trialId,
          stimulusOffsetMs: end + 16,
        }),
      ).toEqual({ ok: true });
      expect(
        lifecycle.dispatch({
          type: "RECORD_TRIAL_TIMING",
          trialId: trial.trialId,
          itiEndMs: end + 516,
        }),
      ).toEqual({ ok: true });
    }
    now += 4000;
  };

  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  for (const trial of schedule.practice)
    runTrial(trial, { kind: "correct", rt: 500 });
  expect(lifecycle.getSnapshot().state).toBe("ready");
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
  for (const trial of schedule.main) {
    if (stopAfterMain !== undefined && trial.index > stopAfterMain) break;
    if (trial.index === 31) {
      expect(lifecycle.dispatch({ type: "OFFER_BREAK" })).toEqual({ ok: true });
      lifecycle.dispatch({ type: "TAKE_BREAK", durationMs: 15_000 });
      lifecycle.dispatch({ type: "CONTINUE_AFTER_BREAK" });
    }
    if (trial.index === 60) {
      // Completion is impossible before the last trial has ended.
      expect(lifecycle.dispatch({ type: "COMPLETE" }).ok).toBe(false);
    }
    runTrial(trial, planFor(trial.index));
  }
  if (stopAfterMain === undefined) {
    expect(lifecycle.dispatch({ type: "COMPLETE" })).toEqual({ ok: true });
  } else {
    lifecycle.dispatch({ type: "ABORT" });
  }
  return { schedule, record: lifecycle.toSessionRecord() };
}

describe("Flanker adapter through the shared engine", () => {
  it("produces complete, correctly classified records for every outcome", () => {
    const { schedule, record } = runSession();
    expect(record.status).toBe("complete");
    expect(record.identity.protocolId).toBe("HB-FLANKER-1.0");
    expect(record.practiceTrialCount).toBe(12);
    expect(record.mainTrialCount).toBe(60);
    expect(record.breakTaken).toBe(true);
    expect(record.breakDurationMs).toBe(15_000);

    const practice = record.trialRecords.filter(
      (trial) => trial.phase === "practice",
    );
    const main = record.trialRecords.filter((trial) => trial.phase === "main");
    expect(practice).toHaveLength(12);
    expect(main).toHaveLength(60);
    expect(main.map((trial) => trial.trialId)).toEqual(
      schedule.main.map((trial) => trial.trialId),
    );

    for (const trial of main) {
      const plan = planFor(trial.trialIndex);
      const scheduled = schedule.main[trial.trialIndex - 1];
      expect(trial.condition).toBe(scheduled.condition);
      expect(trial.stimulus.text).toBe(scheduled.stimulus.text);
      expect(trial.correctResponse).toBe(
        scheduled.stimulus.targetDirection === "left" ? "f" : "j",
      );
      expect(trial.randomization.prngAndScheduleId).toBe(
        "HB-FLANKER-shuffle-v1",
      );
      const timing = trial.timing;
      expect(timing.deadlineMs! - timing.stimulusOnsetMs!).toBe(2000);
      expect(timing.stimulusOnsetMs! - timing.fixationOnsetMs!).toBe(500);

      if (plan.kind === "correct") {
        expect(trial.outcome).toEqual({ category: "correct" });
        expect(timing.reactionTimeMs).toBe(plan.rt);
        expect(trial.response?.value).toBe(trial.correctResponse);
      } else if (plan.kind === "flanker-key") {
        expect(trial.outcome).toEqual({ category: "incorrect" });
        expect(timing.reactionTimeMs).toBe(plan.rt);
        expect(trial.response?.value).not.toBe(trial.correctResponse);
      } else if (plan.kind === "timeout") {
        expect(trial.outcome).toEqual({ category: "timeout" });
        expect(trial.response).toBeNull();
        expect(timing.reactionTimeMs).toBeNull();
        expect(timing.trialEndMs).toBe(timing.deadlineMs);
      } else {
        expect(trial.outcome).toEqual({
          category: "invalid",
          reason: "visibility_lost",
        });
        expect(trial.response).toBeNull();
        expect(timing.stimulusOffsetMs).toBeNull();
        expect(timing.itiEndMs).toBeNull();
      }
      if (plan.kind !== "interrupt") {
        expect(timing.itiEndMs! - timing.stimulusOffsetMs!).toBe(500);
      }
    }
  });

  it("keeps an aborted session incomplete with no records for unpresented trials", () => {
    const { record } = runSession(20);
    expect(record.status).toBe("incomplete");
    const main = record.trialRecords.filter((trial) => trial.phase === "main");
    expect(main).toHaveLength(20);
    expect(main.map((trial) => trial.trialIndex)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(record.mainTrialCount).toBe(20);
  });

  it("uses the configuration the engine expects", () => {
    expect(flankerAdapter.configuration).toBe(FLANKER_CONFIGURATION);
  });
});
