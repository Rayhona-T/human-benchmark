import { describe, expect, it } from "vitest";
import type { SessionRecordStatus } from "../../../engine/contracts";
import type { FlankerStimulus } from "../../flanker/flanker";
import { flankerStimulusToApi } from "../../flanker/flankerResultsCopy";
import { FLANKER_SESSION_DEFINITION } from "../../flanker/useFlankerSession";
import type { StroopStimulus } from "../../stroop/stroop";
import { stroopStimulusToApi } from "../../stroop/stroopResultsFormat";
import { STROOP_SESSION_DEFINITION } from "../../stroop/useStroopSession";
import { CONSENT_NOTICE } from "./saveConfig";
import {
  IneligibleSessionError,
  buildSessionSavePayload,
  saveEligibility,
  type ResultsSave,
} from "./sessionPayload";
import { ENGINE_SESSION_SENTINEL, buildTestRecords } from "./testSessions";

const STROOP_ID = "3b2f6c1e-8d4a-4f7b-9c2e-1a5d7e9f0b13";
const FLANKER_ID = "7c9e2a41-5b3d-4e8f-a1c6-2d4b6f8e0a35";

function stroopSave(
  status: SessionRecordStatus = "complete",
  seed = 20261122,
): ResultsSave<StroopStimulus> {
  return {
    experimentId: "stroop",
    status,
    records: buildTestRecords(STROOP_SESSION_DEFINITION, seed),
    breakTaken: true,
    breakDurationMs: 15000.5,
    stimulusToApi: stroopStimulusToApi,
  };
}

function flankerSave(
  status: SessionRecordStatus = "complete",
): ResultsSave<FlankerStimulus> {
  return {
    experimentId: "flanker",
    status,
    records: buildTestRecords(FLANKER_SESSION_DEFINITION, 4242),
    breakTaken: true,
    breakDurationMs: 15000.5,
    stimulusToApi: flankerStimulusToApi,
  };
}

const options = (clientSessionId: string) => ({
  clientSessionId,
  noticeVersion: CONSENT_NOTICE.version,
});

/** Every key used anywhere in a JSON value. */
function allKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => allKeys(item, keys));
  else if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      keys.add(key);
      allKeys(inner, keys);
    }
  }
  return keys;
}

describe("session save payload", () => {
  it("matches the committed Stroop contract fixture (also posted by a backend test)", async () => {
    const payload = buildSessionSavePayload(stroopSave(), options(STROOP_ID));
    await expect(JSON.stringify(payload, null, 2) + "\n").toMatchFileSnapshot(
      "./__fixtures__/stroop-save-payload.json",
    );
  });

  it("matches the committed Flanker contract fixture (also posted by a backend test)", async () => {
    const payload = buildSessionSavePayload(flankerSave(), options(FLANKER_ID));
    await expect(JSON.stringify(payload, null, 2) + "\n").toMatchFileSnapshot(
      "./__fixtures__/flanker-save-payload.json",
    );
  });

  it("maps each field from the engine record without changing values", () => {
    const save = stroopSave();
    const payload = buildSessionSavePayload(save, options(STROOP_ID));
    const record = save.records[16];
    const trial = payload.trials[16];
    expect(trial).toEqual({
      phase: record.phase,
      trial_index: record.trialIndex,
      condition: record.condition,
      stimulus: {
        word: record.stimulus.word,
        ink_color: record.stimulus.inkColor,
      },
      correct_response: record.correctResponse,
      response_key: record.response ? record.response.value : null,
      outcome: record.outcome.category,
      invalid_reason: null,
      reaction_time_ms: record.timing.reactionTimeMs,
      timing: {
        fixation_onset_ms: record.timing.fixationOnsetMs,
        stimulus_onset_ms: record.timing.stimulusOnsetMs,
        response_timestamp_ms: record.timing.responseTimestampMs,
        deadline_ms: record.timing.deadlineMs,
        stimulus_offset_ms: record.timing.stimulusOffsetMs,
        iti_end_ms: record.timing.itiEndMs,
      },
    });
    // Fractional times are passed through, never rounded.
    expect(payload.trials[0].reaction_time_ms! % 1).toBeCloseTo(0.125);
    expect(payload.trials).toHaveLength(72);
    expect(payload.randomization.practice_order).toHaveLength(12);
    expect(payload.randomization.main_order).toHaveLength(60);
    expect(payload.consent).toEqual({
      confirmed: true,
      notice_version: "HB-NOTICE-0.1-PROVISIONAL",
    });
  });

  it("maps timeouts and invalid trials with no response and no RT", () => {
    const payload = buildSessionSavePayload(flankerSave(), options(FLANKER_ID));
    const main = payload.trials.filter((trial) => trial.phase === "main");
    const timeout = main.find((trial) => trial.trial_index === 11)!;
    const invalid = main.find((trial) => trial.trial_index === 13)!;
    expect(timeout).toMatchObject({
      outcome: "timeout",
      response_key: null,
      reaction_time_ms: null,
    });
    expect(invalid).toMatchObject({
      outcome: "invalid",
      invalid_reason: "visibility_lost",
      response_key: null,
      reaction_time_ms: null,
    });
    expect(main[0].stimulus).toEqual({
      target_direction: expect.stringMatching(/^(left|right)$/),
      flanker_type: expect.stringMatching(/^(left|right|neutral)$/),
      symbols: expect.stringMatching(/^[←→—]{5}$/),
    });
  });

  it("sends no engine identifiers, response metadata, presentation constants or results", () => {
    const payloads = [
      buildSessionSavePayload(stroopSave(), options(STROOP_ID)),
      buildSessionSavePayload(flankerSave(), options(FLANKER_ID)),
    ];
    for (const payload of payloads) {
      const text = JSON.stringify(payload);
      expect(text).not.toContain(ENGINE_SESSION_SENTINEL);
      const keys = allKeys(payload);
      for (const forbidden of [
        "sessionId",
        "session_id",
        "trialId",
        "inputSource",
        "accepted",
        "timingSource",
        "trialEndMs",
        "trialDurationMs",
        "inkHex",
        "fontSizePx",
        "fontFamily",
        "background",
        "cells",
        "analysis",
        "median",
        "userAgent",
        "participant_id",
      ]) {
        expect(keys.has(forbidden)).toBe(false);
      }
    }
  });

  it.each(["incomplete", "interrupted", "technical_error"] as const)(
    "refuses a %s session",
    (status) => {
      expect(saveEligibility(stroopSave(status))).toEqual({
        eligible: false,
        reason: "not_complete",
      });
      expect(() =>
        buildSessionSavePayload(stroopSave(status), options(STROOP_ID)),
      ).toThrow(IneligibleSessionError);
    },
  );

  it("refuses sessions without records or with records from different sessions", () => {
    expect(saveEligibility({ ...stroopSave(), records: [] })).toEqual({
      eligible: false,
      reason: "no_records",
    });
    const mixed = {
      ...stroopSave(),
      records: [
        ...stroopSave().records.slice(0, 40),
        ...stroopSave("complete", 99).records.slice(40),
      ],
    };
    expect(saveEligibility(mixed)).toEqual({
      eligible: false,
      reason: "inconsistent_records",
    });
    expect(
      saveEligibility({ ...flankerSave(), experimentId: "stroop" }),
    ).toEqual({
      eligible: false,
      reason: "inconsistent_records",
    });
  });

  it("does not modify the engine records", () => {
    const save = stroopSave();
    const before = JSON.stringify(save.records);
    buildSessionSavePayload(save, options(STROOP_ID));
    expect(JSON.stringify(save.records)).toBe(before);
  });
});
