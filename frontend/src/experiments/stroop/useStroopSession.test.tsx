import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STROOP_CONFIGURATION } from "./stroop";
import { useStroopSession } from "./useStroopSession";

const SEED = 1234;

function setup() {
  const hook = renderHook(() => useStroopSession(SEED));
  return hook;
}

type Hook = ReturnType<typeof setup>;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function nextFrame() {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

function press(key: string, repeat = false) {
  act(() => {
    fireEvent.keyDown(window, { key, repeat });
  });
}

function blurWindow() {
  act(() => {
    window.dispatchEvent(new Event("blur"));
  });
}

function snapshot(hook: Hook) {
  const current = hook.result.current.getSnapshot();
  if (!current) throw new Error("No active lifecycle");
  return current;
}

/** Runs fixation and waits for the onset animation frame. */
function presentStimulus() {
  advance(STROOP_CONFIGURATION.practice.fixationMs);
  nextFrame();
}

/** Lets the active trial time out, then runs the offset frame and ITI. */
function timeOutAndFinishIti() {
  advance(STROOP_CONFIGURATION.main.responseDeadlineMs);
  nextFrame();
  advance(STROOP_CONFIGURATION.main.interTrialIntervalMs);
}

function startPractice(hook: Hook) {
  act(() => hook.result.current.beginSession());
  act(() => hook.result.current.beginPractice());
}

function finishPracticeAndStartMain(hook: Hook) {
  startPractice(hook);
  for (let index = 0; index < 12; index++) {
    presentStimulus();
    timeOutAndFinishIti();
  }
  expect(hook.result.current.screen).toBe("ready");
  act(() => hook.result.current.beginMain());
}

describe("useStroopSession (browser-timed participant flow)", () => {
  beforeEach(() => {
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

  it("records onset from the animation frame and RT relative to that onset", () => {
    const hook = setup();
    startPractice(hook);
    expect(hook.result.current.trialStage).toBe("fixation");

    advance(STROOP_CONFIGURATION.practice.fixationMs);
    expect(hook.result.current.trialStage).toBe("stimulus");
    // The runtime must not exist until the onset frame callback runs.
    expect(snapshot(hook).activeTrial).toBeNull();
    nextFrame();
    expect(snapshot(hook).activeTrial?.trialIndex).toBe(1);

    advance(250);
    press("d");
    const record = snapshot(hook).records[0];
    const timing = record.timing;
    expect(record.phase).toBe("practice");
    expect(timing.stimulusOnsetMs).not.toBeNull();
    expect(timing.fixationOnsetMs).not.toBeNull();
    expect(
      timing.stimulusOnsetMs! - timing.fixationOnsetMs!,
    ).toBeGreaterThanOrEqual(500);
    expect(timing.deadlineMs).toBe(timing.stimulusOnsetMs! + 2000);
    expect(timing.reactionTimeMs).toBe(
      timing.responseTimestampMs! - timing.stimulusOnsetMs!,
    );
    expect(timing.reactionTimeMs).toBeGreaterThanOrEqual(250);
    expect(timing.reactionTimeMs).toBeLessThan(2000);
  });

  it("ends the stimulus on the next frame and runs a 500 ms interval before the next fixation", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    press("d");
    // Stimulus remains until the next animation frame callback.
    expect(hook.result.current.trialStage).toBe("stimulus");
    nextFrame();
    expect(hook.result.current.trialStage).toBe("feedback");
    advance(499);
    expect(hook.result.current.trialStage).toBe("feedback");
    advance(1);
    expect(hook.result.current.trialStage).toBe("fixation");
    expect(hook.result.current.activeTrial?.index).toBe(2);
  });

  it("times out at the deadline and never accepts a late key as a response", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    advance(1999);
    expect(snapshot(hook).records).toHaveLength(0);
    advance(1);
    const record = snapshot(hook).records[0];
    expect(record.outcome.category).toBe("timeout");
    expect(record.response).toBeNull();
    expect(record.timing.reactionTimeMs).toBeNull();
    press("d");
    expect(snapshot(hook).records).toHaveLength(1);
    expect(snapshot(hook).records[0].outcome.category).toBe("timeout");
  });

  it("ignores keys during fixation, repeats, extra keys, and keys during the interval", () => {
    const hook = setup();
    startPractice(hook);
    press("d"); // fixation
    advance(STROOP_CONFIGURATION.practice.fixationMs);
    press("d"); // stimulus committed but onset frame not yet recorded
    nextFrame();
    expect(snapshot(hook).records).toHaveLength(0);

    press("f", true); // auto-repeat
    expect(snapshot(hook).records).toHaveLength(0);
    press("x"); // unmapped
    expect(snapshot(hook).records).toHaveLength(0);
    press("f");
    press("j"); // second response ignored
    expect(snapshot(hook).records).toHaveLength(1);
    expect(snapshot(hook).records[0].response?.value).toBe("f");

    nextFrame();
    press("k"); // interval
    advance(STROOP_CONFIGURATION.practice.interTrialIntervalMs);
    presentStimulus();
    expect(snapshot(hook).records).toHaveLength(1);
    press("d");
    expect(snapshot(hook).records).toHaveLength(2);
    expect(snapshot(hook).records[1].response?.value).toBe("d");
  });

  it("invalidates a trial interrupted during the stimulus, pauses, and resumes with the next trial", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    blurWindow();

    expect(hook.result.current.screen).toBe("paused");
    expect(hook.result.current.pauseInvalidatedTrial).toBe(true);
    const records = snapshot(hook).records;
    expect(records).toHaveLength(1);
    expect(records[0].outcome).toEqual({
      category: "invalid",
      reason: "interrupt",
    });
    expect(records[0].response).toBeNull();

    // No pending timer may advance the session while paused.
    advance(10_000);
    expect(hook.result.current.screen).toBe("paused");
    press("d");
    expect(snapshot(hook).records).toHaveLength(1);

    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.screen).toBe("practice");
    expect(hook.result.current.activeTrial?.index).toBe(2);
    presentStimulus();
    press("d");
    const after = snapshot(hook).records;
    expect(after).toHaveLength(2);
    expect(after[1].trialIndex).toBe(2);
  });

  it("does not start a stimulus while the page lacks focus", () => {
    const hook = setup();
    startPractice(hook);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    presentStimulus();
    expect(hook.result.current.screen).toBe("paused");
    expect(hook.result.current.pauseInvalidatedTrial).toBe(false);
    expect(snapshot(hook).records).toHaveLength(0);

    vi.mocked(document.hasFocus).mockReturnValue(true);
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.activeTrial?.index).toBe(1);
  });

  it("pauses before onset when focus is lost during fixation without creating a record", () => {
    const hook = setup();
    startPractice(hook);
    advance(200);
    blurWindow();
    expect(hook.result.current.screen).toBe("paused");
    advance(5000);
    expect(snapshot(hook).records).toHaveLength(0);
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.trialStage).toBe("fixation");
    expect(hook.result.current.activeTrial?.index).toBe(1);
  });

  it("rejects a manual pause during the active stimulus so no trial is replayed", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    expect(hook.result.current.canPause).toBe(false);
    act(() => {
      expect(hook.result.current.pauseSession()).toBe(false);
    });
    expect(hook.result.current.screen).toBe("practice");
    press("d");
    expect(snapshot(hook).records).toHaveLength(1);
    expect(snapshot(hook).records[0].trialIndex).toBe(1);
  });

  it("runs 12 practice and 60 main trials, offering the break exactly after main trial 30", () => {
    const hook = setup();
    finishPracticeAndStartMain(hook);
    const practiceRecords = snapshot(hook).records;
    expect(practiceRecords).toHaveLength(12);
    expect(practiceRecords.every((record) => record.phase === "practice")).toBe(
      true,
    );

    for (let index = 0; index < 30; index++) {
      expect(hook.result.current.screen).toBe("main");
      presentStimulus();
      timeOutAndFinishIti();
    }
    expect(hook.result.current.screen).toBe("break");
    expect(snapshot(hook).mainIndex).toBe(30);
    advance(60_000);
    expect(hook.result.current.screen).toBe("break");
    expect(snapshot(hook).mainIndex).toBe(30);

    act(() => hook.result.current.skipBreak());
    for (let index = 0; index < 30; index++) {
      presentStimulus();
      timeOutAndFinishIti();
    }
    expect(hook.result.current.screen).toBe("completed");
    const final = snapshot(hook);
    expect(final.status).toBe("complete");
    const main = final.records.filter((record) => record.phase === "main");
    expect(main).toHaveLength(60);
    expect(main.map((record) => record.trialIndex)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
    expect(final.breakTaken).toBe(false);
  });

  it("still offers the break when the session is paused during the interval after trial 30", () => {
    const hook = setup();
    finishPracticeAndStartMain(hook);
    for (let index = 0; index < 29; index++) {
      presentStimulus();
      timeOutAndFinishIti();
    }
    presentStimulus();
    advance(2000);
    nextFrame();
    expect(hook.result.current.trialStage).toBe("iti");
    expect(hook.result.current.canPause).toBe(true);
    act(() => hook.result.current.pauseSession());
    expect(hook.result.current.screen).toBe("paused");
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.screen).toBe("break");
    expect(snapshot(hook).mainIndex).toBe(30);
  });

  it("offers the break when main trial 30 was invalidated by an interruption", () => {
    const hook = setup();
    finishPracticeAndStartMain(hook);
    for (let index = 0; index < 29; index++) {
      presentStimulus();
      timeOutAndFinishIti();
    }
    presentStimulus();
    blurWindow();
    act(() => hook.result.current.resumeSession());
    expect(hook.result.current.screen).toBe("break");
  });

  it("records a taken break with its duration and ignores a second break action", () => {
    const hook = setup();
    finishPracticeAndStartMain(hook);
    for (let index = 0; index < 30; index++) {
      presentStimulus();
      timeOutAndFinishIti();
    }
    advance(4000);
    act(() => {
      hook.result.current.continueBreak();
      hook.result.current.skipBreak();
    });
    const state = snapshot(hook);
    expect(state.breakTaken).toBe(true);
    expect(state.breakDurationMs).toBe(4000);
    expect(hook.result.current.screen).toBe("main");
    expect(hook.result.current.activeTrial?.index).toBe(31);
  });

  it("keeps an aborted session incomplete without creating unpresented trials", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    press("d");
    nextFrame();
    advance(500);
    presentStimulus();
    act(() => hook.result.current.abortSession());
    const state = snapshot(hook);
    expect(state.status).toBe("incomplete");
    expect(state.records).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    press("d");
    expect(snapshot(hook).records).toHaveLength(1);
  });

  it("clears timers and listeners on unmount during an active trial", () => {
    const hook = setup();
    startPractice(hook);
    presentStimulus();
    const getSnapshot = hook.result.current.getSnapshot;
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.keyDown(window, { key: "d" });
    window.dispatchEvent(new Event("blur"));
    expect(getSnapshot()?.records).toHaveLength(0);
  });
});
