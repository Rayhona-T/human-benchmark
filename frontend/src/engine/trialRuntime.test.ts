import { describe, expect, it } from "vitest";
import type {
  EngineTrial,
  ExperimentConfiguration,
  RandomizationMetadata,
} from "./contracts";
import type {
  InterruptionEventSource,
  InterruptionReason,
} from "./interruption";
import type { KeyboardEventLike, KeyboardInputSource } from "./input";
import type { Schedule } from "./interfaces";
import { ExperimentLifecycle } from "./lifecycle";
import { TrialRuntime } from "./trialRuntime";
import { FakeDeadlineScheduler, FakeMonotonicClock } from "./timing";

class TestKeyboardSource implements KeyboardInputSource {
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

class TestInterruptionSource implements InterruptionEventSource {
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

const randomization: RandomizationMetadata = {
  seedUnsigned32: 42,
  prngAndScheduleId: "test-v1",
  randomizationConfigurationVersion: "1",
  scheduleGenerationStatus: "generated",
  realizedPracticeOrder: [],
  realizedMainOrder: [],
};

function makeContext(mainCount = 1) {
  const trial: EngineTrial<string, "neutral", string> = {
    trialId: "main-1",
    index: 1,
    phase: "main",
    condition: "neutral",
    stimulus: "stimulus",
    correctResponse: "A",
  };
  const schedule: Schedule<EngineTrial<string, "neutral", string>> = {
    practice: [],
    main: [trial],
    metadata: {
      seedUnsigned32: 42,
      prngAndScheduleId: "test-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
    },
  };
  const configuration: ExperimentConfiguration<string, "neutral", string> = {
    experimentId: "test",
    protocolId: "HB-TEST",
    protocolVersion: "1",
    configurationId: "HB-TEST-1",
    configurationVersion: "1",
    practice: {
      trialCount: 0,
      responseDeadlineMs: 1000,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: false,
    },
    main: {
      trialCount: mainCount,
      responseDeadlineMs: 100,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: false,
    },
    stimulusDefinition: "generic",
    conditions: ["neutral"],
    responseMapping: [{ responseValue: "A", logicalKey: "a", label: "A" }],
    minimumCorrectResponsesForMedian: 10,
    neutralCondition: "neutral",
  };
  const lifecycle = new ExperimentLifecycle(
    "session",
    configuration,
    schedule,
    randomization,
  );
  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
  return { lifecycle, trial };
}

describe("TrialRuntime", () => {
  it("records an accepted mapped response and derived reaction time", () => {
    const { lifecycle, trial } = makeContext();
    const clock = new FakeMonotonicClock(100);
    const scheduler = new FakeDeadlineScheduler(100);
    const keyboard = new TestKeyboardSource();
    const interruption = new TestInterruptionSource();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      scheduler,
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      interruption,
      "injected",
    );
    expect(runtime.start(trial, 100)).toEqual({ ok: true });
    clock.set(140);
    keyboard.emit("a");
    const record = lifecycle.toSessionRecord().trialRecords[0];
    expect(record.outcome).toEqual({ category: "correct" });
    expect(record.timing.reactionTimeMs).toBe(40);
    expect(record.timing.stimulusOnsetMs).toBe(100);
  });

  it("records incorrect responses distinctly", () => {
    const { lifecycle, trial } = makeContext();
    const clock = new FakeMonotonicClock(10);
    const keyboard = new TestKeyboardSource();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      new FakeDeadlineScheduler(10),
      keyboard,
      [{ responseValue: "B", logicalKey: "b", label: "B" }],
      new TestInterruptionSource(),
    );
    runtime.start(trial, 100);
    clock.set(30);
    keyboard.emit("b");
    expect(lifecycle.toSessionRecord().trialRecords[0].outcome).toEqual({
      category: "incorrect",
    });
  });

  it("converts a deadline timeout into a timeout outcome", () => {
    const { lifecycle, trial } = makeContext();
    const clock = new FakeMonotonicClock(0);
    const scheduler = new FakeDeadlineScheduler(0);
    const keyboard = new TestKeyboardSource();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      scheduler,
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      new TestInterruptionSource(),
    );
    runtime.start(trial, 100);
    scheduler.advanceTo(100);
    const record = lifecycle.toSessionRecord().trialRecords[0];
    expect(record.outcome).toEqual({ category: "timeout" });
    expect(record.timing.reactionTimeMs).toBeNull();
  });

  it("prevents a response at the deadline from becoming accepted", () => {
    const { lifecycle, trial } = makeContext();
    const clock = new FakeMonotonicClock(0);
    const keyboard = new TestKeyboardSource();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      new FakeDeadlineScheduler(0),
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      new TestInterruptionSource(),
    );
    runtime.start(trial, 100);
    clock.set(100);
    keyboard.emit("a");
    expect(lifecycle.toSessionRecord().trialRecords[0].outcome).toEqual({
      category: "timeout",
    });
  });

  it("records active visibility interruption as invalid and pauses", () => {
    const { lifecycle, trial } = makeContext();
    const clock = new FakeMonotonicClock(0);
    const interruption = new TestInterruptionSource();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      new FakeDeadlineScheduler(0),
      new TestKeyboardSource(),
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      interruption,
    );
    runtime.start(trial, 100);
    interruption.emit("visibility_hidden");
    const snapshot = lifecycle.getSnapshot();
    expect(snapshot.state).toBe("paused");
    expect(lifecycle.toSessionRecord().trialRecords[0].outcome).toEqual({
      category: "invalid",
      reason: "visibility_lost",
    });
  });

  it("cleans timers and listeners on cancel", () => {
    const { lifecycle, trial } = makeContext();
    const scheduler = new FakeDeadlineScheduler(0);
    const keyboard = new TestKeyboardSource();
    const runtime = new TrialRuntime(
      lifecycle,
      new FakeMonotonicClock(0),
      scheduler,
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      new TestInterruptionSource(),
    );
    runtime.start(trial, 100);
    runtime.cancel();
    expect(scheduler.pendingCount()).toBe(0);
  });
});
