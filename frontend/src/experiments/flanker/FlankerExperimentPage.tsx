import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Feedback } from "../../components/ui/Feedback";
import { usePageTitle } from "../../app/usePageTitle";
import { ExperimentSessionShell } from "../shared/ExperimentSessionShell";
import { SessionResults } from "../shared/SessionResults";
import {
  FLANKER_CONFIGURATION,
  FLANKER_MAPPING_CHECK,
  FLANKER_PRESENTATION,
  FLANKER_RESPONSE_MAPPING,
  FLANKER_SYMBOLS,
  flankerArrayFitsViewport,
  evaluateMappingCheckKey,
} from "./flanker";
import { computeFlankerResults } from "./flankerAnalysis";
import {
  FLANKER_EXPORT_COLUMNS,
  FLANKER_RESULTS_COPY,
  flankerStimulusToApi,
} from "./flankerResultsCopy";
import { FlankerArray } from "./FlankerStimulus";
import { useFlankerSession } from "./useFlankerSession";
import "./FlankerExperiment.css";

interface FlankerExperimentPageProps {
  seedOverride?: number;
}

const L = FLANKER_SYMBOLS.left;
const R = FLANKER_SYMBOLS.right;
const D = FLANKER_SYMBOLS.neutral;

function directionLabel(key: string): string {
  return (
    FLANKER_RESPONSE_MAPPING.find((mapping) => mapping.responseValue === key)
      ?.label ?? key
  );
}

/**
 * Key reminder. During timed practice trials it is text only: arrow glyphs
 * near the stimulus would add directional distractors the protocol does not
 * specify.
 */
/**
 * Protocol §4: the whole array, centered in the trial area (the wrapper; the
 * stage has no horizontal padding), must be inside the visible window.
 */
function arrayFitsOnScreen(element: HTMLElement | null): boolean {
  if (!element) return false;
  return flankerArrayFitsViewport(
    element.getBoundingClientRect().left,
    element.clientWidth,
    document.documentElement.clientWidth,
  );
}

function FlankerKeyLegend({ showArrows = true }: { showArrows?: boolean }) {
  return (
    <dl className="flanker-legend" aria-label="Flanker response keys">
      <div>
        <dt>F</dt>
        <dd>Left{showArrows ? ` ${L}` : ""}</dd>
      </div>
      <div>
        <dt>J</dt>
        <dd>Right{showArrows ? ` ${R}` : ""}</dd>
      </div>
    </dl>
  );
}

interface MappingCheckState {
  step: number;
  /** Wrong mapped key pressed on the current step, if any. */
  wrongKey: string | null;
}

export function FlankerExperimentPage({
  seedOverride,
}: FlankerExperimentPageProps) {
  usePageTitle("Flanker experiment");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [arrayFits, setArrayFits] = useState(true);

  // Protocol §4: no timed trial starts unless the full 272 px array is
  // visible. Checked before every fixation and again at the onset frame.
  const canPresentStimulus = useCallback(
    () => arrayFitsOnScreen(wrapperRef.current),
    [],
  );
  const session = useFlankerSession(seedOverride, canPresentStimulus);
  const { screen, getSnapshot } = session;
  const [check, setCheck] = useState<MappingCheckState>({
    step: 0,
    wrongKey: null,
  });
  const checkComplete = check.step >= FLANKER_MAPPING_CHECK.length;

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const update = () => setArrayFits(arrayFitsOnScreen(element));
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);

  // Protocol §5 mapping check: F for the left arrow, then J for the right
  // arrow; a wrong mapped key repeats the prompt; other keys are ignored.
  useEffect(() => {
    if (screen !== "instructions") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      setCheck((current) => {
        const result = evaluateMappingCheckKey(
          current.step,
          event.key,
          event.repeat,
        );
        if (result === "advance")
          return { step: current.step + 1, wrongKey: null };
        if (result === "repeat") {
          return { step: current.step, wrongKey: event.key.toLowerCase() };
        }
        return current;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen]);

  // Results derive only from the engine's recorded trials once the session
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
    return {
      records: snapshot.records,
      status: snapshot.status,
      breakTaken: snapshot.breakTaken,
      breakDurationMs: snapshot.breakDurationMs,
      analysis: computeFlankerResults({
        status: snapshot.status,
        records: snapshot.records,
        breakTaken: snapshot.breakTaken,
        breakDurationMs: snapshot.breakDurationMs,
      }),
    };
  }, [getSnapshot, screen]);

  const tooNarrowMessage = (
    <Feedback tone="warning" title="Window too narrow">
      The arrows are shown at their exact size, as a row{" "}
      {FLANKER_PRESENTATION.arrayWidthPx} pixels wide that must fit fully inside
      your window. They are never shrunk, because their size and spacing are
      part of the experiment. Make the window wider (or rotate your device);
      Resume becomes available when the arrows fit. No trial was started or
      recorded.
    </Feedback>
  );

  const intro = (
    <Card elevated className="experiment-card">
      <Badge tone="info">Flanker experiment</Badge>
      <h1>Respond to the center arrow</h1>
      <p className="experiment-intro__summary">
        This educational task explores how responses to a center arrow can
        differ depending on the symbols around it. Respond to the{" "}
        <strong>center arrow only</strong> and ignore the four symbols around
        it. This is not a diagnosis, IQ estimate, or validated measure of
        general ability.
      </p>
      <p>Use these keys:</p>
      <FlankerKeyLegend />
      <p>Each trial shows a row of five symbols, for example:</p>
      <ul className="flanker-examples">
        <li>
          <span className="flanker-examples__symbols" aria-hidden="true">
            {R}
            {R}
            {R}
            {R}
            {R}
          </span>
          <span>
            <strong>Congruent:</strong> all arrows point the same way.
          </span>
        </li>
        <li>
          <span className="flanker-examples__symbols" aria-hidden="true">
            {L}
            {L}
            {R}
            {L}
            {L}
          </span>
          <span>
            <strong>Incongruent:</strong> the surrounding arrows point the other
            way.
          </span>
        </li>
        <li>
          <span className="flanker-examples__symbols" aria-hidden="true">
            {D}
            {D}
            {R}
            {D}
            {D}
          </span>
          <span>
            <strong>Neutral:</strong> dashes surround the center arrow.
          </span>
        </li>
      </ul>
      <p>In each example the center arrow points right, so the answer is J.</p>
      <p>
        First, you will check the key mapping and complete 12 practice trials
        with feedback. Then you will complete 60 main trials without correctness
        feedback. Respond as accurately and promptly as you can. A trial ends
        after your first valid response or after 2 seconds if no valid response
        is received. You may take or skip a break after trial 30.
      </p>
      <p>
        Your results describe this task session only. Browser timing, keyboard,
        and display differences can affect responses.
      </p>
      <h2 className="experiment-intro__subheading">Before you start</h2>
      <ul className="experiment-intro__list">
        <li>
          <strong>What is recorded:</strong> for each trial, the key you pressed
          (or none), whether it matched the center arrow, and the time your
          browser measured. Nothing is saved or sent anywhere: the data stays in
          this page and is gone when you leave or reload it.
        </li>
        <li>
          <strong>You can stop at any time.</strong> You can pause or exit
          during the task, or simply leave this page. Leaving early is not a
          failure.
        </li>
        <li>
          <strong>Keyboard only:</strong> Tab moves between buttons and Enter
          presses them. During trials, only F and J are used.
        </li>
        <li>
          This task may not work well, and you are welcome to stop, if you
          cannot comfortably see the arrows or use the F and J keys, or if your
          keyboard does not type those letters. The arrows are a row{" "}
          {FLANKER_PRESENTATION.arrayWidthPx} pixels wide that must fit fully
          inside your window.
        </li>
      </ul>
      {!arrayFits ? tooNarrowMessage : null}
      <div className="experiment-actions">
        <Button type="button" onClick={() => session.beginSession()}>
          Start Flanker
        </Button>
      </div>
    </Card>
  );

  const currentCheck = FLANKER_MAPPING_CHECK[check.step];
  const instructions = (
    <Card elevated className="experiment-card">
      <Badge tone="info">Instructions</Badge>
      <h1 tabIndex={-1}>Check the response keys</h1>
      <p>
        Press the key for the arrow shown. F means Left; J means Right. This
        check is not timed or scored.
      </p>
      <FlankerKeyLegend />
      <div
        className="flanker-check-panel"
        style={{ background: FLANKER_PRESENTATION.background }}
      >
        {currentCheck ? (
          <>
            <FlankerArray
              cells={[FLANKER_SYMBOLS[currentCheck.targetDirection]]}
              className="flanker-check-arrow"
            />
            <span className="flanker-visually-hidden">
              Arrow pointing {currentCheck.targetDirection}
            </span>
          </>
        ) : null}
      </div>
      <p className="flanker-check-status" role="status">
        {checkComplete
          ? "Both keys recognized. You can begin the practice trials."
          : check.wrongKey && currentCheck
            ? `That key means ${directionLabel(check.wrongKey)}. This arrow points ${currentCheck.targetDirection}: press ${currentCheck.requiredKey.toUpperCase()}.`
            : `Step ${check.step + 1} of ${FLANKER_MAPPING_CHECK.length}: press the key for this arrow.`}
      </p>
      <div className="experiment-actions">
        <Button
          type="button"
          disabled={!checkComplete}
          onClick={() => {
            setCheck({ step: 0, wrongKey: null });
            session.beginPractice();
          }}
        >
          Begin 12 practice trials
        </Button>
      </div>
    </Card>
  );

  return (
    <div ref={wrapperRef}>
      <ExperimentSessionShell
        session={session}
        experimentName="Flanker"
        configuration={FLANKER_CONFIGURATION}
        stageBackground={FLANKER_PRESENTATION.background}
        stageClassName="flanker-trial-stage"
        intro={intro}
        instructions={instructions}
        renderStimulus={(trial) => (
          <FlankerArray cells={trial.stimulus.cells} />
        )}
        renderPracticeAid={() => <FlankerKeyLegend showArrows={false} />}
        describeCorrectResponse={(record) =>
          `${directionLabel(record.correctResponse)} (${record.correctResponse.toUpperCase()})`
        }
        completionDescription="You completed the Flanker task. The task explores condition differences in responding to a center arrow surrounded by arrows pointing the same way, arrows pointing the other way, or dashes. This screen does not provide a cognitive score or diagnosis."
        results={
          results ? (
            <SessionResults
              results={results.analysis}
              copy={FLANKER_RESULTS_COPY}
              responseWindowMs={FLANKER_CONFIGURATION.main.responseDeadlineMs}
              exportData={{
                experimentId: "flanker",
                records: results.records,
                stimulusColumns: FLANKER_EXPORT_COLUMNS,
              }}
              saveData={{
                experimentId: "flanker",
                status: results.status,
                records: results.records,
                breakTaken: results.breakTaken,
                breakDurationMs: results.breakDurationMs,
                stimulusToApi: flankerStimulusToApi,
              }}
            />
          ) : null
        }
        presentationUnavailable={{
          message: tooNarrowMessage,
          canResume: arrayFits,
        }}
      />
    </div>
  );
}
