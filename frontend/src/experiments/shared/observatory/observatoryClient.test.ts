import { afterEach, describe, expect, it, vi } from "vitest";
import flankerList from "./__fixtures__/flanker-stored-list.json";
import stroopDetail from "./__fixtures__/stroop-stored-detail.json";
import stroopList from "./__fixtures__/stroop-stored-list.json";
import {
  DELETE_ALL_CONFIRMATION,
  deleteAllSessions,
  deleteSession,
  getSession,
  listSessions,
  readObservatoryConfig,
  type ObservatoryConfig,
} from "./observatoryClient";

const API = "http://127.0.0.1:8000";
const CONFIG: ObservatoryConfig = { apiBase: API };
const ID = stroopDetail.session_id;
const CURSOR = "MXwyMDI2LTExLTIzVDA4OjAxOjQ3LjIyNTQyMiswMDowMHxmYWExNmRhNA";

function reply(status: number, body?: unknown) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function plain(status: number, text: string) {
  return vi.fn<typeof fetch>(async () => new Response(text, { status }));
}

const never = () =>
  vi.fn<typeof fetch>(async () => new Response(null, { status: 599 }));

const clone = <T>(value: T): T => structuredClone(value);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// --- Configuration and fail-closed gating ------------------------------------

describe("observatory configuration", () => {
  it("is off in production builds, even when configured", () => {
    expect(
      readObservatoryConfig({ DEV: false, VITE_HB_LOCAL_SAVE_API: API }),
    ).toBeNull();
  });

  it("is off unless explicitly configured", () => {
    expect(readObservatoryConfig({ DEV: true })).toBeNull();
    expect(
      readObservatoryConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: " " }),
    ).toBeNull();
  });

  it.each([
    ["http://127.0.0.1:8000", "http://127.0.0.1:8000"],
    ["http://localhost:8000/", "http://localhost:8000"],
  ])("accepts the trusted local address %s", (raw, origin) => {
    expect(
      readObservatoryConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toEqual({
      apiBase: origin,
    });
  });

  it.each([
    // The backend's Host allowlist refuses [::1] (and binds 127.0.0.1 only).
    "http://[::1]:8000",
    "https://127.0.0.1:8000",
    "http://192.168.1.20:8000",
    "http://127.0.0.1.example.com",
    "http://user:pass@127.0.0.1:8000",
    "http://127.0.0.1:8000/api",
    "http://127.0.0.1:8000/?x=1",
    "http://127.0.0.1:8000/#x",
    "not a url",
  ])("refuses %s", (raw) => {
    expect(
      readObservatoryConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toBeNull();
  });
});

describe("nothing is sent without a valid configuration", () => {
  const configs: [string, ObservatoryConfig | null | undefined][] = [
    ["no configuration", null],
    ["undefined", undefined],
    ["a remote address", { apiBase: "https://evil.example" }],
    ["a malformed address", { apiBase: "127.0.0.1:8000" }],
    ["a non-string address", { apiBase: 8000 as unknown as string }],
  ];

  it.each(configs)("%s", async (_label, config) => {
    const fetchImpl = never();
    const outcomes = await Promise.all([
      listSessions(config, {}, { fetchImpl }),
      getSession(config, ID, { fetchImpl }),
      deleteSession(config, ID, { fetchImpl }),
      deleteAllSessions(config, DELETE_ALL_CONFIRMATION, { fetchImpl }),
    ]);
    expect(outcomes.every((outcome) => outcome.kind === "not_configured")).toBe(
      true,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("outside a dev-server build, even with a valid configuration", async () => {
    vi.stubEnv("DEV", false);
    const fetchImpl = never();
    expect((await listSessions(CONFIG, {}, { fetchImpl })).kind).toBe(
      "not_configured",
    );
    expect(
      (await deleteAllSessions(CONFIG, DELETE_ALL_CONFIRMATION, { fetchImpl }))
        .kind,
    ).toBe("not_configured");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// --- Requests ------------------------------------------------------------------

function sentRequest(fetchImpl: ReturnType<typeof reply>) {
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
  return { url, init };
}

describe("requests", () => {
  it("are credential-free, uncached and do not follow redirects", async () => {
    const fetchImpl = reply(200, stroopList);
    await listSessions(CONFIG, {}, { fetchImpl });
    const { url, init } = sentRequest(fetchImpl);
    expect(url).toBe(`${API}/api/v1/sessions`);
    expect(init).toMatchObject({
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
    });
    expect(init.body).toBeUndefined();
  });

  it("encode the filter, page size and cursor", async () => {
    const fetchImpl = reply(200, stroopList);
    await listSessions(
      CONFIG,
      { experimentId: "stroop", limit: 5, cursor: CURSOR },
      { fetchImpl },
    );
    const { url } = sentRequest(fetchImpl);
    expect(url).toBe(
      `${API}/api/v1/sessions?experiment_id=stroop&limit=5&cursor=${CURSOR}`,
    );
  });

  it.each([
    ["page size 0", { limit: 0 }],
    ["page size 101", { limit: 101 }],
    ["a fractional page size", { limit: 1.5 }],
    ["a cursor with other characters", { cursor: "abc&limit=100" }],
    ["an empty cursor", { cursor: "" }],
    ["an unknown experiment", { experimentId: "go-nogo" as "stroop" }],
  ])("refuse %s locally without sending", async (_label, query) => {
    const fetchImpl = never();
    expect((await listSessions(CONFIG, query, { fetchImpl })).kind).toBe(
      "rejected",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each(["not-a-uuid", "../sessions", `${ID}?x=1`, ID.toUpperCase(), ""])(
    "refuse the session ID %j without sending",
    async (sessionId) => {
      const fetchImpl = never();
      expect((await getSession(CONFIG, sessionId, { fetchImpl })).kind).toBe(
        "rejected",
      );
      expect((await deleteSession(CONFIG, sessionId, { fetchImpl })).kind).toBe(
        "rejected",
      );
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );
});

// --- Listing --------------------------------------------------------------------

describe("listSessions", () => {
  it("returns a validated page from a real backend reply", async () => {
    const outcome = await listSessions(
      CONFIG,
      {},
      { fetchImpl: reply(200, stroopList) },
    );
    expect(outcome).toEqual({ kind: "ok", page: stroopList });
  });

  it("accepts a page with a next cursor", async () => {
    const body = { ...clone(stroopList), next_cursor: CURSOR };
    const outcome = await listSessions(
      CONFIG,
      {},
      { fetchImpl: reply(200, body) },
    );
    expect(outcome.kind === "ok" && outcome.page.next_cursor).toBe(CURSOR);
  });

  it.each<[string, (page: typeof stroopList) => unknown]>([
    // Summaries must never carry trial-level data.
    [
      "trial data in a summary",
      (page) => {
        (page.sessions[0] as Record<string, unknown>).trials =
          stroopDetail.trials;
        return page;
      },
    ],
    [
      "a seed in a summary",
      (page) => {
        (page.sessions[0] as Record<string, unknown>).seed = 123;
        return page;
      },
    ],
    [
      "a missing summary field",
      (page) => {
        delete (page.sessions[0] as Partial<(typeof page.sessions)[0]>)
          .created_at;
        return page;
      },
    ],
    ["an extra page field", (page) => ({ ...page, total: 1 })],
    [
      "a negative trial count",
      (page) => {
        page.sessions[0].trial_counts.main = -1;
        return page;
      },
    ],
    [
      "an unknown experiment",
      (page) => {
        page.sessions[0].experiment_id = "go-nogo";
        return page;
      },
    ],
    [
      "a malformed save time",
      (page) => {
        page.sessions[0].created_at = "yesterday";
        return page;
      },
    ],
    ["a malformed cursor", (page) => ({ ...page, next_cursor: "a b" })],
    ["not JSON", () => undefined],
    ["a list instead of a page", (page) => page.sessions],
  ])("treats %s as unexpected", async (_label, make) => {
    const fetchImpl = reply(200, make(clone(stroopList)));
    expect((await listSessions(CONFIG, {}, { fetchImpl })).kind).toBe(
      "unexpected",
    );
  });

  it("treats entries outside the requested experiment as unexpected", async () => {
    const outcome = await listSessions(
      CONFIG,
      { experimentId: "stroop" },
      { fetchImpl: reply(200, flankerList) },
    );
    expect(outcome.kind).toBe("unexpected");
  });

  it("treats more entries than the requested page size as unexpected", async () => {
    const body = {
      sessions: [...stroopList.sessions, ...flankerList.sessions],
      next_cursor: null,
    };
    const outcome = await listSessions(
      CONFIG,
      { limit: 1 },
      { fetchImpl: reply(200, body) },
    );
    expect(outcome.kind).toBe("unexpected");
  });
});

// --- Error replies (all endpoints) --------------------------------------------

describe("error replies", () => {
  const calls = {
    list: (fetchImpl: typeof fetch) => listSessions(CONFIG, {}, { fetchImpl }),
    detail: (fetchImpl: typeof fetch) => getSession(CONFIG, ID, { fetchImpl }),
    deleteOne: (fetchImpl: typeof fetch) =>
      deleteSession(CONFIG, ID, { fetchImpl }),
    deleteAll: (fetchImpl: typeof fetch) =>
      deleteAllSessions(CONFIG, DELETE_ALL_CONFIRMATION, { fetchImpl }),
  };

  it.each(Object.entries(calls))(
    "%s: local-owner access switched off",
    async (_n, call) => {
      const disabled = reply(403, {
        error: { code: "local_owner_access_disabled", message: "…" },
      });
      expect((await call(disabled)).kind).toBe("access_disabled");
    },
  );

  it.each([
    ["list", calls.list],
    ["deleteAll", calls.deleteAll],
  ])(
    "%s: an unregistered route (405) means access is off",
    async (_n, call) => {
      const missing = reply(405, {
        error: { code: "method_not_allowed", message: "…" },
      });
      expect((await call(missing)).kind).toBe("access_disabled");
    },
  );

  it.each(Object.entries(calls))("%s: other replies", async (_n, call) => {
    expect(
      (await call(reply(422, { error: { code: "invalid_request" } }))).kind,
    ).toBe("rejected");
    expect(
      (await call(reply(500, { error: { code: "internal_error" } }))).kind,
    ).toBe("server_error");
    // A refused Host header comes back as plain text.
    expect((await call(plain(400, "Invalid host header"))).kind).toBe(
      "unexpected",
    );
    expect(
      (await call(reply(403, { error: { code: "forbidden" } }))).kind,
    ).toBe("unexpected");
    expect((await call(reply(418, {}))).kind).toBe("unexpected");
  });

  it.each(Object.entries(calls))("%s: network failure", async (_n, call) => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect((await call(offline)).kind).toBe("unavailable");
  });

  it("reports a timeout", async () => {
    vi.useFakeTimers();
    const hanging = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const pending = listSessions(
      CONFIG,
      {},
      { fetchImpl: hanging, timeoutMs: 50 },
    );
    await vi.advanceTimersByTimeAsync(60);
    expect((await pending).kind).toBe("timeout");
  });

  it("reports cancellation separately from a timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    const hanging = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          if (init?.signal?.aborted)
            reject(new DOMException("Aborted", "AbortError"));
        }),
    );
    const outcome = await getSession(CONFIG, ID, {
      fetchImpl: hanging,
      signal: controller.signal,
    });
    expect(outcome.kind).toBe("cancelled");
  });
});

// --- Detail --------------------------------------------------------------------

describe("getSession", () => {
  it("returns the validated session from a real backend reply", async () => {
    const fetchImpl = reply(200, stroopDetail);
    const outcome = await getSession(CONFIG, ID, { fetchImpl });
    expect(outcome).toEqual({ kind: "ok", session: stroopDetail });
    expect(sentRequest(fetchImpl).url).toBe(`${API}/api/v1/sessions/${ID}`);
  });

  it("reports an unknown session", async () => {
    const outcome = await getSession(CONFIG, ID, {
      fetchImpl: reply(404, { error: { code: "not_found" } }),
    });
    expect(outcome.kind).toBe("not_found");
  });

  it("refuses a reply about a different session", async () => {
    const body = {
      ...clone(stroopDetail),
      session_id: flankerList.sessions[0].session_id,
    };
    expect(
      (await getSession(CONFIG, ID, { fetchImpl: reply(200, body) })).kind,
    ).toBe("unexpected");
  });

  it("refuses a malformed reply", async () => {
    const body = clone(stroopDetail);
    (body.trials[0] as Record<string, unknown>).reaction_time_ms = "fast";
    expect(
      (await getSession(CONFIG, ID, { fetchImpl: reply(200, body) })).kind,
    ).toBe("unexpected");
  });
});

// --- Deletion ---------------------------------------------------------------------

describe("deleteSession", () => {
  it("sends one DELETE without a body", async () => {
    const fetchImpl = reply(204);
    expect((await deleteSession(CONFIG, ID, { fetchImpl })).kind).toBe(
      "deleted",
    );
    const { url, init } = sentRequest(fetchImpl);
    expect(url).toBe(`${API}/api/v1/sessions/${ID}`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.credentials).toBe("omit");
  });

  it("reports an unknown session", async () => {
    const outcome = await deleteSession(CONFIG, ID, {
      fetchImpl: reply(404, { error: { code: "not_found" } }),
    });
    expect(outcome.kind).toBe("not_found");
  });

  it("does not treat a 200 as a deletion", async () => {
    expect(
      (await deleteSession(CONFIG, ID, { fetchImpl: reply(200, {}) })).kind,
    ).toBe("unexpected");
  });
});

describe("deleteAllSessions", () => {
  it("sends exactly the confirmation body", async () => {
    const fetchImpl = reply(200, { deleted_sessions: 3, deleted_trials: 216 });
    const outcome = await deleteAllSessions(CONFIG, DELETE_ALL_CONFIRMATION, {
      fetchImpl,
    });
    expect(outcome).toEqual({
      kind: "deleted",
      deletedSessions: 3,
      deletedTrials: 216,
    });
    const { url, init } = sentRequest(fetchImpl);
    expect(url).toBe(`${API}/api/v1/sessions`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBe('{"confirm":"delete-all-local-sessions"}');
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it.each([
    "",
    "delete-all",
    "DELETE-ALL-LOCAL-SESSIONS",
    " delete-all-local-sessions",
  ])("sends nothing without the exact confirmation (%j)", async (phrase) => {
    const fetchImpl = never();
    const outcome = await deleteAllSessions(
      CONFIG,
      phrase as typeof DELETE_ALL_CONFIRMATION,
      { fetchImpl },
    );
    expect(outcome.kind).toBe("rejected");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    { deleted_sessions: 1 },
    { deleted_sessions: -1, deleted_trials: 0 },
    { deleted_sessions: 1, deleted_trials: 72, extra: true },
    { deleted_sessions: "1", deleted_trials: 72 },
  ])("treats an off-contract result as unexpected: %j", async (body) => {
    const outcome = await deleteAllSessions(CONFIG, DELETE_ALL_CONFIRMATION, {
      fetchImpl: reply(200, body),
    });
    expect(outcome.kind).toBe("unexpected");
  });
});
