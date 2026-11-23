/**
 * TEST HELPER ONLY (imported by tests, never by the app).
 *
 * An in-memory stand-in for the local test backend's Observatory endpoints
 * (docs/backend/API.md), built from REAL recorded backend replies
 * (experiments/shared/observatory/__fixtures__). It records every request so
 * tests can check exactly what was sent.
 */
import { vi } from "vitest";
import flankerStored from "../../experiments/shared/observatory/__fixtures__/flanker-stored-detail.json";
import stroopStored from "../../experiments/shared/observatory/__fixtures__/stroop-stored-detail.json";

export const API = "http://127.0.0.1:8000";

type Detail = typeof stroopStored;

export interface FakeSession {
  detail: Detail;
}

export type FailureMode = "network" | number;

export interface Recorded {
  method: string;
  url: URL;
  body: string | undefined;
}

/** A stored session based on a real recorded reply, with its own ID and time. */
export function fakeSession(
  index: number,
  experiment: "stroop" | "flanker" = "stroop",
  change?: (detail: Detail) => void,
): FakeSession {
  const detail = structuredClone(
    experiment === "stroop"
      ? stroopStored
      : (flankerStored as unknown as Detail),
  );
  detail.session_id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  // Older sessions for higher indexes; minute steps keep the order clear.
  const when = new Date(Date.UTC(2026, 10, 23, 12, 0, 0) - index * 60_000);
  detail.created_at = when.toISOString().replace(/\.\d{3}Z$/, ".000000Z");
  change?.(detail);
  return { detail };
}

function summaryOf(detail: Detail) {
  return {
    session_id: detail.session_id,
    data_schema_version: detail.data_schema_version,
    experiment_id: detail.experiment_id,
    protocol_id: detail.protocol_id,
    protocol_version: detail.protocol_version,
    configuration_id: detail.configuration_id,
    configuration_version: detail.configuration_version,
    status: detail.status,
    consent_notice_version: detail.consent_notice_version,
    created_at: detail.created_at,
    trial_counts: {
      practice: detail.trials.filter((t) => t.phase === "practice").length,
      main: detail.trials.filter((t) => t.phase === "main").length,
    },
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound() {
  return json(404, { error: { code: "not_found", message: "…" } });
}

export function createFakeBackend(initial: FakeSession[]) {
  const store = new Map(initial.map((s) => [s.detail.session_id, s.detail]));
  const requests: Recorded[] = [];
  const failures: Partial<
    Record<"list" | "detail" | "deleteOne" | "deleteAll", FailureMode>
  > = {};
  let accessEnabled = true;

  const fail = (mode: FailureMode | undefined) => {
    if (mode === undefined) return null;
    if (mode === "network") throw new TypeError("Failed to fetch");
    return json(mode, {
      error: { code: mode === 403 ? "local_owner_access_disabled" : "x" },
    });
  };

  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    requests.push({ method, url, body });
    const path = url.pathname;
    const idMatch = /^\/api\/v1\/sessions\/([^/]+)$/.exec(path);

    if (path === "/api/v1/sessions" && method === "GET") {
      if (!accessEnabled)
        return json(405, { error: { code: "method_not_allowed" } });
      const failed = fail(failures.list);
      if (failed) return failed;
      const experiment = url.searchParams.get("experiment_id");
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const offset = Number(url.searchParams.get("cursor")?.slice(1) ?? "0");
      const all = [...store.values()]
        .filter((d) => !experiment || d.experiment_id === experiment)
        .sort((a, b) =>
          a.created_at === b.created_at
            ? b.session_id.localeCompare(a.session_id)
            : b.created_at.localeCompare(a.created_at),
        );
      const page = all.slice(offset, offset + limit);
      return json(200, {
        sessions: page.map(summaryOf),
        next_cursor: offset + limit < all.length ? `o${offset + limit}` : null,
      });
    }
    if (path === "/api/v1/sessions" && method === "DELETE") {
      if (!accessEnabled)
        return json(405, { error: { code: "method_not_allowed" } });
      const failed = fail(failures.deleteAll);
      if (failed) return failed;
      if (body !== JSON.stringify({ confirm: "delete-all-local-sessions" })) {
        return json(422, { error: { code: "invalid_request" } });
      }
      const sessions = store.size;
      const trials = [...store.values()].reduce(
        (n, d) => n + d.trials.length,
        0,
      );
      store.clear();
      return json(200, { deleted_sessions: sessions, deleted_trials: trials });
    }
    if (idMatch && method === "GET") {
      if (!accessEnabled) return notFound();
      const failed = fail(failures.detail);
      if (failed) return failed;
      const detail = store.get(idMatch[1]);
      return detail ? json(200, detail) : notFound();
    }
    if (idMatch && method === "DELETE") {
      if (!accessEnabled) return notFound();
      const failed = fail(failures.deleteOne);
      if (failed) return failed;
      if (!store.delete(idMatch[1])) return notFound();
      return new Response(null, { status: 204 });
    }
    return notFound();
  });

  return {
    fetchImpl,
    requests,
    failures,
    store,
    disableAccess() {
      accessEnabled = false;
    },
  };
}
