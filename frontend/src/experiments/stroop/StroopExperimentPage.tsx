import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageTitle } from "../../app/usePageTitle";
import { STROOP_RESPONSE_MAPPING } from "./stroop";
import { StroopKeyLegend } from "./StroopKeyLegend";
import { StroopStimulus } from "./StroopStimulus";
import { useStroopSession } from "./useStroopSession";
import "./StroopExperiment.css";

interface StroopExperimentPageProps {
  seedOverride?: number;
}

export function StroopExperimentPage({
  seedOverride,
}: StroopExperimentPageProps) {
  usePageTitle("Stroop experiment");
  const session = useStroopSession(seedOverride);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const exitContinueRef = useRef<HTMLButtonElement>(null);
  const keyCheckComplete = checkedKeys.size === STROOP_RESPONSE_MAPPING.length;

  useEffect(() => {
    if (session.screen !== "instructions") return;
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
  }, [session.screen]);

  useEffect(() => {
    if (!exitConfirmOpen) return;
    exitContinueRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExitConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [exitConfirmOpen]);

  const requestExit = () => setExitConfirmOpen(true);
  const confirmExit = () => {
    setExitConfirmOpen(false);
    session.abortSession();
  };

  const trialProgress =
    session.screen === "practice"
      ? `Practice ${session.activeTrial?.index ?? session.practiceIndex + 1} of 12`
      : session.screen === "main"
        ? `Trial ${session.activeTrial?.index ?? session.mainIndex + 1} of 60`
        : null;

  return (
    <div className="stroop-page">
      {session.screen !== "intro" &&
      session.screen !== "instructions" &&
      session.screen !== "completed" &&
      session.screen !== "aborted" &&
      session.screen !== "technical" ? (
        <div className="stroop-session-bar" aria-label="Experiment controls">
          {trialProgress ? (
            <span className="stroop-progress" aria-live="polite">
              {trialProgress}
            </span>
          ) : (
            <span className="stroop-progress">Stroop experiment</span>
          )}
          <div className="stroop-session-bar__actions">
            {session.screen !== "paused" ? (
              <Button
                variant="ghost"
                type="button"
                onClick={session.pauseSession}
              >
                Pause
              </Button>
            ) : null}
            <Button variant="secondary" type="button" onClick={requestExit}>
              Exit
            </Button>
          </div>
        </div>
      ) : null}

      {session.screen === "intro" ? (
        <Card elevated className="stroop-intro">
          <Badge tone="info">Stroop experiment</Badge>
          <h1>Respond to the ink color</h1>
          <p className="stroop-intro__summary">
            This educational task explores how a word's meaning may compete with
            the color used to display it. It is not a diagnosis, IQ test, or
            validated assessment of general ability.
          </p>
          <p>
            You will complete 12 practice trials and 60 main trials. Respond
            with the key shown for the ink color, not the word's meaning. Speed
            and accuracy are both recorded.
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

      {session.screen === "instructions" ? (
        <Card elevated className="stroop-instructions">
          <Badge tone="info">Instructions</Badge>
          <h1>Check the response keys</h1>
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
                {mapping.logicalKey.toUpperCase()}{" "}
                {checkedKeys.has(mapping.logicalKey)
                  ? "checked"
                  : "not checked"}
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

      {session.screen === "practice" || session.screen === "main" ? (
        <section
          className="stroop-trial-stage"
          aria-label="Active Stroop trial"
        >
          {session.screen === "practice" ? (
            <Badge tone="warning">Practice</Badge>
          ) : (
            <Badge tone="neutral">Main task</Badge>
          )}

          {session.trialStage === "fixation" ? (
            <div className="stroop-fixation" aria-label="Fixation">
              +
            </div>
          ) : null}

          {session.trialStage === "stimulus" && session.activeTrial ? (
            <StroopStimulus stimulus={session.activeTrial.stimulus} />
          ) : null}

          {session.trialStage === "stimulus" &&
          session.screen === "practice" ? (
            <StroopKeyLegend />
          ) : null}

          {session.trialStage === "feedback" && session.feedback ? (
            <Card className="stroop-feedback">
              {session.feedback.outcome.category === "correct" ? (
                <h2>Correct</h2>
              ) : session.feedback.outcome.category === "incorrect" ? (
                <h2>Incorrect</h2>
              ) : (
                <h2>No mapped response</h2>
              )}
              <p>
                Correct response:{" "}
                {
                  STROOP_RESPONSE_MAPPING.find(
                    (mapping) =>
                      mapping.responseValue ===
                      session.feedback?.correctResponse,
                  )?.label
                }{" "}
                ({session.feedback.correctResponse.toUpperCase()})
              </p>
            </Card>
          ) : null}

          {session.trialStage === "iti" ? (
            <div className="stroop-iti" aria-hidden="true" />
          ) : null}
        </section>
      ) : null}

      {session.screen === "ready" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="success">Practice complete</Badge>
          <h1>Ready for the main task</h1>
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

      {session.screen === "break" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="info">Optional break</Badge>
          <h1>Rest before continuing</h1>
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

      {session.screen === "paused" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="warning">Paused</Badge>
          <h1>Experiment paused</h1>
          <p>
            {session.pauseContext === "break"
              ? "Your break is paused."
              : "The active session is paused. The interrupted trial was not replayed as valid."}
          </p>
          {session.interruptionReason ? (
            <p>
              The pause was triggered by a page visibility or focus
              interruption. This does not indicate misconduct or poor
              performance.
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

      {session.screen === "completed" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="success">Completed</Badge>
          <h1>Stroop session complete</h1>
          <p>
            You completed the Stroop task. The task explores condition
            differences in responding to ink color while words with competing
            meanings are present. This screen does not provide a cognitive score
            or diagnosis.
          </p>
          <div className="stroop-actions">
            <Link className="stroop-home-link" to="/experiments">
              Return to experiments
            </Link>
          </div>
        </Card>
      ) : null}

      {session.screen === "aborted" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="warning">Incomplete</Badge>
          <h1>Session ended</h1>
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

      {session.screen === "technical" ? (
        <Card elevated className="stroop-centered-card">
          <Badge tone="error">Technical error</Badge>
          <h1>The session could not start</h1>
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

      {exitConfirmOpen ? (
        <div className="stroop-confirm-backdrop" role="presentation">
          <Card
            elevated
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            aria-describedby="exit-description"
          >
            <h2 id="exit-title">Exit this session?</h2>
            <p id="exit-description">
              Your completed trials may remain in this session, but uncompleted
              trials will not be fabricated.
            </p>
            <div className="stroop-actions">
              <Button type="button" variant="danger" onClick={confirmExit}>
                Exit session
              </Button>
              <Button
                type="button"
                variant="secondary"
                ref={exitContinueRef}
                onClick={() => setExitConfirmOpen(false)}
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
