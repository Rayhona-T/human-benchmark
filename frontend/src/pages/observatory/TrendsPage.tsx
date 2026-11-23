import { useEffect, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageTitle } from "../../app/usePageTitle";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Feedback } from "../../components/ui/Feedback";
import { Label, Select } from "../../components/ui/FormControls";
import { Loading } from "../../components/ui/Loading";
import { FLANKER_CONFIGURATION } from "../../experiments/flanker/flanker";
import { FLANKER_RESULTS_COPY } from "../../experiments/flanker/flankerResultsCopy";
import {
  appObservatoryConfig,
  type ObservatoryConfig,
  type RequestFailure,
} from "../../experiments/shared/observatory/observatoryClient";
import { ANALYSIS_VERSION_NOTE } from "../../experiments/shared/observatory/storedSession";
import {
  createTrendCache,
  loadTrendInputs,
  MAX_ANALYSED,
  type TrendCache,
  type TrendLoad,
} from "../../experiments/shared/observatory/trendData";
import {
  buildTrendSeries,
  earlierSessionRange,
  MIN_EARLIER_SESSIONS_FOR_RANGE,
  MIN_SESSIONS_FOR_SERIES,
  type ExclusionReason,
  type IncludedSession,
  type TrendMetric,
  type TrendSeries,
} from "../../experiments/shared/observatory/trends";
import type { SaveExperimentId } from "../../experiments/shared/persistence/sessionPayload";
import {
  formatMs,
  formatPercent,
} from "../../experiments/shared/resultsFormat";
import { STROOP_CONFIGURATION } from "../../experiments/stroop/stroop";
import { STROOP_RESULTS_COPY } from "../../experiments/stroop/stroopResultsFormat";
import { AccessDisabledNotice, SavedAt } from "./observatoryCopy";
import { formatSavedAt, readFailureMessage } from "./observatoryFormat";
import { ObservatoryTabs } from "./ObservatoryTabs";
import { TrendChart, TrendLegend } from "./TrendChart";
import "../Page.css";
import "./Observatory.css";

const EXPERIMENTS: Record<
  SaveExperimentId,
  {
    name: string;
    conditions: readonly string[];
    conditionLabel: Readonly<Record<string, string>>;
    deadlineMs: number;
    minimumCorrect: number;
  }
> = {
  stroop: {
    name: "Stroop",
    conditions: STROOP_CONFIGURATION.conditions,
    conditionLabel: STROOP_RESULTS_COPY.conditionLabel,
    deadlineMs: STROOP_CONFIGURATION.main.responseDeadlineMs,
    minimumCorrect: STROOP_CONFIGURATION.minimumCorrectResponsesForMedian,
  },
  flanker: {
    name: "Flanker",
    conditions: FLANKER_CONFIGURATION.conditions,
    conditionLabel: FLANKER_RESULTS_COPY.conditionLabel,
    deadlineMs: FLANKER_CONFIGURATION.main.responseDeadlineMs,
    minimumCorrect: FLANKER_CONFIGURATION.minimumCorrectResponsesForMedian,
  },
};

const EXCLUSION_TEXT: Record<ExclusionReason, string> = {
  other_experiment: "A different experiment.",
  unsupported_version:
    "Stored under a protocol or configuration version this app does not analyse, so it is not comparable.",
  not_complete: "Not a complete session.",
  invalid_data:
    "Its stored data could not be analysed (incomplete or inconsistent).",
  not_loaded: "Its details could not be loaded from the test server.",
  analysis_version: "Analysed with a different analysis version.",
};

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function describeInterval(days: number | null): string {
  if (days === null) return "First session in this series";
  if (days < 1) return "Same day as the previous session";
  const whole = Math.floor(days);
  return `${whole} day${whole === 1 ? "" : "s"} after the previous session`;
}

export function TrendsPage() {
  usePageTitle("Trends");
  const [config] = useState(appObservatoryConfig);
  if (!config) {
    return (
      <div className="page observatory">
        <Feedback tone="info" title="Not connected">
          <p>{readFailureMessage("not_configured")}</p>
        </Feedback>
      </div>
    );
  }
  return <Trends config={config} />;
}

function Trends({ config }: { config: ObservatoryConfig }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const experiment: SaveExperimentId =
    searchParams.get("experiment") === "flanker" ? "flanker" : "stroop";
  const [cache] = useState<TrendCache>(createTrendCache);
  const [attempt, setAttempt] = useState(0);
  const name = EXPERIMENTS[experiment].name;
  const ids = useId();

  return (
    <div className="page observatory">
      <header className="page-header">
        <p className="page-eyebrow">Personal Observatory · development only</p>
        <h1>Trends across your sessions</h1>
        <p className="page-intro">
          See how your recorded results vary from one saved session to the next,
          for one experiment at a time. Each point is one session’s own result;
          nothing is averaged across sessions.
        </p>
      </header>
      <ObservatoryTabs />

      <fieldset className="observatory-switch">
        <legend>Experiment</legend>
        {(["stroop", "flanker"] as const).map((id) => (
          <label
            key={id}
            className={`observatory-switch__option${id === experiment ? " observatory-switch__option--active" : ""}`}
          >
            <input
              type="radio"
              name={`${ids}-experiment`}
              value={id}
              checked={id === experiment}
              onChange={() =>
                setSearchParams(id === "stroop" ? {} : { experiment: id })
              }
            />
            {EXPERIMENTS[id].name}
          </label>
        ))}
      </fieldset>

      <Card as="section" aria-labelledby={`${ids}-caveats`}>
        <h2 id={`${ids}-caveats`}>Read this first</h2>
        <ul className="observatory-limits">
          <li>
            <strong>Self-observation, not assessment.</strong> These charts show
            what was recorded. They are not a diagnosis, a measure of ability or
            intelligence, or evidence that anything about you has changed.
          </li>
          <li>
            <strong>Doing a task again changes it.</strong> Familiarity,
            practice and strategy often change results between early sessions.
            So can tiredness, sleep, motivation, distractions or the device
            used, none of which are recorded.
          </li>
          <li>
            <strong>Short sessions are noisy.</strong> With about 20 trials per
            condition, results differ from session to session by chance alone.
            Small differences are expected and say little on their own.
          </li>
          <li>
            <strong>Calculated now.</strong> {ANALYSIS_VERSION_NOTE}
          </li>
          <li>
            <strong>Save time, not run time.</strong> Dates show when the test
            server saved each session, in your local time. When a session was
            actually run, and on which device, is not recorded.
          </li>
        </ul>
      </Card>

      <TrendsBody
        key={`${experiment}:${attempt}`}
        config={config}
        experiment={experiment}
        cache={cache}
        onRetry={() => setAttempt((count) => count + 1)}
      />

      <p>
        <Link className="text-link" to="/observatory">
          ← Back to all saved sessions
        </Link>
      </p>
      <p className="observatory-muted" aria-live="polite">
        Showing {name} only. Stroop and Flanker are never combined or compared.
      </p>
    </div>
  );
}

type BodyState =
  | { phase: "loading"; done: number; total: number }
  | { phase: "failed"; kind: RequestFailure["kind"] }
  | { phase: "ready"; load: Extract<TrendLoad, { kind: "ok" }> };

function TrendsBody({
  config,
  experiment,
  cache,
  onRetry,
}: {
  config: ObservatoryConfig;
  experiment: SaveExperimentId;
  cache: TrendCache;
  onRetry: () => void;
}) {
  const [state, setState] = useState<BodyState>({
    phase: "loading",
    done: 0,
    total: 0,
  });

  useEffect(() => {
    // Not aborted on cleanup: StrictMode's second mount reuses the cached
    // requests instead of sending them again (trendData.ts).
    let active = true;
    void loadTrendInputs(config, experiment, cache, (done, total) => {
      if (active) setState({ phase: "loading", done, total });
    }).then((load) => {
      if (!active) return;
      setState(
        load.kind === "ok"
          ? { phase: "ready", load }
          : { phase: "failed", kind: load.kind },
      );
    });
    return () => {
      active = false;
    };
  }, [config, experiment, cache]);

  if (state.phase === "loading") {
    return (
      <Loading
        label={
          state.total > 0
            ? `Loading saved sessions (${state.done} of ${state.total})`
            : "Loading saved sessions"
        }
      />
    );
  }
  if (state.phase === "failed") {
    return state.kind === "access_disabled" ? (
      <AccessDisabledNotice />
    ) : (
      <Feedback tone="error" title="Saved sessions could not be loaded">
        <p>{readFailureMessage(state.kind)}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </Feedback>
    );
  }
  const info = EXPERIMENTS[experiment];
  const series = buildTrendSeries(
    experiment,
    state.load.inputs,
    info.conditions,
  );
  return <SeriesView series={series} load={state.load} onRetry={onRetry} />;
}

function WindowNotice({
  load,
  name,
  analysedWindow,
  comparable,
}: {
  load: Extract<TrendLoad, { kind: "ok" }>;
  name: string;
  analysedWindow: number;
  comparable: number;
}) {
  return (
    <Feedback
      tone="info"
      title="Trends shows a recent window, not your whole history"
    >
      <ul className="observatory-window">
        <li>
          Read: the {load.retrieved} most recently saved {name} sessions.
          {load.truncatedList
            ? ` Older ${name} sessions exist but were not read, so how many is not known.`
            : ""}
        </li>
        {load.unsupported > 0 ? (
          <li>
            {load.unsupported} of these {load.unsupported === 1 ? "is" : "are"}{" "}
            stored under a version this app does not analyse.
          </li>
        ) : null}
        <li>
          Analysed: the newest {analysedWindow} session
          {analysedWindow === 1 ? "" : "s"} of the version this app analyses (at
          most {MAX_ANALYSED} that analyse successfully); {comparable}{" "}
          {comparable === 1 ? "is" : "are"} comparable.
          {load.replacementsUsed > 0
            ? ` ${load.replacementsUsed} older session${load.replacementsUsed === 1 ? " was" : "s were"} loaded in place of sessions that could not be analysed.`
            : ""}
        </li>
        {load.notAnalysed > 0 ? (
          <li>
            {load.notAnalysed} older session{load.notAnalysed === 1 ? "" : "s"}{" "}
            of that version {load.notAnalysed === 1 ? "was" : "were"} read but
            not analysed.
          </li>
        ) : null}
        <li>
          Session 1 is the oldest session in this window, which may not be your
          first session.
        </li>
        <li>
          Earlier-session ranges use only earlier sessions inside this window.
        </li>
      </ul>
      <p>All saved sessions are still listed in the history.</p>
    </Feedback>
  );
}

function SeriesView({
  series,
  load,
  onRetry,
}: {
  series: TrendSeries;
  load: Extract<TrendLoad, { kind: "ok" }>;
  onRetry: () => void;
}) {
  const info = EXPERIMENTS[series.experimentId];
  const ids = useId();
  const count = series.included.length;
  const [selected, setSelected] = useState(count);
  const selectedSession = series.included.find((s) => s.number === selected);
  const notLoaded = series.excluded.filter(
    (s) => s.reason === "not_loaded",
  ).length;
  // Not every saved session was considered: some were not read, or are older
  // than the analysed window.
  const windowLimited = load.notAnalysed > 0 || load.truncatedList;
  // Sessions whose details were loaded (the analysed window).
  const analysedWindow = load.inputs.filter(
    (input) => input.kind !== "unsupported_version",
  ).length;

  return (
    <>
      <section
        aria-labelledby={`${ids}-status`}
        className="observatory-history"
      >
        <h2 id={`${ids}-status`}>
          {count} comparable {info.name} session{count === 1 ? "" : "s"}
          {windowLimited ? " in the analysed window" : ""}
        </h2>
        <p className="observatory-muted">
          Comparable means: {info.name}, complete, stored under the protocol and
          configuration version this app analyses, and analysable with the
          current analysis.{" "}
          {series.excluded.length > 0
            ? `${series.excluded.length} saved ${info.name} session${series.excluded.length === 1 ? " is" : "s are"} left out (listed below).`
            : "No saved session is left out."}
        </p>
        {notLoaded > 0 ? (
          <Feedback tone="warning" title="Some sessions could not be loaded">
            <p>
              {notLoaded} session{notLoaded === 1 ? "" : "s"} could not be
              loaded from the test server and {notLoaded === 1 ? "is" : "are"}{" "}
              not part of the series below.
            </p>
            <Button type="button" variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          </Feedback>
        ) : null}
        {windowLimited ? (
          <WindowNotice
            load={load}
            name={info.name}
            analysedWindow={analysedWindow}
            comparable={count}
          />
        ) : null}
      </section>

      {series.seriesAvailable ? (
        <>
          <div className="observatory-filter observatory-inspect">
            <Label htmlFor={`${ids}-session`}>Session to inspect</Label>
            <Select
              id={`${ids}-session`}
              value={String(selected)}
              onChange={(event) =>
                setSelected(Number(event.currentTarget.value))
              }
            >
              {series.included.map((session) => (
                <option key={session.number} value={session.number}>
                  Session {session.number} · {formatSavedAt(session.createdAt)}
                </option>
              ))}
            </Select>
          </div>

          <MetricSection
            series={series}
            metric="medianRt"
            title="Median correct response time by condition"
            explanation={`Each mark is one session’s median response time for the correct responses in one condition (the middle value, so a few unusually slow or fast responses have little influence). It is shown only when that condition had at least ${info.minimumCorrect} correct responses. The axis runs from 0 to the ${formatMs(info.deadlineMs)} response limit.`}
            selected={selected}
            onSelect={setSelected}
          />
          <MetricSection
            series={series}
            metric="accuracy"
            title="Response accuracy by condition"
            explanation="Each mark is one session’s response accuracy in one condition: correct ÷ (correct + incorrect), the share of key presses that were correct. It is calculated among responses only, so it can stay high even when many trials timed out; the table therefore shows each value with its own number of key presses, its timeouts and the successful response rate (correct ÷ all trials with a correct, incorrect or no response). Invalid trials count in none of these. The axis runs from 0 % to 100 %."
            selected={selected}
            onSelect={setSelected}
          />

          {selectedSession ? (
            <SelectedSession series={series} session={selectedSession} />
          ) : null}
        </>
      ) : (
        <InsufficientSessions series={series} windowLimited={windowLimited} />
      )}

      {series.excluded.length > 0 ? (
        <section
          aria-labelledby={`${ids}-excluded`}
          className="observatory-history"
        >
          <h2 id={`${ids}-excluded`}>Saved sessions left out</h2>
          <ul className="observatory-excluded">
            {series.excluded.map((entry) => (
              <li key={entry.sessionId}>
                <SavedAt iso={entry.createdAt} /> —{" "}
                {EXCLUSION_TEXT[entry.reason]}{" "}
                <Link
                  className="text-link"
                  to={`/observatory/sessions/${entry.sessionId}`}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function InsufficientSessions({
  series,
  windowLimited,
}: {
  series: TrendSeries;
  windowLimited: boolean;
}) {
  const info = EXPERIMENTS[series.experimentId];
  const count = series.included.length;
  const missing = MIN_SESSIONS_FOR_SERIES - count;
  return (
    <section
      className="observatory-insufficient"
      aria-labelledby="trends-insufficient"
    >
      <h2 id="trends-insufficient">
        Not enough comparable sessions for a chart yet
      </h2>
      <p>
        Charts across sessions need at least {MIN_SESSIONS_FOR_SERIES}{" "}
        comparable {info.name} sessions.{" "}
        {windowLimited
          ? `The analysed window has ${count}.`
          : `You have ${count}.`}{" "}
        After {missing} more complete {info.name} session
        {missing === 1 ? "" : "s"} saved with this version, the charts will
        appear. A comparison with your earlier sessions needs at least{" "}
        {MIN_EARLIER_SESSIONS_FOR_RANGE} earlier sessions.
      </p>
      {count > 0 ? (
        <>
          <p>Until then, each session can be viewed on its own:</p>
          <ul className="observatory-excluded">
            {series.included.map((session) => (
              <li key={session.sessionId}>
                Session {session.number}, saved{" "}
                <SavedAt iso={session.createdAt} />{" "}
                <Link
                  className="text-link"
                  to={`/observatory/sessions/${session.sessionId}`}
                >
                  Open results
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/**
 * The parts shown for one session, condition and metric. The table and the
 * selected-session panel both use this, so they always say the same thing.
 * Response accuracy is never shown without its own denominator, the
 * timeout count and the successful response rate (protocols §10).
 */
function valueParts(
  session: IncludedSession,
  condition: string,
  metric: TrendMetric,
  minimumCorrect: number,
): string[] {
  const entry = session.conditions.find((c) => c.condition === condition);
  if (!entry) return ["not available"];
  if (metric === "medianRt") {
    return [
      entry.medianRt.available
        ? `${formatMs(entry.medianRt.valueMs)} (${entry.correctRtCount} correct)`
        : `not shown: ${entry.correctRtCount} correct, needs ${minimumCorrect}`,
    ];
  }
  const accuracy = entry.accuracy.available
    ? `${formatPercent(entry.accuracy.value)} (${entry.accuracy.numerator} of ${entry.accuracy.denominator} key presses)`
    : "accuracy not available: no key presses";
  const timeouts =
    entry.timeouts === null
      ? "timeouts not available"
      : `${entry.timeouts} timeout${entry.timeouts === 1 ? "" : "s"}`;
  const successful = entry.successfulResponseRate.available
    ? `successful responses ${formatPercent(entry.successfulResponseRate.value)} (${entry.successfulResponseRate.numerator} of ${entry.successfulResponseRate.denominator} trials)`
    : "successful responses not available";
  return [accuracy, timeouts, successful];
}

function valueText(
  session: IncludedSession,
  condition: string,
  metric: TrendMetric,
  minimumCorrect: number,
) {
  const parts = valueParts(session, condition, metric, minimumCorrect);
  return (
    <span className="observatory-value">
      {parts.map((part) => (
        <span key={part}>{part}</span>
      ))}
    </span>
  );
}

function MetricSection({
  series,
  metric,
  title,
  explanation,
  selected,
  onSelect,
}: {
  series: TrendSeries;
  metric: TrendMetric;
  title: string;
  explanation: string;
  selected: number;
  onSelect: (sessionNumber: number) => void;
}) {
  const info = EXPERIMENTS[series.experimentId];
  const ids = useId();
  const isRt = metric === "medianRt";
  return (
    <section aria-labelledby={`${ids}-title`} className="observatory-metric">
      <h2 id={`${ids}-title`}>{title}</h2>
      <p className="observatory-metric__explain">{explanation}</p>
      <TrendLegend
        conditions={series.conditions}
        conditionLabel={info.conditionLabel}
      />
      <TrendChart
        title={`${title}, ${info.name}, by session`}
        sessions={series.included}
        conditions={series.conditions}
        conditionLabel={info.conditionLabel}
        metric={metric}
        domainMax={isRt ? info.deadlineMs : 1}
        tickStep={isRt ? 500 : 0.25}
        formatTick={(value) =>
          isRt ? String(value) : `${Math.round(value * 100)}%`
        }
        formatValue={(value) => (isRt ? formatMs(value) : formatPercent(value))}
        formatDate={shortDate}
        selectedNumber={selected}
        onSelect={onSelect}
      />
      <p className="observatory-muted">
        Sessions are spaced evenly by order, not by date; dashed lines mark
        intervals of 7 days or more. A missing mark means the value is not
        available for that session (see the table).
      </p>
      <details className="observatory-details">
        <summary>Table of every session’s values</summary>
        <div className="observatory-table-wrap">
          <table className="observatory-table observatory-table--values">
            <caption>
              {title}, {info.name}. Save time is when the test server stored the
              session.
            </caption>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Saved</th>
                {series.conditions.map((condition) => (
                  <th scope="col" key={condition}>
                    {info.conditionLabel[condition] ?? condition}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.included.map((session) => (
                <tr key={session.number}>
                  <th scope="row" data-label="Session">
                    {session.number}
                  </th>
                  <td data-label="Saved">
                    <SavedAt iso={session.createdAt} />
                    <span className="observatory-version">
                      {describeInterval(session.daysSincePrevious)}
                    </span>
                  </td>
                  {series.conditions.map((condition) => (
                    <td
                      key={condition}
                      data-label={info.conditionLabel[condition] ?? condition}
                    >
                      {valueText(
                        session,
                        condition,
                        metric,
                        info.minimumCorrect,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function rangeText(
  range: ReturnType<typeof earlierSessionRange>,
  metric: TrendMetric,
): string {
  const format = metric === "medianRt" ? formatMs : formatPercent;
  if (range.status === "insufficient") {
    return `Not shown: needs at least ${range.required} earlier sessions with a value for this condition (there ${range.earlierWithValue === 1 ? "is" : "are"} ${range.earlierWithValue}).`;
  }
  const span = `${format(range.min)} to ${format(range.max)} across your ${range.count} earlier sessions`;
  if (range.position === null)
    return `${span}. This session has no value to place.`;
  const where =
    range.position === "within"
      ? "This session’s value is within that range."
      : range.position === "below"
        ? "This session’s value is lower than every earlier session’s."
        : "This session’s value is higher than every earlier session’s.";
  return `${span}. ${where}`;
}

function SelectedSession({
  series,
  session,
}: {
  series: TrendSeries;
  session: IncludedSession;
}) {
  const info = EXPERIMENTS[series.experimentId];
  const ids = useId();
  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="observatory-selected"
      aria-live="polite"
    >
      <h2 id={`${ids}-title`}>Session {session.number}</h2>
      <p className="observatory-muted">
        Saved <SavedAt iso={session.createdAt} />.{" "}
        {describeInterval(session.daysSincePrevious)}.{" "}
        <Link
          className="text-link"
          to={`/observatory/sessions/${session.sessionId}`}
        >
          Open this session’s full results
        </Link>
      </p>
      <p className="observatory-metric__explain">
        The earlier-session range is the lowest to the highest value among the
        sessions saved before this one, for the same condition. It describes
        your own earlier sessions only; it is not a normal or expected range,
        and a value outside it is not, by itself, a meaningful change.
      </p>
      {(["medianRt", "accuracy"] as const).map((metric) => (
        <div key={metric} className="observatory-table-wrap">
          <table className="observatory-table observatory-table--values">
            <caption>
              {metric === "medianRt"
                ? "Median correct response time"
                : "Response accuracy"}{" "}
              in session {session.number}, and your earlier sessions
            </caption>
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">This session</th>
                <th scope="col">Earlier sessions (lowest to highest)</th>
              </tr>
            </thead>
            <tbody>
              {series.conditions.map((condition) => (
                <tr key={condition}>
                  <th scope="row" data-label="Condition">
                    {info.conditionLabel[condition] ?? condition}
                  </th>
                  <td data-label="This session">
                    {valueText(session, condition, metric, info.minimumCorrect)}
                  </td>
                  <td data-label="Earlier sessions">
                    {rangeText(
                      earlierSessionRange(
                        series,
                        session.number,
                        condition,
                        metric,
                      ),
                      metric,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
