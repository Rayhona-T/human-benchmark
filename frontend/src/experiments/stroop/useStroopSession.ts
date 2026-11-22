import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  PracticeOrMain,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";
import {
  ExperimentLifecycle,
  type LifecycleSnapshot,
} from "../../engine/lifecycle";
import { BrowserKeyboardInputSource } from "../../engine/input";
import {
  BrowserInterruptionEventSource,
  type InterruptionReason,
} from "../../engine/interruption";
import { TrialRuntime } from "../../engine/trialRuntime";
import {
  BrowserDeadlineScheduler,
  BrowserMonotonicClock,
} from "../../engine/timing";
import {
  STROOP_CONFIGURATION,
  STROOP_RESPONSE_MAPPING,
  type StroopResponse,
  type StroopSchedule,
  type StroopTrial,
} from "./stroop";
import { createStroopSchedule } from "./stroopSchedule";

export type StroopScreen =
  | "intro"
  | "instructions"
  | "practice"
  | "ready"
  | "main"
  | "break"
  | "paused"
  | "completed"
  | "aborted"
  | "technical";

export type StroopTrialStage =
  "idle" | "fixation" | "stimulus" | "feedback" | "iti";

type StroopRecord = TrialRecord<unknown, string, StroopResponse>;

export interface StroopSessionHook {
  screen: StroopScreen;
  trialStage: StroopTrialStage;
  activeTrial: StroopTrial | null;
  feedback: StroopRecord | null;
  practiceIndex: number;
  mainIndex: number;
  pauseContext: PracticeOrMain | "break" | null;
  interruptionReason: InterruptionReason | null;
  /** True when the current pause invalidated an already-presented trial. */
  pauseInvalidatedTrial: boolean;
  /** Pause/exit are unavailable while a timed stimulus is on screen. */
  canPause: boolean;
  /** Read-only view of the engine state (records are copies). */
  getSnapshot: () => LifecycleSnapshot<unknown, string, StroopResponse> | null;
  beginSession: (seed?: number) => void;
  beginPractice: () => void;
  beginMain: () => void;
  pauseSession: () => boolean;
  resumeSession: () => void;
  continueBreak: () => void;
  skipBreak: () => void;
  abortSession: () => void;
  restartSession: () => void;
}

function createSessionSeed(): number | null {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return null;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] >>> 0;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `stroop-${Date.now().toString(36)}`;
}

/** Protocol §7: a timed stimulus may start only while visible and focused. */
function currentUnavailability(): InterruptionReason | null {
  if (typeof document === "undefined") return null;
  if (document.hidden) return "visibility_hidden";
  if (!document.hasFocus()) return "document_focus_lost";
  return null;
}

function interruptionReasonFromOutcome(
  outcome: TrialOutcome,
): InterruptionReason | null {
  if (outcome.category !== "invalid") return null;
  if (outcome.reason === "visibility_lost") return "visibility_hidden";
  if (outcome.reason === "interrupt") return "window_blur";
  if (outcome.reason === "focus_lost") return "document_focus_lost";
  return null;
}

function phaseConfiguration(phase: PracticeOrMain) {
  return phase === "practice"
    ? STROOP_CONFIGURATION.practice
    : STROOP_CONFIGURATION.main;
}

export function useStroopSession(seedOverride?: number): StroopSessionHook {
  const [screen, setScreen] = useState<StroopScreen>("intro");
  const [trialStage, setTrialStageState] = useState<StroopTrialStage>("idle");
  const [activeTrial, setActiveTrial] = useState<StroopTrial | null>(null);
  const [feedback, setFeedback] = useState<StroopRecord | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [mainIndex, setMainIndex] = useState(0);
  const [pauseContext, setPauseContext] = useState<
    PracticeOrMain | "break" | null
  >(null);
  const [interruptionReason, setInterruptionReason] =
    useState<InterruptionReason | null>(null);
  const [pauseInvalidatedTrial, setPauseInvalidatedTrial] = useState(false);

  const lifecycleRef = useRef<ExperimentLifecycle<
    unknown,
    string,
    StroopResponse
  > | null>(null);
  const scheduleRef = useRef<StroopSchedule | null>(null);
  const runtimeRef = useRef<TrialRuntime<
    unknown,
    string,
    StroopResponse
  > | null>(null);
  const trialStageRef = useRef<StroopTrialStage>("idle");
  const fixationTimeoutRef = useRef<number | null>(null);
  const onsetFrameRef = useRef<number | null>(null);
  const offsetFrameRef = useRef<number | null>(null);
  const itiTimeoutRef = useRef<number | null>(null);
  const preOnsetGuardRef = useRef<(() => void) | null>(null);
  const breakStartRef = useRef<number | null>(null);
  const breakOfferedRef = useRef(false);
  const breakActionRef = useRef(false);
  const interruptionRef = useRef<BrowserInterruptionEventSource | null>(null);
  const breakInterruptionCleanupRef = useRef<(() => void) | null>(null);
  const prepareNextTrialRef = useRef<(phase: PracticeOrMain) => void>(() => {});
  const sessionStartedRef = useRef(false);

  const setTrialStage = useCallback((stage: StroopTrialStage) => {
    trialStageRef.current = stage;
    setTrialStageState(stage);
  }, []);

  const interruptionSource = useCallback(() => {
    if (!interruptionRef.current) {
      interruptionRef.current = new BrowserInterruptionEventSource();
    }
    return interruptionRef.current;
  }, []);

  const stopPreOnsetGuard = useCallback(() => {
    preOnsetGuardRef.current?.();
    preOnsetGuardRef.current = null;
  }, []);

  const clearTrialTimers = useCallback(() => {
    if (fixationTimeoutRef.current !== null) {
      window.clearTimeout(fixationTimeoutRef.current);
      fixationTimeoutRef.current = null;
    }
    if (onsetFrameRef.current !== null) {
      window.cancelAnimationFrame(onsetFrameRef.current);
      onsetFrameRef.current = null;
    }
    if (offsetFrameRef.current !== null) {
      window.cancelAnimationFrame(offsetFrameRef.current);
      offsetFrameRef.current = null;
    }
    if (itiTimeoutRef.current !== null) {
      window.clearTimeout(itiTimeoutRef.current);
      itiTimeoutRef.current = null;
    }
    stopPreOnsetGuard();
  }, [stopPreOnsetGuard]);

  const disposeRuntime = useCallback(() => {
    runtimeRef.current?.dispose();
    runtimeRef.current = null;
  }, []);

  const stopBreakInterruption = useCallback(() => {
    breakInterruptionCleanupRef.current?.();
    breakInterruptionCleanupRef.current = null;
  }, []);

  /**
   * Pauses a practice/main phase outside an active stimulus. The DOM update is
   * flushed synchronously so a stimulus committed for a not-yet-recorded onset
   * frame is removed before that frame paints.
   */
  const pauseOutsideStimulus = useCallback(
    (phase: PracticeOrMain, reason: InterruptionReason | null) => {
      clearTrialTimers();
      disposeRuntime();
      const lifecycle = lifecycleRef.current;
      if (!lifecycle) return false;
      const result = lifecycle.dispatch({ type: "PAUSE", resumePhase: phase });
      if (!result.ok) return false;
      flushSync(() => {
        setInterruptionReason(reason);
        setPauseInvalidatedTrial(false);
        setPauseContext(phase);
        setScreen("paused");
        setTrialStage("idle");
        setActiveTrial(null);
        setFeedback(null);
      });
      return true;
    },
    [clearTrialTimers, disposeRuntime, setTrialStage],
  );

  const showCompleted = useCallback(() => {
    setScreen("completed");
    setTrialStage("idle");
    setActiveTrial(null);
  }, [setTrialStage]);

  const prepareNextTrial = useCallback(
    (phase: PracticeOrMain) => {
      const lifecycle = lifecycleRef.current;
      const schedule = scheduleRef.current;
      if (!lifecycle || !schedule) return;
      clearTrialTimers();
      disposeRuntime();

      const snapshot = lifecycle.getSnapshot();
      setPracticeIndex(snapshot.practiceIndex);
      setMainIndex(snapshot.mainIndex);
      if (phase === "practice" && snapshot.state === "ready") {
        setScreen("ready");
        setTrialStage("idle");
        setActiveTrial(null);
        setFeedback(null);
        return;
      }
      if (snapshot.state !== phase) return;

      // Break and completion decisions are made here, at the start of the next
      // trial, so they apply however the previous interval ended (normal ITI,
      // manual pause, or an interruption that invalidated main trial 30).
      if (phase === "main") {
        if (
          !breakOfferedRef.current &&
          snapshot.mainIndex === STROOP_CONFIGURATION.main.breakAfterTrialIndex
        ) {
          const offered = lifecycle.dispatch({ type: "OFFER_BREAK" });
          if (offered.ok) {
            breakOfferedRef.current = true;
            breakStartRef.current = performance.now();
            breakActionRef.current = false;
            setScreen("break");
            setTrialStage("idle");
            setActiveTrial(null);
            return;
          }
        }
        if (snapshot.mainIndex >= schedule.main.length) {
          const completed = lifecycle.dispatch({ type: "COMPLETE" });
          if (completed.ok) showCompleted();
          return;
        }
      }

      const index =
        phase === "practice" ? snapshot.practiceIndex : snapshot.mainIndex;
      const trials = phase === "practice" ? schedule.practice : schedule.main;
      const trial = trials[index];
      if (!trial) return;

      const unavailable = currentUnavailability();
      if (unavailable) {
        pauseOutsideStimulus(phase, unavailable);
        return;
      }

      const config = phaseConfiguration(phase);
      flushSync(() => {
        setFeedback(null);
        setActiveTrial(trial);
        setTrialStage("fixation");
      });
      const fixationOnsetMs = performance.now();

      // Covers fixation and the gap before the onset frame. Losing focus or
      // visibility here pauses before onset; the trial was never presented,
      // so it is shown again (with a new fixation) after resume.
      preOnsetGuardRef.current = interruptionSource().subscribe((reason) => {
        pauseOutsideStimulus(phase, reason);
      });

      fixationTimeoutRef.current = window.setTimeout(() => {
        fixationTimeoutRef.current = null;
        // Commit the stimulus synchronously so the next animation frame is the
        // frame that first renders it (protocol §7 step 2).
        flushSync(() => setTrialStage("stimulus"));
        onsetFrameRef.current = window.requestAnimationFrame(
          (onsetTimestamp) => {
            onsetFrameRef.current = null;
            const unavailableAtOnset = currentUnavailability();
            if (unavailableAtOnset) {
              pauseOutsideStimulus(phase, unavailableAtOnset);
              return;
            }
            stopPreOnsetGuard();
            const currentLifecycle = lifecycleRef.current;
            if (!currentLifecycle) return;

            const runtime = new TrialRuntime(
              currentLifecycle,
              new BrowserMonotonicClock(),
              new BrowserDeadlineScheduler(),
              new BrowserKeyboardInputSource(),
              STROOP_RESPONSE_MAPPING,
              interruptionSource(),
              "performance.now",
              (outcome) => {
                if (runtimeRef.current !== runtime) return;
                const after = currentLifecycle.getSnapshot();
                const latest = after.records[after.records.length - 1] as
                  StroopRecord | undefined;
                setPracticeIndex(after.practiceIndex);
                setMainIndex(after.mainIndex);

                if (after.state === "technical_error") {
                  setScreen("technical");
                  setTrialStage("idle");
                  setActiveTrial(null);
                  return;
                }

                const interruption = interruptionReasonFromOutcome(outcome);
                if (after.state === "paused") {
                  flushSync(() => {
                    setInterruptionReason(interruption);
                    setPauseInvalidatedTrial(true);
                    setPauseContext(phase);
                    setScreen("paused");
                    setTrialStage("idle");
                    setActiveTrial(null);
                    setFeedback(null);
                  });
                  return;
                }

                // Protocol §7 step 6: end the stimulus on the next frame and
                // start the 500 ms interval from that offset callback.
                offsetFrameRef.current = window.requestAnimationFrame(() => {
                  offsetFrameRef.current = null;
                  const showFeedback =
                    phase === "practice" &&
                    config.feedbackEnabled &&
                    outcome.category !== "invalid";
                  flushSync(() => {
                    setActiveTrial(null);
                    setFeedback(showFeedback ? (latest ?? null) : null);
                    setTrialStage(showFeedback ? "feedback" : "iti");
                  });
                  itiTimeoutRef.current = window.setTimeout(() => {
                    itiTimeoutRef.current = null;
                    prepareNextTrialRef.current(phase);
                  }, config.interTrialIntervalMs);
                });
              },
            );
            runtimeRef.current = runtime;
            const started = runtime.start(
              trial,
              config.responseDeadlineMs,
              onsetTimestamp,
              fixationOnsetMs,
            );
            if (!started.ok) {
              runtimeRef.current = null;
              setScreen("technical");
              setTrialStage("idle");
              setActiveTrial(null);
            }
          },
        );
      }, config.fixationMs);
    },
    [
      clearTrialTimers,
      disposeRuntime,
      interruptionSource,
      pauseOutsideStimulus,
      setTrialStage,
      showCompleted,
      stopPreOnsetGuard,
    ],
  );

  useEffect(() => {
    prepareNextTrialRef.current = prepareNextTrial;
  }, [prepareNextTrial]);

  const beginSession = useCallback(
    (seedOverride?: number) => {
      if (sessionStartedRef.current) return;
      sessionStartedRef.current = true;
      clearTrialTimers();
      disposeRuntime();
      stopBreakInterruption();
      breakOfferedRef.current = false;
      breakActionRef.current = false;
      breakStartRef.current = null;
      const seed =
        seedOverride === undefined ? createSessionSeed() : seedOverride;
      if (seed === null) {
        setScreen("technical");
        setTrialStage("idle");
        return;
      }
      try {
        const schedule = createStroopSchedule(seed);
        const lifecycle = new ExperimentLifecycle(
          createSessionId(),
          STROOP_CONFIGURATION,
          schedule,
          {
            seedUnsigned32: schedule.metadata.seedUnsigned32,
            prngAndScheduleId: schedule.metadata.prngAndScheduleId,
            randomizationConfigurationVersion:
              schedule.metadata.randomizationConfigurationVersion,
            scheduleGenerationStatus: "generated",
            realizedPracticeOrder: schedule.metadata.realizedPracticeOrder,
            realizedMainOrder: schedule.metadata.realizedMainOrder,
          },
        );
        lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
        lifecycleRef.current = lifecycle;
        scheduleRef.current = schedule;
        setPracticeIndex(0);
        setMainIndex(0);
        setFeedback(null);
        setInterruptionReason(null);
        setPauseInvalidatedTrial(false);
        setPauseContext(null);
        setActiveTrial(null);
        setScreen("instructions");
        setTrialStage("idle");
      } catch {
        lifecycleRef.current = null;
        scheduleRef.current = null;
        setScreen("technical");
        setTrialStage("idle");
      }
    },
    [clearTrialTimers, disposeRuntime, setTrialStage, stopBreakInterruption],
  );

  const beginPractice = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const started = lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
    if (!started.ok) return;
    if (lifecycle.getSnapshot().state === "ready") {
      setScreen("ready");
      setTrialStage("idle");
    } else {
      setScreen("practice");
      prepareNextTrial("practice");
    }
  }, [prepareNextTrial, setTrialStage]);

  const beginMain = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const started = lifecycle.dispatch({ type: "BEGIN_MAIN" });
    if (!started.ok) return;
    setScreen("main");
    prepareNextTrial("main");
  }, [prepareNextTrial]);

  /** Returns true when the session was paused by this call. */
  const pauseSession = useCallback((): boolean => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return false;
    const snapshot = lifecycle.getSnapshot();
    if (snapshot.state === "practice" || snapshot.state === "main") {
      // A presented stimulus must end by response, deadline, or interruption;
      // pausing it would discard the trial and later replay it.
      if (
        trialStageRef.current === "stimulus" ||
        snapshot.activeTrial !== null
      ) {
        return false;
      }
      return pauseOutsideStimulus(snapshot.state, null);
    }
    if (snapshot.state === "break") {
      const result = lifecycle.dispatch({
        type: "PAUSE",
        resumePhase: "break",
      });
      if (result.ok) {
        setInterruptionReason(null);
        setPauseInvalidatedTrial(false);
        setPauseContext("break");
        setScreen("paused");
        return true;
      }
    }
    return false;
  }, [pauseOutsideStimulus]);

  const resumeSession = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const result = lifecycle.dispatch({ type: "RESUME" });
    if (!result.ok) return;
    const snapshot = lifecycle.getSnapshot();
    setInterruptionReason(null);
    setPauseInvalidatedTrial(false);
    setPauseContext(null);
    if (snapshot.state === "break") {
      setScreen("break");
    } else if (snapshot.state === "practice" || snapshot.state === "main") {
      setScreen(snapshot.state);
      prepareNextTrial(snapshot.state);
    }
  }, [prepareNextTrial]);

  const continueBreak = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle || breakActionRef.current) return;
    if (lifecycle.getSnapshot().state !== "break") return;
    breakActionRef.current = true;
    stopBreakInterruption();
    const duration =
      breakStartRef.current === null
        ? 0
        : Math.max(0, performance.now() - breakStartRef.current);
    lifecycle.dispatch({ type: "TAKE_BREAK", durationMs: duration });
    const continued = lifecycle.dispatch({ type: "CONTINUE_AFTER_BREAK" });
    if (continued.ok) {
      breakStartRef.current = null;
      setScreen("main");
      prepareNextTrial("main");
    }
  }, [prepareNextTrial, stopBreakInterruption]);

  const skipBreak = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle || breakActionRef.current) return;
    if (lifecycle.getSnapshot().state !== "break") return;
    breakActionRef.current = true;
    stopBreakInterruption();
    const skipped = lifecycle.dispatch({ type: "SKIP_BREAK" });
    if (skipped.ok) {
      breakStartRef.current = null;
      setScreen("main");
      prepareNextTrial("main");
    }
  }, [prepareNextTrial, stopBreakInterruption]);

  const abortSession = useCallback(() => {
    sessionStartedRef.current = false;
    clearTrialTimers();
    disposeRuntime();
    stopBreakInterruption();
    lifecycleRef.current?.dispatch({ type: "ABORT" });
    setActiveTrial(null);
    setTrialStage("idle");
    setFeedback(null);
    setScreen("aborted");
  }, [clearTrialTimers, disposeRuntime, setTrialStage, stopBreakInterruption]);

  const restartSession = useCallback(() => {
    sessionStartedRef.current = false;
    beginSession(seedOverride);
  }, [beginSession, seedOverride]);

  // During the break no trial timer runs; a visibility/focus loss pauses it.
  useEffect(() => {
    if (screen !== "break") {
      stopBreakInterruption();
      return;
    }
    breakInterruptionCleanupRef.current = interruptionSource().subscribe(
      (reason) => {
        const result = lifecycleRef.current?.dispatch({
          type: "PAUSE",
          resumePhase: "break",
        });
        if (result?.ok) {
          setInterruptionReason(reason);
          setPauseInvalidatedTrial(false);
          setPauseContext("break");
          setScreen("paused");
        }
      },
    );
    return stopBreakInterruption;
  }, [interruptionSource, screen, stopBreakInterruption]);

  // During feedback / inter-trial intervals the previous trial is already
  // recorded; an interruption pauses before the next fixation.
  useEffect(() => {
    if (
      (screen !== "practice" && screen !== "main") ||
      (trialStage !== "feedback" && trialStage !== "iti")
    ) {
      return;
    }
    return interruptionSource().subscribe((reason) => {
      const state = lifecycleRef.current?.getSnapshot().state;
      if (state === "practice" || state === "main") {
        pauseOutsideStimulus(state, reason);
      }
    });
  }, [interruptionSource, pauseOutsideStimulus, screen, trialStage]);

  useEffect(() => {
    return () => {
      clearTrialTimers();
      disposeRuntime();
      stopBreakInterruption();
    };
  }, [clearTrialTimers, disposeRuntime, stopBreakInterruption]);

  const getSnapshot = useCallback(
    () => lifecycleRef.current?.getSnapshot() ?? null,
    [],
  );

  const canPause =
    screen === "break" ||
    ((screen === "practice" || screen === "main") && trialStage !== "stimulus");

  return {
    screen,
    trialStage,
    activeTrial,
    feedback,
    practiceIndex,
    mainIndex,
    pauseContext,
    interruptionReason,
    pauseInvalidatedTrial,
    canPause,
    getSnapshot,
    beginSession,
    beginPractice,
    beginMain,
    pauseSession,
    resumeSession,
    continueBreak,
    skipBreak,
    abortSession,
    restartSession,
  };
}
