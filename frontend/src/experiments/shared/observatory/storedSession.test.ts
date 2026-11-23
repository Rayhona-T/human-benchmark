/**
 * Stored-session adapter: validation, version policy, faithfulness.
 * Inputs start from real backend responses
 * (observatory/__fixtures__/*-stored-detail.json) and are then broken on
 * purpose.
 */
import { describe, expect, it } from "vitest";
import { computeStroopResults } from "../../stroop/stroopAnalysis";
import flankerStored from "./__fixtures__/flanker-stored-detail.json";
import stroopStored from "./__fixtures__/stroop-stored-detail.json";
import {
  adaptStoredSession,
  analyseStoredSession,
  type StoredSessionProblemCode,
} from "./storedSession";

type Detail = typeof stroopStored;
type Trial = Detail["trials"][number];

const clone = <T>(value: T): T => structuredClone(value);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function stroop(change?: (detail: Detail) => void): Detail {
  const detail = clone(stroopStored);
  change?.(detail);
  return detail;
}

/** Index in `trials` of the first main trial matching `test`. */
function mainIndex(detail: Detail, test: (trial: Trial) => boolean): number {
  const index = detail.trials.findIndex(
    (trial) => trial.phase === "main" && test(trial),
  );
  if (index < 0) throw new Error("test setup: no such trial");
  return index;
}

function expectProblem(
  value: unknown,
  code: StoredSessionProblemCode,
  location?: string,
) {
  const result = adaptStoredSession(value);
  expect(result.ok).toBe(false);
  if (result.ok) return result;
  expect(result.problem.code).toBe(code);
  expect(result.problem.message.length).toBeGreaterThan(20);
  if (location !== undefined) {
    expect(result.problem.details.map((detail) => detail.location)).toContain(
      location,
    );
  }
  // Nothing is analysed either.
  expect(analyseStoredSession(value).ok).toBe(false);
  return result;
}

describe("valid stored sessions", () => {
  it.each([
    ["stroop", stroopStored],
    ["flanker", flankerStored],
  ])("a real stored %s session is accepted", (experiment, detail) => {
    const result = analyseStoredSession(detail);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.experimentId).toBe(experiment);
    expect(result.session.sessionId).toBe(detail.session_id);
    expect(result.session.createdAt).toBe(detail.created_at);
    expect(result.session.consentNoticeVersion).toBe(
      detail.consent_notice_version,
    );
    expect(result.session.analysisInput.records).toHaveLength(72);
    expect(result.session.randomization).toEqual(detail.randomization);
  });

  it("does not change its input", () => {
    const detail = deepFreeze(stroop());
    expect(() => analyseStoredSession(detail)).not.toThrow();
    expect(detail).toEqual(stroopStored);
  });

  it("missing RTs are accepted where the protocol has none (timeouts and invalid trials)", () => {
    const withoutRt = stroopStored.trials.filter(
      (trial) => trial.phase === "main" && trial.reaction_time_ms === null,
    );
    const outcomes = new Set(withoutRt.map((trial) => trial.outcome));
    expect(outcomes).toEqual(new Set(["timeout", "invalid"]));

    const result = analyseStoredSession(stroopStored);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.results.main.timeout).toBeGreaterThan(0);
    expect(result.results.main.invalid).toBeGreaterThan(0);
    expect(result.results.correctMissingRt).toBe(0);
  });

  it("too few correct responses leave the median unavailable, never zero", () => {
    // Turn every correct main "neutral" trial except 9 into a timeout,
    // consistently (no key, no RT, no response time), as a real session could.
    const detail = stroop((d) => {
      let kept = 0;
      for (const trial of d.trials) {
        if (trial.phase !== "main" || trial.condition !== "neutral") continue;
        if (trial.outcome !== "correct") continue;
        if (kept < 9) {
          kept += 1;
          continue;
        }
        trial.outcome = "timeout";
        trial.response_key = null;
        trial.reaction_time_ms = null;
        trial.timing.response_timestamp_ms = null;
      }
    });
    const result = analyseStoredSession(detail);
    expect(result.ok).toBe(true);
    if (!result.ok || result.experimentId !== "stroop") return;
    const neutral = result.results.conditions?.find(
      (entry) => entry.condition === "neutral",
    );
    expect(neutral?.correctRtCount).toBe(9);
    expect(neutral?.medianCorrectRt).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
    const interference = result.results.contrasts?.find(
      (entry) => entry.id === "interference",
    );
    expect(interference?.reactionTime).toEqual({
      available: false,
      reason: "below_display_minimum",
    });
  });

  it("a single changed stored RT changes the results (the equivalence check is not vacuous)", () => {
    const original = analyseStoredSession(stroopStored);
    const detail = stroop((d) => {
      const index = mainIndex(d, (trial) => trial.outcome === "correct");
      const trial = d.trials[index];
      trial.reaction_time_ms = (trial.reaction_time_ms as number) + 100;
      trial.timing.response_timestamp_ms =
        (trial.timing.response_timestamp_ms as number) + 100;
    });
    const changed = analyseStoredSession(detail);
    expect(original.ok && changed.ok).toBe(true);
    if (!original.ok || !changed.ok) return;
    expect(changed.results).not.toStrictEqual(original.results);
  });

  it("uses the approved analysis unchanged", () => {
    const adapted = adaptStoredSession(stroopStored);
    const analysed = analyseStoredSession(stroopStored);
    expect(adapted.ok && analysed.ok).toBe(true);
    if (!adapted.ok || !analysed.ok) return;
    expect(analysed.results).toStrictEqual(
      computeStroopResults(adapted.session.analysisInput),
    );
  });
});

describe("format errors", () => {
  it.each([
    ["not an object", () => "session" as unknown, "session"],
    ["null", () => null, "session"],
    [
      "a missing field",
      () =>
        stroop((d) => {
          delete (d as Partial<Detail>).trials;
        }),
      "session.trials",
    ],
    [
      "an unknown field",
      () => ({ ...stroop(), participant_id: "x" }),
      "session.participant_id",
    ],
    [
      "a missing trial field",
      () =>
        stroop((d) => {
          delete (d.trials[3] as Partial<Trial>).outcome;
        }),
      "session.trials[3].outcome",
    ],
    [
      "a missing timing field",
      () =>
        stroop((d) => {
          delete (d.trials[3].timing as Partial<Trial["timing"]>).deadline_ms;
        }),
      "session.trials[3].timing.deadline_ms",
    ],
    [
      "an RT given as text",
      () =>
        stroop((d) => {
          (d.trials[3] as { reaction_time_ms: unknown }).reaction_time_ms =
            "412";
        }),
      "session.trials[3].reaction_time_ms",
    ],
    [
      "an unknown outcome",
      () =>
        stroop((d) => {
          (d.trials[3] as { outcome: string }).outcome = "skipped";
        }),
      "session.trials[3].outcome",
    ],
    [
      "an unknown phase",
      () =>
        stroop((d) => {
          (d.trials[3] as { phase: string }).phase = "warmup";
        }),
      "session.trials[3].phase",
    ],
    [
      "a malformed session ID",
      () => ({ ...stroop(), session_id: "not-a-uuid" }),
      "session.session_id",
    ],
    [
      "a non-UTC save time",
      () => ({ ...stroop(), created_at: "2026-11-23T08:01:47+02:00" }),
      "session.created_at",
    ],
    [
      "a missing break flag",
      () => ({ ...stroop(), break_taken: null }),
      "session.break_taken",
    ],
  ])("%s is refused as unreadable", (_label, make, location) => {
    expectProblem(make(), "invalid_format", location);
  });
});

describe("version and identity policy", () => {
  it("an unknown experiment is refused", () => {
    expectProblem(
      { ...stroop(), experiment_id: "go-nogo" },
      "unknown_experiment",
    );
  });

  it("an unsupported data schema is refused", () => {
    const result = expectProblem(
      { ...stroop(), data_schema_version: 2 },
      "unsupported_schema",
    );
    expect(result.ok || result.problem.message).toContain("version 2");
  });

  it.each([
    ["protocol_version", "1.1"],
    ["protocol_id", "HB-STROOP-2.0"],
    ["configuration_id", "HB-STROOP-SHORT"],
    ["configuration_version", "2.0"],
  ])("a different %s (%s) is refused, not analysed", (field, value) => {
    const result = expectProblem(
      { ...stroop(), [field]: value },
      "unsupported_version",
      `session.${field}`,
    );
    expect(result.ok || result.problem.message).toContain(value);
  });

  it("a Stroop session carrying the Flanker protocol is an identity contradiction", () => {
    expectProblem(
      {
        ...stroop(),
        protocol_id: flankerStored.protocol_id,
        configuration_id: flankerStored.configuration_id,
      },
      "identity_mismatch",
    );
  });

  it("a Flanker session labelled as Stroop is refused", () => {
    expectProblem(
      { ...clone(flankerStored), experiment_id: "stroop" },
      "identity_mismatch",
    );
  });

  it("a different session than the one requested is refused", () => {
    const result = adaptStoredSession(stroopStored, {
      expectedSessionId: flankerStored.session_id,
    });
    expect(!result.ok && result.problem.code).toBe("identity_mismatch");
  });

  it("a different experiment than the one requested is refused", () => {
    const result = adaptStoredSession(stroopStored, {
      expectedExperimentId: "flanker",
    });
    expect(!result.ok && result.problem.code).toBe("identity_mismatch");
  });

  it.each(["incomplete", "interrupted", "technical_error"])(
    "a %s session is not analysed",
    (status) => {
      const result = expectProblem({ ...stroop(), status }, "not_complete");
      expect(result.ok || result.problem.message).toContain(status);
    },
  );
});

describe("inconsistent trial data is refused, never repaired", () => {
  const correctMain = (d: Detail) =>
    d.trials[mainIndex(d, (trial) => trial.outcome === "correct")];
  const timeoutMain = (d: Detail) =>
    d.trials[mainIndex(d, (trial) => trial.outcome === "timeout")];
  const invalidMain = (d: Detail) =>
    d.trials[mainIndex(d, (trial) => trial.outcome === "invalid")];

  it.each<[string, (d: Detail) => void]>([
    ["a missing main trial", (d) => void d.trials.pop()],
    ["an extra trial", (d) => void d.trials.push(clone(d.trials[20]))],
    [
      "trials out of order",
      (d) => {
        [d.trials[20], d.trials[21]] = [d.trials[21], d.trials[20]];
      },
    ],
    [
      "a duplicated trial index",
      (d) => {
        d.trials[21] = {
          ...clone(d.trials[21]),
          trial_index: d.trials[20].trial_index,
        };
      },
    ],
    ["an unknown condition", (d) => void (correctMain(d).condition = "mixed")],
    [
      "a correct trial without an RT",
      (d) => void (correctMain(d).reaction_time_ms = null),
    ],
    [
      "a correct trial without a key",
      (d) => void (correctMain(d).response_key = null),
    ],
    [
      "a correct trial with the wrong key",
      (d) => {
        const trial = correctMain(d);
        trial.response_key = ["d", "f", "j", "k"].find(
          (k) => k !== trial.correct_response,
        ) as string;
      },
    ],
    [
      "an incorrect trial with the correct key",
      (d) => {
        const trial = d.trials[mainIndex(d, (t) => t.outcome === "incorrect")];
        trial.response_key = trial.correct_response;
      },
    ],
    [
      "a timeout with an RT",
      (d) => void (timeoutMain(d).reaction_time_ms = 1999),
    ],
    [
      "an invalid trial without a reason",
      (d) => void (invalidMain(d).invalid_reason = null),
    ],
    [
      "an invalid trial with an unknown reason",
      (d) => void (invalidMain(d).invalid_reason = "cosmic_ray"),
    ],
    [
      "a reason on a valid trial",
      (d) => void (correctMain(d).invalid_reason = "focus_lost"),
    ],
    [
      "an RT at the deadline",
      (d) => void (correctMain(d).reaction_time_ms = 2000),
    ],
    ["a negative RT", (d) => void (correctMain(d).reaction_time_ms = -1)],
    [
      "an unmapped response key",
      (d) => void (correctMain(d).response_key = "q"),
    ],
    [
      "a negative timestamp",
      (d) => void (correctMain(d).timing.fixation_onset_ms = -5),
    ],
    [
      "a taken break without its duration",
      (d) => {
        d.break_taken = true;
        (d as { break_duration_ms: number | null }).break_duration_ms = null;
      },
    ],
  ])("%s", (_label, change) => {
    const result = expectProblem(stroop(change), "malformed");
    expect(result.ok || result.problem.details.length).toBeGreaterThan(0);
  });

  it("lists every problem found, with exact locations", () => {
    const result = expectProblem(
      stroop((d) => {
        d.trials[15].condition = "mixed";
        d.trials[16].reaction_time_ms = -1;
      }),
      "malformed",
    );
    if (result.ok) return;
    const locations = result.problem.details.map((detail) => detail.location);
    expect(locations).toContain("session.trials[15].condition");
    expect(locations).toContain("session.trials[16].reaction_time_ms");
  });

  it("explains the refusal in plain language without internal detail", () => {
    const result = expectProblem(
      stroop((d) => void (d.trials[16].reaction_time_ms = -1)),
      "malformed",
    );
    if (result.ok) return;
    expect(result.problem.message).toMatch(/cannot be calculated/);
    expect(result.problem.message).not.toMatch(/trials\[|reaction_time_ms/);
  });
});
