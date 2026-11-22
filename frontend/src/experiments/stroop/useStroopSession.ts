import { useCallback, useEffect, useRef, useState } from "react";
import type { PracticeOrMain, TrialRecord } from "../../engine/contracts";
import { ExperimentLifecycle } from "../../engine/lifecycle";
import { BrowserKeyboardInputSource } from "../../engine/input";
import { BrowserInterruptionEventSource } from "../../engine/interruption";
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

export interface StroopSessionHook {
  screen: StroopScreen;
  trialStage: StroopTrialStage;
  activeTrial: StroopTrial | null;
  feedback: TrialRecord<unknown, string, StroopResponse> | null;
  practiceIndex: number;
  mainIndex: number;
  pauseContext: PracticeOrMain | "break" | null;
  interruptionReason:
    "visibility_hidden" | "window_blur" | "document_focus_lost" | null;
  beginSession: (seed?: number) => void;
  beginPractice: () => void;
  beginMain: () => void;
  pauseSession: () => void;
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

export function useStroopSession(seedOverride?: number): StroopSessionHook {
  const [screen, setScreen] = useState<StroopScreen>("intro");
  const [trialStage, setTrialStage] = useState<StroopTrialStage>("idle");
  const [activeTrial, setActiveTrial] = useState<StroopTrial | null>(null);
  const [feedback, setFeedback] = useState<TrialRecord<
    unknown,
    string,
    StroopResponse
  > | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [mainIndex, setMainIndex] = useState(0);
  const [pauseContext, setPauseContext] = useState<
    PracticeOrMain | "break" | null
  >(null);
  const [interruptionReason, setInterruptionReason] = useState<
    "visibility_hidden" | "window_blur" | "document_focus_lost" | null
  >(null);

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
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const activePhaseRef = useRef<PracticeOrMain | null>(null);
  const breakStartRef = useRef<number | null>(null);
  const interruptionRef = useRef<BrowserInterruptionEventSource | null>(null);
  const interruptionCleanupRef = useRef<(() => void) | null>(null);
  const prepareNextTrialRef = useRef<(phase: PracticeOrMain) => void>(() => {});
  const sessionStartedRef = useRef(false);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const itiTimeoutRef = useRef<number | null>(null);
  const breakActionRef = useRef(false);

  const clearTrialTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
    if (itiTimeoutRef.current !== null) {
      window.clearTimeout(itiTimeoutRef.current);
      itiTimeoutRef.current = null;
    }
  }, []);

  const disposeRuntime = useCallback(() => {
    runtimeRef.current?.dispose();
    runtimeRef.current = null;
  }, []);

  const stopBreakInterruption = useCallback(() => {
    interruptionCleanupRef.current?.();
    interruptionCleanupRef.current = null;
  }, []);

  const prepareNextTrial = useCallback(
    (phase: PracticeOrMain) => {
      const lifecycle = lifecycleRef.current;
      const schedule = scheduleRef.current;
      if (!lifecycle || !schedule) return;
      if (typeof document !== "undefined" && document.hidden) {
        const result = lifecycle.dispatch({
          type: "PAUSE",
          resumePhase: phase,
        });
        if (result.ok) {
          setInterruptionReason("visibility_hidden");
          setPauseContext(phase);
          setScreen("paused");
          setTrialStage("idle");
          setActiveTrial(null);
        }
        return;
      }

      const snapshot = lifecycle.getSnapshot();
      if (
        (phase === "practice" && snapshot.state !== "practice") ||
        (phase === "main" && snapshot.state !== "main")
      ) {
        if (phase === "practice" && snapshot.state === "ready") {
          setScreen("ready");
          setTrialStage("idle");
          setActiveTrial(null);
        }
        return;
      }

      const index =
        phase === "practice" ? snapshot.practiceIndex : snapshot.mainIndex;
      const trials = phase === "practice" ? schedule.practice : schedule.main;
      const trial = trials[index];
      if (!trial) {
        if (phase === "main") {
          lifecycle.dispatch({ type: "COMPLETE" });
          setScreen("completed");
          setTrialStage("idle");
          setActiveTrial(null);
        }
        return;
      }

      activePhaseRef.current = phase;
      setActiveTrial(trial);
      setTrialStage("fixation");
      clearTrialTimers();
      disposeRuntime();

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        setTrialStage("stimulus");
        rafRef.current = window.requestAnimationFrame((onsetTimestamp) => {
          rafRef.current = null;
          const currentLifecycle = lifecycleRef.current;
          if (!currentLifecycle) return;

          const runtime = new TrialRuntime(
            currentLifecycle,
            new BrowserMonotonicClock(),
            new BrowserDeadlineScheduler(),
            new BrowserKeyboardInputSource(),
            STROOP_RESPONSE_MAPPING,
            interruptionRef.current ?? new BrowserInterruptionEventSource(),
            "performance.now",
            () => {
              const finalSnapshot = currentLifecycle.getSnapshot();
              const latestRecord = finalSnapshot.records[
                finalSnapshot.records.length - 1
              ] as TrialRecord<unknown, string, StroopResponse> | undefined;

              setPracticeIndex(finalSnapshot.practiceIndex);
              setMainIndex(finalSnapshot.mainIndex);
              setActiveTrial(null);
              setFeedback(latestRecord ?? null);

              if (finalSnapshot.state === "paused") {
                if (
                  latestRecord &&
                  latestRecord.outcome.category === "invalid"
                ) {
                  if (latestRecord.outcome.reason === "visibility_lost") {
                    setInterruptionReason("visibility_hidden");
                  } else if (latestRecord.outcome.reason === "interrupt") {
                    setInterruptionReason("window_blur");
                  } else {
                    setInterruptionReason("document_focus_lost");
                  }
                }
                setPauseContext(activePhaseRef.current);
                setScreen("paused");
                setTrialStage("idle");
                return;
              }
              if (finalSnapshot.state === "technical_error") {
                setScreen("technical");
                setTrialStage("idle");
                return;
              }

              if (phase === "practice") {
                setTrialStage("feedback");
                feedbackTimeoutRef.current = window.setTimeout(() => {
                  feedbackTimeoutRef.current = null;
                  setFeedback(null);
                  const afterFeedback = currentLifecycle.getSnapshot();
                  setPracticeIndex(afterFeedback.practiceIndex);
                  if (afterFeedback.state === "ready") {
                    setScreen("ready");
                    setTrialStage("idle");
                  } else {
                    prepareNextTrialRef.current("practice");
                  }
                }, STROOP_CONFIGURATION.practice.interTrialIntervalMs);
              } else {
                setTrialStage("iti");
                itiTimeoutRef.current = window.setTimeout(() => {
                  itiTimeoutRef.current = null;
                  const afterIti = currentLifecycle.getSnapshot();
                  setMainIndex(afterIti.mainIndex);
                  if (
                    afterIti.state === "main" &&
                    afterIti.mainIndex ===
                      STROOP_CONFIGURATION.main.breakAfterTrialIndex
                  ) {
                    const offered = currentLifecycle.dispatch({
                      type: "OFFER_BREAK",
                    });
                    if (offered.ok) {
                      breakStartRef.current = performance.now();
                      breakActionRef.current = false;
                      setScreen("break");
                      setTrialStage("idle");
                    }
                  } else if (
                    afterIti.state === "main" &&
                    afterIti.mainIndex === STROOP_CONFIGURATION.main.trialCount
                  ) {
                    const completed = currentLifecycle.dispatch({
                      type: "COMPLETE",
                    });
                    if (completed.ok) {
                      setScreen("completed");
                      setTrialStage("idle");
                      setActiveTrial(null);
                    }
                  } else if (afterIti.state === "main") {
                    prepareNextTrialRef.current("main");
                  }
                }, STROOP_CONFIGURATION.main.interTrialIntervalMs);
              }
            },
          );
          runtimeRef.current = runtime;
          const started = runtime.start(
            trial,
            phase === "practice"
              ? STROOP_CONFIGURATION.practice.responseDeadlineMs
              : STROOP_CONFIGURATION.main.responseDeadlineMs,
            onsetTimestamp,
          );
          if (!started.ok) {
            setScreen("technical");
            setTrialStage("idle");
          }
        });
      }, STROOP_CONFIGURATION.practice.fixationMs);
    },
    [clearTrialTimers, disposeRuntime],
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
        interruptionRef.current = new BrowserInterruptionEventSource();
        setPracticeIndex(0);
        setMainIndex(0);
        setFeedback(null);
        setInterruptionReason(null);
        setPauseContext(null);
        setScreen("instructions");
        setTrialStage("idle");
      } catch {
        lifecycleRef.current = null;
        scheduleRef.current = null;
        setScreen("technical");
        setTrialStage("idle");
      }
    },
    [clearTrialTimers, disposeRuntime, stopBreakInterruption],
  );

  const beginPractice = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const started = lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
    if (!started.ok) return;
    const snapshot = lifecycle.getSnapshot();
    if (snapshot.state === "ready") {
      setScreen("ready");
      setTrialStage("idle");
    } else {
      setScreen("practice");
      prepareNextTrial("practice");
    }
  }, [prepareNextTrial]);

  const beginMain = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const started = lifecycle.dispatch({ type: "BEGIN_MAIN" });
    if (!started.ok) return;
    setScreen("main");
    prepareNextTrial("main");
  }, [prepareNextTrial]);

  const pauseSession = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const snapshot = lifecycle.getSnapshot();
    if (snapshot.state === "practice" || snapshot.state === "main") {
      clearTrialTimers();
      disposeRuntime();
      const result = lifecycle.dispatch({ type: "PAUSE" });
      if (result.ok) {
        setPauseContext(snapshot.state === "practice" ? "practice" : "main");
        setScreen("paused");
        setTrialStage("idle");
        setActiveTrial(null);
      }
    } else if (snapshot.state === "break") {
      const result = lifecycle.dispatch({
        type: "PAUSE",
        resumePhase: "break",
      });
      if (result.ok) {
        setPauseContext("break");
        setScreen("paused");
      }
    }
  }, [activeTrial, clearTrialTimers, disposeRuntime]);

  const resumeSession = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    const result = lifecycle.dispatch({ type: "RESUME" });
    if (!result.ok) return;
    const snapshot = lifecycle.getSnapshot();
    setInterruptionReason(null);
    setPauseContext(null);
    if (snapshot.state === "break") {
      setScreen("break");
    } else if (snapshot.state === "practice") {
      setScreen("practice");
      prepareNextTrial("practice");
    } else if (snapshot.state === "main") {
      setScreen("main");
      prepareNextTrial("main");
    } else if (snapshot.state === "ready") {
      setScreen("ready");
    }
  }, [prepareNextTrial]);

  const continueBreak = useCallback(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (breakActionRef.current) return;
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
    if (!lifecycle) return;
    if (breakActionRef.current) return;
    breakActionRef.current = true;
    stopBreakInterruption();
    lifecycle.dispatch({ type: "SKIP_BREAK" });
    breakStartRef.current = null;
    setScreen("main");
    prepareNextTrial("main");
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
  }, [clearTrialTimers, disposeRuntime, stopBreakInterruption]);

  const restartSession = useCallback(() => {
    sessionStartedRef.current = false;
    beginSession(seedOverride);
  }, [beginSession, seedOverride]);

  useEffect(() => {
    if (screen !== "break") {
      stopBreakInterruption();
      return;
    }
    if (!interruptionRef.current) {
      interruptionRef.current = new BrowserInterruptionEventSource();
    }
    interruptionCleanupRef.current = interruptionRef.current.subscribe(
      (reason) => {
        setInterruptionReason(reason);
        const lifecycle = lifecycleRef.current;
        const result = lifecycle?.dispatch({
          type: "PAUSE",
          resumePhase: "break",
        });
        if (result?.ok) {
          setPauseContext("break");
          setScreen("paused");
        }
      },
    );
    return stopBreakInterruption;
  }, [screen, stopBreakInterruption]);

  useEffect(() => {
    if (
      (screen !== "practice" && screen !== "main") ||
      (trialStage !== "fixation" && trialStage !== "iti")
    ) {
      return;
    }
    if (!interruptionRef.current) {
      interruptionRef.current = new BrowserInterruptionEventSource();
    }
    const cleanup = interruptionRef.current.subscribe((reason) => {
      clearTrialTimers();
      disposeRuntime();
      const lifecycle = lifecycleRef.current;
      const snapshot = lifecycle?.getSnapshot();
      if (!lifecycle || !snapshot) return;
      if (snapshot.state !== "practice" && snapshot.state !== "main") return;
      const phase =
        snapshot.state === "practice" ? "practice" : "main";
      const result = lifecycle.dispatch({
        type: "PAUSE",
        resumePhase: phase,
      });
      if (result.ok) {
        setInterruptionReason(reason);
        setPauseContext(phase);
        setScreen("paused");
        setTrialStage("idle");
        setActiveTrial(null);
      }
    });
    return cleanup;
  }, [
    clearTrialTimers,
    disposeRuntime,
    screen,
    trialStage,
  ]);

  useEffect(() => {
    return () => {
      clearTrialTimers();
      disposeRuntime();
      stopBreakInterruption();
    };
  }, [clearTrialTimers, disposeRuntime, stopBreakInterruption]);

  return {
    screen,
    trialStage,
    activeTrial,
    feedback,
    practiceIndex,
    mainIndex,
    pauseContext,
    interruptionReason,
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
