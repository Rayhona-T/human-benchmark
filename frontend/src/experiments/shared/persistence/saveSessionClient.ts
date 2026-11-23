/**
 * The only network call in the frontend: one POST after the participant
 * explicitly chooses to save a finished session.
 *
 * Every reply is reduced to a small, typed outcome. Server text is never
 * shown to the participant. Retrying with the same client_session_id is
 * safe: the backend stores a client_session_id once and answers a repeat
 * with 409 duplicate_session, reported here as "already_saved".
 *
 * Every request needs its own consent authorization (consent.ts). Without
 * a valid, unused one, saveSession throws before any network activity.
 */
import { consumeAuthorization, type SaveAuthorization } from "./consent";
import type { SessionSavePayload } from "./sessionPayload";

export const SAVE_TIMEOUT_MS = 10_000;

export type SaveOutcome =
  | {
      kind: "saved";
      sessionId: string;
      createdAt: string;
      trialsStored: { practice: number; main: number };
    }
  | { kind: "already_saved" }
  /** Rejected by validation; retrying the same data would not help. */
  | {
      kind: "rejected";
      reason: "invalid_session" | "notice_not_recognized" | "too_large";
    }
  | { kind: "unavailable" }
  | { kind: "timeout" }
  | { kind: "server_error" }
  /** A reply that does not match the contract; the save is not confirmed. */
  | { kind: "unexpected" }
  /** The page stopped the request (for example by leaving the results). */
  | { kind: "cancelled" };

export function canRetry(outcome: SaveOutcome): boolean {
  return (
    outcome.kind === "unavailable" ||
    outcome.kind === "timeout" ||
    outcome.kind === "server_error" ||
    outcome.kind === "unexpected"
  );
}

export interface SaveRequestOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Aborts the request without reporting a timeout (e.g. on unmount). */
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function errorCode(body: unknown): string | null {
  if (!isRecord(body) || !isRecord(body.error)) return null;
  return typeof body.error.code === "string" ? body.error.code : null;
}

function errorLocations(body: unknown): string[] {
  if (
    !isRecord(body) ||
    !isRecord(body.error) ||
    !Array.isArray(body.error.details)
  ) {
    return [];
  }
  return body.error.details
    .map((detail) => (isRecord(detail) ? detail.location : null))
    .filter((location): location is string => typeof location === "string");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function savedOutcome(body: unknown, payload: SessionSavePayload): SaveOutcome {
  if (
    !isRecord(body) ||
    typeof body.session_id !== "string" ||
    typeof body.created_at !== "string" ||
    body.experiment_id !== payload.experiment_id ||
    body.status !== payload.status ||
    !isRecord(body.trials_stored) ||
    !isCount(body.trials_stored.practice) ||
    !isCount(body.trials_stored.main)
  ) {
    return { kind: "unexpected" };
  }
  return {
    kind: "saved",
    sessionId: body.session_id,
    createdAt: body.created_at,
    trialsStored: {
      practice: body.trials_stored.practice,
      main: body.trials_stored.main,
    },
  };
}

export async function saveSession(
  apiBase: string,
  payload: SessionSavePayload,
  authorization: SaveAuthorization,
  options: SaveRequestOptions = {},
): Promise<SaveOutcome> {
  // Consent boundary: checked (and the authorization used up) before any
  // timer, request or other side effect. Throws ConsentNotAuthorizedError.
  if (payload.consent.confirmed !== true) {
    consumeAuthorization(null, payload.consent.notice_version);
  }
  consumeAuthorization(authorization, payload.consent.notice_version);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? SAVE_TIMEOUT_MS);
  const stop = () => controller.abort();
  options.signal?.addEventListener("abort", stop);
  if (options.signal?.aborted) controller.abort();

  try {
    const response = await fetchImpl(`${apiBase}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // No cookies or other credentials, no referrer, no caching.
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
    });
    const body = await readJson(response);
    if (response.status === 201) return savedOutcome(body, payload);
    const code = errorCode(body);
    if (response.status === 409 && code === "duplicate_session") {
      return { kind: "already_saved" };
    }
    if (response.status === 422 && code === "invalid_session") {
      return errorLocations(body).includes("consent.notice_version")
        ? { kind: "rejected", reason: "notice_not_recognized" }
        : { kind: "rejected", reason: "invalid_session" };
    }
    if (response.status === 422 && code === "invalid_request") {
      return { kind: "rejected", reason: "invalid_session" };
    }
    if (response.status === 413)
      return { kind: "rejected", reason: "too_large" };
    if (response.status >= 500) return { kind: "server_error" };
    return { kind: "unexpected" };
  } catch {
    if (timedOut) return { kind: "timeout" };
    if (controller.signal.aborted) return { kind: "cancelled" };
    return { kind: "unavailable" };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
  }
}
