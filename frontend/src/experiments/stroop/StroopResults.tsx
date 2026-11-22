import type { ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Feedback } from "../../components/ui/Feedback";
import type { StroopCondition } from "./stroop";
import {
  RT_DISPLAY_MINIMUM_CORRECT,
  type ConditionResult,
  type ContrastResult,
  type InvalidReason,
  type MedianValue,
  type RateValue,
  type StroopSessionResults,
} from "./stroopAnalysis";
import {
  CONDITION_EXAMPLE,
  CONDITION_LABEL,
  CONTRAST_TITLE,
  INVALID_REASON_LABEL,
  MINUS,
  describeRateContrast,
  describeRtContrast,
  formatMs,
  formatPercent,
  formatSignedMs,
  formatSignedPoints,
} from "./stroopResultsFormat";
import "./StroopResults.css";

function RateCell({ value }: { value: RateValue }) {
  if (!value.available) {
    return (
      <span className="stroop-results__unavailable">
        Unavailable (0 trials)
      </span>
    );
  }
  return (
    <>
      <span className="stroop-results__value">
        {formatPercent(value.value)}
      </span>
      <span className="stroop-results__count">
        {value.numerator} of {value.denominator}
      </span>
    </>
  );
}

function MedianCell({
  value,
  correct,
}: {
  value: MedianValue;
  correct: number;
}) {
  if (!value.available) {
    return (
      <span className="stroop-results__unavailable">
        Not shown: {correct} correct (minimum {RT_DISPLAY_MINIMUM_CORRECT})
      </span>
    );
  }
  return (
    <>
      <span className="stroop-results__value">{formatMs(value.valueMs)}</span>
      <span className="stroop-results__count">from {value.count} correct</span>
    </>
  );
}

function ConditionTable({
  conditions,
}: {
  conditions: readonly ConditionResult[];
}) {
  const rows: {
    label: string;
    hint?: string;
    cell: (condition: ConditionResult) => ReactNode;
  }[] = [
    {
      label: "Recorded trials",
      cell: (c) => c.counts.recorded,
    },
    { label: "Correct", cell: (c) => c.counts.correct },
    { label: "Incorrect", cell: (c) => c.counts.incorrect },
    { label: "Timeouts", cell: (c) => c.counts.timeout },
    {
      label: "Invalid (excluded)",
      cell: (c) => c.counts.invalid,
    },
    {
      label: "Response accuracy",
      hint: "correct ÷ (correct + incorrect)",
      cell: (c) => <RateCell value={c.rates.responseAccuracy} />,
    },
    {
      label: "Successful response rate",
      hint: "correct ÷ (correct + incorrect + timeouts)",
      cell: (c) => <RateCell value={c.rates.successfulResponseRate} />,
    },
    {
      label: "Timeout rate",
      hint: "timeouts ÷ (correct + incorrect + timeouts)",
      cell: (c) => <RateCell value={c.rates.timeoutRate} />,
    },
    {
      label: "Median correct response time",
      hint: `correct responses only; shown with ${RT_DISPLAY_MINIMUM_CORRECT}+`,
      cell: (c) => (
        <MedianCell value={c.medianCorrectRt} correct={c.correctRtCount} />
      ),
    },
  ];

  return (
    <div
      className="stroop-results__table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Results by condition table"
    >
      <table className="stroop-results__table">
        <caption>Main-trial results by condition (practice excluded)</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {conditions.map((condition) => (
              <th scope="col" key={condition.condition}>
                {CONDITION_LABEL[condition.condition]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {row.label}
                {row.hint ? (
                  <span className="stroop-results__hint">{row.hint}</span>
                ) : null}
              </th>
              {conditions.map((condition) => (
                <td key={condition.condition}>{row.cell(condition)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContrastCard({ contrast }: { contrast: ContrastResult }) {
  const rtFirst = CONDITION_LABEL[contrast.rtFirst];
  const rtSecond = CONDITION_LABEL[contrast.rtSecond];
  const rateFirst = CONDITION_LABEL[contrast.rateFirst];
  const rateSecond = CONDITION_LABEL[contrast.rateSecond];
  const entries: {
    label: string;
    formula: string;
    value: string | null;
    sentence: string;
  }[] = [
    {
      label: "Median correct response time",
      formula: `${rtFirst} ${MINUS} ${rtSecond}`,
      value: contrast.reactionTime.available
        ? formatSignedMs(contrast.reactionTime.valueMs)
        : null,
      sentence: describeRtContrast(contrast, contrast.reactionTime),
    },
    {
      label: "Response accuracy",
      formula: `${rateFirst} ${MINUS} ${rateSecond}`,
      value: contrast.responseAccuracy.available
        ? formatSignedPoints(contrast.responseAccuracy.value)
        : null,
      sentence: describeRateContrast(
        contrast,
        "response accuracy",
        contrast.responseAccuracy,
      ),
    },
    {
      label: "Successful response rate",
      formula: `${rateFirst} ${MINUS} ${rateSecond}`,
      value: contrast.successfulResponseRate.available
        ? formatSignedPoints(contrast.successfulResponseRate.value)
        : null,
      sentence: describeRateContrast(
        contrast,
        "the successful response rate",
        contrast.successfulResponseRate,
      ),
    },
  ];

  return (
    <Card as="section" className="stroop-results__contrast">
      <h3>{CONTRAST_TITLE[contrast.id]}</h3>
      <p className="stroop-results__contrast-pair">
        {rtFirst} vs {rtSecond} trials
      </p>
      <dl className="stroop-results__contrast-list">
        {entries.map((entry) => (
          <div key={entry.label} className="stroop-results__contrast-item">
            <dt>
              {entry.label}{" "}
              <span className="stroop-results__hint">{entry.formula}</span>
            </dt>
            <dd>
              {entry.value ? (
                <span className="stroop-results__value">{entry.value}</span>
              ) : null}
              <span className="stroop-results__sentence">{entry.sentence}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function describeBreak(results: StroopSessionResults): string {
  if (results.breakTaken) {
    const seconds =
      results.breakDurationMs === null
        ? null
        : Math.round(results.breakDurationMs / 1000);
    return seconds === null ? "Taken" : `Taken (about ${seconds} s)`;
  }
  // Engine convention: SKIP_BREAK records duration 0; otherwise it stays null.
  return results.breakDurationMs === 0 ? "Skipped" : "Not reached";
}

export function StroopResults({ results }: { results: StroopSessionResults }) {
  const invalidEntries = Object.entries(results.invalidReasons) as [
    InvalidReason,
    number,
  ][];

  return (
    <div className="stroop-results">
      <section
        aria-labelledby="results-status"
        className="stroop-results__section"
      >
        <h2 id="results-status">Session status</h2>
        <p>
          {results.isComplete ? (
            <Badge tone="success">Complete</Badge>
          ) : results.status === "technical_error" ? (
            <Badge tone="error">Stopped by a technical error</Badge>
          ) : (
            <Badge tone="warning">Incomplete</Badge>
          )}
        </p>
        <p>
          {results.isComplete
            ? `All ${results.plannedMainTrials} scheduled main trials were presented. The results below describe this one session only.`
            : `The session ended before all ${results.plannedMainTrials} main trials were presented, so only trial counts are shown. Condition results and comparisons are calculated only for complete sessions.`}
        </p>
      </section>

      <section
        aria-labelledby="results-recorded"
        className="stroop-results__section"
      >
        <h2 id="results-recorded">What was recorded</h2>
        <dl className="stroop-results__stats">
          <div>
            <dt>Main trials presented</dt>
            <dd>
              {results.main.recorded} of {results.plannedMainTrials}
            </dd>
          </div>
          <div>
            <dt>Correct</dt>
            <dd>{results.main.correct}</dd>
          </div>
          <div>
            <dt>Incorrect</dt>
            <dd>{results.main.incorrect}</dd>
          </div>
          <div>
            <dt>Timeouts (no key within 2 s)</dt>
            <dd>{results.main.timeout}</dd>
          </div>
          <div>
            <dt>Invalid (excluded from rates)</dt>
            <dd>{results.main.invalid}</dd>
          </div>
          <div>
            <dt>Not presented</dt>
            <dd>{results.unpresentedMain}</dd>
          </div>
          <div>
            <dt>Practice trials (not analysed)</dt>
            <dd>
              {results.practiceRecorded} of {results.plannedPracticeTrials}
            </dd>
          </div>
          <div>
            <dt>Optional break</dt>
            <dd>{describeBreak(results)}</dd>
          </div>
        </dl>
        {invalidEntries.length > 0 ? (
          <p className="stroop-results__note">
            Invalid trials and reasons:{" "}
            {invalidEntries
              .map(
                ([reason, count]) =>
                  `${count} × ${INVALID_REASON_LABEL[reason]}`,
              )
              .join("; ")}
            . A trial is invalid only for these predefined technical reasons,
            never because of a slow or incorrect response.
          </p>
        ) : null}
        {results.unpresentedMain > 0 ? (
          <p className="stroop-results__note">
            Trials that were not presented are not counted as timeouts or
            errors; they did not happen.
          </p>
        ) : null}
        {results.unrecognizedRecords > 0 ? (
          <Feedback tone="warning" title="Data note">
            {results.unrecognizedRecords} recorded trial(s) could not be
            assigned to a condition and are not included above.
          </Feedback>
        ) : null}
      </section>

      {results.isComplete && results.conditions && results.overallRates ? (
        <section
          aria-labelledby="results-conditions"
          className="stroop-results__section"
        >
          <h2 id="results-conditions">Results by condition</h2>
          <p>
            Across all main trials: response accuracy{" "}
            {results.overallRates.responseAccuracy.available
              ? `${formatPercent(results.overallRates.responseAccuracy.value)} (${results.overallRates.responseAccuracy.numerator} of ${results.overallRates.responseAccuracy.denominator})`
              : "unavailable"}
            , successful response rate{" "}
            {results.overallRates.successfulResponseRate.available
              ? `${formatPercent(results.overallRates.successfulResponseRate.value)} (${results.overallRates.successfulResponseRate.numerator} of ${results.overallRates.successfulResponseRate.denominator})`
              : "unavailable"}
            , timeout rate{" "}
            {results.overallRates.timeoutRate.available
              ? `${formatPercent(results.overallRates.timeoutRate.value)} (${results.overallRates.timeoutRate.numerator} of ${results.overallRates.timeoutRate.denominator})`
              : "unavailable"}
            .
          </p>
          <ConditionTable conditions={results.conditions} />
        </section>
      ) : null}

      {results.isComplete && results.contrasts ? (
        <section
          aria-labelledby="results-contrasts"
          className="stroop-results__section"
        >
          <h2 id="results-contrasts">Condition comparisons</h2>
          <p>
            Each comparison subtracts one condition from another. For response
            time, a positive value means the first condition in the formula was
            slower. For accuracy and successful response rate, a positive value
            means the first condition in the formula had the higher rate.
            Comparisons are descriptive, not tests of statistical significance;
            with at most 20 trials per condition, small differences can arise
            from ordinary trial-to-trial variation.
          </p>
          <div className="stroop-results__contrasts">
            {results.contrasts.map((contrast) => (
              <ContrastCard key={contrast.id} contrast={contrast} />
            ))}
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="results-reading"
        className="stroop-results__section"
      >
        <h2 id="results-reading">How to read these results</h2>
        <div className="stroop-results__explainers">
          <Card as="section">
            <h3>The three conditions</h3>
            <ul>
              {(Object.keys(CONDITION_LABEL) as StroopCondition[]).map(
                (condition) => (
                  <li key={condition}>
                    <strong>{CONDITION_LABEL[condition]}:</strong>{" "}
                    {CONDITION_EXAMPLE[condition]}.
                  </li>
                ),
              )}
            </ul>
          </Card>
          <Card as="section">
            <h3>Response time</h3>
            <p>
              Response time is the time from when the browser recorded the word
              appearing to when it registered your first mapped key press. The
              summary is the median of correct responses only: the middle value
              when they are sorted, which is less affected by a few unusually
              fast or slow responses than an average. No responses are removed
              for being fast or slow. A median is shown only when a condition
              has at least {RT_DISPLAY_MINIMUM_CORRECT} correct responses. This
              is a practical display rule for this project, not a validated
              scientific threshold.
            </p>
          </Card>
          <Card as="section">
            <h3>Three different rates</h3>
            <p>
              <strong>Response accuracy</strong> is the share of key presses
              that were correct. <strong>Successful response rate</strong> is
              the share of all analysable trials, including timeouts, that ended
              in a correct response. <strong>Timeout rate</strong> is the share
              of analysable trials with no key press within 2 seconds. Invalid
              trials are excluded from all three. Speed and accuracy are
              reported separately and are not combined into a score.
            </p>
          </Card>
          <Card as="section">
            <h3>Limits of this measurement</h3>
            <p>
              Times are recorded by your browser and depend on your device,
              display, keyboard, and system load; they are not laboratory-grade
              measurements and are not directly comparable across devices. One
              short session describes how this task went at this moment; it does
              not establish a stable personal trait. This task does not measure
              intelligence, diagnose any condition, or compare you with other
              people.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
