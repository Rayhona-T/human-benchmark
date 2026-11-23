/**
 * Stored-session adapter (Cycle 9 Task 9.3): turns a session reloaded from
 * the local backend into input for the EXISTING, approved analysis
 * (`HB-ANALYSIS-1.1`, sessionAnalysis.ts via computeStroopResults /
 * computeFlankerResults). No calculation is added or changed here.
 *
 * Policy:
 *   - Faithful: stored values are passed through unchanged. Nothing missing
 *     is filled in, defaulted, inferred, sorted or rounded.
 *   - Strict: a session is analysed only if it is complete, uses the data
 *     schema and the exact experiment, protocol and configuration versions
 *     this app defines, and every trial is internally consistent (the same
 *     rules the backend enforced when it was saved). Anything else is
 *     refused with a plain-language reason. A session is never analysed
 *     with a design it was not recorded under.
 *   - Honest about analysis versions: the backend does not store which
 *     analysis version the results page used when the session was saved
 *     (DATA_AND_PRIVACY.md D8). Results computed here are labelled as
 *     calculated NOW with the current ANALYSIS_VERSION; they are not
 *     claimed to be the numbers originally shown.
 */
import type {
  ExperimentConfiguration,
  TrialOutcome,
} from "../../../engine/contracts";
import { FLANKER_CONFIGURATION } from "../../flanker/flanker";
import {
  computeFlankerResults,
  type FlankerSessionResults,
} from "../../flanker/flankerAnalysis";
import { STROOP_CONFIGURATION } from "../../stroop/stroop";
import {
  computeStroopResults,
  type StroopSessionResults,
} from "../../stroop/stroopAnalysis";
import type { SaveExperimentId } from "../persistence/sessionPayload";
import {
  ANALYSIS_VERSION,
  type AnalysableTrial,
  type InvalidReason,
  type SessionResultsInput,
} from "../sessionAnalysis";
import {
  ResponseShapeError,
  parseSessionDetail,
  type StoredRandomization,
  type StoredSessionDetail,
  type StoredTrial,
} from "./observatoryClient";

/** The only stored data format this app reads (sessionPayload.ts). */
export const SUPPORTED_DATA_SCHEMA_VERSION = 1;

interface SupportedExperiment {
  name: string;
  configuration: ExperimentConfiguration<unknown, string, unknown>;
}

/**
 * Exactly one supported version per experiment: the one this app runs and
 * the approved analysis is defined for.
 */
const SUPPORTED: Readonly<Record<SaveExperimentId, SupportedExperiment>> = {
  stroop: {
    name: "Stroop",
    configuration: STROOP_CONFIGURATION as ExperimentConfiguration<
      unknown,
      string,
      unknown
    >,
  },
  flanker: {
    name: "Flanker",
    configuration: FLANKER_CONFIGURATION as ExperimentConfiguration<
      unknown,
      string,
      unknown
    >,
  },
};

/** Display name of a stored experiment ("Stroop", "Flanker"). */
export function experimentName(experimentId: SaveExperimentId): string {
  return SUPPORTED[experimentId].name;
}

/**
 * Whether a history entry was stored under the one version this app can
 * analyse (the same identity checks as adaptStoredSession, from summary
 * fields alone, so the list never needs trial data). A true result does not
 * replace the full validation done when the session is opened.
 */
export function isSupportedVersion(summary: {
  experiment_id: SaveExperimentId;
  data_schema_version: number;
  protocol_id: string;
  protocol_version: string;
  configuration_id: string;
  configuration_version: string;
}): boolean {
  const { configuration } = SUPPORTED[summary.experiment_id];
  return (
    summary.data_schema_version === SUPPORTED_DATA_SCHEMA_VERSION &&
    summary.protocol_id === configuration.protocolId &&
    summary.protocol_version === configuration.protocolVersion &&
    summary.configuration_id === configuration.configurationId &&
    summary.configuration_version === configuration.configurationVersion
  );
}

const INVALID_REASONS: readonly InvalidReason[] = [
  "focus_lost",
  "visibility_lost",
  "presentation_failed",
  "input_failed",
  "timing_error",
  "deadline_unavailable",
  "interrupt",
  "protocol_error",
];

/** Shown with every result computed from a stored session. */
export const ANALYSIS_VERSION_NOTE =
  `The analysis version used when this session was saved was not recorded. ` +
  `These results are calculated now from the stored trials with ${ANALYSIS_VERSION}.`;

// --- Output ------------------------------------------------------------------

/** One stored trial, unchanged, in the engine's field names. */
export interface StoredTrialRecord extends AnalysableTrial {
  readonly phase: "practice" | "main";
  readonly trialIndex: number;
  readonly condition: string;
  readonly stimulus: Readonly<Record<string, string>>;
  readonly correctResponse: string;
  readonly responseKey: string | null;
  readonly outcome: TrialOutcome;
  readonly timing: {
    readonly fixationOnsetMs: number | null;
    readonly stimulusOnsetMs: number | null;
    readonly responseTimestampMs: number | null;
    readonly deadlineMs: number | null;
    readonly stimulusOffsetMs: number | null;
    readonly itiEndMs: number | null;
    readonly reactionTimeMs: number | null;
  };
}

export interface AdaptedStoredSession {
  readonly sessionId: string;
  readonly experimentId: SaveExperimentId;
  readonly identity: {
    readonly dataSchemaVersion: number;
    readonly protocolId: string;
    readonly protocolVersion: string;
    readonly configurationId: string;
    readonly configurationVersion: string;
  };
  readonly consentNoticeVersion: string;
  /** Server UTC time the session was SAVED (not when it was run). */
  readonly createdAt: string;
  /** Kept as stored, for reproducibility; not analysed. */
  readonly randomization: StoredRandomization;
  readonly analysisInput: Omit<SessionResultsInput, "records"> & {
    readonly records: readonly StoredTrialRecord[];
  };
  readonly analysisVersion: {
    /** Always null: not stored by the backend (D8). */
    readonly recordedAtSave: null;
    /** The version these results are calculated with. */
    readonly appliedNow: typeof ANALYSIS_VERSION;
    readonly note: string;
  };
}

export type StoredSessionProblemCode =
  | "invalid_format"
  | "unknown_experiment"
  | "unsupported_schema"
  | "unsupported_version"
  | "identity_mismatch"
  | "not_complete"
  | "malformed";

export interface StoredSessionProblem {
  readonly code: StoredSessionProblemCode;
  /** Plain language, suitable for the participant. */
  readonly message: string;
  /** Exact locations, for developers and tests. Never shown as-is. */
  readonly details: readonly { location: string; problem: string }[];
}

export type AdaptResult =
  | { ok: true; session: AdaptedStoredSession }
  | { ok: false; problem: StoredSessionProblem };

export type AnalysedStoredSession =
  | {
      ok: true;
      experimentId: "stroop";
      session: AdaptedStoredSession;
      results: StroopSessionResults;
    }
  | {
      ok: true;
      experimentId: "flanker";
      session: AdaptedStoredSession;
      results: FlankerSessionResults;
    }
  | { ok: false; problem: StoredSessionProblem };

export interface AdaptOptions {
  /** The session that was asked for; a different one is refused. */
  expectedSessionId?: string;
  /** The experiment that was asked for; a different one is refused. */
  expectedExperimentId?: SaveExperimentId;
}

// --- Problems ------------------------------------------------------------------

const MAX_DETAILS = 20;

function problem(
  code: StoredSessionProblemCode,
  message: string,
  details: readonly { location: string; problem: string }[] = [],
): { ok: false; problem: StoredSessionProblem } {
  return {
    ok: false,
    problem: Object.freeze({
      code,
      message,
      details: Object.freeze(details.slice(0, MAX_DETAILS)),
    }),
  };
}

const MESSAGES = {
  invalid_format:
    "This saved session could not be read, because its data is not in the expected format. Nothing was changed.",
  unknown_experiment:
    "This saved session is from an experiment that this version of HUMAN BENCHMARK does not include, so its results cannot be shown.",
  identity_mismatch:
    "The saved data does not match the session that was asked for, so it is not shown.",
  malformed:
    "This saved session's trial data is incomplete or inconsistent, so its results cannot be calculated. Nothing was changed or filled in.",
} as const;

// --- Adapter -------------------------------------------------------------------

function isKnownExperiment(value: string): value is SaveExperimentId {
  return Object.hasOwn(SUPPORTED, value);
}

function outcomeOf(trial: StoredTrial): TrialOutcome {
  if (trial.outcome === "invalid") {
    return {
      category: "invalid",
      reason: trial.invalid_reason as InvalidReason,
    };
  }
  return { category: trial.outcome };
}

function checkTrial(
  trial: StoredTrial,
  location: string,
  configuration: ExperimentConfiguration<unknown, string, unknown>,
  keys: ReadonlySet<string>,
  issues: { location: string; problem: string }[],
) {
  const add = (where: string, what: string) =>
    issues.push({ location: `${location}${where}`, problem: what });
  if (!configuration.conditions.includes(trial.condition)) {
    add(".condition", "is not a condition of this experiment");
  }
  if (!keys.has(trial.correct_response)) {
    add(".correct_response", "is not a response key of this experiment");
  }
  if (trial.response_key !== null && !keys.has(trial.response_key)) {
    add(".response_key", "is not a response key of this experiment");
  }
  const isInvalid = trial.outcome === "invalid";
  if (isInvalid !== (trial.invalid_reason !== null)) {
    add(
      ".invalid_reason",
      "must be present for invalid trials and only for them",
    );
  } else if (
    isInvalid &&
    !(INVALID_REASONS as readonly string[]).includes(
      trial.invalid_reason as string,
    )
  ) {
    add(".invalid_reason", "is not a known reason");
  }

  const responded =
    trial.outcome === "correct" || trial.outcome === "incorrect";
  const rt = trial.reaction_time_ms;
  if (responded) {
    if (trial.response_key === null)
      add(".response_key", "is missing for a response");
    if (rt === null) add(".reaction_time_ms", "is missing for a response");
    if (trial.timing.response_timestamp_ms === null) {
      add(".timing.response_timestamp_ms", "is missing for a response");
    }
    if (
      trial.outcome === "correct" &&
      trial.response_key !== null &&
      trial.response_key !== trial.correct_response
    ) {
      add(".outcome", "is correct but the key does not match");
    }
    if (
      trial.outcome === "incorrect" &&
      trial.response_key === trial.correct_response
    ) {
      add(".outcome", "is incorrect but the key matches");
    }
  } else {
    if (trial.response_key !== null)
      add(".response_key", "must be empty without a response");
    if (rt !== null)
      add(".reaction_time_ms", "must be empty without a response");
    if (trial.timing.response_timestamp_ms !== null) {
      add(".timing.response_timestamp_ms", "must be empty without a response");
    }
  }
  if (rt !== null) {
    const deadline = configuration[trial.phase].responseDeadlineMs;
    if (rt < 0 || rt >= deadline) {
      add(".reaction_time_ms", `must be at least 0 and below ${deadline} ms`);
    }
  }
  for (const [key, value] of Object.entries(trial.timing)) {
    if (value !== null && value < 0)
      add(`.timing.${key}`, "must not be negative");
  }
}

function checkOrder(
  trials: readonly StoredTrial[],
  configuration: ExperimentConfiguration<unknown, string, unknown>,
  issues: { location: string; problem: string }[],
) {
  // A complete session: every planned practice trial, then every planned
  // main trial, each numbered 1..N in order (as the backend returns them).
  const expected: { phase: "practice" | "main"; index: number }[] = [];
  for (let index = 1; index <= configuration.practice.trialCount; index++) {
    expected.push({ phase: "practice", index });
  }
  for (let index = 1; index <= configuration.main.trialCount; index++) {
    expected.push({ phase: "main", index });
  }
  if (trials.length !== expected.length) {
    issues.push({
      location: "session.trials",
      problem: `has ${trials.length} trials; a complete session has ${configuration.practice.trialCount} practice and ${configuration.main.trialCount} main trials`,
    });
    return;
  }
  trials.forEach((trial, position) => {
    const want = expected[position];
    if (trial.phase !== want.phase || trial.trial_index !== want.index) {
      issues.push({
        location: `session.trials[${position}]`,
        problem: `should be ${want.phase} trial ${want.index}`,
      });
    }
  });
}

function toRecord(trial: StoredTrial): StoredTrialRecord {
  const timing = trial.timing;
  return Object.freeze({
    phase: trial.phase,
    trialIndex: trial.trial_index,
    condition: trial.condition,
    stimulus: trial.stimulus,
    correctResponse: trial.correct_response,
    responseKey: trial.response_key,
    outcome: Object.freeze(outcomeOf(trial)),
    timing: Object.freeze({
      fixationOnsetMs: timing.fixation_onset_ms,
      stimulusOnsetMs: timing.stimulus_onset_ms,
      responseTimestampMs: timing.response_timestamp_ms,
      deadlineMs: timing.deadline_ms,
      stimulusOffsetMs: timing.stimulus_offset_ms,
      itiEndMs: timing.iti_end_ms,
      reactionTimeMs: trial.reaction_time_ms,
    }),
  });
}

/**
 * Validates a stored session (the raw GET /api/v1/sessions/{id} body, or an
 * already-parsed StoredSessionDetail) and converts it for analysis.
 */
export function adaptStoredSession(
  value: unknown,
  options: AdaptOptions = {},
): AdaptResult {
  let detail: StoredSessionDetail;
  try {
    detail = parseSessionDetail(value);
  } catch (error) {
    if (error instanceof ResponseShapeError) {
      return problem("invalid_format", MESSAGES.invalid_format, [
        { location: error.location, problem: error.message },
      ]);
    }
    throw error;
  }

  if (
    options.expectedSessionId !== undefined &&
    detail.session_id !== options.expectedSessionId
  ) {
    return problem("identity_mismatch", MESSAGES.identity_mismatch, [
      {
        location: "session.session_id",
        problem: "is not the requested session",
      },
    ]);
  }
  if (!isKnownExperiment(detail.experiment_id)) {
    return problem("unknown_experiment", MESSAGES.unknown_experiment, [
      {
        location: "session.experiment_id",
        problem: "is not a known experiment",
      },
    ]);
  }
  const experimentId = detail.experiment_id;
  if (
    options.expectedExperimentId !== undefined &&
    experimentId !== options.expectedExperimentId
  ) {
    return problem("identity_mismatch", MESSAGES.identity_mismatch, [
      {
        location: "session.experiment_id",
        problem: "is not the requested experiment",
      },
    ]);
  }
  const { name, configuration } = SUPPORTED[experimentId];

  if (detail.data_schema_version !== SUPPORTED_DATA_SCHEMA_VERSION) {
    return problem(
      "unsupported_schema",
      `This saved session uses a storage format (version ${detail.data_schema_version}) that this version of HUMAN BENCHMARK cannot read, so its results cannot be shown.`,
      [
        {
          location: "session.data_schema_version",
          problem: "is not supported",
        },
      ],
    );
  }

  // A protocol or configuration that belongs to the OTHER experiment is an
  // identity contradiction, not merely an unsupported version.
  const belongsElsewhere = Object.entries(SUPPORTED).some(
    ([id, other]) =>
      id !== experimentId &&
      (detail.protocol_id === other.configuration.protocolId ||
        detail.configuration_id === other.configuration.configurationId),
  );
  if (belongsElsewhere) {
    return problem("identity_mismatch", MESSAGES.identity_mismatch, [
      {
        location: "session.protocol_id",
        problem: "belongs to a different experiment",
      },
    ]);
  }
  const versionIssues = (
    [
      ["protocol_id", configuration.protocolId],
      ["protocol_version", configuration.protocolVersion],
      ["configuration_id", configuration.configurationId],
      ["configuration_version", configuration.configurationVersion],
    ] as const
  )
    .filter(([field, supported]) => detail[field] !== supported)
    .map(([field, supported]) => ({
      location: `session.${field}`,
      problem: `is not the supported ${supported}`,
    }));
  if (versionIssues.length > 0) {
    return problem(
      "unsupported_version",
      `This ${name} session was recorded with a version of the experiment (protocol ${detail.protocol_id} ${detail.protocol_version}, configuration ${detail.configuration_id} ${detail.configuration_version}) that this version of HUMAN BENCHMARK does not include. Its results are not calculated, because the analysis is defined for one specific version and could mislead for another.`,
      versionIssues,
    );
  }

  if (detail.status !== "complete") {
    return problem(
      "not_complete",
      `Only complete sessions are analysed. This saved session is marked "${detail.status}".`,
      [{ location: "session.status", problem: "is not complete" }],
    );
  }

  const issues: { location: string; problem: string }[] = [];
  if (detail.break_taken && detail.break_duration_ms === null) {
    issues.push({
      location: "session.break_duration_ms",
      problem: "is missing although the break was taken",
    });
  }
  if (detail.break_duration_ms !== null && detail.break_duration_ms < 0) {
    issues.push({
      location: "session.break_duration_ms",
      problem: "is negative",
    });
  }
  checkOrder(detail.trials, configuration, issues);
  const keys = new Set(
    configuration.responseMapping.map((mapping) =>
      String(mapping.responseValue),
    ),
  );
  detail.trials.forEach((trial, position) =>
    checkTrial(
      trial,
      `session.trials[${position}]`,
      configuration,
      keys,
      issues,
    ),
  );
  if (issues.length > 0)
    return problem("malformed", MESSAGES.malformed, issues);

  const session: AdaptedStoredSession = Object.freeze({
    sessionId: detail.session_id,
    experimentId,
    identity: Object.freeze({
      dataSchemaVersion: detail.data_schema_version,
      protocolId: detail.protocol_id,
      protocolVersion: detail.protocol_version,
      configurationId: detail.configuration_id,
      configurationVersion: detail.configuration_version,
    }),
    consentNoticeVersion: detail.consent_notice_version,
    createdAt: detail.created_at,
    randomization: detail.randomization,
    analysisInput: Object.freeze({
      status: "complete" as const,
      records: Object.freeze(detail.trials.map(toRecord)),
      breakTaken: detail.break_taken,
      breakDurationMs: detail.break_duration_ms,
    }),
    analysisVersion: Object.freeze({
      recordedAtSave: null,
      appliedNow: ANALYSIS_VERSION,
      note: ANALYSIS_VERSION_NOTE,
    }),
  });
  return { ok: true, session };
}

/**
 * Validates, adapts and analyses a stored session with the experiment's
 * approved analysis function. Nothing is analysed unless adaptation succeeds.
 */
export function analyseStoredSession(
  value: unknown,
  options: AdaptOptions = {},
): AnalysedStoredSession {
  const adapted = adaptStoredSession(value, options);
  if (!adapted.ok) return adapted;
  const { session } = adapted;
  if (session.experimentId === "stroop") {
    return {
      ok: true,
      experimentId: "stroop",
      session,
      results: computeStroopResults(session.analysisInput),
    };
  }
  return {
    ok: true,
    experimentId: "flanker",
    session,
    results: computeFlankerResults(session.analysisInput),
  };
}
