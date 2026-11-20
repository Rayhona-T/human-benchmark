import type { SessionLifecycleState } from "./contracts";

export type SessionTransition =
  | { type: "OPEN_INSTRUCTIONS" }
  | { type: "BEGIN_PRACTICE" }
  | { type: "PRACTICE_COMPLETE" }
  | { type: "BEGIN_MAIN" }
  | { type: "OFFER_BREAK" }
  | { type: "TAKE_BREAK" }
  | { type: "SKIP_BREAK" }
  | { type: "CONTINUE_AFTER_BREAK" }
  | { type: "FOCUS_LOST" }
  | { type: "FOCUS_RESTORED"; resumeTo: "practice" | "main" | "break" }
  | { type: "PAUSE"; resumeTo: "practice" | "main" | "break" }
  | { type: "RESUME"; resumeTo: "practice" | "main" | "break" }
  | { type: "COMPLETE" }
  | { type: "ABORT" }
  | { type: "INTERRUPT" }
  | { type: "SCHEDULE_ERROR" };

export type InvalidSessionTransition = {
  allowed: false;
  from: SessionLifecycleState;
  transition: SessionTransition["type"];
};

export type SessionTransitionResult =
  { allowed: true; to: SessionLifecycleState } | InvalidSessionTransition;

const allowedTransitions: Partial<
  Record<
    SessionLifecycleState,
    Partial<Record<SessionTransition["type"], SessionLifecycleState>>
  >
> = {
  idle: {
    OPEN_INSTRUCTIONS: "instructions",
    SCHEDULE_ERROR: "technical_error",
  },
  instructions: {
    BEGIN_PRACTICE: "practice",
    ABORT: "aborted",
  },
  practice: {
    PRACTICE_COMPLETE: "ready",
    FOCUS_LOST: "paused",
    INTERRUPT: "aborted",
  },
  ready: {
    BEGIN_MAIN: "main",
    ABORT: "aborted",
  },
  main: {
    OFFER_BREAK: "break",
    FOCUS_LOST: "paused",
    COMPLETE: "completed",
    ABORT: "aborted",
  },
  break: {
    TAKE_BREAK: "break",
    CONTINUE_AFTER_BREAK: "main",
    SKIP_BREAK: "main",
    PAUSE: "paused",
    INTERRUPT: "aborted",
  },
  paused: {
    FOCUS_RESTORED: "main",
    RESUME: "main",
    INTERRUPT: "aborted",
  },
  completed: {},
  aborted: {},
  technical_error: {},
};

export function transitionSession(
  from: SessionLifecycleState,
  transition: SessionTransition,
): SessionTransitionResult {
  if (
    from === "paused" &&
    (transition.type === "FOCUS_RESTORED" || transition.type === "RESUME")
  ) {
    return { allowed: true, to: transition.resumeTo };
  }
  const to = allowedTransitions[from]?.[transition.type];
  if (!to) {
    return {
      allowed: false,
      from,
      transition: transition.type,
    };
  }
  return { allowed: true, to };
}
