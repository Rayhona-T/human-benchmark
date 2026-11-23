/**
 * Longitudinal series for the Personal Observatory (Cycle 9, Task 9.5).
 *
 * Pure functions. Every value shown comes UNCHANGED from the approved
 * per-session analysis (HB-ANALYSIS-1.1 via analyseStoredSession); this
 * module only selects comparable sessions, orders them, and builds the
 * descriptive earlier-session range. It computes no new statistic: no means,
 * no pooled RTs, no pooled accuracy, no differences between sessions, no
 * trend, no test.
 *
 * Rules (docs/PERSONAL_OBSERVATORY.md §4, decisions O5–O7):
 *   - one experiment at a time; only sessions stored under the one protocol
 *     and configuration version this app analyses, complete, valid, and
 *     analysed with the same (current) analysis version;
 *   - a series needs at least 3 comparable sessions;
 *   - an earlier-session range needs at least 5 earlier comparable sessions
 *     with a value for that condition, and never includes the session being
 *     looked at;
 *   - a condition's median RT exists only where the approved analysis made it
 *     available (at least 10 correct responses); otherwise it is missing,
 *     never zero and never filled in.
 */
import type { SaveExperimentId } from "../persistence/sessionPayload";
import {
  ANALYSIS_VERSION,
  type MedianValue,
  type RateValue,
} from "../sessionAnalysis";
import type { StoredSessionSummary } from "./observatoryClient";
import {
  isSupportedVersion,
  type AnalysedStoredSession,
} from "./storedSession";

export const MIN_SESSIONS_FOR_SERIES = 3;
export const MIN_EARLIER_SESSIONS_FOR_RANGE = 5;
/** Intervals at least this long are marked as gaps in the chart. */
export const GAP_HIGHLIGHT_DAYS = 7;

const DAY_MS = 86_400_000;

/** What is known about one saved session when the series is built. */
export type TrendInput =
  /** Not loaded: its stored version is not the one this app analyses. */
  | { summary: StoredSessionSummary; kind: "unsupported_version" }
  /** Its details could not be loaded from the server. */
  | { summary: StoredSessionSummary; kind: "not_loaded" }
  /** Loaded and passed through the approved adapter and analysis. */
  | {
      summary: StoredSessionSummary;
      kind: "analysed";
      result: AnalysedStoredSession;
    };

export type ExclusionReason =
  | "other_experiment"
  | "unsupported_version"
  | "not_complete"
  | "invalid_data"
  | "not_loaded"
  | "analysis_version";

export interface ConditionValues {
  readonly condition: string;
  /** From the approved analysis; unavailable below the RT display minimum. */
  readonly medianRt: MedianValue;
  /** Correct responses with a usable RT in this condition. */
  readonly correctRtCount: number;
  /** Response accuracy: correct / (correct + incorrect) in this condition. */
  readonly accuracy: RateValue;
  /**
   * Timeouts (no key before the deadline) in this condition. They are not in
   * the accuracy denominator, so they are shown beside it (protocol §10).
   */
  readonly timeouts: number | null;
  /** Successful response rate: correct / (correct + incorrect + timeouts). */
  readonly successfulResponseRate: RateValue;
}

export interface IncludedSession {
  /** 1 = the earliest comparable session in this series. */
  readonly number: number;
  readonly sessionId: string;
  /** Server save time (UTC), not when the session was run. */
  readonly createdAt: string;
  /** Whole and fractional days since the previous comparable session. */
  readonly daysSincePrevious: number | null;
  readonly conditions: readonly ConditionValues[];
}

export interface ExcludedSession {
  readonly sessionId: string;
  readonly createdAt: string;
  readonly reason: ExclusionReason;
}

export interface TrendSeries {
  readonly experimentId: SaveExperimentId;
  readonly conditions: readonly string[];
  readonly included: readonly IncludedSession[];
  readonly excluded: readonly ExcludedSession[];
  /** True when at least MIN_SESSIONS_FOR_SERIES sessions are comparable. */
  readonly seriesAvailable: boolean;
}

/** Oldest first; ties (same save time) by session ID, as the backend orders. */
function byOrder(a: StoredSessionSummary, b: StoredSessionSummary): number {
  if (a.created_at !== b.created_at) {
    return Date.parse(a.created_at) - Date.parse(b.created_at);
  }
  return a.session_id < b.session_id ? -1 : a.session_id > b.session_id ? 1 : 0;
}

function exclusionFor(
  experimentId: SaveExperimentId,
  input: TrendInput,
): ExclusionReason | null {
  const { summary } = input;
  if (summary.experiment_id !== experimentId) return "other_experiment";
  if (input.kind === "unsupported_version" || !isSupportedVersion(summary)) {
    return "unsupported_version";
  }
  if (input.kind === "not_loaded") return "not_loaded";
  const { result } = input;
  if (!result.ok) {
    if (result.problem.code === "not_complete") return "not_complete";
    if (result.problem.code === "unsupported_version")
      return "unsupported_version";
    return "invalid_data";
  }
  if (result.experimentId !== experimentId) return "other_experiment";
  if (result.results.analysisVersion !== ANALYSIS_VERSION)
    return "analysis_version";
  if (!result.results.isComplete || !result.results.conditions)
    return "not_complete";
  return null;
}

/** Builds the comparable series for ONE experiment. */
export function buildTrendSeries(
  experimentId: SaveExperimentId,
  inputs: readonly TrendInput[],
  conditions: readonly string[],
): TrendSeries {
  const ordered = [...inputs].sort((a, b) => byOrder(a.summary, b.summary));
  const included: IncludedSession[] = [];
  const excluded: ExcludedSession[] = [];
  for (const input of ordered) {
    const reason = exclusionFor(experimentId, input);
    if (reason !== null || input.kind !== "analysed" || !input.result.ok) {
      excluded.push({
        sessionId: input.summary.session_id,
        createdAt: input.summary.created_at,
        reason: reason ?? "invalid_data",
      });
      continue;
    }
    const results = input.result.results;
    const previous = included.at(-1);
    included.push({
      number: included.length + 1,
      sessionId: input.summary.session_id,
      createdAt: input.summary.created_at,
      daysSincePrevious: previous
        ? (Date.parse(input.summary.created_at) -
            Date.parse(previous.createdAt)) /
          DAY_MS
        : null,
      conditions: conditions.map((condition) => {
        const entry = (results.conditions ?? []).find(
          (candidate) => candidate.condition === condition,
        );
        return entry
          ? {
              condition,
              medianRt: entry.medianCorrectRt,
              correctRtCount: entry.correctRtCount,
              accuracy: entry.rates.responseAccuracy,
              timeouts: entry.counts.timeout,
              successfulResponseRate: entry.rates.successfulResponseRate,
            }
          : {
              condition,
              medianRt: { available: false, reason: "no_correct_responses" },
              correctRtCount: 0,
              accuracy: { available: false, reason: "zero_denominator" },
              timeouts: null,
              successfulResponseRate: {
                available: false,
                reason: "zero_denominator",
              },
            };
      }),
    });
  }
  return {
    experimentId,
    conditions,
    included,
    excluded,
    seriesAvailable: included.length >= MIN_SESSIONS_FOR_SERIES,
  };
}

export type TrendMetric = "medianRt" | "accuracy";

/** A session's value for one condition and metric, or null when missing. */
export function metricValue(
  session: IncludedSession,
  condition: string,
  metric: TrendMetric,
): number | null {
  const entry = session.conditions.find((c) => c.condition === condition);
  if (!entry) return null;
  if (metric === "medianRt") {
    return entry.medianRt.available ? entry.medianRt.valueMs : null;
  }
  return entry.accuracy.available ? entry.accuracy.value : null;
}

export type EarlierRange =
  /** Fewer than MIN_EARLIER_SESSIONS_FOR_RANGE earlier sessions have a value. */
  | {
      status: "insufficient";
      earlierWithValue: number;
      required: number;
      value: number | null;
    }
  | {
      status: "available";
      /** Lowest and highest value among the earlier sessions. */
      min: number;
      max: number;
      /** Earlier sessions with a value (the range's basis). */
      count: number;
      sessionNumbers: readonly number[];
      /** The selected session's own value; null when it has none. */
      value: number | null;
      position: "below" | "within" | "above" | null;
    };

/**
 * The lowest-to-highest range of one metric across the sessions BEFORE the
 * selected one (the selected session is never part of its own reference).
 * Purely descriptive: where the selected value lies relative to the user's
 * own earlier values. No test, interval, percentage or trend is implied.
 */
export function earlierSessionRange(
  series: TrendSeries,
  selectedNumber: number,
  condition: string,
  metric: TrendMetric,
): EarlierRange {
  const selected = series.included.find((s) => s.number === selectedNumber);
  const value = selected ? metricValue(selected, condition, metric) : null;
  const earlier = series.included
    .filter((s) => s.number < selectedNumber)
    .map((s) => ({
      number: s.number,
      value: metricValue(s, condition, metric),
    }))
    .filter(
      (entry): entry is { number: number; value: number } =>
        entry.value !== null,
    );
  if (earlier.length < MIN_EARLIER_SESSIONS_FOR_RANGE) {
    return {
      status: "insufficient",
      earlierWithValue: earlier.length,
      required: MIN_EARLIER_SESSIONS_FOR_RANGE,
      value,
    };
  }
  const values = earlier.map((entry) => entry.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    status: "available",
    min,
    max,
    count: earlier.length,
    sessionNumbers: earlier.map((entry) => entry.number),
    value,
    position:
      value === null
        ? null
        : value < min
          ? "below"
          : value > max
            ? "above"
            : "within",
  };
}
