/**
 * Participant-initiated, local-only export of a session's trial records.
 *
 * Pure: builds CSV text from engine records. Nothing is uploaded; the
 * browser turns the text into a file only when the participant asks.
 * Values are written as recorded; missing or not-applicable values are "NA".
 */
import type { SessionRecordStatus, TrialRecord } from "../../engine/contracts";

export const MISSING = "NA";

/** UTF-8 byte-order mark, so spreadsheets read arrows and dashes correctly. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

export interface ExportColumn<TStimulus = unknown> {
  name: string;
  description: string;
  value: (
    record: TrialRecord<TStimulus, string, unknown>,
    context: ExportContext,
  ) => string | number | null;
}

export interface ExportContext {
  experimentId: string;
  analysisVersion: string;
  status: SessionRecordStatus;
}

function ms(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 1000) / 1000;
}

function usableRt(
  record: TrialRecord<unknown, string, unknown>,
): number | null {
  const category = record.outcome.category;
  if (category !== "correct" && category !== "incorrect") return null;
  const value = record.timing.reactionTimeMs;
  return value !== null && Number.isFinite(value) && value >= 0
    ? ms(value)
    : null;
}

/** Columns shared by every experiment, in export order. */
export const BASE_COLUMNS_BEFORE: readonly ExportColumn[] = [
  {
    name: "experiment",
    description: "Experiment identifier (stroop or flanker).",
    value: (_, c) => c.experimentId,
  },
  {
    name: "protocol_id",
    description: "Approved protocol version used for the session.",
    value: (r) => r.experiment.protocolId,
  },
  {
    name: "analysis_version",
    description: "Version of the analysis definitions (HB-ANALYSIS-1.1).",
    value: (_, c) => c.analysisVersion,
  },
  {
    name: "session_status",
    description:
      "complete, incomplete, interrupted, or technical_error. Incomplete sessions contain only the trials that were presented.",
    value: (_, c) => c.status,
  },
  {
    name: "seed",
    description:
      "Random seed that generated this session's trial order (not personal data).",
    value: (r) => r.randomization.seedUnsigned32,
  },
  {
    name: "prng_id",
    description: "Identifier of the trial-order algorithm.",
    value: (r) => r.randomization.prngAndScheduleId,
  },
  {
    name: "phase",
    description: "practice or main. Practice trials are never used in results.",
    value: (r) => r.phase,
  },
  {
    name: "trial_index",
    description: "Trial number within its phase, starting at 1.",
    value: (r) => r.trialIndex,
  },
  {
    name: "condition",
    description: "congruent, incongruent, or neutral.",
    value: (r) => r.condition,
  },
];

export const BASE_COLUMNS_AFTER: readonly ExportColumn[] = [
  {
    name: "correct_key",
    description: "Key that matched the stimulus (lowercase).",
    value: (r) => String(r.correctResponse),
  },
  {
    name: "response_key",
    description: "First valid mapped key pressed; NA if none.",
    value: (r) => (r.response ? String(r.response.value) : null),
  },
  {
    name: "outcome",
    description:
      "correct, incorrect, timeout (no key within the deadline), or invalid (page hidden or lost focus, or a technical problem).",
    value: (r) => r.outcome.category,
  },
  {
    name: "correct",
    description:
      "1 if correct, 0 if incorrect; NA for timeouts and invalid trials (no response to score).",
    value: (r) =>
      r.outcome.category === "correct"
        ? 1
        : r.outcome.category === "incorrect"
          ? 0
          : null,
  },
  {
    name: "invalid_reason",
    description: "Why a trial is invalid; NA otherwise.",
    value: (r) => (r.outcome.category === "invalid" ? r.outcome.reason : null),
  },
  {
    name: "rt_ms",
    description:
      "Response time in milliseconds (key press minus recorded stimulus onset) for correct and incorrect responses; NA for timeouts, invalid trials, and missing values.",
    value: (r) => usableRt(r),
  },
  {
    name: "fixation_onset_ms",
    description:
      "Browser timestamp (ms, page-relative) when the fixation cross appeared; NA if not recorded.",
    value: (r) => ms(r.timing.fixationOnsetMs),
  },
  {
    name: "stimulus_onset_ms",
    description:
      "Browser animation-frame timestamp (ms) of the frame that first showed the stimulus.",
    value: (r) => ms(r.timing.stimulusOnsetMs),
  },
  {
    name: "response_timestamp_ms",
    description: "Browser timestamp (ms) of the key press; NA if none.",
    value: (r) => ms(r.timing.responseTimestampMs),
  },
  {
    name: "deadline_ms",
    description: "Response deadline timestamp (ms): stimulus onset + 2000.",
    value: (r) => ms(r.timing.deadlineMs),
  },
  {
    name: "stimulus_offset_ms",
    description:
      "Animation-frame timestamp (ms) of the frame that removed the stimulus; NA if the trial was interrupted or the session ended first. Frame times mark the start of a frame, so this can be up to one frame earlier than response_timestamp_ms.",
    value: (r) => ms(r.timing.stimulusOffsetMs),
  },
  {
    name: "iti_end_ms",
    description:
      "Timestamp (ms) when the 500 ms interval after the trial ended; NA if it did not complete.",
    value: (r) => ms(r.timing.itiEndMs),
  },
];

export function csvField(value: string | number | null): string {
  if (value === null) return MISSING;
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Builds RFC 4180 CSV (CRLF line endings) with a UTF-8 byte-order mark so
 * spreadsheet programs read the arrow and dash symbols correctly.
 */
export function buildTrialCsv<TStimulus>(
  records: readonly TrialRecord<TStimulus, string, unknown>[],
  context: ExportContext,
  stimulusColumns: readonly ExportColumn<TStimulus>[],
): string {
  const columns = [
    ...(BASE_COLUMNS_BEFORE as readonly ExportColumn<TStimulus>[]),
    ...stimulusColumns,
    ...(BASE_COLUMNS_AFTER as readonly ExportColumn<TStimulus>[]),
  ];
  const lines = [columns.map((column) => csvField(column.name)).join(",")];
  for (const record of records) {
    lines.push(
      columns
        .map((column) => csvField(column.value(record, context)))
        .join(","),
    );
  }
  return `${BYTE_ORDER_MARK}${lines.join("\r\n")}\r\n`;
}

export function exportFileName(
  experimentId: string,
  status: SessionRecordStatus,
) {
  return `human-benchmark-${experimentId}-${status}-trials.csv`;
}
