import { describe, expect, it } from "vitest";
import type {
  EngineTrial,
  ExperimentConfiguration,
  RandomizationMetadata,
} from "./contracts";
import type { Schedule } from "./interfaces";
import { ExperimentLifecycle } from "./lifecycle";

type Trial = EngineTrial<string, "neutral", string>;

const trial = (phase: "practice" | "main", index: number): Trial => ({
  trialId: `${phase}-${index}`,
  index,
  phase,
  condition: "neutral",
  stimulus: `${phase}-${index}`,
  correctResponse: "a",
});

const configuration: ExperimentConfiguration<string, "neutral", string> = {
  experimentId: "test",
  protocolId: "TEST-1",
  protocolVersion: "1",
  configurationId: "TEST-1",
  configurationVersion: "1",
  practice: {
    trialCount: 1,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: true,
  },
  main: {
    trialCount: 2,
    responseDeadlineMs: 2000,
    fixationMs: 500,
    interTrialIntervalMs: 500,
    feedbackEnabled: false,
  },
  stimulusDefinition: "",
  conditions: ["neutral"],
  responseMapping: [{ responseValue: "a", logicalKey: "a", label: "A" }],
  minimumCorrectResponsesForMedian: 10,
  neutralCondition: "neutral",
};

const randomization: RandomizationMetadata = {
  seedUnsigned32: 1,
  prngAndScheduleId: "test",
  randomizationConfigurationVersion: "1",
  scheduleGenerationStatus: "generated",
  realizedPracticeOrder: [],
  realizedMainOrder: [],
  allocationDetails: { selectedDerangement: [1, 0, 3, 2] },
};

function lifecycleInMain() {
  const schedule: Schedule<Trial> = {
    practice: [trial("practice", 1)],
    main: [trial("main", 1), trial("main", 2)],
    metadata: {
      seedUnsigned32: 1,
      prngAndScheduleId: "test",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
    },
  };
  const lifecycle = new ExperimentLifecycle(
    "s",
    configuration,
    schedule,
    randomization,
  );
  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
  lifecycle.dispatch({
    type: "COMPLETE_TRIAL",
    outcome: { category: "timeout" },
  });
  lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
  return lifecycle;
}

function settleMainTrial(
  lifecycle: ExperimentLifecycle<string, "neutral", string>,
  onsetMs: number,
) {
  lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
  lifecycle.dispatch({
    type: "COMPLETE_TRIAL",
    outcome: { category: "correct" },
    response: {
      value: "a",
      inputSource: "keyboard",
      timestampMs: onsetMs + 400,
      accepted: true,
    },
    timing: {
      stimulusOnsetMs: onsetMs,
      responseTimestampMs: onsetMs + 400,
      trialEndMs: onsetMs + 400,
    },
  });
  lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
}

const latestTiming = (
  lifecycle: ExperimentLifecycle<string, "neutral", string>,
) => {
  const records = lifecycle.getSnapshot().records;
  return records[records.length - 1].timing;
};

describe("RECORD_TRIAL_TIMING (stimulus offset and ITI end)", () => {
  it("starts both timestamps as null and fills each once on the latest record", () => {
    const lifecycle = lifecycleInMain();
    settleMainTrial(lifecycle, 1000);
    expect(latestTiming(lifecycle)).toMatchObject({
      stimulusOffsetMs: null,
      itiEndMs: null,
    });

    expect(
      lifecycle.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "main-1",
        stimulusOffsetMs: 1416,
      }),
    ).toEqual({ ok: true });
    expect(
      lifecycle.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "main-1",
        itiEndMs: 1917,
      }),
    ).toEqual({ ok: true });
    expect(latestTiming(lifecycle)).toMatchObject({
      stimulusOnsetMs: 1000,
      responseTimestampMs: 1400,
      trialEndMs: 1400,
      stimulusOffsetMs: 1416,
      itiEndMs: 1917,
    });
  });

  it("never overwrites an existing timestamp", () => {
    const lifecycle = lifecycleInMain();
    settleMainTrial(lifecycle, 1000);
    lifecycle.dispatch({
      type: "RECORD_TRIAL_TIMING",
      trialId: "main-1",
      stimulusOffsetMs: 1416,
    });
    lifecycle.dispatch({
      type: "RECORD_TRIAL_TIMING",
      trialId: "main-1",
      itiEndMs: 1917,
    });
    for (const action of [{ stimulusOffsetMs: 1500 }, { itiEndMs: 2500 }]) {
      expect(
        lifecycle.dispatch({
          type: "RECORD_TRIAL_TIMING",
          trialId: "main-1",
          ...action,
        }),
      ).toMatchObject({ ok: false, reason: "invalid_timing_record" });
    }
    expect(latestTiming(lifecycle)).toMatchObject({
      stimulusOffsetMs: 1416,
      itiEndMs: 1917,
    });
  });

  it("rejects out-of-order, non-finite, unknown, and older-record timestamps", () => {
    const lifecycle = lifecycleInMain();
    settleMainTrial(lifecycle, 1000);
    const reject = (action: {
      trialId: string;
      stimulusOffsetMs?: number;
      itiEndMs?: number;
    }) =>
      expect(
        lifecycle.dispatch({ type: "RECORD_TRIAL_TIMING", ...action }),
      ).toMatchObject({
        ok: false,
        reason: "invalid_timing_record",
      });

    reject({ trialId: "main-1", itiEndMs: 1900 }); // ITI end before any offset
    reject({ trialId: "main-1", stimulusOffsetMs: 999 }); // before onset
    reject({ trialId: "main-1", stimulusOffsetMs: Number.NaN });
    reject({ trialId: "main-1", stimulusOffsetMs: -1 });
    reject({ trialId: "main-2", stimulusOffsetMs: 1416 }); // not yet recorded
    lifecycle.dispatch({
      type: "RECORD_TRIAL_TIMING",
      trialId: "main-1",
      stimulusOffsetMs: 1416,
    });
    reject({ trialId: "main-1", itiEndMs: 1415 }); // before offset

    settleMainTrial(lifecycle, 3000);
    reject({ trialId: "main-1", itiEndMs: 3500 }); // no longer the latest record
    expect(lifecycle.getSnapshot().records[1].timing).toMatchObject({
      stimulusOffsetMs: 1416,
      itiEndMs: null,
    });
  });

  it("is rejected once the session is paused, aborted, or completed", () => {
    const paused = lifecycleInMain();
    settleMainTrial(paused, 1000);
    paused.dispatch({ type: "PAUSE" });
    expect(
      paused.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "main-1",
        stimulusOffsetMs: 1416,
      }),
    ).toMatchObject({ ok: false, reason: "invalid_transition" });

    const aborted = lifecycleInMain();
    settleMainTrial(aborted, 1000);
    aborted.dispatch({ type: "ABORT" });
    expect(
      aborted.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "main-1",
        stimulusOffsetMs: 1416,
      }),
    ).toMatchObject({ ok: false });
    expect(
      aborted.toSessionRecord().trialRecords[1].timing.stimulusOffsetMs,
    ).toBeNull();

    const completed = lifecycleInMain();
    settleMainTrial(completed, 1000);
    settleMainTrial(completed, 3000);
    completed.dispatch({ type: "COMPLETE" });
    expect(
      completed.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "main-2",
        stimulusOffsetMs: 3416,
      }),
    ).toMatchObject({ ok: false });
  });

  it("allows the final practice trial to be completed after the phase becomes ready", () => {
    const schedule: Schedule<Trial> = {
      practice: [trial("practice", 1)],
      main: [trial("main", 1), trial("main", 2)],
      metadata: {
        seedUnsigned32: 1,
        prngAndScheduleId: "test",
        randomizationConfigurationVersion: "1",
        scheduleGenerationStatus: "generated",
      },
    };
    const lifecycle = new ExperimentLifecycle(
      "s",
      configuration,
      schedule,
      randomization,
    );
    lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
    lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
    lifecycle.dispatch({ type: "ACTIVATE_TRIAL" });
    lifecycle.dispatch({
      type: "COMPLETE_TRIAL",
      outcome: { category: "timeout" },
      timing: { stimulusOnsetMs: 100, deadlineMs: 2100 },
    });
    lifecycle.dispatch({ type: "ADVANCE_TRIAL" });
    expect(lifecycle.getSnapshot().state).toBe("ready");
    expect(
      lifecycle.dispatch({
        type: "RECORD_TRIAL_TIMING",
        trialId: "practice-1",
        stimulusOffsetMs: 2110,
      }),
    ).toEqual({ ok: true });
  });

  it("returns snapshot records whose timing cannot mutate the engine's records", () => {
    const lifecycle = lifecycleInMain();
    settleMainTrial(lifecycle, 1000);
    const copy = lifecycle.getSnapshot().records[1];
    (copy.timing as { reactionTimeMs: number | null }).reactionTimeMs = 1;
    (copy.timing as { stimulusOffsetMs: number | null }).stimulusOffsetMs = 5;
    expect(
      lifecycle.getSnapshot().records[1].timing.stimulusOffsetMs,
    ).toBeNull();
    expect(
      lifecycle.toSessionRecord().trialRecords[1].timing.stimulusOffsetMs,
    ).toBeNull();
  });

  it("carries allocation details in session randomization metadata", () => {
    const lifecycle = lifecycleInMain();
    expect(lifecycle.toSessionRecord().randomization.allocationDetails).toEqual(
      {
        selectedDerangement: [1, 0, 3, 2],
      },
    );
  });
});
