import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Link, useBlocker, type BlockerFunction } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type {
  EngineTrial,
  ExperimentConfiguration,
  TrialRecord,
} from "../../engine/contracts";
import type {
  ExperimentSessionHook,
  SessionScreen,
} from "./useExperimentSession";
import { ClearSessionContext } from "./clearSessionContext";
import "./ExperimentSession.css";

/** Screens whose heading receives focus when they appear. */
const FOCUSED_HEADING_SCREENS: readonly SessionScreen[] = [
  "instructions",
  "ready",
  "break",
  "paused",
  "completed",
  "aborted",
  "technical",
];

/**
 * A session is "active" from the first practice trial until it ends. Leaving
 * the page then would silently lose it, so departures are confirmed (Task
 * 10.4, owner decision). Never on the intro or instructions, and never after
 * completion, exit, or clearing.
 */
const ACTIVE_SCREENS: readonly SessionScreen[] = [
  "practice",
  "ready",
  "main",
  "break",
  "paused",
];

/** Ended sessions whose results may be cleared (FR-PRI-03). */
const ENDED_RESULT_SCREENS: readonly SessionScreen[] = [
  "completed",
  "aborted",
  "technical",
];

const PAUSABLE_SCREENS: readonly SessionScreen[] = [
  "practice",
  "main",
  "break",
];

export interface ExperimentSessionShellProps<
  TStimulus,
  TCondition extends string,
  TResponse,
> {
  session: ExperimentSessionHook<TStimulus, TCondition, TResponse>;
  /** Display name, e.g. "Stroop" or "Flanker". */
  experimentName: string;
  configuration: ExperimentConfiguration<TStimulus, TCondition, TResponse>;
  /** Protocol background for the timed trial area. */
  stageBackground: string;
  stageClassName?: string;
  stageRef?: Ref<HTMLElement>;
  intro: ReactNode;
  /** Instructions screen; its h1 needs tabIndex={-1} to receive focus. */
  instructions: ReactNode;
  renderStimulus: (
    trial: EngineTrial<TStimulus, TCondition, TResponse>,
  ) => ReactNode;
  /** Optional aid shown with the stimulus during practice only. */
  renderPracticeAid?: () => ReactNode;
  /** Completes "Correct response: …" in practice feedback. */
  describeCorrectResponse: (
    record: TrialRecord<TStimulus, TCondition, TResponse>,
  ) => string;
  completionDescription: string;
  /** Results computed by the experiment from the session's own records. */
  results: ReactNode;
  /**
   * Shown on the paused screen when the session paused because the
   * presentation precondition failed; Resume stays disabled while
   * `canResume` is false.
   */
  presentationUnavailable?: { message: ReactNode; canResume: boolean };
}

interface SessionDialogProps {
  id: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Also on Escape. The cancel button has initial focus (the safe choice). */
  onCancel: () => void;
}

/** Modal confirmation used for Exit, leaving the page, and clearing data. */
function SessionDialog({
  id,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: SessionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });
  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLButtonElement>("[data-autofocus]")
      ?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelRef.current();
        return;
      }
      // Modal: Tab and Shift+Tab cycle through the dialog's buttons only.
      // (The content behind is inert, but the site header is not.)
      if (event.key !== "Tab") return;
      const buttons = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (!inside || document.activeElement === last)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return (
    <div
      className="experiment-confirm-backdrop"
      role="presentation"
      ref={dialogRef}
    >
      <Card
        as="div"
        elevated
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <p id={`${id}-description`}>{description}</p>
        <div className="experiment-actions">
          <Button type="button" variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-autofocus
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Shared participant chrome for experiment sessions: session bar, practice
 * and main trial stage, ready/break/paused/end screens, exit confirmation,
 * focus management, and scroll reset. Extracted from the Cycle 5 Stroop page.
 */
export function ExperimentSessionShell<
  TStimulus,
  TCondition extends string,
  TResponse,
>({
  session,
  experimentName,
  configuration,
  stageBackground,
  stageClassName,
  stageRef,
  intro,
  instructions,
  renderStimulus,
  renderPracticeAid,
  describeCorrectResponse,
  completionDescription,
  results,
  presentationUnavailable,
}: ExperimentSessionShellProps<TStimulus, TCondition, TResponse>) {
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const pausedForExitRef = useRef(false);
  const exitOpenerRef = useRef<HTMLElement | null>(null);
  const pausedForLeaveRef = useRef(false);
  const focusIntroRef = useRef(false);
  const { screen } = session;
  const active = ACTIVE_SCREENS.includes(screen);

  // Leaving the browser page (reload, close, another address) while a session
  // is active: the browser's own confirmation. Its wording is the browser's.
  useEffect(() => {
    if (!active) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);

  // Leaving within the app (links, Back, Forward) while a session is active.
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      active && currentLocation.pathname !== nextLocation.pathname,
    [active],
  );
  const blocker = useBlocker(shouldBlock);
  const leaveConfirmOpen = blocker.state === "blocked";

  // No trial runs behind the leave dialog. A stimulus already on screen
  // cannot be paused (protocol §7): it ends by response or deadline, and the
  // session pauses as soon as that trial is recorded.
  const { canPause, pauseSession, resumeSession } = session;
  const resumeAfterStayRef = useRef(false);
  useEffect(() => {
    if (!leaveConfirmOpen) {
      // Stay resumes only once the blocker has reset, so this effect cannot
      // pause the session again in between.
      if (resumeAfterStayRef.current) {
        resumeAfterStayRef.current = false;
        resumeSession();
      }
      return;
    }
    // Cleared only by Stay or Leave: a repeated navigation attempt can
    // briefly reset the blocker while the session stays paused.
    if (!pausedForLeaveRef.current && canPause) {
      pausedForLeaveRef.current = pauseSession();
    }
  }, [leaveConfirmOpen, canPause, pauseSession, resumeSession]);

  const stayInSession = () => {
    resumeAfterStayRef.current = pausedForLeaveRef.current;
    pausedForLeaveRef.current = false;
    blocker.reset?.();
  };
  const leaveSession = () => {
    pausedForLeaveRef.current = false;
    blocker.proceed?.();
  };

  const requestClear = () => {
    exitOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setClearConfirmOpen(true);
  };
  const cancelClear = () => {
    setClearConfirmOpen(false);
    if (exitOpenerRef.current?.isConnected) exitOpenerRef.current.focus();
    exitOpenerRef.current = null;
  };
  const confirmClear = () => {
    setClearConfirmOpen(false);
    exitOpenerRef.current = null;
    focusIntroRef.current = true;
    session.clearSession();
  };
  const dialogOpen = exitConfirmOpen || leaveConfirmOpen || clearConfirmOpen;

  useEffect(() => {
    // Each screen starts at the top so the session bar (progress, Pause,
    // Exit) is never left hidden under the sticky site header.
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTop = 0;
    const focusIntro = screen === "intro" && focusIntroRef.current;
    focusIntroRef.current = false;
    // Never take focus from an open dialog (the content behind it is inert).
    if (contentRef.current?.hasAttribute("inert")) return;
    if (FOCUSED_HEADING_SCREENS.includes(screen) || focusIntro) {
      const heading = contentRef.current?.querySelector<HTMLElement>("h1");
      // After clearing, focus moves to the start screen's heading so
      // keyboard and screen-reader users are not left on a removed button.
      if (focusIntro && heading && !heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }
      heading?.focus({ preventScroll: true });
    }
  }, [screen]);

  const closeExitConfirm = (resume: boolean) => {
    setExitConfirmOpen(false);
    const shouldResume = resume && pausedForExitRef.current;
    pausedForExitRef.current = false;
    if (shouldResume) {
      session.resumeSession();
    } else if (exitOpenerRef.current?.isConnected) {
      exitOpenerRef.current.focus();
    }
    exitOpenerRef.current = null;
  };

  const requestExit = () => {
    exitOpenerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // Pause first so no trial runs behind the confirmation dialog.
    pausedForExitRef.current = session.pauseSession();
    setExitConfirmOpen(true);
  };
  const confirmExit = () => {
    setExitConfirmOpen(false);
    pausedForExitRef.current = false;
    exitOpenerRef.current = null;
    session.abortSession();
  };

  const trialProgress =
    screen === "practice"
      ? `Practice ${session.activeTrial?.index ?? session.practiceIndex + 1} of ${configuration.practice.trialCount}`
      : screen === "main"
        ? `Trial ${session.activeTrial?.index ?? session.mainIndex + 1} of ${configuration.main.trialCount}`
        : null;

  const controlsLocked =
    (screen === "practice" || screen === "main") && !session.canPause;
  const presentationPause =
    screen === "paused" &&
    session.interruptionReason === "presentation_unavailable";
  const resumeDisabled =
    presentationPause && presentationUnavailable?.canResume === false;

  return (
    <div className="experiment-page">
      <div ref={contentRef} inert={dialogOpen}>
        {screen !== "intro" &&
        screen !== "instructions" &&
        screen !== "completed" &&
        screen !== "aborted" &&
        screen !== "technical" ? (
          <div
            className="experiment-session-bar"
            role="group"
            aria-label="Experiment controls"
          >
            <span className="experiment-progress">
              {trialProgress ?? `${experimentName} experiment`}
            </span>
            <div className="experiment-session-bar__actions">
              {PAUSABLE_SCREENS.includes(screen) ? (
                <Button
                  variant="ghost"
                  type="button"
                  disabled={controlsLocked}
                  onClick={session.pauseSession}
                >
                  Pause
                </Button>
              ) : null}
              <Button
                variant="secondary"
                type="button"
                disabled={controlsLocked}
                onClick={requestExit}
              >
                Exit
              </Button>
            </div>
          </div>
        ) : null}

        {screen === "intro" ? intro : null}

        {screen === "instructions" ? instructions : null}

        {screen === "practice" || screen === "main" ? (
          <section
            ref={stageRef}
            className={`experiment-trial-stage${stageClassName ? ` ${stageClassName}` : ""}`}
            aria-label={`Active ${experimentName} trial`}
            style={{ background: stageBackground }}
          >
            {/* Page heading for assistive technology (WCAG 1.3.1 / 2.4.6).
                Visually hidden: absolutely positioned and 1 px, so the
                visible trial presentation and stimulus layout are unchanged;
                never focused, never announced as a live change. */}
            <h1 className="visually-hidden">
              {experimentName}{" "}
              {screen === "practice" ? "practice trials" : "main trials"}
            </h1>
            {screen === "practice" ? (
              <Badge tone="warning">Practice</Badge>
            ) : (
              <Badge tone="neutral">Main task</Badge>
            )}

            {session.trialStage === "fixation" ? (
              <div className="experiment-fixation" aria-hidden="true">
                +
              </div>
            ) : null}

            {session.trialStage === "stimulus" && session.activeTrial
              ? renderStimulus(session.activeTrial)
              : null}

            {session.trialStage === "stimulus" &&
            screen === "practice" &&
            renderPracticeAid
              ? renderPracticeAid()
              : null}

            {session.trialStage === "feedback" && session.feedback ? (
              <Card as="div" className="experiment-feedback" role="status">
                {session.feedback.outcome.category === "correct" ? (
                  <h2>Correct</h2>
                ) : session.feedback.outcome.category === "incorrect" ? (
                  <h2>Incorrect</h2>
                ) : (
                  <h2>No response in time</h2>
                )}
                <p>
                  Correct response: {describeCorrectResponse(session.feedback)}
                </p>
              </Card>
            ) : null}
          </section>
        ) : null}

        {screen === "ready" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="success">Practice complete</Badge>
            <h1 tabIndex={-1}>Ready for the main task</h1>
            <p>
              The practice trials are separate from the{" "}
              {configuration.main.trialCount} main trials. There is no
              correctness feedback during the main task.
            </p>
            <div className="experiment-actions">
              <Button type="button" onClick={session.beginMain}>
                Start {configuration.main.trialCount} main trials
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "break" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="info">Optional break</Badge>
            <h1 tabIndex={-1}>Rest before continuing</h1>
            <p>
              You have completed the first{" "}
              {configuration.main.breakAfterTrialIndex} main trials. Take as
              much time as you need. This break is not a trial.
            </p>
            <div className="experiment-actions">
              <Button type="button" onClick={session.continueBreak}>
                Continue
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={session.skipBreak}
              >
                Skip break
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "paused" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="warning">Paused</Badge>
            <h1 tabIndex={-1}>Experiment paused</h1>
            <p>
              {session.pauseContext === "break"
                ? "Your break is paused."
                : session.pauseInvalidatedTrial
                  ? "The trial on screen when the pause happened is recorded as invalid and will not be repeated. The session continues with the next trial."
                  : "No trial was on screen. The session continues where it stopped."}
            </p>
            {presentationPause ? (
              presentationUnavailable?.message
            ) : session.interruptionReason ? (
              <p>
                The pause was triggered because the page was hidden or lost
                focus. This does not indicate misconduct or poor performance.
              </p>
            ) : null}
            <div className="experiment-actions">
              <Button
                type="button"
                disabled={resumeDisabled}
                onClick={session.resumeSession}
              >
                Resume
              </Button>
              <Button variant="secondary" type="button" onClick={requestExit}>
                Exit
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "completed" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="success">Completed</Badge>
            <h1 tabIndex={-1}>{experimentName} session complete</h1>
            <p>{completionDescription}</p>
            <div className="experiment-actions">
              <Link className="experiment-home-link" to="/experiments">
                Return to experiments
              </Link>
            </div>
          </Card>
        ) : null}

        {screen === "aborted" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="warning">Incomplete</Badge>
            <h1 tabIndex={-1}>Session ended</h1>
            <p>
              This session was exited before completion. Uncompleted trials are
              not represented as timeouts or valid outcomes.
            </p>
            <div className="experiment-actions">
              <Link className="experiment-home-link" to="/experiments">
                Return to experiments
              </Link>
              <Button
                variant="secondary"
                type="button"
                onClick={session.restartSession}
              >
                Restart
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "technical" ? (
          <Card elevated className="experiment-centered-card">
            <Badge tone="error">Technical error</Badge>
            <h1 tabIndex={-1}>The session cannot continue</h1>
            <p>
              A required seed or timing resource was unavailable. No experiment
              result or trial outcome was fabricated.
            </p>
            <div className="experiment-actions">
              <Link className="experiment-home-link" to="/experiments">
                Return to experiments
              </Link>
            </div>
          </Card>
        ) : null}
        <ClearSessionContext.Provider
          value={ENDED_RESULT_SCREENS.includes(screen) ? requestClear : null}
        >
          {results}
        </ClearSessionContext.Provider>
      </div>

      {exitConfirmOpen ? (
        <SessionDialog
          id="exit"
          title="Exit this session?"
          description="No trials run while you decide. If you exit, the session is marked incomplete and uncompleted trials are not fabricated."
          confirmLabel="Exit session"
          cancelLabel="Continue"
          onConfirm={confirmExit}
          onCancel={() => closeExitConfirm(true)}
        />
      ) : null}

      {leaveConfirmOpen ? (
        <SessionDialog
          id="leave"
          title="Leave this session?"
          description="It will end as incomplete and its data will be discarded."
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={leaveSession}
          onCancel={stayInSession}
        />
      ) : null}

      {clearConfirmOpen ? (
        <SessionDialog
          id="clear"
          title="Clear this session's data?"
          description="This session's trials and results will be removed from this page. This cannot be undone. Files you already downloaded are not affected."
          confirmLabel="Clear data"
          cancelLabel="Cancel"
          onConfirm={confirmClear}
          onCancel={cancelClear}
        />
      ) : null}
    </div>
  );
}
