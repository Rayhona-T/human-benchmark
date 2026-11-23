/**
 * Maps a finished session's engine records to the backend save contract
 * (POST /api/v1/sessions, data_schema_version 1; docs/backend/API.md).
 *
 * Pure and timing-independent: runs only after the session has ended, reads
 * copies of the engine records, and never changes them. Values are passed
 * through as recorded (no rounding, no inference). Only fields the contract
 * defines are produced; the engine's sessionId, trialId, response metadata,
 * presentation constants and any analysis results are never included.
 */
import type {
  EngineTrial,
  RandomizationMetadata,
  SessionRecordStatus,
  TrialRecord,
} from "../../../engine/contracts";

export type SaveExperimentId = "stroop" | "flanker";
export type ApiStimulus = Readonly<Record<string, string>>;

/** What a results page provides so its session can be saved. */
export interface ResultsSave<TStimulus = unknown> {
  experimentId: SaveExperimentId;
  status: SessionRecordStatus;
  records: readonly TrialRecord<TStimulus, string, unknown>[];
  breakTaken: boolean;
  breakDurationMs: number | null;
  /** Experiment adapter: task-relevant stimulus attributes only. */
  stimulusToApi: (stimulus: TStimulus) => ApiStimulus;
}

export interface ApiPlannedTrial {
  trial_index: number;
  condition: string;
  stimulus: ApiStimulus;
  correct_response: string;
}

export interface ApiTrial extends ApiPlannedTrial {
  phase: "practice" | "main";
  response_key: string | null;
  outcome: "correct" | "incorrect" | "timeout" | "invalid";
  invalid_reason: string | null;
  reaction_time_ms: number | null;
  timing: {
    fixation_onset_ms: number | null;
    stimulus_onset_ms: number | null;
    response_timestamp_ms: number | null;
    deadline_ms: number | null;
    stimulus_offset_ms: number | null;
    iti_end_ms: number | null;
  };
}

export interface SessionSavePayload {
  data_schema_version: 1;
  client_session_id: string;
  consent: { confirmed: true; notice_version: string };
  experiment_id: SaveExperimentId;
  protocol_id: string;
  protocol_version: string;
  configuration_id: string;
  configuration_version: string;
  status: "complete";
  break_taken: boolean;
  break_duration_ms: number | null;
  randomization: {
    seed: number | null;
    prng_id: string | null;
    randomization_version: string | null;
    schedule_generation_status: RandomizationMetadata["scheduleGenerationStatus"];
    allocation_details: Readonly<Record<string, unknown>> | null;
    practice_order: ApiPlannedTrial[];
    main_order: ApiPlannedTrial[];
  };
  trials: ApiTrial[];
}

export type Ineligibility =
  "not_complete" | "no_records" | "schedule_missing" | "inconsistent_records";

export type Eligibility =
  { eligible: true } | { eligible: false; reason: Ineligibility };

/**
 * Only complete sessions may be saved (the engine's own completion status;
 * the backend enforces the same rule). Other checks guard against records
 * that could not have come from one engine session.
 */
export function saveEligibility<TStimulus>(
  save: ResultsSave<TStimulus>,
): Eligibility {
  if (save.status !== "complete")
    return { eligible: false, reason: "not_complete" };
  const [first] = save.records;
  if (!first) return { eligible: false, reason: "no_records" };
  const randomization = first.randomization;
  if (randomization.scheduleGenerationStatus !== "generated") {
    return { eligible: false, reason: "schedule_missing" };
  }
  const consistent = save.records.every(
    (record) =>
      record.experiment.experimentId === save.experimentId &&
      record.experiment.protocolId === first.experiment.protocolId &&
      record.randomization.seedUnsigned32 === randomization.seedUnsigned32,
  );
  if (first.experiment.experimentId !== save.experimentId || !consistent) {
    return { eligible: false, reason: "inconsistent_records" };
  }
  return { eligible: true };
}

function plannedTrial<TStimulus>(
  trial: EngineTrial<TStimulus, string, unknown>,
  stimulusToApi: (stimulus: TStimulus) => ApiStimulus,
): ApiPlannedTrial {
  return {
    trial_index: trial.index,
    condition: trial.condition,
    stimulus: stimulusToApi(trial.stimulus),
    correct_response: String(trial.correctResponse),
  };
}

function apiTrial<TStimulus>(
  record: TrialRecord<TStimulus, string, unknown>,
  stimulusToApi: (stimulus: TStimulus) => ApiStimulus,
): ApiTrial {
  const { timing, outcome } = record;
  return {
    phase: record.phase,
    trial_index: record.trialIndex,
    condition: record.condition,
    stimulus: stimulusToApi(record.stimulus),
    correct_response: String(record.correctResponse),
    response_key: record.response ? String(record.response.value) : null,
    outcome: outcome.category,
    invalid_reason: outcome.category === "invalid" ? outcome.reason : null,
    reaction_time_ms: timing.reactionTimeMs,
    timing: {
      fixation_onset_ms: timing.fixationOnsetMs,
      stimulus_onset_ms: timing.stimulusOnsetMs,
      response_timestamp_ms: timing.responseTimestampMs,
      deadline_ms: timing.deadlineMs,
      stimulus_offset_ms: timing.stimulusOffsetMs,
      iti_end_ms: timing.itiEndMs,
    },
  };
}

export class IneligibleSessionError extends Error {
  readonly reason: Ineligibility;
  constructor(reason: Ineligibility) {
    super(`Session is not eligible for saving: ${reason}`);
    this.reason = reason;
  }
}

/** Builds the request body. Throws IneligibleSessionError for ineligible sessions. */
export function buildSessionSavePayload<TStimulus>(
  save: ResultsSave<TStimulus>,
  options: { clientSessionId: string; noticeVersion: string },
): SessionSavePayload {
  const eligibility = saveEligibility(save);
  if (!eligibility.eligible)
    throw new IneligibleSessionError(eligibility.reason);

  const first = save.records[0];
  const identity = first.experiment;
  const randomization = first.randomization;
  const order = (trials: readonly unknown[]) =>
    (trials as readonly EngineTrial<TStimulus, string, unknown>[]).map(
      (trial) => plannedTrial(trial, save.stimulusToApi),
    );

  return {
    data_schema_version: 1,
    client_session_id: options.clientSessionId,
    consent: { confirmed: true, notice_version: options.noticeVersion },
    experiment_id: save.experimentId,
    protocol_id: identity.protocolId,
    protocol_version: identity.protocolVersion,
    configuration_id: identity.configurationId,
    configuration_version: identity.configurationVersion,
    status: "complete",
    break_taken: save.breakTaken,
    break_duration_ms: save.breakDurationMs,
    randomization: {
      seed: randomization.seedUnsigned32,
      prng_id: randomization.prngAndScheduleId,
      randomization_version: randomization.randomizationConfigurationVersion,
      schedule_generation_status: randomization.scheduleGenerationStatus,
      allocation_details: randomization.allocationDetails ?? null,
      practice_order: order(randomization.realizedPracticeOrder),
      main_order: order(randomization.realizedMainOrder),
    },
    trials: save.records.map((record) => apiTrial(record, save.stimulusToApi)),
  };
}
