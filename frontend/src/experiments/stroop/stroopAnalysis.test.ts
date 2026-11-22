import { describe, expect, it } from "vitest";
import type {
  SessionRecordStatus,
  TrialOutcome,
  TrialRecord,
} from "../../engine/contracts";
import type {
  InterruptionEventSource,
  InterruptionReason,
} from "../../engine/interruption";
import type {
  KeyboardEventLike,
  KeyboardInputSource,
} from "../../engine/input";
import { ExperimentLifecycle } from "../../engine/lifecycle";
import { FakeDeadlineScheduler, FakeMonotonicClock } from "../../engine/timing";
import { TrialRuntime } from "../../engine/trialRuntime";
import {
  STROOP_CONFIGURATION,
  STROOP_RESPONSE_MAPPING,
  type StroopCondition,
  type StroopResponse,
  type StroopTrial,
} from "./stroop";
import {
  computeStroopResults,
  median,
  type ContrastResult,
  type StroopSessionResults,
} from "./stroopAnalysis";
import { createStroopSchedule } from "./stroopSchedule";

type TestRecord = TrialRecord<unknown, string, StroopResponse>;

let sequence = 0;
function makeRecord(
  condition: string,
  outcome: TrialOutcome,
  reactionTimeMs: number | null = null,
  phase: "practice" | "main" = "main",
): TestRecord {
  sequence += 1;
  return {
    experiment: {
      experimentId: "stroop",
      protocolId: "HB-STROOP-1.0",
      protocolVersion: "1.0",
      configurationId: "HB-STROOP-1.0",
      configurationVersion: "1.0",
    },
    sessionId: "test",
    trialId: `t-${sequence}`,
    phase,
    trialIndex: sequence,
    condition,
    stimulus: null,
    correctResponse: "d",
    response:
      outcome.category === "correct" || outcome.category === "incorrect"
        ? {
            value: outcome.category === "correct" ? "d" : "f",
            inputSource: "keyboard",
            timestampMs: 1000 + (reactionTimeMs ?? 0),
            accepted: true,
          }
        : null,
    lifecycleState: "completed",
    outcome,
    timing: {
      fixationOnsetMs: 500,
      stimulusOnsetMs: 1000,
      responseTimestampMs: null,
      deadlineMs: 3000,
      trialEndMs: null,
      stimulusOffsetMs: null,
      itiEndMs: null,
      reactionTimeMs,
      trialDurationMs: null,
      timingSource: "injected",
    },
    randomization: {
      seedUnsigned32: 1,
      prngAndScheduleId: "HB-STROOP-shuffle-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: [],
      realizedMainOrder: [],
    },
  };
}

const correct = (condition: string, rt: number) =>
  makeRecord(condition, { category: "correct" }, rt);
const incorrect = (condition: string, rt: number) =>
  makeRecord(condition, { category: "incorrect" }, rt);
const timeout = (condition: string) =>
  makeRecord(condition, { category: "timeout" });
const invalid = (
  condition: string,
  reason: "visibility_lost" | "interrupt" | "focus_lost" = "interrupt",
) => makeRecord(condition, { category: "invalid", reason });

function repeat<T>(count: number, factory: (index: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => factory(index));
}

function results(
  records: TestRecord[],
  status: SessionRecordStatus = "complete",
): StroopSessionResults {
  return computeStroopResults({
    status,
    records,
    breakTaken: false,
    breakDurationMs: 0,
  });
}

function condition(result: StroopSessionResults, name: StroopCondition) {
  const entry = result.conditions?.find((item) => item.condition === name);
  if (!entry) throw new Error(`missing ${name}`);
  return entry;
}

function contrast(result: StroopSessionResults, id: ContrastResult["id"]) {
  const entry = result.contrasts?.find((item) => item.id === id);
  if (!entry) throw new Error(`missing ${id}`);
  return entry;
}

/** 20 analysable trials per condition with chosen correct RTs. */
function balancedSession(rts: Partial<Record<StroopCondition, number[]>>) {
  const records: TestRecord[] = [];
  for (const name of ["congruent", "incongruent", "neutral"] as const) {
    const values = rts[name] ?? repeat(20, () => 500);
    records.push(...values.map((rt) => correct(name, rt)));
    records.push(...repeat(20 - values.length, () => timeout(name)));
  }
  return records;
}

describe("median", () => {
  it("uses the middle value for odd counts and the mean of the middle two for even counts", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([40, 10, 30, 20])).toBe(25);
    expect(median([5])).toBe(5);
    expect(median([])).toBeNull();
  });
});

describe("computeStroopResults: counts and rates (protocol §9–§10)", () => {
  it("uses the three approved denominators and excludes invalid trials from all of them", () => {
    const records = [
      ...repeat(12, (i) => correct("congruent", 500 + i)),
      ...repeat(3, () => incorrect("congruent", 450)),
      ...repeat(4, () => timeout("congruent")),
      invalid("congruent", "visibility_lost"),
      ...balancedSession({ congruent: [] }).filter(
        (record) => record.condition !== "congruent",
      ),
    ];
    const result = results(records);
    const congruent = condition(result, "congruent");

    expect(congruent.counts).toEqual({
      correct: 12,
      incorrect: 3,
      timeout: 4,
      invalid: 1,
      analysable: 19,
      responded: 15,
      recorded: 20,
    });
    expect(congruent.rates.responseAccuracy).toEqual({
      available: true,
      numerator: 12,
      denominator: 15,
      value: 12 / 15,
    });
    expect(congruent.rates.successfulResponseRate).toEqual({
      available: true,
      numerator: 12,
      denominator: 19,
      value: 12 / 19,
    });
    expect(congruent.rates.timeoutRate).toEqual({
      available: true,
      numerator: 4,
      denominator: 19,
      value: 4 / 19,
    });
    expect(result.invalidReasons).toEqual({ visibility_lost: 1 });
    expect(result.main.invalid).toBe(1);
  });

  it("reports rates as unavailable, not zero, when a denominator is zero", () => {
    const records = [
      ...repeat(20, () => timeout("congruent")),
      ...repeat(20, () => invalid("incongruent")),
      ...repeat(20, (i) => correct("neutral", 500 + i)),
    ];
    const result = results(records);
    const congruent = condition(result, "congruent");
    expect(congruent.rates.responseAccuracy).toEqual({
      available: false,
      reason: "zero_denominator",
    });
    // Timeouts are analysable: success rate is a real 0 of 20.
    expect(congruent.rates.successfulResponseRate).toMatchObject({
      available: true,
      numerator: 0,
      denominator: 20,
      value: 0,
    });
    expect(congruent.rates.timeoutRate).toMatchObject({ value: 1 });

    const incongruent = condition(result, "incongruent");
    expect(incongruent.rates.responseAccuracy.available).toBe(false);
    expect(incongruent.rates.successfulResponseRate.available).toBe(false);
    expect(incongruent.rates.timeoutRate.available).toBe(false);
    expect(incongruent.medianCorrectRt).toEqual({
      available: false,
      reason: "no_correct_responses",
    });
  });

  it("never counts a timeout or invalid trial as an incorrect response", () => {
    const records = [
      ...repeat(20, () => timeout("congruent")),
      ...repeat(20, () => invalid("incongruent")),
      ...repeat(20, () => timeout("neutral")),
    ];
    const result = results(records);
    expect(result.main.incorrect).toBe(0);
    expect(result.main.responded).toBe(0);
    expect(result.overallRates?.responseAccuracy.available).toBe(false);
  });

  it("computes overall rates across conditions from main trials", () => {
    const records = [
      ...repeat(15, (i) => correct("congruent", 500 + i)),
      ...repeat(5, () => incorrect("congruent", 600)),
      ...repeat(10, (i) => correct("incongruent", 600 + i)),
      ...repeat(10, () => timeout("incongruent")),
      ...repeat(19, (i) => correct("neutral", 550 + i)),
      invalid("neutral"),
    ];
    const overall = results(records).overallRates;
    expect(overall?.responseAccuracy).toMatchObject({
      numerator: 44,
      denominator: 49,
    });
    expect(overall?.successfulResponseRate).toMatchObject({
      numerator: 44,
      denominator: 59,
    });
    expect(overall?.timeoutRate).toMatchObject({
      numerator: 10,
      denominator: 59,
    });
  });
});

describe("computeStroopResults: reaction time", () => {
  it("uses only correct main-trial RTs (not incorrect, timeout, invalid, or practice)", () => {
    const records = [
      ...repeat(11, (i) => correct("congruent", 400 + i * 10)), // 400..500
      incorrect("congruent", 100),
      incorrect("congruent", 1900),
      makeRecord("congruent", { category: "correct" }, 50, "practice"),
      makeRecord("congruent", { category: "correct" }, 60, "practice"),
      ...repeat(7, () => timeout("congruent")),
      ...balancedSession({}).filter(
        (record) => record.condition !== "congruent",
      ),
    ];
    const result = results(records);
    const congruent = condition(result, "congruent");
    expect(congruent.correctRtCount).toBe(11);
    expect(congruent.medianCorrectRt).toEqual({
      available: true,
      valueMs: 450,
      count: 11,
    });
    expect(result.practiceRecorded).toBe(2);
    expect(congruent.counts.recorded).toBe(20);
  });

  it("applies the 10-correct-response display rule per condition", () => {
    const nine = results(balancedSession({ congruent: repeat(9, () => 500) }));
    expect(condition(nine, "congruent").medianCorrectRt).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
    const ten = results(balancedSession({ congruent: repeat(10, () => 500) }));
    expect(condition(ten, "congruent").medianCorrectRt).toEqual({
      available: true,
      valueMs: 500,
      count: 10,
    });
  });

  it("does not remove unusually fast or slow valid responses", () => {
    const rts = [...repeat(18, () => 500), 1, 1999];
    const result = results(balancedSession({ neutral: rts }));
    expect(condition(result, "neutral").correctRtCount).toBe(20);
  });
});

describe("computeStroopResults: contrasts (protocol §10 table)", () => {
  it("computes RT contrasts as first − second with positive meaning slower", () => {
    const result = results(
      balancedSession({
        congruent: repeat(20, () => 550),
        incongruent: repeat(20, () => 700),
        neutral: repeat(20, () => 600),
      }),
    );
    expect(contrast(result, "interference").reactionTime).toEqual({
      available: true,
      valueMs: 100,
      firstMedianMs: 700,
      secondMedianMs: 600,
    });
    expect(contrast(result, "facilitation").reactionTime).toMatchObject({
      valueMs: 50,
    });
    expect(contrast(result, "congruency").reactionTime).toMatchObject({
      valueMs: 150,
    });
  });

  it("produces negative RT contrasts when the first condition is faster", () => {
    const result = results(
      balancedSession({
        congruent: repeat(20, () => 650),
        incongruent: repeat(20, () => 500),
        neutral: repeat(20, () => 600),
      }),
    );
    expect(contrast(result, "interference").reactionTime).toMatchObject({
      valueMs: -100,
    });
    expect(contrast(result, "facilitation").reactionTime).toMatchObject({
      valueMs: -50,
    });
  });

  it("orders rate contrasts as in the protocol (e.g. interference = neutral − incongruent)", () => {
    const records = [
      ...repeat(20, (i) => correct("congruent", 500 + i)), // accuracy 1.0
      ...repeat(15, (i) => correct("incongruent", 600 + i)),
      ...repeat(5, () => incorrect("incongruent", 600)), // accuracy 0.75
      ...repeat(18, (i) => correct("neutral", 550 + i)),
      ...repeat(2, () => incorrect("neutral", 550)), // accuracy 0.9
    ];
    const result = results(records);
    const interference = contrast(result, "interference");
    expect(interference.rateFirst).toBe("neutral");
    expect(interference.rateSecond).toBe("incongruent");
    expect(interference.responseAccuracy).toMatchObject({
      first: 0.9,
      second: 0.75,
    });
    expect(
      interference.responseAccuracy.available &&
        interference.responseAccuracy.value,
    ).toBeCloseTo(0.15, 12);
    expect(
      contrast(result, "facilitation").responseAccuracy.available &&
        (contrast(result, "facilitation").responseAccuracy as { value: number })
          .value,
    ).toBeCloseTo(0.1, 12);
    expect(
      (
        contrast(result, "congruency").successfulResponseRate as {
          value: number;
        }
      ).value,
    ).toBeCloseTo(0.25, 12);
  });

  it("withholds an RT contrast when either condition is below the display rule, but keeps rate contrasts", () => {
    const result = results(
      balancedSession({
        congruent: repeat(20, () => 500),
        incongruent: repeat(9, () => 700),
        neutral: repeat(20, () => 600),
      }),
    );
    expect(contrast(result, "interference").reactionTime).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
    expect(contrast(result, "congruency").reactionTime.available).toBe(false);
    expect(contrast(result, "facilitation").reactionTime).toMatchObject({
      available: true,
      valueMs: 100,
    });
    expect(
      contrast(result, "interference").successfulResponseRate.available,
    ).toBe(true);
  });

  it("withholds a rate contrast when either denominator is zero", () => {
    const records = [
      ...repeat(20, (i) => correct("congruent", 500 + i)),
      ...repeat(20, () => timeout("incongruent")),
      ...repeat(20, (i) => correct("neutral", 500 + i)),
    ];
    const result = results(records);
    expect(contrast(result, "interference").responseAccuracy).toEqual({
      available: false,
      reason: "zero_denominator",
    });
    expect(
      contrast(result, "interference").successfulResponseRate.available,
    ).toBe(true);
  });
});

describe("computeStroopResults: accuracy-contrast operand order and sign (protocol §10)", () => {
  it("defines every contrast's RT and rate operands exactly as the protocol table", () => {
    const result = results(balancedSession({}));
    const operands = result.contrasts?.map((entry) => ({
      id: entry.id,
      rt: `${entry.rtFirst} - ${entry.rtSecond}`,
      rate: `${entry.rateFirst} - ${entry.rateSecond}`,
    }));
    expect(operands).toEqual([
      {
        id: "interference",
        rt: "incongruent - neutral",
        rate: "neutral - incongruent",
      },
      {
        id: "facilitation",
        rt: "neutral - congruent",
        rate: "congruent - neutral",
      },
      {
        id: "congruency",
        rt: "incongruent - congruent",
        rate: "congruent - incongruent",
      },
    ]);
  });

  it("gives negative accuracy and success contrasts when the first rate operand is lower", () => {
    // congruent 0.80, incongruent 0.95, neutral 0.90 (no timeouts, so the
    // successful response rate equals response accuracy).
    const result = results([
      ...repeat(16, (i) => correct("congruent", 500 + i)),
      ...repeat(4, () => incorrect("congruent", 500)),
      ...repeat(19, (i) => correct("incongruent", 600 + i)),
      incorrect("incongruent", 600),
      ...repeat(18, (i) => correct("neutral", 550 + i)),
      ...repeat(2, () => incorrect("neutral", 550)),
    ]);
    const expected = {
      interference: { first: 0.9, second: 0.95, value: -0.05 },
      facilitation: { first: 0.8, second: 0.9, value: -0.1 },
      congruency: { first: 0.8, second: 0.95, value: -0.15 },
    } as const;
    for (const [id, values] of Object.entries(expected)) {
      for (const measure of [
        "responseAccuracy",
        "successfulResponseRate",
      ] as const) {
        const value = contrast(result, id as ContrastResult["id"])[measure];
        expect(value.available, `${id} ${measure}`).toBe(true);
        if (!value.available) continue;
        expect(value.first, `${id} ${measure} first`).toBeCloseTo(
          values.first,
          12,
        );
        expect(value.second, `${id} ${measure} second`).toBeCloseTo(
          values.second,
          12,
        );
        expect(value.value, `${id} ${measure} value`).toBeCloseTo(
          values.value,
          12,
        );
      }
    }
  });

  it("gives positive accuracy and success contrasts for every contrast when the first rate operand is higher", () => {
    // congruent 1.00, incongruent 0.75, neutral 0.90.
    const result = results([
      ...repeat(20, (i) => correct("congruent", 500 + i)),
      ...repeat(15, (i) => correct("incongruent", 600 + i)),
      ...repeat(5, () => incorrect("incongruent", 600)),
      ...repeat(18, (i) => correct("neutral", 550 + i)),
      ...repeat(2, () => incorrect("neutral", 550)),
    ]);
    const expected = {
      interference: 0.15,
      facilitation: 0.1,
      congruency: 0.25,
    };
    for (const [id, value] of Object.entries(expected)) {
      for (const measure of [
        "responseAccuracy",
        "successfulResponseRate",
      ] as const) {
        const entry = contrast(result, id as ContrastResult["id"])[measure];
        expect(entry.available && entry.value, `${id} ${measure}`).toBeCloseTo(
          value,
          12,
        );
      }
    }
  });
});

describe("computeStroopResults: incomplete sessions", () => {
  for (const status of [
    "incomplete",
    "interrupted",
    "technical_error",
  ] as const) {
    it(`shows only counts for a ${status} session`, () => {
      const records = [
        ...repeat(12, () =>
          makeRecord("neutral", { category: "correct" }, 400, "practice"),
        ),
        ...repeat(15, (i) => correct("congruent", 500 + i)),
        timeout("neutral"),
        invalid("incongruent", "focus_lost"),
      ];
      const result = results(records, status);
      expect(result.isComplete).toBe(false);
      expect(result.conditions).toBeNull();
      expect(result.contrasts).toBeNull();
      expect(result.overallRates).toBeNull();
      expect(result.main).toMatchObject({
        recorded: 17,
        correct: 15,
        timeout: 1,
        invalid: 1,
      });
      expect(result.unpresentedMain).toBe(43);
      expect(result.practiceRecorded).toBe(12);
    });
  }

  it("keeps a complete session with invalid trials complete", () => {
    const records = balancedSession({}).map((record, index) =>
      index === 0 ? invalid(record.condition) : record,
    );
    const result = results(records);
    expect(result.isComplete).toBe(true);
    expect(result.main.invalid).toBe(1);
    expect(result.unpresentedMain).toBe(0);
    expect(condition(result, "congruent").counts.analysable).toBe(19);
  });

  it("does not attribute records with an unknown condition", () => {
    const result = results([correct("mystery", 500)]);
    expect(result.unrecognizedRecords).toBe(1);
    expect(result.main.recorded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: real Stroop schedule → real lifecycle → real TrialRuntime.

class TestKeyboard implements KeyboardInputSource {
  private listener: ((event: KeyboardEventLike) => void) | null = null;
  subscribe(listener: (event: KeyboardEventLike) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(key: string): void {
    this.listener?.({ key, repeat: false });
  }
}

class TestInterruptions implements InterruptionEventSource {
  private listener: ((reason: InterruptionReason) => void) | null = null;
  subscribe(listener: (reason: InterruptionReason) => void): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }
  emit(reason: InterruptionReason): void {
    this.listener?.(reason);
  }
}

type Plan =
  | { kind: "correct"; rt: number }
  | { kind: "incorrect"; rt: number }
  | { kind: "timeout" }
  | { kind: "interrupt" };

function planFor(index: number): Plan {
  if (index === 7 || index === 41) return { kind: "interrupt" };
  if (index % 10 === 0) return { kind: "timeout" };
  if (index % 7 === 3) return { kind: "incorrect", rt: 900 + index };
  return { kind: "correct", rt: 400 + index * 3 };
}

function wrongKey(correctKey: StroopResponse): StroopResponse {
  const other = STROOP_RESPONSE_MAPPING.find(
    (mapping) => mapping.responseValue !== correctKey,
  );
  return (other as (typeof STROOP_RESPONSE_MAPPING)[number]).responseValue;
}

function runSession(stopAfterMain?: number) {
  const schedule = createStroopSchedule(1234);
  const lifecycle = new ExperimentLifecycle<unknown, string, StroopResponse>(
    "integration",
    STROOP_CONFIGURATION,
    schedule,
    {
      seedUnsigned32: schedule.metadata.seedUnsigned32,
      prngAndScheduleId: schedule.metadata.prngAndScheduleId,
      randomizationConfigurationVersion:
        schedule.metadata.randomizationConfigurationVersion,
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: schedule.metadata.realizedPracticeOrder,
      realizedMainOrder: schedule.metadata.realizedMainOrder,
    },
  );
  const clock = new FakeMonotonicClock(0);
  const scheduler = new FakeDeadlineScheduler(0);
  let now = 1000;

  const runTrial = (trial: StroopTrial, plan: Plan) => {
    const keyboard = new TestKeyboard();
    const interruptions = new TestInterruptions();
    const runtime = new TrialRuntime(
      lifecycle,
      clock,
      scheduler,
      keyboard,
      STROOP_RESPONSE_MAPPING,
      interruptions,
    );
    clock.set(now);
    scheduler.setNow(now);
    expect(runtime.start(trial, 2000, now, now - 500)).toEqual({ ok: true });
    if (plan.kind === "correct" || plan.kind === "incorrect") {
      clock.set(now + plan.rt);
      keyboard.emit(
        plan.kind === "correct"
          ? trial.correctResponse
          : wrongKey(trial.correctResponse),
      );
    } else if (plan.kind === "timeout") {
      scheduler.advanceTo(now + 2000);
    } else {
      clock.set(now + 300);
      interruptions.emit("window_blur");
      expect(lifecycle.dispatch({ type: "RESUME" })).toEqual({ ok: true });
    }
    now += 4000;
  };

  lifecycle.dispatch({ type: "OPEN_INSTRUCTIONS" });
  lifecycle.dispatch({ type: "BEGIN_PRACTICE" });
  for (const trial of schedule.practice)
    runTrial(trial, { kind: "correct", rt: 450 });
  lifecycle.dispatch({ type: "BEGIN_MAIN" });
  for (const trial of schedule.main) {
    if (stopAfterMain !== undefined && trial.index > stopAfterMain) break;
    if (trial.index === 31) {
      lifecycle.dispatch({ type: "OFFER_BREAK" });
      lifecycle.dispatch({ type: "SKIP_BREAK" });
    }
    runTrial(trial, planFor(trial.index));
  }
  if (stopAfterMain === undefined) {
    expect(lifecycle.dispatch({ type: "COMPLETE" })).toEqual({ ok: true });
  } else {
    lifecycle.dispatch({ type: "ABORT" });
  }
  const snapshot = lifecycle.getSnapshot();
  return {
    schedule,
    snapshot,
    results: computeStroopResults({
      status: snapshot.status,
      records: snapshot.records,
      breakTaken: snapshot.breakTaken,
      breakDurationMs: snapshot.breakDurationMs,
    }),
  };
}

describe("computeStroopResults: integration with real engine records", () => {
  it("matches an independent tally of the realized seed-1234 schedule", () => {
    const { schedule, results: result } = runSession();
    expect(result.status).toBe("complete");
    expect(result.practiceRecorded).toBe(12);
    expect(result.main.recorded).toBe(60);
    expect(result.unpresentedMain).toBe(0);
    expect(result.invalidReasons).toEqual({ interrupt: 2 });
    expect(result.breakDurationMs).toBe(0);

    for (const name of ["congruent", "incongruent", "neutral"] as const) {
      const trials = schedule.main.filter((trial) => trial.condition === name);
      const plans = trials.map((trial) => planFor(trial.index));
      const count = (kind: Plan["kind"]) =>
        plans.filter((plan) => plan.kind === kind).length;
      const correctRts = plans
        .filter(
          (plan): plan is { kind: "correct"; rt: number } =>
            plan.kind === "correct",
        )
        .map((plan) => plan.rt)
        .sort((a, b) => a - b);
      const mid = correctRts.length / 2;
      const expectedMedian =
        correctRts.length % 2 === 1
          ? correctRts[Math.floor(mid)]
          : (correctRts[mid - 1] + correctRts[mid]) / 2;

      const entry = condition(result, name);
      expect(entry.counts.correct).toBe(count("correct"));
      expect(entry.counts.incorrect).toBe(count("incorrect"));
      expect(entry.counts.timeout).toBe(count("timeout"));
      expect(entry.counts.invalid).toBe(count("interrupt"));
      expect(entry.rates.responseAccuracy).toMatchObject({
        numerator: count("correct"),
        denominator: count("correct") + count("incorrect"),
      });
      expect(entry.rates.successfulResponseRate).toMatchObject({
        denominator: count("correct") + count("incorrect") + count("timeout"),
      });
      if (correctRts.length >= 10) {
        expect(entry.medianCorrectRt).toEqual({
          available: true,
          valueMs: expectedMedian,
          count: correctRts.length,
        });
      } else {
        expect(entry.medianCorrectRt.available).toBe(false);
      }
    }
  });

  it("reports an aborted real session as incomplete with unpresented trials", () => {
    const { results: result } = runSession(25);
    expect(result.status).toBe("incomplete");
    expect(result.main.recorded).toBe(25);
    expect(result.unpresentedMain).toBe(35);
    expect(result.conditions).toBeNull();
    expect(result.contrasts).toBeNull();
    expect(result.invalidReasons).toEqual({ interrupt: 1 });
  });
});
