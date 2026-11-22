import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageTitle } from "../../app/usePageTitle";
import { STROOP_CONFIGURATION, STROOP_RESPONSE_MAPPING } from "./stroop";
import { StroopKeyLegend } from "./StroopKeyLegend";
import { StroopStimulus } from "./StroopStimulus";
import { useStroopSession, type StroopScreen } from "./useStroopSession";
import "./StroopExperiment.css";

interface StroopExperimentPageProps {
  seedOverride?: number;
}

/** Screens whose heading receives focus when they appear. */
const FOCUSED_HEADING_SCREENS: readonly StroopScreen[] = [
  "instructions",
  "ready",
  "break",
  "paused",
  "completed",
  "aborted",
  "technical",
];

const PAUSABLE_SCREENS: readonly StroopScreen[] = ["practice", "main", "break"];

export function StroopExperimentPage({
  seedOverride,
}: StroopExperimentPageProps) {
  usePageTitle("Stroop experiment");
  const session = useStroopSession(seedOverride);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitDialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pausedForExitRef = useRef(false);
  const exitOpenerRef = useRef<HTMLElement | null>(null);
  const keyCheckComplete = checkedKeys.size === STROOP_RESPONSE_MAPPING.length;
  const { screen } = session;

  useEffect(() => {
    if (FOCUSED_HEADING_SCREENS.includes(screen)) {
      headingRef.current?.focus();
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "instructions") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const mapping = STROOP_RESPONSE_MAPPING.find(
        (item) => item.logicalKey.toLowerCase() === event.key.toLowerCase(),
      );
      if (!mapping) return;
      setCheckedKeys((current) => {
        const next = new Set(current);
        next.add(mapping.logicalKey);
        return next;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      ? `Practice ${session.activeTrial?.index ?? session.practiceIndex + 1} of ${STROOP_CONFIGURATION.practice.trialCount}`
      : screen === "main"
        ? `Trial ${session.activeTrial?.index ?? session.mainIndex + 1} of ${STROOP_CONFIGURATION.main.trialCount}`
        : null;

  const controlsLocked =
    (screen === "practice" || screen === "main") && !session.canPause;

  const correctFeedbackMapping = STROOP_RESPONSE_MAPPING.find(
    (mapping) => mapping.responseValue === session.feedback?.correctResponse,
  );

  return (
    <div className="stroop-page">
      <div inert={exitConfirmOpen}>
        {screen !== "intro" &&
        screen !== "instructions" &&
        screen !== "completed" &&
        screen !== "aborted" &&
        screen !== "technical" ? (
          <div
            className="stroop-session-bar"
            role="group"
            aria-label="Experiment controls"
          >
            <span className="stroop-progress">
              {trialProgress ?? "Stroop experiment"}
            </span>
            <div className="stroop-session-bar__actions">
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

        {screen === "intro" ? (
          <Card elevated className="stroop-intro">
            <Badge tone="info">Stroop experiment</Badge>
            <h1>Respond to the ink color</h1>
            <p className="stroop-intro__summary">
              This educational task explores how a word's meaning may compete
              with the color used to display it. It is not a diagnosis, IQ test,
              or validated assessment of general ability.
            </p>
            <p>
              You will complete 12 practice trials and 60 main trials. Respond
              with the key shown for the ink color, not the word's meaning.
              Speed and accuracy are both recorded.
            </p>
            <p className="stroop-intro__timing">
              A session typically takes several minutes, depending on response
              pace and whether you take the optional break. Browser, keyboard,
              display, and device timing may affect recorded reaction times.
            </p>
            <StroopKeyLegend />
            <div className="stroop-actions">
              <Button type="button" onClick={() => session.beginSession()}>
                Start Stroop
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "instructions" ? (
          <Card elevated className="stroop-instructions">
            <Badge tone="info">Instructions</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Check the response keys
            </h1>
            <p>
              Press each key once. The task is to respond to the ink color,
              regardless of the word you see.
            </p>
            <StroopKeyLegend />
            <div className="stroop-key-check" aria-live="polite">
              {STROOP_RESPONSE_MAPPING.map((mapping) => (
                <Badge
                  key={mapping.logicalKey}
                  tone={
                    checkedKeys.has(mapping.logicalKey) ? "success" : "neutral"
                  }
                >
                  {mapping.logicalKey.toUpperCase()} = {mapping.label}:{" "}
                  {checkedKeys.has(mapping.logicalKey)
                    ? "recognized"
                    : "not pressed yet"}
                </Badge>
              ))}
            </div>
            <div className="stroop-actions">
              <Button
                type="button"
                disabled={!keyCheckComplete}
                onClick={() => {
                  setCheckedKeys(new Set());
                  session.beginPractice();
                }}
              >
                Begin 12 practice trials
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "practice" || screen === "main" ? (
          <section
            className="stroop-trial-stage"
            aria-label="Active Stroop trial"
            style={{
              background: STROOP_CONFIGURATION.stimulusDefinition.background,
            }}
          >
            {screen === "practice" ? (
              <Badge tone="warning">Practice</Badge>
            ) : (
              <Badge tone="neutral">Main task</Badge>
            )}

            {session.trialStage === "fixation" ? (
              <div className="stroop-fixation" aria-hidden="true">
                +
              </div>
            ) : null}

            {session.trialStage === "stimulus" && session.activeTrial ? (
              <StroopStimulus stimulus={session.activeTrial.stimulus} />
            ) : null}

            {session.trialStage === "stimulus" && screen === "practice" ? (
              <StroopKeyLegend />
            ) : null}

            {session.trialStage === "feedback" && session.feedback ? (
              <Card className="stroop-feedback" role="status">
                {session.feedback.outcome.category === "correct" ? (
                  <h2>Correct</h2>
                ) : session.feedback.outcome.category === "incorrect" ? (
                  <h2>Incorrect</h2>
                ) : (
                  <h2>No response in time</h2>
                )}
                <p>
                  Correct response: {correctFeedbackMapping?.label} (
                  {session.feedback.correctResponse.toUpperCase()})
                </p>
              </Card>
            ) : null}
          </section>
        ) : null}

        {screen === "ready" ? (
          <Card elevated className="stroop-centered-card">
            <Badge tone="success">Practice complete</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Ready for the main task
            </h1>
            <p>
              The practice trials are separate from the 60 main trials. There is
              no correctness feedback during the main task.
            </p>
            <div className="stroop-actions">
              <Button type="button" onClick={session.beginMain}>
                Start 60 main trials
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "break" ? (
          <Card elevated className="stroop-centered-card">
            <Badge tone="info">Optional break</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Rest before continuing
            </h1>
            <p>
              You have completed the first 30 main trials. Take as much time as
              you need. This break is not a trial.
            </p>
            <div className="stroop-actions">
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
          <Card elevated className="stroop-centered-card">
            <Badge tone="warning">Paused</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Experiment paused
            </h1>
            <p>
              {session.pauseContext === "break"
                ? "Your break is paused."
                : session.pauseInvalidatedTrial
                  ? "The trial on screen when the pause happened is recorded as invalid and will not be repeated. The session continues with the next trial."
                  : "No trial was on screen. The session continues where it stopped."}
            </p>
            {session.interruptionReason ? (
              <p>
                The pause was triggered because the page was hidden or lost
                focus. This does not indicate misconduct or poor performance.
              </p>
            ) : null}
            <div className="stroop-actions">
              <Button type="button" onClick={session.resumeSession}>
                Resume
              </Button>
              <Button variant="secondary" type="button" onClick={requestExit}>
                Exit
              </Button>
            </div>
          </Card>
        ) : null}

        {screen === "completed" ? (
          <Card elevated className="stroop-centered-card">
            <Badge tone="success">Completed</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Stroop session complete
            </h1>
            <p>
              You completed the Stroop task. The task explores condition
              differences in responding to ink color while words with competing
              meanings are present. This screen does not provide a cognitive
              score or diagnosis.
            </p>
            <div className="stroop-actions">
              <Link className="stroop-home-link" to="/experiments">
                Return to experiments
              </Link>
            </div>
          </Card>
        ) : null}

        {screen === "aborted" ? (
          <Card elevated className="stroop-centered-card">
            <Badge tone="warning">Incomplete</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              Session ended
            </h1>
            <p>
              This session was exited before completion. Uncompleted trials are
              not represented as timeouts or valid outcomes.
            </p>
            <div className="stroop-actions">
              <Link className="stroop-home-link" to="/experiments">
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
          <Card elevated className="stroop-centered-card">
            <Badge tone="error">Technical error</Badge>
            <h1 ref={headingRef} tabIndex={-1}>
              The session cannot continue
            </h1>
            <p>
              A required seed or timing resource was unavailable. No experiment
              result or trial outcome was fabricated.
            </p>
            <div className="stroop-actions">
              <Link className="stroop-home-link" to="/experiments">
                Return to experiments
              </Link>
            </div>
          </Card>
        ) : null}
      </div>

      {exitConfirmOpen ? (
        <div
          className="stroop-confirm-backdrop"
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
            <div className="stroop-actions">
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
