import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeSave,
  ConsentNotAuthorizedError,
  type SaveAuthorization,
} from "./consent";
import { CONSENT_NOTICE } from "./saveConfig";
import { canRetry, saveSession, type SaveOutcome } from "./saveSessionClient";
import type { SessionSavePayload } from "./sessionPayload";

const API = "http://127.0.0.1:8000";
const payload = {
  consent: { confirmed: true, notice_version: CONSENT_NOTICE.version },
  experiment_id: "flanker",
  status: "complete",
  trials: [],
} as unknown as SessionSavePayload;

/** A real authorization, issued from a ticked checkbox on the page. */
function grant(noticeVersion: string = CONSENT_NOTICE.version) {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked = true;
  document.body.append(box);
  const authorization = authorizeSave({
    agreed: true,
    checkbox: box,
    noticeVersion,
  });
  box.remove();
  if (authorization === null) throw new Error("test setup: not authorized");
  return authorization;
}

const json = (status: number, body: unknown) =>
  vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );

const SAVED = {
  session_id: "0a86e32e-fe7e-4026-b44f-8087457442b1",
  experiment_id: "flanker",
  status: "complete",
  created_at: "2026-11-22T14:52:47.667816Z",
  trials_stored: { practice: 12, main: 60 },
};

async function outcomeFor(fetchImpl: typeof fetch): Promise<SaveOutcome> {
  return saveSession(API, payload, grant(), { fetchImpl });
}

describe("save session client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts JSON once, with no credentials, no referrer and no caching", async () => {
    const fetchImpl = json(201, SAVED);
    await outcomeFor(fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${API}/api/v1/sessions`);
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(String(init.body))).toEqual(payload);
  });

  it("reports a confirmed save only for a 201 that matches the contract", async () => {
    expect(
      await outcomeFor(json(201, SAVED) as unknown as typeof fetch),
    ).toEqual({
      kind: "saved",
      sessionId: SAVED.session_id,
      createdAt: SAVED.created_at,
      trialsStored: { practice: 12, main: 60 },
    });
    for (const broken of [
      {},
      { ...SAVED, experiment_id: "stroop" },
      { ...SAVED, status: "incomplete" },
      { ...SAVED, trials_stored: { practice: -1, main: 60 } },
      { ...SAVED, trials_stored: { practice: "12", main: 60 } },
      { ...SAVED, session_id: 5 },
      [SAVED],
    ]) {
      expect(
        await outcomeFor(json(201, broken) as unknown as typeof fetch),
      ).toEqual({
        kind: "unexpected",
      });
    }
  });

  it("treats a 201 whose body is not JSON as unconfirmed", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>", { status: 201 }),
    );
    expect(await outcomeFor(fetchImpl as unknown as typeof fetch)).toEqual({
      kind: "unexpected",
    });
  });

  it.each<[number, unknown, SaveOutcome]>([
    [409, { error: { code: "duplicate_session" } }, { kind: "already_saved" }],
    [409, { error: { code: "something_else" } }, { kind: "unexpected" }],
    [
      422,
      {
        error: {
          code: "invalid_session",
          details: [{ location: "consent.notice_version", message: "x" }],
        },
      },
      { kind: "rejected", reason: "notice_not_recognized" },
    ],
    [
      422,
      {
        error: {
          code: "invalid_session",
          details: [{ location: "status", message: "x" }],
        },
      },
      { kind: "rejected", reason: "invalid_session" },
    ],
    [
      422,
      { error: { code: "invalid_request" } },
      { kind: "rejected", reason: "invalid_session" },
    ],
    [
      413,
      { error: { code: "payload_too_large" } },
      { kind: "rejected", reason: "too_large" },
    ],
    [500, { error: { code: "internal_error" } }, { kind: "server_error" }],
    [503, "not json at all", { kind: "server_error" }],
    [404, { error: { code: "not_found" } }, { kind: "unexpected" }],
    [200, SAVED, { kind: "unexpected" }],
  ])("maps HTTP %i to a safe outcome", async (status, body, expected) => {
    expect(
      await outcomeFor(json(status, body) as unknown as typeof fetch),
    ).toEqual(expected);
  });

  it("reports an unreachable server", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await outcomeFor(fetchImpl as unknown as typeof fetch)).toEqual({
      kind: "unavailable",
    });
  });

  it("gives up after the timeout and aborts the request", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          signal = init.signal ?? undefined;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = saveSession(API, payload, grant(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 10_000,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await pending).toEqual({ kind: "timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("reports cancellation separately from a timeout", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const pending = saveSession(API, payload, grant(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: controller.signal,
    });
    controller.abort();
    expect(await pending).toEqual({ kind: "cancelled" });
  });

  describe("consent boundary: nothing is sent without a valid, unused authorization", () => {
    it("refuses a missing or forged authorization before any request", async () => {
      const fetchImpl = json(201, SAVED);
      const forged = Object.freeze({
        noticeVersion: CONSENT_NOTICE.version,
      }) as SaveAuthorization;
      for (const authorization of [
        undefined,
        null,
        forged,
      ] as unknown as SaveAuthorization[]) {
        await expect(
          saveSession(API, payload, authorization, {
            fetchImpl: fetchImpl as unknown as typeof fetch,
          }),
        ).rejects.toBeInstanceOf(ConsentNotAuthorizedError);
      }
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("an authorization covers exactly one request", async () => {
      const fetchImpl = json(201, SAVED);
      const authorization = grant();
      const options = { fetchImpl: fetchImpl as unknown as typeof fetch };
      await saveSession(API, payload, authorization, options);
      await expect(
        saveSession(API, payload, authorization, options),
      ).rejects.toBeInstanceOf(ConsentNotAuthorizedError);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("refuses an authorization for a different notice, or a payload not claiming consent", async () => {
      const fetchImpl = json(201, SAVED);
      const options = { fetchImpl: fetchImpl as unknown as typeof fetch };
      await expect(
        saveSession(API, payload, grant("HB-NOTICE-OTHER"), options),
      ).rejects.toBeInstanceOf(ConsentNotAuthorizedError);
      const unconfirmed = {
        ...payload,
        consent: { confirmed: false, notice_version: CONSENT_NOTICE.version },
      } as unknown as SessionSavePayload;
      await expect(
        saveSession(API, unconfirmed, grant(), options),
      ).rejects.toBeInstanceOf(ConsentNotAuthorizedError);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("no authorization is issued unless the state and the checkbox on the page are both ticked", () => {
      const box = document.createElement("input");
      box.type = "checkbox";
      const noticeVersion = CONSENT_NOTICE.version;
      // Not on the page.
      box.checked = true;
      expect(
        authorizeSave({ agreed: true, checkbox: box, noticeVersion }),
      ).toBeNull();
      document.body.append(box);
      // On the page but unticked, although the state says agreed.
      box.checked = false;
      expect(
        authorizeSave({ agreed: true, checkbox: box, noticeVersion }),
      ).toBeNull();
      // Ticked, but the state does not say agreed.
      box.checked = true;
      expect(
        authorizeSave({ agreed: false, checkbox: box, noticeVersion }),
      ).toBeNull();
      expect(
        authorizeSave({ agreed: true, checkbox: null, noticeVersion }),
      ).toBeNull();
      expect(
        authorizeSave({ agreed: true, checkbox: box, noticeVersion }),
      ).not.toBeNull();
      box.remove();
    });
  });

  it("allows retry only where repeating the same request is safe and useful", () => {
    expect(canRetry({ kind: "unavailable" })).toBe(true);
    expect(canRetry({ kind: "timeout" })).toBe(true);
    expect(canRetry({ kind: "server_error" })).toBe(true);
    expect(canRetry({ kind: "unexpected" })).toBe(true);
    expect(canRetry({ kind: "already_saved" })).toBe(false);
    expect(canRetry({ kind: "rejected", reason: "invalid_session" })).toBe(
      false,
    );
    expect(
      canRetry({ kind: "rejected", reason: "notice_not_recognized" }),
    ).toBe(false);
  });
});
