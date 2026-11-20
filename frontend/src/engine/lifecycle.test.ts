import { describe, expect, it } from "vitest";
import type {
  EngineTrial,
  ExperimentConfiguration,
  RandomizationMetadata,
} from "./contracts";
import type { Schedule } from "./interfaces";
import { ExperimentLifecycle } from "./lifecycle";

const randomization: RandomizationMetadata = {
  seedUnsigned32: 123,
  prngAndScheduleId: "test-schedule-v1",
  randomizationConfigurationVersion: "1",
  scheduleGenerationStatus: "generated",
  realizedPracticeOrder: [],
  realizedMainOrder: [],
};

function makeTrial(
  index: number,
  phase: "practice" | "main",
  trialId = `${phase}-${index}`,
): EngineTrial<string, "neutral", string> {
  return {
    trialId,
    index,
    phase,
    condition: "neutral",
    stimulus: "stimulus",
    correctResponse: "A",
  };
}

function makeLifecycle(options?: {
  practiceCount?: number;
  mainCount?: number;
  breakAt?: number;
  schedulePracticeCount?: number;
  scheduleMainCount?: number;
}) {
  const practiceCount = options?.practiceCount ?? 2;
  const mainCount = options?.mainCount ?? 3;
  const schedulePracticeCount = options?.schedulePracticeCount ?? practiceCount;
  const scheduleMainCount = options?.scheduleMainCount ?? mainCount;
  const practice = Array.from({ length: schedulePracticeCount }, (_, index) =>
    makeTrial(index + 1, "practice"),
  );
  const main = Array.from({ length: scheduleMainCount }, (_, index) =>
    makeTrial(index + 1, "main"),
  );
  const schedule: Schedule<EngineTrial<string, "neutral", string>> = {
    practice,
    main,
    metadata: {
      seedUnsigned32: 123,
      prngAndScheduleId: "test-schedule-v1",
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
      trialCount: practiceCount,
      responseDeadlineMs: 2000,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: true,
    },
    main: {
      trialCount: mainCount,
      responseDeadlineMs: 2000,
      fixationMs: 500,
      interTrialIntervalMs: 500,
      feedbackEnabled: false,
      breakAfterTrialIndex: options?.breakAt,
    },
    stimulusDefinition: "generic",
    conditions: ["neutral"],
    responseMapping: [{ responseValue: "A", logicalKey: "a", label: "A" }],
    minimumCorrectResponsesForMedian: 10,
    neutralCondition: "neutral",
  };
  return new ExperimentLifecycle(
    "session-1",
    configuration,
    schedule,
    randomization,
  );
}

function prepareMain(
  lifecycle: ExperimentLifecycle<string, "neutral", string>,
) {
  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  for (
    let index = 0;
    index < lifecycle.getSnapshot().practiceIndex + 2;
    index++
  ) {
    if (lifecycle.getSnapshot().state === "ready") break;
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
  }
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
}

describe("ExperimentLifecycle", () => {
  it("initializes and follows practice-to-main progression", () => {
    const lifecycle = makeLifecycle();
    expect(lifecycle.getSnapshot().state).toBe("idle");
    expect(lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" })).toEqual({
      ok: true,
    });
    expect(lifecycle.dispatch({ type: "BEGIN_PRACTICE" })).toEqual({
      ok: true,
    });

    for (let index = 0; index < 2; index++) {
      expect(lifecycle.dispatch({ type: "ACTIVATE_TRIAL" })).toEqual({
        ok: true,
      });
      expect(
        lifecycle.dispatch({
          type: "COMPLETE_TRIAL",
          outcome: { category: "correct" },
        }),
      ).toEqual({ ok: true });
      expect(lifecycle.dispatch({ type: "ADVANCE_TRIAL" })).toEqual({
        ok: true,
      });
    }

    expect(lifecycle.getSnapshot().phase).toBe("ready");
    expect(lifecycle.dispatch({ type: "BEGIN_MAIN" })).toEqual({ ok: true });
    expect(lifecycle.getSnapshot().state).toBe("main");
  });

  it("supports empty practice and starts main immediately", () => {
    const lifecycle = makeLifecycle({ practiceCount: 0, mainCount: 1 });
    lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
    expect(lifecycle.dispatch({ type: "BEGIN_PRACTICE" })).toEqual({
      ok: true,
    });
    expect(lifecycle.getSnapshot().phase).toBe("ready");
  });

  it("rejects invalid session transitions", () => {
    const lifecycle = makeLifecycle();
    expect(lifecycle.dispatch({ type: "BEGIN_PRACTICE" }).ok).toBe(false);
    lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
    expect(lifecycle.dispatch({ type: "BEGIN_MAIN" }).ok).toBe(false);
  });

  it("records trial ordering and practice/main distinction", () => {
    const lifecycle = makeLifecycle();
    prepareMain(lifecycle);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "incorrect" },
      response: {
        value: "B",
        inputSource: "keyboard",
        timestampMs: 100,
        accepted: true,
      },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });

    const records = lifecycle.toSessionRecord().trialRecords;
    expect(records).toHaveLength(3);
    expect(records[0].phase).toBe("practice");
    expect(records[2].phase).toBe("main");
    expect(records[2].outcome).toEqual({ category: "incorrect" });
  });

  it("preserves timeout and invalid outcomes", () => {
    const lifecycle = makeLifecycle();
    prepareMain(lifecycle);
    for (const outcome of [
      { category: "timeout" } as const,
      {
        category: "invalid",
        reason: "focus_lost",
      } as const,
    ]) {
      lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
      lifecycle.dispatch({ type: "COMPLETE_TRIAL", outcome });
      lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    }
    expect(
      lifecycle.toSessionRecord().trialRecords.map((record) => record.outcome),
    ).toContainEqual({ category: "timeout" });
    expect(
      lifecycle.toSessionRecord().trialRecords.map((record) => record.outcome),
    ).toContainEqual({ category: "invalid", reason: "focus_lost" });
  });

  it("supports a configured break without skipping trials", () => {
    const lifecycle = makeLifecycle({ mainCount: 3, breakAt: 1 });
    prepareMain(lifecycle);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    expect(lifecycle.dispatch({ type: "OFFER_BREAK" })).toEqual({ ok: true });
    expect(lifecycle.dispatch({ type: "TAKE_BREAK", durationMs: 800 })).toEqual(
      {
        ok: true,
      },
    );
    expect(lifecycle.dispatch({ type: "CONTINUE_AFTER_BREAK" })).toEqual({
      ok: true,
    });
    expect(lifecycle.getSnapshot().mainIndex).toBe(1);
  });

  it("rejects breaks that are absent or not at a boundary", () => {
    const lifecycle = makeLifecycle();
    prepareMain(lifecycle);
    expect(lifecycle.dispatch({ type: "OFFER_BREAK" }).ok).toBe(false);

    const bounded = makeLifecycle({ mainCount: 3, breakAt: 2 });
    prepareMain(bounded);
    expect(bounded.dispatch({ type: "OFFER_BREAK" }).ok).toBe(false);
  });

  it("supports skip break and resume from the next trial", () => {
    const lifecycle = makeLifecycle({ mainCount: 3, breakAt: 1 });
    prepareMain(lifecycle);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "correct" },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    lifecycle.dispatch({ type: "OFFER_BREAK" });
    lifecycle.dispatch({ type: "SKIP_BREAK" });
    expect(lifecycle.getSnapshot().state).toBe("main");
  });

  it("pauses and resumes the active practice or main trial", () => {
    const practice = makeLifecycle();
    practice.dispatch({ type: "OPEN_INSTRUCTIONS" });
    practice.dispatch({ type: "BEGIN_PRACTICE" });
    practice.dispatch({ type: "ACTIVATE_TRIAL" });
    expect(practice.dispatch({ type: "PAUSE" })).toEqual({ ok: true });
    expect(practice.dispatch({ type: "ACTIVATE_TRIAL" }).ok).toBe(false);
    expect(practice.dispatch({ type: "RESUME" })).toEqual({ ok: true });
    expect(practice.getSnapshot().activeTrial?.trialIndex).toBe(1);

    const main = makeLifecycle();
    prepareMain(main);
    main.dispatch({ type: "ACTIVATE_TRIAL" });
    main.dispatch({ type: "PAUSE" });
    expect(main.dispatch({ type: "ADVANCE_TRIAL" }).ok).toBe(false);
    expect(main.dispatch({ type: "RESUME" })).toEqual({ ok: true });
  });

  it("records explicit abort and interruption without fabricating outcomes", () => {
    const lifecycle = makeLifecycle();
    lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
    lifecycle.dispatch({ type: "ABORT" });
    expect(lifecycle.toSessionRecord().status).toBe("incomplete");
    expect(lifecycle.toSessionRecord().trialRecords).toHaveLength(0);

    const interrupted = makeLifecycle();
    interrupted.dispatch({ type: "OPEN_INSTRUCTIONS" });
    interrupted.dispatch({ type: "INTERRUPT" });
    expect(interrupted.toSessionRecord().status).toBe("interrupted");
  });

  it("rejects premature completion and completes only after all main trials", () => {
    const lifecycle = makeLifecycle();
    expect(lifecycle.dispatch({ type: "COMPLETE" }).ok).toBe(false);
    prepareMain(lifecycle);
    expect(lifecycle.dispatch({ type: "COMPLETE" }).ok).toBe(false);

    for (let index = 0; index < 3; index++) {
      lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
      lifecycle.dispatch({
        type: "COMPLETE_TRIAL",
        outcome: { category: "correct" },
      });
      lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    }
    expect(lifecycle.dispatch({ type: "COMPLETE" })).toEqual({ ok: true });
    expect(lifecycle.toSessionRecord().status).toBe("complete");
  });

  it("rejects duplicate activation and premature advancement", () => {
    const lifecycle = makeLifecycle();
    prepareMain(lifecycle);
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    expect(lifecycle.dispatch({ type: "ACTIVATE_TRIAL" }).ok).toBe(false);
    expect(lifecycle.dispatch({ type: "ADVANCE_TRIAL" }).ok).toBe(false);
  });

  it("rejects mismatched schedule and configuration trial counts", () => {
    const lifecycle = makeLifecycle({
      practiceCount: 2,
      schedulePracticeCount: 1,
    });
    lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
    expect(lifecycle.dispatch({ type: "BEGIN_PRACTICE" }).ok).toBe(false);
  });

  it("marks schedule setup failure as technical error", () => {
    const lifecycle = makeLifecycle();
    expect(lifecycle.dispatch({ type: "SCHEDULE_ERROR" })).toEqual({
      ok: true,
    });
    expect(lifecycle.toSessionRecord().status).toBe("technical_error");
  });
});
