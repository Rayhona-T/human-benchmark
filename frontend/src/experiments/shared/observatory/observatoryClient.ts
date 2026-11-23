/**
 * Personal Observatory data client (Cycle 9 Task 9.3): reads and deletes
 * sessions stored by the LOCAL test backend (docs/backend/API.md).
 *
 * Gating (fail closed):
 *   - only in a dev-server build (`import.meta.env.DEV`), re-checked on every
 *     call, so production builds can never send these requests;
 *   - only with a valid configuration from `readObservatoryConfig`: the same
 *     opt-in setting as saving (VITE_HB_LOCAL_SAVE_API), restricted to the
 *     hosts the backend trusts (`localhost`, `127.0.0.1`);
 *   - the backend additionally requires HB_LOCAL_OWNER_ACCESS=true. Its
 *     refusal is reported as `access_disabled`; nothing here works around it.
 *
 * Every reply is validated strictly, field by field, and unknown fields are
 * rejected: a history entry that carried trial data would be refused, not
 * passed on. Server text is never shown to the participant.
 *
 * LOCAL-OWNER ACCESS IS NOT OWNERSHIP PROOF (docs/backend/DATA_AND_PRIVACY.md
 * §8.1).
 */
import { parseLocalApiOrigin } from "../localApi";
import type { SaveExperimentId } from "../persistence/sessionPayload";

export const OBSERVATORY_TIMEOUT_MS = 10_000;
export const MAX_PAGE_SIZE = 100;
export const DELETE_ALL_CONFIRMATION = "delete-all-local-sessions";

// --- Configuration -----------------------------------------------------------

export interface ObservatoryConfig {
  /** Origin of the local test backend, e.g. "http://127.0.0.1:8000". */
  readonly apiBase: string;
}

export interface ObservatoryEnvironment {
  DEV: boolean;
  VITE_HB_LOCAL_SAVE_API?: string;
}

/**
 * The configuration, or null when the Observatory must not be offered. The
 * address rule is the one shared with saving (../localApi.ts).
 */
export function readObservatoryConfig(
  env: ObservatoryEnvironment,
): ObservatoryConfig | null {
  if (env.DEV !== true) return null;
  const apiBase = parseLocalApiOrigin(env.VITE_HB_LOCAL_SAVE_API);
  return apiBase ? Object.freeze({ apiBase }) : null;
}

/** Configuration of the running app (always null in production builds). */
export function appObservatoryConfig(): ObservatoryConfig | null {
  return readObservatoryConfig({
    DEV: import.meta.env.DEV,
    VITE_HB_LOCAL_SAVE_API: import.meta.env.VITE_HB_LOCAL_SAVE_API as
      string | undefined,
  });
}

/** Re-validates a configuration at call time (fail closed). */
function usableBase(config: ObservatoryConfig | null | undefined) {
  if (!config || typeof config.apiBase !== "string") return null;
  return readObservatoryConfig({
    DEV: import.meta.env.DEV,
    VITE_HB_LOCAL_SAVE_API: config.apiBase,
  })?.apiBase;
}

// --- Validated response types ------------------------------------------------

export interface TrialCounts {
  readonly practice: number;
  readonly main: number;
}

/** One history entry. Contains no trial-level data by construction. */
export interface StoredSessionSummary {
  readonly session_id: string;
  readonly data_schema_version: number;
  readonly experiment_id: SaveExperimentId;
  readonly protocol_id: string;
  readonly protocol_version: string;
  readonly configuration_id: string;
  readonly configuration_version: string;
  readonly status: string;
  readonly consent_notice_version: string;
  readonly created_at: string;
  readonly trial_counts: TrialCounts;
}

export interface StoredSessionPage {
  readonly sessions: readonly StoredSessionSummary[];
  readonly next_cursor: string | null;
}

export type StoredOutcome = "correct" | "incorrect" | "timeout" | "invalid";

export interface StoredTiming {
  readonly fixation_onset_ms: number | null;
  readonly stimulus_onset_ms: number | null;
  readonly response_timestamp_ms: number | null;
  readonly deadline_ms: number | null;
  readonly stimulus_offset_ms: number | null;
  readonly iti_end_ms: number | null;
}

export interface StoredPlannedTrial {
  readonly trial_index: number;
  readonly condition: string;
  readonly stimulus: Readonly<Record<string, string>>;
  readonly correct_response: string;
}

export interface StoredTrial extends StoredPlannedTrial {
  readonly phase: "practice" | "main";
  readonly response_key: string | null;
  readonly outcome: StoredOutcome;
  readonly invalid_reason: string | null;
  readonly reaction_time_ms: number | null;
  readonly timing: StoredTiming;
}

export interface StoredRandomization {
  readonly seed: number | null;
  readonly prng_id: string | null;
  readonly randomization_version: string | null;
  readonly schedule_generation_status: string;
  readonly allocation_details: Readonly<Record<string, unknown>> | null;
  readonly practice_order: readonly StoredPlannedTrial[];
  readonly main_order: readonly StoredPlannedTrial[];
}

/** GET /api/v1/sessions/{id}, exactly as the backend returns it. */
export interface StoredSessionDetail {
  readonly session_id: string;
  readonly data_schema_version: number;
  readonly experiment_id: string;
  readonly protocol_id: string;
  readonly protocol_version: string;
  readonly configuration_id: string;
  readonly configuration_version: string;
  readonly status: string;
  readonly consent_notice_version: string;
  readonly break_taken: boolean;
  readonly break_duration_ms: number | null;
  readonly created_at: string;
  readonly randomization: StoredRandomization;
  readonly trials: readonly StoredTrial[];
}

// --- Shape validation (pure; also used by storedSession.ts) -----------------

/** Where a reply did not match the contract (for tests and developers). */
export class ResponseShapeError extends Error {
  readonly location: string;
  constructor(location: string, problem: string) {
    super(`${location}: ${problem}`);
    this.location = location;
  }
}

type Json = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,128}$/;
// Backend serializes UTC datetimes with a trailing "Z".
const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

function fail(location: string, problem: string): never {
  throw new ResponseShapeError(location, problem);
}

function object(value: unknown, location: string, keys: readonly string[]) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(location, "must be an object");
  }
  const record = value as Json;
  const expected = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) fail(`${location}.${key}`, "is not expected");
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${location}.${key}`, "is missing");
  }
  return record;
}

function text(value: unknown, location: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256) {
    fail(location, "must be a non-empty string");
  }
  return value;
}

function textOrNull(value: unknown, location: string): string | null {
  return value === null ? null : text(value, location);
}

function finite(value: unknown, location: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(location, "must be a finite number");
  }
  return value;
}

function finiteOrNull(value: unknown, location: string): number | null {
  return value === null ? null : finite(value, location);
}

function count(value: unknown, location: string): number {
  const number = finite(value, location);
  if (!Number.isInteger(number) || number < 0) {
    fail(location, "must be a non-negative integer");
  }
  return number;
}

function bool(value: unknown, location: string): boolean {
  if (typeof value !== "boolean") fail(location, "must be true or false");
  return value;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  location: string,
): T {
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  ) {
    fail(location, `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function uuid(value: unknown, location: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    fail(location, "must be a session ID");
  }
  return value;
}

function utcTime(value: unknown, location: string): string {
  if (
    typeof value !== "string" ||
    !UTC_TIME.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(location, "must be a UTC time");
  }
  return value;
}

function array(value: unknown, location: string, max: number): unknown[] {
  if (!Array.isArray(value)) fail(location, "must be a list");
  if (value.length > max) fail(location, "is too long");
  return value;
}

function stimulus(value: unknown, location: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(location, "must be an object");
  }
  const entries = Object.entries(value as Json);
  if (entries.length === 0 || entries.length > 8) {
    fail(location, "must have task attributes");
  }
  const result: Record<string, string> = {};
  for (const [key, inner] of entries) {
    result[key] = text(inner, `${location}.${key}`);
  }
  return Object.freeze(result);
}

const EXPERIMENTS: readonly SaveExperimentId[] = ["stroop", "flanker"];
const OUTCOMES: readonly StoredOutcome[] = [
  "correct",
  "incorrect",
  "timeout",
  "invalid",
];
const MAX_TRIALS = 500;
const MAX_SCHEDULE = 200;

const SUMMARY_KEYS = [
  "session_id",
  "data_schema_version",
  "experiment_id",
  "protocol_id",
  "protocol_version",
  "configuration_id",
  "configuration_version",
  "status",
  "consent_notice_version",
  "created_at",
  "trial_counts",
] as const;

function parseSummary(value: unknown, location: string): StoredSessionSummary {
  const raw = object(value, location, SUMMARY_KEYS);
  const counts = object(raw.trial_counts, `${location}.trial_counts`, [
    "practice",
    "main",
  ]);
  return Object.freeze({
    session_id: uuid(raw.session_id, `${location}.session_id`),
    data_schema_version: count(
      raw.data_schema_version,
      `${location}.data_schema_version`,
    ),
    experiment_id: oneOf(
      raw.experiment_id,
      EXPERIMENTS,
      `${location}.experiment_id`,
    ),
    protocol_id: text(raw.protocol_id, `${location}.protocol_id`),
    protocol_version: text(
      raw.protocol_version,
      `${location}.protocol_version`,
    ),
    configuration_id: text(
      raw.configuration_id,
      `${location}.configuration_id`,
    ),
    configuration_version: text(
      raw.configuration_version,
      `${location}.configuration_version`,
    ),
    status: text(raw.status, `${location}.status`),
    consent_notice_version: text(
      raw.consent_notice_version,
      `${location}.consent_notice_version`,
    ),
    created_at: utcTime(raw.created_at, `${location}.created_at`),
    trial_counts: Object.freeze({
      practice: count(counts.practice, `${location}.trial_counts.practice`),
      main: count(counts.main, `${location}.trial_counts.main`),
    }),
  });
}

/** Validates a GET /api/v1/sessions reply. Throws ResponseShapeError. */
export function parseSessionPage(value: unknown): StoredSessionPage {
  const raw = object(value, "page", ["sessions", "next_cursor"]);
  const sessions = array(raw.sessions, "page.sessions", MAX_PAGE_SIZE).map(
    (entry, index) => parseSummary(entry, `page.sessions[${index}]`),
  );
  const cursor = raw.next_cursor;
  if (cursor !== null && (typeof cursor !== "string" || !CURSOR.test(cursor))) {
    fail("page.next_cursor", "must be a cursor or null");
  }
  return Object.freeze({
    sessions: Object.freeze(sessions),
    next_cursor: cursor,
  });
}

function parsePlanned(value: unknown, location: string): StoredPlannedTrial {
  const raw = object(value, location, [
    "trial_index",
    "condition",
    "stimulus",
    "correct_response",
  ]);
  return Object.freeze({
    trial_index: count(raw.trial_index, `${location}.trial_index`),
    condition: text(raw.condition, `${location}.condition`),
    stimulus: stimulus(raw.stimulus, `${location}.stimulus`),
    correct_response: text(
      raw.correct_response,
      `${location}.correct_response`,
    ),
  });
}

const TIMING_KEYS = [
  "fixation_onset_ms",
  "stimulus_onset_ms",
  "response_timestamp_ms",
  "deadline_ms",
  "stimulus_offset_ms",
  "iti_end_ms",
] as const;

function parseTrial(value: unknown, location: string): StoredTrial {
  const raw = object(value, location, [
    "phase",
    "trial_index",
    "condition",
    "stimulus",
    "correct_response",
    "response_key",
    "outcome",
    "invalid_reason",
    "reaction_time_ms",
    "timing",
  ]);
  const timing = object(raw.timing, `${location}.timing`, TIMING_KEYS);
  const parsedTiming = {} as Record<
    (typeof TIMING_KEYS)[number],
    number | null
  >;
  for (const key of TIMING_KEYS) {
    parsedTiming[key] = finiteOrNull(timing[key], `${location}.timing.${key}`);
  }
  return Object.freeze({
    phase: oneOf(raw.phase, ["practice", "main"] as const, `${location}.phase`),
    trial_index: count(raw.trial_index, `${location}.trial_index`),
    condition: text(raw.condition, `${location}.condition`),
    stimulus: stimulus(raw.stimulus, `${location}.stimulus`),
    correct_response: text(
      raw.correct_response,
      `${location}.correct_response`,
    ),
    response_key: textOrNull(raw.response_key, `${location}.response_key`),
    outcome: oneOf(raw.outcome, OUTCOMES, `${location}.outcome`),
    invalid_reason: textOrNull(
      raw.invalid_reason,
      `${location}.invalid_reason`,
    ),
    reaction_time_ms: finiteOrNull(
      raw.reaction_time_ms,
      `${location}.reaction_time_ms`,
    ),
    timing: Object.freeze(parsedTiming),
  });
}

function parseAllocation(value: unknown, location: string) {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    fail(location, "must be an object or null");
  }
  // Bounded, opaque reproducibility data: kept as received, never analysed.
  return Object.freeze({ ...(value as Json) });
}

/** Validates a GET /api/v1/sessions/{id} reply. Throws ResponseShapeError. */
export function parseSessionDetail(value: unknown): StoredSessionDetail {
  const raw = object(value, "session", [
    "session_id",
    "data_schema_version",
    "experiment_id",
    "protocol_id",
    "protocol_version",
    "configuration_id",
    "configuration_version",
    "status",
    "consent_notice_version",
    "break_taken",
    "break_duration_ms",
    "created_at",
    "randomization",
    "trials",
  ]);
  const randomization = object(raw.randomization, "session.randomization", [
    "seed",
    "prng_id",
    "randomization_version",
    "schedule_generation_status",
    "allocation_details",
    "practice_order",
    "main_order",
  ]);
  return Object.freeze({
    session_id: uuid(raw.session_id, "session.session_id"),
    data_schema_version: count(
      raw.data_schema_version,
      "session.data_schema_version",
    ),
    experiment_id: text(raw.experiment_id, "session.experiment_id"),
    protocol_id: text(raw.protocol_id, "session.protocol_id"),
    protocol_version: text(raw.protocol_version, "session.protocol_version"),
    configuration_id: text(raw.configuration_id, "session.configuration_id"),
    configuration_version: text(
      raw.configuration_version,
      "session.configuration_version",
    ),
    status: text(raw.status, "session.status"),
    consent_notice_version: text(
      raw.consent_notice_version,
      "session.consent_notice_version",
    ),
    break_taken: bool(raw.break_taken, "session.break_taken"),
    break_duration_ms: finiteOrNull(
      raw.break_duration_ms,
      "session.break_duration_ms",
    ),
    created_at: utcTime(raw.created_at, "session.created_at"),
    randomization: Object.freeze({
      seed:
        randomization.seed === null
          ? null
          : count(randomization.seed, "session.randomization.seed"),
      prng_id: textOrNull(
        randomization.prng_id,
        "session.randomization.prng_id",
      ),
      randomization_version: textOrNull(
        randomization.randomization_version,
        "session.randomization.randomization_version",
      ),
      schedule_generation_status: text(
        randomization.schedule_generation_status,
        "session.randomization.schedule_generation_status",
      ),
      allocation_details: parseAllocation(
        randomization.allocation_details,
        "session.randomization.allocation_details",
      ),
      practice_order: Object.freeze(
        array(
          randomization.practice_order,
          "session.randomization.practice_order",
          MAX_SCHEDULE,
        ).map((entry, index) =>
          parsePlanned(entry, `session.randomization.practice_order[${index}]`),
        ),
      ),
      main_order: Object.freeze(
        array(
          randomization.main_order,
          "session.randomization.main_order",
          MAX_SCHEDULE,
        ).map((entry, index) =>
          parsePlanned(entry, `session.randomization.main_order[${index}]`),
        ),
      ),
    }),
    trials: Object.freeze(
      array(raw.trials, "session.trials", MAX_TRIALS).map((entry, index) =>
        parseTrial(entry, `session.trials[${index}]`),
      ),
    ),
  });
}

// --- Requests --------------------------------------------------------------

/** Failure kinds shared by every request. */
export type RequestFailure =
  /** No valid configuration, or not a dev-server build: nothing was sent. */
  | { kind: "not_configured" }
  /** The backend has local-owner access switched off (405, or 403). */
  | { kind: "access_disabled" }
  /** The request was refused as invalid (422), e.g. a stale cursor. */
  | { kind: "rejected" }
  | { kind: "unavailable" }
  | { kind: "timeout" }
  | { kind: "server_error" }
  /** A reply that does not match the contract; it is not used. */
  | { kind: "unexpected" }
  | { kind: "cancelled" };

export type ListOutcome =
  { kind: "ok"; page: StoredSessionPage } | RequestFailure;
export type DetailOutcome =
  | { kind: "ok"; session: StoredSessionDetail }
  | { kind: "not_found" }
  | RequestFailure;
export type DeleteOutcome =
  { kind: "deleted" } | { kind: "not_found" } | RequestFailure;
export type DeleteAllOutcome =
  | { kind: "deleted"; deletedSessions: number; deletedTrials: number }
  | RequestFailure;

export interface RequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Aborts the request without reporting a timeout (e.g. on unmount). */
  signal?: AbortSignal;
}

export interface ListQuery {
  experimentId?: SaveExperimentId;
  /** 1 to 100; the backend default (20) when omitted. */
  limit?: number;
  /** A `next_cursor` from an earlier page. */
  cursor?: string;
}

interface Exchange {
  status: number;
  body: unknown;
}

type Sent = { kind: "reply"; reply: Exchange } | RequestFailure;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorCode(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as Json).error;
  if (typeof error !== "object" || error === null) return null;
  const code = (error as Json).code;
  return typeof code === "string" ? code : null;
}

async function send(
  config: ObservatoryConfig | null | undefined,
  path: string,
  init: { method: "GET" | "DELETE"; body?: string },
  options: RequestOptions,
): Promise<Sent> {
  const base = usableBase(config);
  if (!base) return { kind: "not_configured" };
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? OBSERVATORY_TIMEOUT_MS);
  const stop = () => controller.abort();
  options.signal?.addEventListener("abort", stop);
  if (options.signal?.aborted) controller.abort();
  try {
    const response = await fetchImpl(`${base}/api/v1/sessions${path}`, {
      method: init.method,
      headers:
        init.body === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
      body: init.body,
      signal: controller.signal,
      // No cookies or other credentials, no referrer, no caching.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
    });
    const body = response.status === 204 ? null : await readJson(response);
    return { kind: "reply", reply: { status: response.status, body } };
  } catch {
    if (timedOut) return { kind: "timeout" };
    if (controller.signal.aborted) return { kind: "cancelled" };
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}

/** Shared mapping of error replies. `notFound` only where 404 is meaningful. */
function failureOf(reply: Exchange): RequestFailure {
  if (
    reply.status === 403 &&
    errorCode(reply.body) === "local_owner_access_disabled"
  ) {
    return { kind: "access_disabled" };
  }
  // With access off, the list and delete-all routes are not registered.
  if (reply.status === 405) return { kind: "access_disabled" };
  if (reply.status === 422) return { kind: "rejected" };
  if (reply.status >= 500) return { kind: "server_error" };
  return { kind: "unexpected" };
}

function validSessionId(sessionId: string): boolean {
  return typeof sessionId === "string" && UUID.test(sessionId);
}

/** GET /api/v1/sessions: one page of summaries, newest first. */
export async function listSessions(
  config: ObservatoryConfig | null | undefined,
  query: ListQuery = {},
  options: RequestOptions = {},
): Promise<ListOutcome> {
  const params = new URLSearchParams();
  if (query.experimentId !== undefined) {
    if (!EXPERIMENTS.includes(query.experimentId)) return { kind: "rejected" };
    params.set("experiment_id", query.experimentId);
  }
  if (query.limit !== undefined) {
    if (
      !Number.isInteger(query.limit) ||
      query.limit < 1 ||
      query.limit > MAX_PAGE_SIZE
    ) {
      return { kind: "rejected" };
    }
    params.set("limit", String(query.limit));
  }
  if (query.cursor !== undefined) {
    if (typeof query.cursor !== "string" || !CURSOR.test(query.cursor)) {
      return { kind: "rejected" };
    }
    params.set("cursor", query.cursor);
  }
  const search = params.toString();
  const sent = await send(
    config,
    search ? `?${search}` : "",
    { method: "GET" },
    options,
  );
  if (sent.kind !== "reply") return sent;
  if (sent.reply.status !== 200) return failureOf(sent.reply);
  let page: StoredSessionPage;
  try {
    page = parseSessionPage(sent.reply.body);
  } catch {
    return { kind: "unexpected" };
  }
  if (
    query.experimentId !== undefined &&
    page.sessions.some((entry) => entry.experiment_id !== query.experimentId)
  ) {
    return { kind: "unexpected" };
  }
  if (query.limit !== undefined && page.sessions.length > query.limit) {
    return { kind: "unexpected" };
  }
  return { kind: "ok", page };
}

/** GET /api/v1/sessions/{id}: the stored session with all its trials. */
export async function getSession(
  config: ObservatoryConfig | null | undefined,
  sessionId: string,
  options: RequestOptions = {},
): Promise<DetailOutcome> {
  if (!validSessionId(sessionId)) return { kind: "rejected" };
  const sent = await send(config, `/${sessionId}`, { method: "GET" }, options);
  if (sent.kind !== "reply") return sent;
  if (sent.reply.status === 404) return { kind: "not_found" };
  if (sent.reply.status !== 200) return failureOf(sent.reply);
  let session: StoredSessionDetail;
  try {
    session = parseSessionDetail(sent.reply.body);
  } catch {
    return { kind: "unexpected" };
  }
  // The reply must be the session that was asked for.
  if (session.session_id !== sessionId) return { kind: "unexpected" };
  return { kind: "ok", session };
}

/** DELETE /api/v1/sessions/{id}: permanent; there is no undo. */
export async function deleteSession(
  config: ObservatoryConfig | null | undefined,
  sessionId: string,
  options: RequestOptions = {},
): Promise<DeleteOutcome> {
  if (!validSessionId(sessionId)) return { kind: "rejected" };
  const sent = await send(
    config,
    `/${sessionId}`,
    { method: "DELETE" },
    options,
  );
  if (sent.kind !== "reply") return sent;
  if (sent.reply.status === 204) return { kind: "deleted" };
  if (sent.reply.status === 404) return { kind: "not_found" };
  return failureOf(sent.reply);
}

/**
 * DELETE /api/v1/sessions: deletes EVERY stored session; there is no undo.
 * The caller must pass the exact confirmation phrase; anything else sends
 * nothing.
 */
export async function deleteAllSessions(
  config: ObservatoryConfig | null | undefined,
  confirmation: typeof DELETE_ALL_CONFIRMATION,
  options: RequestOptions = {},
): Promise<DeleteAllOutcome> {
  if (confirmation !== DELETE_ALL_CONFIRMATION) return { kind: "rejected" };
  const sent = await send(
    config,
    "",
    { method: "DELETE", body: JSON.stringify({ confirm: confirmation }) },
    options,
  );
  if (sent.kind !== "reply") return sent;
  if (sent.reply.status !== 200) return failureOf(sent.reply);
  try {
    const body = object(sent.reply.body, "result", [
      "deleted_sessions",
      "deleted_trials",
    ]);
    return {
      kind: "deleted",
      deletedSessions: count(body.deleted_sessions, "result.deleted_sessions"),
      deletedTrials: count(body.deleted_trials, "result.deleted_trials"),
    };
  } catch {
    return { kind: "unexpected" };
  }
}
