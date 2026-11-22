import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageTitle } from "../../app/usePageTitle";
import { STROOP_CONFIGURATION, STROOP_RESPONSE_MAPPING } from "./stroop";
import { StroopKeyLegend } from "./StroopKeyLegend";
import { StroopResults } from "./StroopResults";
import { computeStroopResults } from "./stroopAnalysis";
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
  const { screen, getSnapshot } = session;

  // Results derive only from the engine's recorded trials, once the session
  // has ended. No trial is added, inferred, or modified here.
  const results = useMemo(() => {
    if (
      screen !== "completed" &&
      screen !== "aborted" &&
      screen !== "technical"
    ) {
      return null;
    }
    const snapshot = getSnapshot();
    if (!snapshot) return null;
    return computeStroopResults({
      status: snapshot.status,
      records: snapshot.records,
      breakTaken: snapshot.breakTaken,
      breakDurationMs: snapshot.breakDurationMs,
    });
  }, [getSnapshot, screen]);

  useEffect(() => {
    // Each screen starts at the top so the session bar (progress, Pause,
    // Exit) is never left hidden under the sticky site header.
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTop = 0;
    if (FOCUSED_HEADING_SCREENS.includes(screen)) {
      headingRef.current?.focus({ preventScroll: true });
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
              This educational task explores how responses can differ when a
              word's meaning agrees or conflicts with its ink color. Your job is
              to respond to the <strong>ink color</strong>, not to read the
              word. This is not a diagnosis, IQ test, or validated assessment of
              general ability.
            </p>
            <p>Use the keys shown below.</p>
            <StroopKeyLegend />
            <p>
              You can first check the key mapping and then complete 12 practice
              trials with feedback. The main task has 60 trials and no
              correctness feedback. Respond as accurately and promptly as you
              can. A trial ends after your first valid mapped key or after 2
              seconds if no valid mapped response is received.
            </p>
            <p>
              You may take or skip a self-paced break after trial 30. Your
              results describe this task session only. Browser timing, keyboard,
              and color perception can affect responses.
            </p>
            <h2 className="stroop-intro__subheading">Before you start</h2>
            <ul className="stroop-intro__list">
              <li>
                <strong>What is recorded:</strong> for each trial, the key you
                pressed (or none), whether it matched the ink color, and the
                time your browser measured. Nothing is saved or sent anywhere:
                the data stays in this page and is gone when you leave or reload
                it.
              </li>
              <li>
                <strong>You can stop at any time.</strong> You can pause or exit
                during the task, or simply leave this page. Leaving early is not
                a failure.
              </li>
              <li>
                This task may not work well, and you are welcome to stop, if you
                are unfamiliar with the English color words, cannot easily tell
                the four ink colors apart, or use a keyboard that does not type
                the letters D, F, J, and K.
              </li>
            </ul>
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
        {results ? <StroopResults results={results} /> : null}
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
