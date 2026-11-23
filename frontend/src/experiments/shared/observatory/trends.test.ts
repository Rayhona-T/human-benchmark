import { describe, expect, it } from "vitest";
import { fakeSession } from "../../../pages/observatory/fakeBackend";
import { computeStroopResults } from "../../stroop/stroopAnalysis";
import { STROOP_CONFIGURATION } from "../../stroop/stroop";
import type { StoredSessionSummary } from "./observatoryClient";
import { adaptStoredSession, analyseStoredSession } from "./storedSession";
import {
  buildTrendSeries,
  earlierSessionRange,
  metricValue,
  MIN_EARLIER_SESSIONS_FOR_RANGE,
  MIN_SESSIONS_FOR_SERIES,
  type IncludedSession,
  type TrendInput,
  type TrendSeries,
} from "./trends";

const CONDITIONS = STROOP_CONFIGURATION.conditions;
type Detail = ReturnType<typeof fakeSession>["detail"];

function summaryOf(detail: Detail): StoredSessionSummary {
  return {
    session_id: detail.session_id,
    data_schema_version: detail.data_schema_version,
    experiment_id: detail.experiment_id as "stroop" | "flanker",
    protocol_id: detail.protocol_id,
    protocol_version: detail.protocol_version,
    configuration_id: detail.configuration_id,
    configuration_version: detail.configuration_version,
    status: detail.status,
    consent_notice_version: detail.consent_notice_version,
    created_at: detail.created_at,
    trial_counts: { practice: 12, main: 60 },
  };
}

function analysed(detail: Detail): TrendInput {
  return {
    summary: summaryOf(detail),
    kind: "analysed",
    result: analyseStoredSession(detail, {
      expectedSessionId: detail.session_id,
    }),
  };
}

const stroop = (index: number, change?: (d: Detail) => void) =>
  fakeSession(index, "stroop", change).detail;

/** Leaves only `keep` correct main trials in one condition (rest timeouts). */
function keepCorrect(condition: string, keep: number) {
  return (d: Detail) => {
    let kept = 0;
    for (const trial of d.trials) {
      if (trial.phase !== "main" || trial.condition !== condition) continue;
      if (trial.outcome !== "correct") continue;
      if (kept < keep) {
        kept += 1;
        continue;
      }
      trial.outcome = "timeout";
      trial.response_key = null;
      (trial as { reaction_time_ms: number | null }).reaction_time_ms = null;
      (
        trial.timing as { response_timestamp_ms: number | null }
      ).response_timestamp_ms = null;
    }
  };
}

describe("comparable series", () => {
  it("orders sessions by save time (oldest first) and numbers them", () => {
    // fakeSession: a higher index is saved earlier.
    const inputs = [stroop(1), stroop(3), stroop(2)].map(analysed);
    const series = buildTrendSeries("stroop", inputs, CONDITIONS);
    expect(series.included.map((s) => s.sessionId)).toEqual([
      stroop(3).session_id,
      stroop(2).session_id,
      stroop(1).session_id,
    ]);
    expect(series.included.map((s) => s.number)).toEqual([1, 2, 3]);
  });

  it("breaks equal save times by session ID, as the backend does", () => {
    const sameTime = "2026-11-20T10:00:00.000000Z";
    const a = stroop(8, (d) => (d.created_at = sameTime));
    const b = stroop(5, (d) => (d.created_at = sameTime));
    const series = buildTrendSeries("stroop", [b, a].map(analysed), CONDITIONS);
    expect(series.included.map((s) => s.sessionId)).toEqual(
      [a.session_id, b.session_id].sort(),
    );
  });

  it("never mixes in another experiment", () => {
    const inputs = [
      analysed(stroop(1)),
      analysed(fakeSession(2, "flanker").detail),
      analysed(stroop(3)),
    ];
    const series = buildTrendSeries("stroop", inputs, CONDITIONS);
    expect(series.included).toHaveLength(2);
    expect(series.excluded).toEqual([
      expect.objectContaining({ reason: "other_experiment" }),
    ]);
  });

  it("excludes sessions it cannot compare, with a reason for each", () => {
    const unsupported = stroop(4, (d) => (d.protocol_version = "2.0"));
    const incomplete = stroop(5, (d) => (d.status = "incomplete"));
    const malformed = stroop(6, (d) => {
      const trial = d.trials.find(
        (t) => t.phase === "main" && t.outcome === "correct",
      );
      if (trial)
        (trial as { reaction_time_ms: number | null }).reaction_time_ms = null;
    });
    const missing = stroop(7);
    const inputs: TrendInput[] = [
      analysed(stroop(1)),
      { summary: summaryOf(unsupported), kind: "unsupported_version" },
      analysed(incomplete),
      analysed(malformed),
      { summary: summaryOf(missing), kind: "not_loaded" },
      // A summary claiming a supported version whose detail says otherwise.
      analysed(stroop(8, (d) => (d.configuration_version = "9.9"))),
    ];
    const series = buildTrendSeries("stroop", inputs, CONDITIONS);
    expect(series.included.map((s) => s.sessionId)).toEqual([
      stroop(1).session_id,
    ]);
    const reasons = Object.fromEntries(
      series.excluded.map((e) => [e.sessionId, e.reason]),
    );
    expect(reasons).toEqual({
      [unsupported.session_id]: "unsupported_version",
      [incomplete.session_id]: "not_complete",
      [malformed.session_id]: "invalid_data",
      [missing.session_id]: "not_loaded",
      [stroop(8).session_id]: "unsupported_version",
    });
  });

  it.each([
    [MIN_SESSIONS_FOR_SERIES - 1, false],
    [MIN_SESSIONS_FOR_SERIES, true],
    [MIN_SESSIONS_FOR_SERIES + 1, true],
  ])(
    "with %i comparable sessions a series is available: %s",
    (count, available) => {
      const inputs = Array.from({ length: count }, (_, i) =>
        analysed(stroop(i + 1)),
      );
      expect(
        buildTrendSeries("stroop", inputs, CONDITIONS).seriesAvailable,
      ).toBe(available);
    },
  );

  it("does not count excluded sessions toward the 3-session threshold", () => {
    const inputs: TrendInput[] = [
      analysed(stroop(1)),
      analysed(stroop(2)),
      analysed(stroop(3, (d) => (d.status = "incomplete"))),
    ];
    expect(buildTrendSeries("stroop", inputs, CONDITIONS).seriesAvailable).toBe(
      false,
    );
  });

  it("records the interval since the previous comparable session", () => {
    const first = stroop(
      1,
      (d) => (d.created_at = "2026-01-01T09:00:00.000000Z"),
    );
    const sameDay = stroop(
      2,
      (d) => (d.created_at = "2026-01-01T17:30:00.000000Z"),
    );
    const later = stroop(
      3,
      (d) => (d.created_at = "2026-02-15T09:00:00.000000Z"),
    );
    const series = buildTrendSeries(
      "stroop",
      [later, first, sameDay].map(analysed),
      CONDITIONS,
    );
    expect(series.included.map((s) => s.daysSincePrevious)).toEqual([
      null,
      8.5 / 24,
      45 - 8.5 / 24,
    ]);
  });
});

describe("values come unchanged from the approved analysis", () => {
  it("uses each session's own median and accuracy, never pooled", () => {
    const detail = stroop(1);
    const series = buildTrendSeries("stroop", [analysed(detail)], CONDITIONS);
    const adapted = adaptStoredSession(detail);
    if (!adapted.ok) throw new Error("fixture must adapt");
    const reference = computeStroopResults(adapted.session.analysisInput);
    for (const condition of CONDITIONS) {
      const expected = reference.conditions?.find(
        (c) => c.condition === condition,
      );
      const entry = series.included[0].conditions.find(
        (c) => c.condition === condition,
      );
      expect(entry?.medianRt).toEqual(expected?.medianCorrectRt);
      expect(entry?.accuracy).toEqual(expected?.rates.responseAccuracy);
      expect(entry?.correctRtCount).toBe(expected?.correctRtCount);
    }
  });

  it("keeps each session's accuracy denominator its own", () => {
    const full = stroop(1);
    const fewer = stroop(2, keepCorrect("neutral", 9));
    const series = buildTrendSeries(
      "stroop",
      [full, fewer].map(analysed),
      CONDITIONS,
    );
    const neutral = (s: IncludedSession) =>
      s.conditions.find((c) => c.condition === "neutral")?.accuracy;
    const byId = (id: string) =>
      series.included.find((s) => s.sessionId === id)!;
    const a = neutral(byId(full.session_id));
    const b = neutral(byId(fewer.session_id));
    // Timeouts are not key presses, so the second session's denominator shrinks.
    expect(a?.available && b?.available).toBe(true);
    if (!a?.available || !b?.available) return;
    expect(b.denominator).toBeLessThan(a.denominator);
    expect(b.value).toBeCloseTo(b.numerator / b.denominator, 12);
  });

  it("gives no median below 10 correct responses (9 = missing, 10 = shown)", () => {
    const nine = stroop(1, keepCorrect("neutral", 9));
    const ten = stroop(2, keepCorrect("neutral", 10));
    const series = buildTrendSeries(
      "stroop",
      [nine, ten].map(analysed),
      CONDITIONS,
    );
    const byId = (id: string) =>
      series.included.find((s) => s.sessionId === id)!;
    expect(
      metricValue(byId(nine.session_id), "neutral", "medianRt"),
    ).toBeNull();
    expect(
      byId(nine.session_id).conditions.find((c) => c.condition === "neutral")
        ?.medianRt,
    ).toEqual({ available: false, reason: "below_display_minimum" });
    expect(metricValue(byId(ten.session_id), "neutral", "medianRt")).toEqual(
      expect.any(Number),
    );
    // Other conditions of the same session are unaffected.
    expect(metricValue(byId(nine.session_id), "congruent", "medianRt")).toEqual(
      expect.any(Number),
    );
  });
});

// --- Earlier-session range: explicit numbers -------------------------------

function seriesOf(values: (number | null)[]): TrendSeries {
  return {
    experimentId: "stroop",
    conditions: ["neutral"],
    excluded: [],
    seriesAvailable: values.length >= MIN_SESSIONS_FOR_SERIES,
    included: values.map((value, index) => ({
      number: index + 1,
      sessionId: `s${index + 1}`,
      createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T10:00:00.000000Z`,
      daysSincePrevious: index === 0 ? null : 1,
      conditions: [
        {
          condition: "neutral",
          medianRt:
            value === null
              ? { available: false, reason: "below_display_minimum" }
              : { available: true, valueMs: value, count: 12 },
          correctRtCount: value === null ? 9 : 12,
          accuracy: {
            available: true,
            numerator: 18,
            denominator: 20,
            value: 0.9,
          },
          timeouts: 0,
          successfulResponseRate: {
            available: true,
            numerator: 18,
            denominator: 20,
            value: 0.9,
          },
        },
      ],
    })),
  };
}

describe("earlier-session range", () => {
  it("needs 5 earlier sessions with a value; the selected session is excluded", () => {
    const series = seriesOf([500, 520, 480, 510, 530, 470]);
    // Session 5 has only 4 earlier sessions.
    expect(earlierSessionRange(series, 5, "neutral", "medianRt")).toEqual({
      status: "insufficient",
      earlierWithValue: 4,
      required: MIN_EARLIER_SESSIONS_FOR_RANGE,
      value: 530,
    });
    // Session 6: exactly 5 earlier sessions; its own 470 is not in the range.
    expect(earlierSessionRange(series, 6, "neutral", "medianRt")).toEqual({
      status: "available",
      min: 480,
      max: 530,
      count: 5,
      sessionNumbers: [1, 2, 3, 4, 5],
      value: 470,
      position: "below",
    });
  });

  it("skips earlier sessions without a value and never treats them as 0", () => {
    const series = seriesOf([500, null, 480, 510, 530, 490, 505]);
    const range = earlierSessionRange(series, 7, "neutral", "medianRt");
    expect(range).toMatchObject({
      status: "available",
      min: 480,
      max: 530,
      count: 5,
    });
    if (range.status === "available")
      expect(range.sessionNumbers).not.toContain(2);
    // Only 4 values before session 6 once the missing one is skipped.
    expect(earlierSessionRange(series, 6, "neutral", "medianRt")).toMatchObject(
      {
        status: "insufficient",
        earlierWithValue: 4,
      },
    );
  });

  it.each([
    [480, "within"],
    [530, "within"],
    [505, "within"],
    [479, "below"],
    [531, "above"],
  ])(
    "places a value of %i as %s (ends of the range count as within)",
    (value, position) => {
      const series = seriesOf([500, 520, 480, 510, 530, value]);
      expect(
        earlierSessionRange(series, 6, "neutral", "medianRt"),
      ).toMatchObject({ position });
    },
  );

  it("reports no position when the selected session has no value", () => {
    const series = seriesOf([500, 520, 480, 510, 530, null]);
    expect(earlierSessionRange(series, 6, "neutral", "medianRt")).toMatchObject(
      {
        status: "available",
        value: null,
        position: null,
      },
    );
  });
});
