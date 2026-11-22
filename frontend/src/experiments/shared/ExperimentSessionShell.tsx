import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router-dom";
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
  const exitDialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pausedForExitRef = useRef(false);
  const exitOpenerRef = useRef<HTMLElement | null>(null);
  const { screen } = session;

  useEffect(() => {
    // Each screen starts at the top so the session bar (progress, Pause,
    // Exit) is never left hidden under the sticky site header.
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTop = 0;
    if (FOCUSED_HEADING_SCREENS.includes(screen)) {
      contentRef.current
        ?.querySelector<HTMLElement>("h1")
        ?.focus({ preventScroll: true });
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

  useEffect(() => {
    if (!exitConfirmOpen) return;
    exitDialogRef.current
      ?.querySelector<HTMLButtonElement>("[data-autofocus]")
      ?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExitConfirm(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

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
      <div ref={contentRef} inert={exitConfirmOpen}>
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
              <Card className="experiment-feedback" role="status">
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
        {results}
      </div>

      {exitConfirmOpen ? (
        <div
          className="experiment-confirm-backdrop"
          role="presentation"
          ref={exitDialogRef}
        >
          <Card
            elevated
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-description"
          >
            <h2 id="exit-title">Exit this session?</h2>
            <p id="exit-description">
              No trials run while you decide. If you exit, the session is marked
              incomplete and uncompleted trials are not fabricated.
            </p>
            <div className="experiment-actions">
              <Button type="button" variant="danger" onClick={confirmExit}>
                Exit session
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-autofocus
                onClick={() => closeExitConfirm(true)}
              >
                Continue
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
