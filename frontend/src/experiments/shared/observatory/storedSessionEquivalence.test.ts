/**
 * Round-trip equivalence for the two schedule-generated contract fixtures
 * (persistence/__fixtures__/{stroop,flanker}-save-payload.json):
 *
 *   live engine-format records ──analysis──────────────────────► results A
 *        │ buildSessionSavePayload (must equal the committed fixture)
 *        ▼
 *   saved by the REAL backend, read back by GET /sessions/{id}
 *   (observatory/__fixtures__/*-stored-detail.json, recorded by
 *    scripts/generate_observatory_fixtures.py)
 *        │ adaptStoredSession
 *        ▼
 *   reconstructed records ─────────analysis────────────────────► results B
 *
 * A and B must be identical (deep, strict equality). The page-run fixtures
 * are covered by storedSessionPageEquivalence.test.tsx.
 */
import { describe, expect, it } from "vitest";
import { FLANKER_SESSION_DEFINITION } from "../../flanker/useFlankerSession";
import { computeFlankerResults } from "../../flanker/flankerAnalysis";
import { flankerStimulusToApi } from "../../flanker/flankerResultsCopy";
import { STROOP_SESSION_DEFINITION } from "../../stroop/useStroopSession";
import { computeStroopResults } from "../../stroop/stroopAnalysis";
import { stroopStimulusToApi } from "../../stroop/stroopResultsFormat";
import flankerPayload from "../persistence/__fixtures__/flanker-save-payload.json";
import stroopPayload from "../persistence/__fixtures__/stroop-save-payload.json";
import { CONSENT_NOTICE } from "../persistence/saveConfig";
import { buildSessionSavePayload } from "../persistence/sessionPayload";
import { buildTestRecords } from "../persistence/testSessions";
import { ANALYSIS_VERSION } from "../sessionAnalysis";
import flankerStored from "./__fixtures__/flanker-stored-detail.json";
import stroopStored from "./__fixtures__/stroop-stored-detail.json";
import {
  ANALYSIS_VERSION_NOTE,
  adaptStoredSession,
  analyseStoredSession,
} from "./storedSession";

// The same inputs that produced the committed fixtures (sessionPayload.test.ts).
const CASES = [
  {
    name: "Stroop",
    records: () => buildTestRecords(STROOP_SESSION_DEFINITION, 20261122),
    stimulusToApi: stroopStimulusToApi as (
      stimulus: unknown,
    ) => Record<string, string>,
    clientSessionId: "3b2f6c1e-8d4a-4f7b-9c2e-1a5d7e9f0b13",
    payload: stroopPayload,
    stored: stroopStored,
    analyse: computeStroopResults,
    experimentId: "stroop" as const,
  },
  {
    name: "Flanker",
    records: () => buildTestRecords(FLANKER_SESSION_DEFINITION, 4242),
    stimulusToApi: flankerStimulusToApi as (
      stimulus: unknown,
    ) => Record<string, string>,
    clientSessionId: "7c9e2a41-5b3d-4e8f-a1c6-2d4b6f8e0a35",
    payload: flankerPayload,
    stored: flankerStored,
    analyse: computeFlankerResults,
    experimentId: "flanker" as const,
  },
];

const BREAK = { breakTaken: true, breakDurationMs: 15000.5 };

describe.each(CASES)("$name stored-session equivalence", (testCase) => {
  const records = testCase.records();

  it("the live records are the ones the committed fixture was built from", () => {
    const rebuilt = buildSessionSavePayload(
      {
        experimentId: testCase.experimentId,
        status: "complete",
        records,
        ...BREAK,
        stimulusToApi: testCase.stimulusToApi,
      },
      {
        clientSessionId: testCase.clientSessionId,
        noticeVersion: CONSENT_NOTICE.version,
      },
    );
    expect(rebuilt).toEqual(testCase.payload);
  });

  it("the recorded backend detail holds exactly the saved trials and schedule", () => {
    // The backend stores and returns the trials and randomization unchanged.
    expect(testCase.stored.trials).toEqual(testCase.payload.trials);
    expect(testCase.stored.randomization).toEqual(
      testCase.payload.randomization,
    );
    expect(testCase.stored.experiment_id).toBe(testCase.payload.experiment_id);
    expect(testCase.stored.break_taken).toBe(testCase.payload.break_taken);
    expect(testCase.stored.break_duration_ms).toBe(
      testCase.payload.break_duration_ms,
    );
  });

  it("analysing the stored session gives results identical to the live session", () => {
    const live = testCase.analyse({ status: "complete", records, ...BREAK });

    const stored = analyseStoredSession(testCase.stored, {
      expectedSessionId: testCase.stored.session_id,
      expectedExperimentId: testCase.experimentId,
    });

    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.experimentId).toBe(testCase.experimentId);
    expect(stored.results).toStrictEqual(live);
    // Guard against a vacuous comparison: the session has real content.
    expect(live.main.recorded).toBe(60);
    expect(live.conditions?.length).toBe(3);
    expect(live.contrasts?.length).toBe(3);
    expect(live.trialSeries?.length).toBe(60);
  });

  it("reconstructed records keep every analysed field of every live record", () => {
    const adapted = adaptStoredSession(testCase.stored);
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    const rebuilt = adapted.session.analysisInput.records;
    expect(rebuilt).toHaveLength(records.length);
    rebuilt.forEach((record, position) => {
      const live = records[position];
      expect({
        phase: record.phase,
        trialIndex: record.trialIndex,
        condition: record.condition,
        outcome: record.outcome,
        reactionTimeMs: record.timing.reactionTimeMs,
      }).toStrictEqual({
        phase: live.phase,
        trialIndex: live.trialIndex,
        condition: live.condition,
        outcome: live.outcome,
        reactionTimeMs: live.timing.reactionTimeMs,
      });
      // The other stored values are passed through unchanged as well.
      expect(record.timing).toStrictEqual({
        fixationOnsetMs: live.timing.fixationOnsetMs,
        stimulusOnsetMs: live.timing.stimulusOnsetMs,
        responseTimestampMs: live.timing.responseTimestampMs,
        deadlineMs: live.timing.deadlineMs,
        stimulusOffsetMs: live.timing.stimulusOffsetMs,
        itiEndMs: live.timing.itiEndMs,
        reactionTimeMs: live.timing.reactionTimeMs,
      });
      expect(record.correctResponse).toBe(String(live.correctResponse));
      expect(record.responseKey).toBe(
        live.response ? String(live.response.value) : null,
      );
    });
  });

  it("labels the results as calculated now, without claiming the saved version", () => {
    const adapted = adaptStoredSession(testCase.stored);
    expect(adapted.ok && adapted.session.analysisVersion).toEqual({
      recordedAtSave: null,
      appliedNow: ANALYSIS_VERSION,
      note: ANALYSIS_VERSION_NOTE,
    });
  });
});
