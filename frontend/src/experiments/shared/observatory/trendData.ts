/**
 * Loads what the Trends view needs, using only the existing local API
 * (Cycle 9, Task 9.5):
 *   1. summaries for ONE experiment (GET /api/v1/sessions?experiment_id=…),
 *      paged with the backend cursor;
 *   2. details (trials) only for sessions stored under the version this app
 *      can analyse, newest first: the newest MAX_ANALYSED, plus up to
 *      REPLACEMENT_LIMIT older ones replacing invalid or unloadable sessions
 *      (see loadTrendInputs), a few at a time;
 *   3. each detail through the approved adapter and analysis.
 *
 * Requests are kept in a cache owned by the page. React StrictMode mounts
 * effects twice in development; the second mount reuses the same promises,
 * so no request is sent twice and none is aborted half-way. Failed requests
 * are dropped from the cache so "Try again" asks the server again.
 */
import type { SaveExperimentId } from "../persistence/sessionPayload";
import {
  getSession,
  listSessions,
  MAX_PAGE_SIZE,
  type DetailOutcome,
  type ObservatoryConfig,
  type RequestFailure,
  type StoredSessionSummary,
} from "./observatoryClient";
import { analyseStoredSession, isSupportedVersion } from "./storedSession";
import type { TrendInput } from "./trends";

/** Summaries read at most (two full pages). */
export const MAX_SUMMARIES = 200;
/** Sessions whose trials are loaded and analysed, newest first. */
export const MAX_ANALYSED = 60;
export const DETAIL_CONCURRENCY = 4;

type ListAll =
  | {
      kind: "ok";
      sessions: readonly StoredSessionSummary[];
      truncated: boolean;
    }
  | RequestFailure;

export interface TrendCache {
  lists: Map<SaveExperimentId, Promise<ListAll>>;
  details: Map<string, Promise<DetailOutcome>>;
}

export function createTrendCache(): TrendCache {
  return { lists: new Map(), details: new Map() };
}

async function listAll(
  config: ObservatoryConfig,
  experimentId: SaveExperimentId,
): Promise<ListAll> {
  const sessions: StoredSessionSummary[] = [];
  let cursor: string | undefined;
  for (;;) {
    const outcome = await listSessions(config, {
      experimentId,
      limit: MAX_PAGE_SIZE,
      ...(cursor ? { cursor } : {}),
    });
    if (outcome.kind !== "ok") return outcome;
    sessions.push(...outcome.page.sessions);
    if (!outcome.page.next_cursor)
      return { kind: "ok", sessions, truncated: false };
    if (sessions.length >= MAX_SUMMARIES) {
      return { kind: "ok", sessions, truncated: true };
    }
    cursor = outcome.page.next_cursor;
  }
}

export type TrendLoad =
  | {
      kind: "ok";
      inputs: readonly TrendInput[];
      /** Summaries read for this experiment (newest first). */
      retrieved: number;
      /** More summaries exist than were read; their number is unknown. */
      truncatedList: boolean;
      /** Read summaries stored under a version this app does not analyse. */
      unsupported: number;
      /**
       * Supported-version sessions that were read but are older than the
       * analysed window (not loaded). Known exactly.
       */
      notAnalysed: number;
      /** Extra details loaded to replace invalid or unloadable sessions. */
      replacementsUsed: number;
    }
  | RequestFailure;

/**
 * At most this many extra details are loaded to replace sessions inside the
 * window that turn out to be invalid or cannot be loaded, so that such
 * sessions do not push older valid ones out of the window. Bounded, and used
 * only when needed: with no invalid sessions, exactly MAX_ANALYSED (or fewer)
 * details are loaded, as before.
 */
export const REPLACEMENT_LIMIT = 10;

/**
 * Selection, in order:
 *   1. read up to MAX_SUMMARIES summaries of ONE experiment, newest first
 *      (server order: save time, then session ID, both descending);
 *   2. keep those stored under the version this app analyses;
 *   3. load and analyse the newest MAX_ANALYSED of them;
 *   4. while fewer than MAX_ANALYSED analysed successfully and older
 *      supported sessions remain, load the next older ones, up to
 *      REPLACEMENT_LIMIT extra loads in total.
 * The analysed window is therefore always the newest contiguous run of
 * supported-version sessions among those read.
 */
export async function loadTrendInputs(
  config: ObservatoryConfig,
  experimentId: SaveExperimentId,
  cache: TrendCache,
  onProgress?: (done: number, total: number) => void,
): Promise<TrendLoad> {
  let listPromise = cache.lists.get(experimentId);
  if (!listPromise) {
    listPromise = listAll(config, experimentId);
    cache.lists.set(experimentId, listPromise);
  }
  const list = await listPromise;
  if (list.kind !== "ok") {
    cache.lists.delete(experimentId);
    return list;
  }

  const supported = list.sessions.filter(isSupportedVersion);
  const inputs: TrendInput[] = list.sessions
    .filter((summary) => !isSupportedVersion(summary))
    .map((summary) => ({ summary, kind: "unsupported_version" as const }));
  const unsupported = inputs.length;

  let done = 0;
  let total = Math.min(MAX_ANALYSED, supported.length);
  let valid = 0;
  onProgress?.(done, total);

  const loadOne = async (summary: StoredSessionSummary) => {
    let detail = cache.details.get(summary.session_id);
    if (!detail) {
      detail = getSession(config, summary.session_id);
      cache.details.set(summary.session_id, detail);
    }
    const outcome = await detail;
    if (outcome.kind === "ok") {
      const result = analyseStoredSession(outcome.session, {
        expectedSessionId: summary.session_id,
        expectedExperimentId: experimentId,
      });
      if (result.ok) valid += 1;
      inputs.push({ summary, kind: "analysed", result });
    } else {
      cache.details.delete(summary.session_id);
      inputs.push({ summary, kind: "not_loaded" });
    }
    done += 1;
    onProgress?.(done, total);
  };

  const loadRange = async (from: number, to: number) => {
    let next = from;
    const worker = async () => {
      while (next < to) await loadOne(supported[next++]);
    };
    await Promise.all(
      Array.from({ length: Math.min(DETAIL_CONCURRENCY, to - from) }, worker),
    );
  };

  let loaded = total;
  await loadRange(0, loaded);
  let replacementsUsed = 0;
  while (
    valid < MAX_ANALYSED &&
    loaded < supported.length &&
    replacementsUsed < REPLACEMENT_LIMIT
  ) {
    const extra = Math.min(
      MAX_ANALYSED - valid,
      supported.length - loaded,
      REPLACEMENT_LIMIT - replacementsUsed,
    );
    total += extra;
    await loadRange(loaded, loaded + extra);
    loaded += extra;
    replacementsUsed += extra;
  }

  return {
    kind: "ok",
    inputs,
    retrieved: list.sessions.length,
    truncatedList: list.truncated,
    unsupported,
    notAnalysed: supported.length - loaded,
    replacementsUsed,
  };
}
