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

class TestKeyboard implements KeyboardInputSource {
  private listener: ((event: KeyboardEventLike) => void) | null = null;
  subscribe(listener: (event: KeyboardEventLike) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(key: string): void {
    this.listener?.({ key, repeat: false });
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

const randomization: RandomizationMetadata = {
  seedUnsigned32: 7,
  prngAndScheduleId: "integration-v1",
  randomizationConfigurationVersion: "1",
  scheduleGenerationStatus: "generated",
  realizedPracticeOrder: [],
  realizedMainOrder: [],
};

function createIntegratedSession(mainCount = 3, breakAt?: number) {
  const practice: EngineTrial<string, "neutral", string>[] = [
    {
      trialId: "practice-1",
      index: 1,
      phase: "practice",
      condition: "neutral",
      stimulus: "practice",
      correctResponse: "A",
    },
  ];
  const main: EngineTrial<string, "neutral", string>[] = Array.from(
    { length: mainCount },
    (_, index) => ({
      trialId: `main-${index + 1}`,
      index: index + 1,
      phase: "main" as const,
      condition: "neutral" as const,
      stimulus: `main-${index + 1}`,
      correctResponse: "A",
    }),
  );
  const schedule: Schedule<EngineTrial<string, "neutral", string>> = {
    practice,
    main,
    metadata: {
      seedUnsigned32: 7,
      prngAndScheduleId: "integration-v1",
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
      trialCount: 1,
      responseDeadlineMs: 100,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: true,
    },
    main: {
      trialCount: mainCount,
      responseDeadlineMs: 100,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: false,
      breakAfterTrialIndex: breakAt,
    },
    stimulusDefinition: "generic",
    conditions: ["neutral"],
    responseMapping: [{ responseValue: "A", logicalKey: "a", label: "A" }],
    minimumCorrectResponsesForMedian: 10,
    neutralCondition: "neutral",
  };
  const lifecycle = new ExperimentLifecycle(
    "integration-session",
    configuration,
    schedule,
    randomization,
  );
  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  return { lifecycle, schedule };
}

function prepareMain(
  lifecycle: ExperimentLifecycle<string, "neutral", string>,
) {
  lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
  lifecycle.dispatch({
    type: "COMPLETE_TRIAL",
    outcome: { category: "correct" },
  });
  lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
}

describe("experiment engine integration", () => {
  it("completes practice, main trials, and session without mixing phases", () => {
    const { lifecycle, schedule } = createIntegratedSession();
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "BEGIN_MAIN" });

    for (let index = 0; index < schedule.main.length; index++) {
      lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
      lifecycle.dispatch({
        type: "COMPLETE_TRIAL",
        outcome: { category: "correct" },
      });
      lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    }
    expect(lifecycle.dispatch({ type: "COMPLETE" })).toEqual({ ok: true });
    const record = lifecycle.toSessionRecord();
    expect(record.status).toBe("complete");
    expect(record.practiceTrialCount).toBe(1);
    expect(record.mainTrialCount).toBe(3);
    expect(record.trialRecords.map((trial) => trial.phase)).toEqual([
      "practice",
      "main",
      "main",
      "main",
    ]);
  });

  it("records incorrect responses separately from timeout", () => {
    const { lifecycle, schedule } = createIntegratedSession(1);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "timeout" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "BEGIN_MAIN" });

    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "incorrect" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    const outcomes = lifecycle
      .toSessionRecord()
      .trialRecords.map((trial) => trial.outcome);
    expect(outcomes).toContainEqual({ category: "timeout" });
    expect(outcomes).toContainEqual({ category: "incorrect" });
    expect(schedule.main).toHaveLength(1);
  });

  it("settles timeout once and rejects late and duplicate responses", () => {
    const { lifecycle, schedule } = createIntegratedSession(1);
    prepareMain(lifecycle);

    const keyboard = new TestKeyboard();
    const interruptions = new TestInterruptions();
    const clock = new FakeMonotonicClock(0);
    const scheduler = new FakeDeadlineScheduler(0);
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      scheduler,
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      interruptions,
      "injected",
    );
    runtime.start(schedule.main[0], 100);
    scheduler.advanceTo(100);
    keyboard.emit("a");
    const records = lifecycle.toSessionRecord().trialRecords;
    expect(records.filter((trial) => trial.phase === "main")).toHaveLength(1);
    expect(records.at(-1)?.outcome).toEqual({ category: "timeout" });
    expect(records.at(-1)?.timing.reactionTimeMs).toBeNull();
  });

  it("pauses and resumes main trial context without skipping", () => {
    const { lifecycle, schedule } = createIntegratedSession(2);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "BEGIN_MAIN" });
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });

    lifecycle.dispatch({ type: "PAUSE", resumePhase: "main" });
    expect(lifecycle.dispatch({ type: "ACTIVATE_TRIAL" }).ok).toBe(false);
    lifecycle.dispatch({ type: "RESUME" });
    expect(lifecycle.getSnapshot().activeTrial?.trialId).toBe(
      schedule.main[0].trialId,
    );
  });

  it("invalidates an interrupted active trial and preserves its record", () => {
    const { lifecycle, schedule } = createIntegratedSession(2);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "BEGIN_MAIN" });

    const keyboard = new TestKeyboard();
    const interruptions = new TestInterruptions();
    const runtime = new TrialRuntime(
      lifecycle,
      new FakeMonotonicClock(0),
      new FakeDeadlineScheduler(0),
      keyboard,
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      interruptions,
    );
    runtime.start(schedule.main[0], 100);
    interruptions.emit("visibility_hidden");
    expect(lifecycle.getSnapshot().state).toBe("paused");
    expect(lifecycle.toSessionRecord().trialRecords.at(-1)?.outcome).toEqual({
      category: "invalid",
      reason: "visibility_lost",
    });
  });

  it("enters, pauses, and resumes a configured break without a trial record", () => {
    const { lifecycle } = createIntegratedSession(3, 1);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "BEGIN_MAIN" });
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "OFFER_BREAK" });
    lifecycle.dispatch({ type: "PAUSE" });
    expect(lifecycle.getSnapshot().state).toBe("paused");
    lifecycle.dispatch({ type: "RESUME" });
    expect(lifecycle.getSnapshot().state).toBe("break");
    expect(lifecycle.toSessionRecord().trialRecords).toHaveLength(2);
  });

  it("aborts without fabricating unpresented trials", () => {
    const { lifecycle } = createIntegratedSession(3);
    lifecycle.dispatch({ type: "ABORT" });
    const record = lifecycle.toSessionRecord();
    expect(record.status).toBe("incomplete");
    expect(record.trialRecords).toHaveLength(0);
  });

  it("records technical timing failure rather than a normal completion", () => {
    const { lifecycle, schedule } = createIntegratedSession(1);
    prepareMain(lifecycle);
    const runtime = new TrialRuntime(
      lifecycle,
      new FakeMonotonicClock(-1),
      new FakeDeadlineScheduler(0),
      new TestKeyboard(),
      [{ responseValue: "A", logicalKey: "a", label: "A" }],
      new TestInterruptions(),
    );
    expect(runtime.start(schedule.main[0], 100).ok).toBe(false);
    expect(lifecycle.toSessionRecord().status).toBe("technical_error");
  });
});
