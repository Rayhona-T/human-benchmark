import type { ReactNode } from "react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Feedback } from "../../components/ui/Feedback";
import type { TrialRecord } from "../../engine/contracts";
import {
  BASE_COLUMNS_AFTER,
  BASE_COLUMNS_BEFORE,
  MISSING,
  buildTrialCsv,
  exportFileName,
  type ExportColumn,
} from "./exportTrials";
import { buildRtPlotData } from "./rtPlotData";
import { RtDotPlot } from "./RtDotPlot";
import { appSaveConfig, type SaveConfig } from "./persistence/saveConfig";
import { SaveSessionPanel } from "./persistence/SaveSessionPanel";
import type { ResultsSave } from "./persistence/sessionPayload";
import {
  speedAccuracyDetail,
  type ConditionResult,
  type ContrastResult,
  type InvalidReason,
  type MedianValue,
  type RateValue,
  type RtDistribution,
  type SessionResults as SessionResultsData,
} from "./sessionAnalysis";
import {
  MINUS,
  SPEED_ACCURACY_CAVEAT,
  describeRateContrastWith,
  describeRtContrastWith,
  describeSpeedAccuracyWith,
  formatMs,
  formatPercent,
  formatSignedMs,
  formatSignedPoints,
  type ResultsCopy,
} from "./resultsFormat";
import "./SessionResults.css";

function RateCell({ value }: { value: RateValue }) {
  if (!value.available) {
    return (
      <span className="session-results__unavailable">
        Unavailable (0 trials)
      </span>
    );
  }
  return (
    <>
      <span className="session-results__value">
        {formatPercent(value.value)}
      </span>
      <span className="session-results__count">
        {value.numerator} of {value.denominator}
      </span>
    </>
  );
}

function MedianCell({
  value,
  correct,
  minimum,
}: {
  value: MedianValue;
  correct: number;
  minimum: number;
}) {
  if (!value.available) {
    return (
      <span className="session-results__unavailable">
        Not shown: {correct} correct (minimum {minimum})
      </span>
    );
  }
  return (
    <>
      <span className="session-results__value">{formatMs(value.valueMs)}</span>
      <span className="session-results__count">from {value.count} correct</span>
    </>
  );
}

function ConditionTable<TCondition extends string>({
  conditions,
  conditionLabel,
  minimum,
}: {
  conditions: readonly ConditionResult<TCondition>[];
  conditionLabel: Record<TCondition, string>;
  minimum: number;
}) {
  const rows: {
    label: string;
    hint?: string;
    cell: (condition: ConditionResult<TCondition>) => ReactNode;
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
      hint: `correct responses only; shown with ${minimum}+`,
      cell: (c) => (
        <MedianCell
          value={c.medianCorrectRt}
          correct={c.correctRtCount}
          minimum={minimum}
        />
      ),
    },
  ];

  return (
    <div
      className="session-results__table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Results by condition table"
    >
      <table className="session-results__table">
        <caption>Main-trial results by condition (practice excluded)</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            {conditions.map((condition) => (
              <th scope="col" key={condition.condition}>
                {conditionLabel[condition.condition]}
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
                  <span className="session-results__hint">{row.hint}</span>
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

function DistributionCell({
  value,
  pick,
  correct,
  minimum,
}: {
  value: RtDistribution;
  pick: (v: Extract<RtDistribution, { available: true }>) => number;
  correct: number;
  minimum: number;
}) {
  if (!value.available) {
    return (
      <span className="session-results__unavailable">
        Not shown: {correct} correct (minimum {minimum})
      </span>
    );
  }
  return (
    <span className="session-results__value">{formatMs(pick(value))}</span>
  );
}

/** Secondary: min, Q1, median, Q3, max of correct RTs (type 7 quartiles). */
function DistributionTable<TCondition extends string>({
  conditions,
  conditionLabel,
  minimum,
}: {
  conditions: readonly ConditionResult<TCondition>[];
  conditionLabel: Record<TCondition, string>;
  minimum: number;
}) {
  const rows: {
    label: string;
    hint: string;
    pick: (v: Extract<RtDistribution, { available: true }>) => number;
  }[] = [
    { label: "Fastest", hint: "minimum", pick: (v) => v.minMs },
    {
      label: "Lower quartile",
      hint: "a quarter were faster",
      pick: (v) => v.q1Ms,
    },
    { label: "Median", hint: "the middle value", pick: (v) => v.medianMs },
    {
      label: "Upper quartile",
      hint: "a quarter were slower",
      pick: (v) => v.q3Ms,
    },
    { label: "Slowest", hint: "maximum", pick: (v) => v.maxMs },
  ];
  return (
    <div
      className="session-results__table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Spread of response times table"
    >
      <table className="session-results__table">
        <caption>Spread of correct response times in this session (ms)</caption>
        <thead>
          <tr>
            <th scope="col">Summary</th>
            {conditions.map((condition) => (
              <th scope="col" key={condition.condition}>
                {conditionLabel[condition.condition]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">
                {row.label}
                <span className="session-results__hint">{row.hint}</span>
              </th>
              {conditions.map((condition) => (
                <td key={condition.condition}>
                  <DistributionCell
                    value={condition.correctRtDistribution}
                    pick={row.pick}
                    correct={condition.correctRtCount}
                    minimum={minimum}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContrastCard<TCondition extends string, TId extends string>({
  contrast,
  copy,
  minimum,
}: {
  contrast: ContrastResult<TCondition, TId>;
  copy: ResultsCopy<TCondition, TId>;
  minimum: number;
}) {
  const label = copy.conditionLabel;
  const rtFirst = label[contrast.rtFirst];
  const rtSecond = label[contrast.rtSecond];
  const rateFirst = label[contrast.rateFirst];
  const rateSecond = label[contrast.rateSecond];
  const speedAccuracy = describeSpeedAccuracyWith(
    contrast,
    speedAccuracyDetail(contrast),
    label,
  );
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
      sentence: describeRtContrastWith(
        contrast,
        contrast.reactionTime,
        label,
        minimum,
      ),
    },
    {
      label: "Response accuracy",
      formula: `${rateFirst} ${MINUS} ${rateSecond}`,
      value: contrast.responseAccuracy.available
        ? formatSignedPoints(contrast.responseAccuracy.value)
        : null,
      sentence: describeRateContrastWith(
        contrast,
        "response accuracy",
        contrast.responseAccuracy,
        label,
      ),
    },
    {
      label: "Successful response rate",
      formula: `${rateFirst} ${MINUS} ${rateSecond}`,
      value: contrast.successfulResponseRate.available
        ? formatSignedPoints(contrast.successfulResponseRate.value)
        : null,
      sentence: describeRateContrastWith(
        contrast,
        "the successful response rate",
        contrast.successfulResponseRate,
        label,
      ),
    },
  ];

  return (
    <Card as="section" className="session-results__contrast">
      <h3>{copy.contrastTitle[contrast.id]}</h3>
      <p className="session-results__contrast-pair">
        {rtFirst} vs {rtSecond} trials
      </p>
      <dl className="session-results__contrast-list">
        {entries.map((entry) => (
          <div key={entry.label} className="session-results__contrast-item">
            <dt>
              {entry.label}{" "}
              <span className="session-results__hint">{entry.formula}</span>
            </dt>
            <dd>
              {entry.value ? (
                <span className="session-results__value">{entry.value}</span>
              ) : null}
              <span className="session-results__sentence">
                {entry.sentence}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {speedAccuracy ? (
        <div className="session-results__speed-accuracy">
          <p className="session-results__speed-accuracy-title">
            Speed and accuracy together
          </p>
          <p>{speedAccuracy}</p>
          <p className="session-results__hint">{SPEED_ACCURACY_CAVEAT}</p>
        </div>
      ) : null}
    </Card>
  );
}

function describeBreak(results: SessionResultsData): string {
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

function HeadlineRate({
  label,
  value,
  unit,
  emptyReason,
}: {
  label: string;
  value: RateValue;
  unit: string;
  emptyReason: string;
}) {
  return (
    <div className="session-results__headline">
      <dt>{label}</dt>
      <dd>
        {value.available ? (
          <>
            <span className="session-results__headline-value">
              {formatPercent(value.value)}
            </span>
            <span className="session-results__headline-basis">
              {value.numerator} of {value.denominator} {unit}
            </span>
          </>
        ) : (
          <>
            <span className="session-results__headline-value session-results__headline-value--muted">
              Unavailable
            </span>
            <span className="session-results__headline-basis">
              {emptyReason}
            </span>
          </>
        )}
      </dd>
    </div>
  );
}

/** Records and experiment columns for the participant-initiated download. */
export interface ResultsExport<TStimulus = unknown> {
  experimentId: string;
  records: readonly TrialRecord<TStimulus, string, unknown>[];
  stimulusColumns: readonly ExportColumn<TStimulus>[];
}

function downloadCsv(fileName: string, text: string) {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

function ExportPanel<TStimulus>({
  results,
  exportData,
  saveOffered,
}: {
  results: SessionResultsData;
  exportData: ResultsExport<TStimulus>;
  /** True when the optional development save panel is shown below. */
  saveOffered: boolean;
}) {
  const columns = [
    ...BASE_COLUMNS_BEFORE,
    ...exportData.stimulusColumns,
    ...BASE_COLUMNS_AFTER,
  ];
  const hasRecords = exportData.records.length > 0;
  return (
    <section
      aria-labelledby="results-export"
      className="session-results__section"
    >
      <h2 id="results-export">Your data</h2>
      <p>
        You can download every trial recorded in this session, including
        practice, as a CSV file for a spreadsheet.{" "}
        {saveOffered
          ? "The file is created in your browser, and downloading it uploads nothing. Nothing is stored by HUMAN BENCHMARK unless you choose to save the session below; otherwise the data is gone once you leave this page."
          : "The file is created in your browser; nothing is uploaded or stored by HUMAN BENCHMARK, and the data is gone once you leave this page."}
      </p>
      <div className="session-results__export-actions">
        <Button
          type="button"
          variant="secondary"
          disabled={!hasRecords}
          onClick={() =>
            downloadCsv(
              exportFileName(exportData.experimentId, results.status),
              buildTrialCsv(
                exportData.records,
                {
                  experimentId: exportData.experimentId,
                  analysisVersion: results.analysisVersion,
                  status: results.status,
                },
                exportData.stimulusColumns,
              ),
            )
          }
        >
          Download trial data (CSV)
        </Button>
        {!hasRecords ? (
          <span className="session-results__hint">
            No trials were recorded in this session.
          </span>
        ) : null}
      </div>
      <details className="session-results__details">
        <summary>What each column means</summary>
        <p>
          One row per recorded trial. {MISSING} means the value does not apply
          or was not recorded; it is never a zero. Times are in milliseconds.
        </p>
        <dl className="session-results__dictionary">
          {columns.map((column) => (
            <div key={column.name}>
              <dt>
                <code>{column.name}</code>
              </dt>
              <dd>{column.description}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

/**
 * Experiment-agnostic results presentation. Wording comes from `copy`; the
 * structure, rules, and calculations are shared by every experiment.
 */
export function SessionResults<
  TCondition extends string,
  TId extends string,
  TStimulus = unknown,
>({
  results,
  copy,
  responseWindowMs = 2000,
  exportData,
  saveData,
  saveConfig = appSaveConfig(),
}: {
  results: SessionResultsData<TCondition, TId>;
  copy: ResultsCopy<TCondition, TId>;
  /** Protocol response deadline; the plot's axis spans 0 to this value. */
  responseWindowMs?: number;
  exportData?: ResultsExport<TStimulus>;
  /** The finished session, for the optional development save panel. */
  saveData?: ResultsSave<TStimulus>;
  /** Where saving goes; null (production, or not configured) hides it. */
  saveConfig?: SaveConfig | null;
}) {
  const saveOffered = Boolean(saveData && saveConfig);
  const minimum = results.minimumCorrectForMedian;
  const plot = buildRtPlotData(results, responseWindowMs);
  const invalidEntries = Object.entries(results.invalidReasons) as [
    InvalidReason,
    number,
  ][];

  return (
    <div className="session-results">
      <section
        aria-labelledby="results-status"
        className="session-results__section session-results__overview"
      >
        <h2 id="results-status">Session overview</h2>
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
        {results.isComplete && results.overallRates ? (
          <dl className="session-results__headlines">
            <HeadlineRate
              label="Response accuracy"
              value={results.overallRates.responseAccuracy}
              unit="key presses were correct"
              emptyReason="no key presses to score"
            />
            <HeadlineRate
              label="Successful response rate"
              value={results.overallRates.successfulResponseRate}
              unit="analysable trials ended in a correct response"
              emptyReason="no analysable trials"
            />
          </dl>
        ) : null}
        <dl className="session-results__stats">
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
          <p className="session-results__note">
            Invalid trials and reasons:{" "}
            {invalidEntries
              .map(
                ([reason, count]) =>
                  `${count} × ${copy.invalidReasonLabel[reason]}`,
              )
              .join("; ")}
            . A trial is invalid only for these predefined technical reasons,
            never because of a slow or incorrect response.
          </p>
        ) : null}
        {results.unpresentedMain > 0 ? (
          <p className="session-results__note">
            Trials that were not presented are not counted as timeouts or
            errors; they did not happen.
          </p>
        ) : null}
        {results.correctMissingRt > 0 ? (
          <Feedback tone="warning" title="Missing response times">
            {results.correctMissingRt} correct response(s) have no usable
            recorded response time. They count as correct in every rate but are
            left out of the response-time summaries.
          </Feedback>
        ) : null}
        {results.unrecognizedRecords > 0 ? (
          <Feedback tone="warning" title="Data note">
            {results.unrecognizedRecords} recorded trial(s) could not be
            assigned to a condition and are not included above.
          </Feedback>
        ) : null}
      </section>

      {plot && results.conditions ? (
        <section
          aria-labelledby="results-times"
          className="session-results__section"
        >
          <h2 id="results-times">Response times</h2>
          <p>
            Each dot is one correct response, placed by how long it took. Dots
            stack upward and downward when times are close. The line marks the
            median: half of the correct responses were faster and half slower.
            Nothing is removed for being unusually fast or slow.
          </p>
          <RtDotPlot
            data={plot}
            conditionLabel={copy.conditionLabel}
            minimumCorrect={minimum}
            stimulusNoun={copy.stimulusNoun}
          />
          <details className="session-results__details">
            <summary>
              Spread of response times (fastest, quartiles, slowest)
            </summary>
            <p>
              These describe only the correct responses in this session. They
              are not typical values for other people. Quartiles use linear
              interpolation, the method spreadsheet programs use for
              QUARTILE.INC.
            </p>
            <DistributionTable
              conditions={results.conditions}
              conditionLabel={copy.conditionLabel}
              minimum={minimum}
            />
          </details>
        </section>
      ) : null}

      {results.isComplete && results.conditions && results.overallRates ? (
        <section
          aria-labelledby="results-conditions"
          className="session-results__section"
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
          <ConditionTable
            conditions={results.conditions}
            conditionLabel={copy.conditionLabel}
            minimum={minimum}
          />
        </section>
      ) : null}

      {results.isComplete && results.contrasts ? (
        <section
          aria-labelledby="results-contrasts"
          className="session-results__section"
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
          <div className="session-results__contrasts">
            {results.contrasts.map((contrast) => (
              <ContrastCard
                key={contrast.id}
                contrast={contrast}
                copy={copy}
                minimum={minimum}
              />
            ))}
          </div>
        </section>
      ) : null}

      {exportData ? (
        <ExportPanel
          results={results}
          exportData={exportData}
          saveOffered={saveOffered}
        />
      ) : null}

      {saveData && saveConfig ? (
        <SaveSessionPanel save={saveData} config={saveConfig} />
      ) : null}

      <section
        aria-labelledby="results-reading"
        className="session-results__section"
      >
        <h2 id="results-reading">How to read these results</h2>
        <ul className="session-results__key-points">
          <li>This is an educational experiment, not a clinical assessment.</li>
          <li>These results describe this one session, not a lasting trait.</li>
          <li>Read speed and accuracy together.</li>
          <li>
            There is no comparison with other people: no norms exist for this
            task.
          </li>
        </ul>
        <div className="session-results__explainers">
          <Card as="section">
            <h3>The three conditions</h3>
            <ul>
              {(Object.keys(copy.conditionLabel) as TCondition[]).map(
                (condition) => (
                  <li key={condition}>
                    <strong>{copy.conditionLabel[condition]}:</strong>{" "}
                    {copy.conditionExample[condition]}.
                  </li>
                ),
              )}
            </ul>
          </Card>
          <Card as="section">
            <h3>Response time</h3>
            <p>
              Response time is the time from when the browser recorded{" "}
              {copy.stimulusNoun} appearing to when it registered your first
              mapped key press. The summary is the median of correct responses
              only: the middle value when they are sorted, which is less
              affected by a few unusually fast or slow responses than an
              average. No responses are removed for being fast or slow. A median
              is shown only when a condition has at least {minimum} correct
              responses. This is a practical display rule for this project, not
              a validated scientific threshold.
            </p>
          </Card>
        </div>
        <details className="session-results__details">
          <summary>More about these numbers and their limits</summary>
          <div className="session-results__explainers">
            <Card as="section">
              <h3>Three different rates</h3>
              <p>
                <strong>Response accuracy</strong> is the share of key presses
                that were correct. <strong>Successful response rate</strong> is
                the share of all analysable trials, including timeouts, that
                ended in a correct response. <strong>Timeout rate</strong> is
                the share of analysable trials with no key press within 2
                seconds. Invalid trials are excluded from all three. Speed and
                accuracy are reported separately and are not combined into a
                score.
              </p>
            </Card>
            <Card as="section">
              <h3>Why the median, and what it leaves out</h3>
              <p>
                Response times are usually skewed: most are close together, with
                a few much slower ones. The median is a useful summary because
                those few do not pull it far, but it is only one number. The
                dots show the whole spread, which can differ between conditions
                even when medians are similar. With few correct responses, or
                different numbers in two conditions, a median can also shift by
                chance, so a difference between medians is a description, not
                proof of an effect.
              </p>
            </Card>
            <Card as="section">
              <h3>Few trials, noisy estimates</h3>
              <p>
                Each condition has at most 20 main trials. Responses vary from
                trial to trial, so repeating the task could give noticeably
                different numbers. That is normal and is why one session cannot
                describe a person's stable characteristics.
              </p>
            </Card>
            <Card as="section">
              <h3>Limits of this measurement</h3>
              <p>
                Times are recorded by your browser and depend on your device,
                display, keyboard, and system load; they are not
                laboratory-grade measurements and are not directly comparable
                across devices. One short session describes how this task went
                at this moment; it does not establish a stable personal trait.
                This task does not measure intelligence, diagnose any condition,
                or compare you with other people.
                {copy.extraLimitations ? ` ${copy.extraLimitations}` : null}
              </p>
            </Card>
          </div>
        </details>
      </section>
    </div>
  );
}
