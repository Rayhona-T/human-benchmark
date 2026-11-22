import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlankerSchedule } from "./flankerSchedule";
import { useFlankerSession } from "./useFlankerSession";

const SEED = 1234;
let arrayFits = true;

function setup() {
  return renderHook(() => useFlankerSession(SEED, () => arrayFits));
}
type Hook = ReturnType<typeof setup>;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });
const press = (key: string, repeat = false) =>
  act(() => {
    fireEvent.keyDown(window, { key, repeat });
  });
const snapshot = (hook: Hook) => {
  const value = hook.result.current.getSnapshot();
  if (!value) throw new Error("no lifecycle");
  return value;
};
const presentStimulus = () => {
  advance(500);
  nextFrame();
};
const finishTrialByTimeout = () => {
  advance(2000);
  nextFrame();
  advance(500);
};

describe("useFlankerSession (shared session flow with the Flanker definition)", () => {
  beforeEach(() => {
    arrayFits = true;
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs the seeded HB-FLANKER-1.0 schedule with protocol timing and records", () => {
    const expected = createFlankerSchedule(SEED);
    const hook = setup();
    act(() => hook.result.current.beginSession());
    act(() => hook.result.current.beginPractice());
    for (let index = 0; index < 12; index++) {
      presentStimulus();
      finishTrialByTimeout();
    }
    expect(hook.result.current.screen).toBe("ready");
    act(() => hook.result.current.beginMain());
    for (let index = 0; index < 30; index++) {
      presentStimulus();
      finishTrialByTimeout();
    }
    expect(hook.result.current.screen).toBe("break");
    act(() => hook.result.current.skipBreak());
    for (let index = 0; index < 30; index++) {
      presentStimulus();
      finishTrialByTimeout();
    }
    expect(hook.result.current.screen).toBe("completed");
    const final = snapshot(hook);
    expect(final.status).toBe("complete");
    expect(final.records).toHaveLength(72);
    const main = final.records.filter((record) => record.phase === "main");
    expect(main.map((record) => record.stimulus.text)).toEqual(
      expected.main.map((trial) => trial.stimulus.text),
    );
    for (const record of final.records) {
      const timing = record.timing;
      expect(record.outcome.category).toBe("timeout");
      expect(
        timing.stimulusOnsetMs! - timing.fixationOnsetMs!,
      ).toBeGreaterThanOrEqual(500);
      expect(timing.deadlineMs! - timing.stimulusOnsetMs!).toBe(2000);
      expect(timing.stimulusOffsetMs!).toBeGreaterThanOrEqual(
        timing.deadlineMs!,
      );
      expect(timing.itiEndMs! - timing.stimulusOffsetMs!).toBe(500);
    }
    expect(final.records[0].experiment.protocolId).toBe("HB-FLANKER-1.0");
    expect(final.records[0].randomization.prngAndScheduleId).toBe(
      "HB-FLANKER-shuffle-v1",
    );
  });

  it("classifies the center arrow only: the flanker key is incorrect", () => {
    const schedule = createFlankerSchedule(SEED);
    const firstIncongruent = schedule.practice.findIndex(
      (trial) => trial.condition === "incongruent",
    );
    const hook = setup();
    act(() => hook.result.current.beginSession());
    act(() => hook.result.current.beginPractice());
    for (let index = 0; index < firstIncongruent; index++) {
      presentStimulus();
      finishTrialByTimeout();
    }
    presentStimulus();
    const trial = hook.result.current.activeTrial!;
    expect(trial.condition).toBe("incongruent");
    press("x"); // unmapped: ignored
    press(trial.stimulus.flankerType === "left" ? "f" : "j");
    press(trial.correctResponse); // second key ignored
    const record = snapshot(hook).records[firstIncongruent];
    expect(record.outcome).toEqual({ category: "incorrect" });
    expect(record.response?.value).not.toBe(trial.correctResponse);
  });

  it("does not start a trial while the array cannot fit, and resumes once it fits", () => {
    arrayFits = false;
    const hook = setup();
    act(() => hook.result.current.beginSession());
    act(() => hook.result.current.beginPractice());
    expect(hook.result.current.screen).toBe("paused");
    expect(hook.result.current.interruptionReason).toBe(
      "presentation_unavailable",
    );
    expect(hook.result.current.pauseInvalidatedTrial).toBe(false);
    advance(10_000);
    expect(snapshot(hook).records).toHaveLength(0);

    // Still too narrow: resuming pauses again without creating anything.
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.screen).toBe("paused");
    expect(snapshot(hook).records).toHaveLength(0);

    arrayFits = true;
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.screen).toBe("practice");
    expect(hook.result.current.trialStage).toBe("fixation");
    expect(hook.result.current.activeTrial?.index).toBe(1);
  });

  it("re-checks at onset: narrowing during fixation prevents onset and creates no record", () => {
    const hook = setup();
    act(() => hook.result.current.beginSession());
    act(() => hook.result.current.beginPractice());
    advance(300);
    arrayFits = false;
    presentStimulus();
    expect(hook.result.current.screen).toBe("paused");
    expect(hook.result.current.interruptionReason).toBe(
      "presentation_unavailable",
    );
    expect(snapshot(hook).records).toHaveLength(0);
    arrayFits = true;
    act(() => hook.result.current.resumeSession());
    // The never-presented trial starts again with a new fixation.
    expect(hook.result.current.activeTrial?.index).toBe(1);
    expect(hook.result.current.trialStage).toBe("fixation");
  });

  it("invalidates an interrupted trial and never replays it", () => {
    const hook = setup();
    act(() => hook.result.current.beginSession());
    act(() => hook.result.current.beginPractice());
    presentStimulus();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(hook.result.current.screen).toBe("paused");
    expect(hook.result.current.pauseInvalidatedTrial).toBe(true);
    const [record] = snapshot(hook).records;
    expect(record.outcome).toEqual({
      category: "invalid",
      reason: "interrupt",
    });
    expect(record.timing.stimulusOffsetMs).toBeNull();
    expect(record.timing.itiEndMs).toBeNull();
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.activeTrial?.index).toBe(2);
  });
});
