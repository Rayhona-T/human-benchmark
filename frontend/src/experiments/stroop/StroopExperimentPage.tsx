import { useEffect, useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { usePageTitle } from "../../app/usePageTitle";
import { ExperimentSessionShell } from "../shared/ExperimentSessionShell";
import { STROOP_CONFIGURATION, STROOP_RESPONSE_MAPPING } from "./stroop";
import { StroopKeyLegend } from "./StroopKeyLegend";
import { StroopResults } from "./StroopResults";
import { computeStroopResults } from "./stroopAnalysis";
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

  const intro = (
    <Card elevated className="experiment-card">
      <Badge tone="info">Stroop experiment</Badge>
      <h1>Respond to the ink color</h1>
      <p className="experiment-intro__summary">
        This educational task explores how responses can differ when a word's
        meaning agrees or conflicts with its ink color. Your job is to respond
        to the <strong>ink color</strong>, not to read the word. This is not a
        diagnosis, IQ test, or validated assessment of general ability.
      </p>
      <p>Use the keys shown below.</p>
      <StroopKeyLegend />
      <p>
        You can first check the key mapping and then complete 12 practice trials
        with feedback. The main task has 60 trials and no correctness feedback.
        Respond as accurately and promptly as you can. A trial ends after your
        first valid mapped key or after 2 seconds if no valid mapped response is
        received.
      </p>
      <p>
        You may take or skip a self-paced break after trial 30. Your results
        describe this task session only. Browser timing, keyboard, and color
        perception can affect responses.
      </p>
      <h2 className="experiment-intro__subheading">Before you start</h2>
      <ul className="experiment-intro__list">
        <li>
          <strong>What is recorded:</strong> for each trial, the key you pressed
          (or none), whether it matched the ink color, and the time your browser
          measured. Nothing is saved or sent anywhere: the data stays in this
          page and is gone when you leave or reload it.
        </li>
        <li>
          <strong>You can stop at any time.</strong> You can pause or exit
          during the task, or simply leave this page. Leaving early is not a
          failure.
        </li>
        <li>
          This task may not work well, and you are welcome to stop, if you are
          unfamiliar with the English color words, cannot easily tell the four
          ink colors apart, or use a keyboard that does not type the letters D,
          F, J, and K.
        </li>
      </ul>
      <div className="experiment-actions">
        <Button type="button" onClick={() => session.beginSession()}>
          Start Stroop
        </Button>
      </div>
    </Card>
  );

  return (
    <ExperimentSessionShell
      session={session}
      experimentName="Stroop"
      configuration={STROOP_CONFIGURATION}
      stageBackground={STROOP_CONFIGURATION.stimulusDefinition.background}
      intro={intro}
      instructions={
        <Card elevated className="experiment-card">
          <Badge tone="info">Instructions</Badge>
          <h1 tabIndex={-1}>Check the response keys</h1>
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
          <div className="experiment-actions">
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
      }
      renderStimulus={(trial) => <StroopStimulus stimulus={trial.stimulus} />}
      renderPracticeAid={() => <StroopKeyLegend />}
      describeCorrectResponse={(record) => {
        const mapping = STROOP_RESPONSE_MAPPING.find(
          (item) => item.responseValue === record.correctResponse,
        );
        return `${mapping?.label} (${record.correctResponse.toUpperCase()})`;
      }}
      completionDescription="You completed the Stroop task. The task explores condition differences in responding to ink color while words with competing meanings are present. This screen does not provide a cognitive score or diagnosis."
      results={results ? <StroopResults results={results} /> : null}
    />
  );
}
