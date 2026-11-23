import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlankerStimulus } from "../../flanker/flanker";
import { flankerStimulusToApi } from "../../flanker/flankerResultsCopy";
import { FLANKER_SESSION_DEFINITION } from "../../flanker/useFlankerSession";
import { SaveSessionPanel } from "./SaveSessionPanel";
import type { ResultsSave } from "./sessionPayload";
import { buildTestRecords } from "./testSessions";

const CONFIG = { apiBase: "http://127.0.0.1:8000" };
const SAVED = {
  session_id: "0a86e32e-fe7e-4026-b44f-8087457442b1",
  experiment_id: "flanker",
  status: "complete",
  created_at: "2026-11-22T14:52:47.667816Z",
  trials_stored: { practice: 12, main: 60 },
};

const save: ResultsSave<FlankerStimulus> = {
  experimentId: "flanker",
  status: "complete",
  records: buildTestRecords(FLANKER_SESSION_DEFINITION, 4242),
  breakTaken: false,
  breakDurationMs: 0,
  stimulusToApi: flankerStimulusToApi,
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function renderPanel(fetchImpl: ReturnType<typeof vi.fn>, data = save) {
  return render(
    <SaveSessionPanel
      save={data}
      config={CONFIG}
      fetchImpl={fetchImpl as unknown as typeof fetch}
    />,
  );
}

const agree = () =>
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I have read this provisional notice/,
    }),
  );
const clickSave = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save this session" }));
const clientIdOf = (call: unknown[]) =>
  (
    JSON.parse(String((call[1] as RequestInit).body)) as {
      client_session_id: string;
    }
  ).client_session_id;

describe("SaveSessionPanel", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "5d1c9a3e-7b2f-4c6d-8e1a-3f5b7d9c1e24",
    );
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("states honestly that the notice is provisional and not approved", () => {
    renderPanel(vi.fn());
    expect(
      screen.getByText("Development test · provisional notice"),
    ).toBeInTheDocument();
    expect(screen.getByText("HB-NOTICE-0.1-PROVISIONAL")).toBeInTheDocument();
    expect(
      screen.getByText(
        /It has not been approved, and there is no ethics or research approval/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Viewing or deleting a saved session is not available from this page yet/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:8000")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /\bapproved notice\b|ethics approval (was|has been) granted|research-ready/i,
    );
  });

  it("does not assume consent: the box starts unticked and saving without it sends nothing", () => {
    const fetchImpl = vi.fn();
    renderPanel(fetchImpl);
    const box = screen.getByRole("checkbox", {
      name: /I have read this provisional notice/,
    });
    expect(box).not.toBeChecked();
    clickSave();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nothing has been sent",
    );
    expect(box).toHaveFocus();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("declining sends nothing, and agreement is not remembered when reviewing again", () => {
    const fetchImpl = vi.fn();
    renderPanel(fetchImpl);
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Don't save" }));
    expect(
      screen.getByText("Nothing from this session was sent."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save this session" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Review saving again" }),
    );
    expect(
      screen.getByRole("checkbox", { name: /I have read/ }),
    ).not.toBeChecked();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("confirms only what the server confirmed, then offers no further save", async () => {
    const fetchImpl = vi.fn(async () => reply(201, SAVED));
    renderPanel(fetchImpl);
    agree();
    clickSave();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(await screen.findByText("Session saved")).toBeInTheDocument();
    expect(
      screen.getByText(/72\s+trials \(12 practice, 60 main\)/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Save this session|Try saving again/,
      }),
    ).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("repeated clicks while saving send a single request", async () => {
    let finish: (value: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => (finish = resolve)),
    );
    renderPanel(fetchImpl);
    agree();
    const button = screen.getByRole("button", { name: "Save this session" });
    // Clicks delivered inside one React batch: the button is still mounted
    // for every click, so only the in-flight guard can stop a second send.
    act(() => {
      button.click();
      button.click();
      button.click();
    });
    finish(reply(201, SAVED));
    expect(await screen.findByText("Session saved")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("after a failure, retry reuses the same save ID, so a duplicate becomes 'already saved'", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(reply(500, { error: { code: "internal_error" } }))
      .mockResolvedValueOnce(
        reply(409, { error: { code: "duplicate_session" } }),
      );
    // A different value on every call, so a regenerated ID would be detected.
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("5d1c9a3e-7b2f-4c6d-8e1a-3f5b7d9c1e24")
      .mockReturnValueOnce("6e2d0b4f-8c3a-4d7e-9f2b-4a6c8e0d2f35")
      .mockReturnValueOnce("7f3e1c5a-9d4b-4e8f-a03c-5b7d9f1e3a46");
    renderPanel(fetchImpl);
    agree();
    clickSave();
    expect(
      await screen.findByText("Could not reach the test server"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing was\s+lost/)).toBeInTheDocument();
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(
      await screen.findByText("The test server had a problem"),
    ).toBeInTheDocument();
    agree();
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(await screen.findByText("Already saved")).toBeInTheDocument();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const ids = fetchImpl.mock.calls.map(clientIdOf);
    expect(new Set(ids).size).toBe(1);
    expect(
      screen.queryByRole("button", { name: "Try saving again" }),
    ).toBeNull();
  });

  it.each([
    [
      reply(422, {
        error: {
          code: "invalid_session",
          details: [
            {
              location: "consent.notice_version",
              message: "is not a recognized consent notice version",
            },
          ],
        },
      }),
      /does not recognize this page's consent notice version/,
    ],
    [
      reply(422, {
        error: {
          code: "invalid_session",
          details: [
            {
              location: "status",
              message: "only complete sessions can be saved",
            },
          ],
        },
      }),
      /found a problem with this session's data/,
    ],
    [
      reply(413, { error: { code: "payload_too_large" } }),
      /larger than the test server accepts/,
    ],
  ])(
    "a rejection is explained without server text and offers no pointless retry",
    async (response, message) => {
      renderPanel(vi.fn(async () => response));
      agree();
      clickSave();
      expect(await screen.findByText("Not saved")).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(
        /invalid_session|consent\.notice_version|payload_too_large/,
      );
      expect(
        screen.queryByRole("button", { name: "Try saving again" }),
      ).toBeNull();
    },
  );

  it("a malformed success reply is not reported as saved", async () => {
    renderPanel(vi.fn(async () => reply(201, { ok: true })));
    agree();
    clickSave();
    expect(await screen.findByText("Save not confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Session saved")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Try saving again" }),
    ).toBeInTheDocument();
  });

  it("moves focus to the result so it is announced", async () => {
    renderPanel(vi.fn(async () => reply(201, SAVED)));
    agree();
    clickSave();
    await screen.findByText("Session saved");
    await waitFor(() =>
      expect(document.activeElement).toHaveClass("save-session__status"),
    );
  });

  it("aborts the request if the panel goes away, without updating it", async () => {
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
    const { unmount } = renderPanel(fetchImpl);
    agree();
    clickSave();
    unmount();
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it("without a secure random source, nothing is sent", () => {
    const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    const fetchImpl = vi.fn();
    try {
      renderPanel(fetchImpl);
      agree();
      clickSave();
      expect(
        screen.getByText("Saving is not available in this browser"),
      ).toBeInTheDocument();
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (original) Object.defineProperty(crypto, "randomUUID", original);
      else delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });

  describe("consent regression (Cycle 8 consent incident)", () => {
    const checkbox = () =>
      screen.getByRole<HTMLInputElement>("checkbox", {
        name: /I have read this provisional notice/,
      });

    it("the checkbox on the page decides: if it is unticked when Save is pressed, nothing is sent, even if the agreement state says ticked", () => {
      const fetchImpl = vi.fn(async () => reply(201, SAVED));
      renderPanel(fetchImpl);
      agree();
      // Reproduce the reported symptom: the box on screen is unticked while
      // the panel's agreement state still says "agreed" (no change event).
      checkbox().checked = false;
      clickSave();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nothing has been sent",
      );
      expect(checkbox()).not.toBeChecked();
      expect(screen.queryByText("Session saved")).toBeNull();
    });

    it("ticking and then unticking prevents saving, however often Save is pressed", () => {
      const fetchImpl = vi.fn();
      renderPanel(fetchImpl);
      agree();
      agree();
      expect(checkbox()).not.toBeChecked();
      act(() => {
        const button = screen.getByRole("button", {
          name: "Save this session",
        });
        button.click();
        button.click();
        button.click();
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("keyboard activation of Save cannot bypass consent; ticking by keyboard then saving sends one request", async () => {
      const user = userEvent.setup();
      const fetchImpl = vi.fn(async () => reply(201, SAVED));
      renderPanel(fetchImpl);
      screen.getByRole("button", { name: "Save this session" }).focus();
      await user.keyboard("{Enter}");
      // Focus has moved to the checkbox; return to Save and use Space.
      screen.getByRole("button", { name: "Save this session" }).focus();
      await user.keyboard(" ");
      expect(fetchImpl).not.toHaveBeenCalled();
      checkbox().focus();
      await user.keyboard(" ");
      expect(checkbox()).toBeChecked();
      screen.getByRole("button", { name: "Save this session" }).focus();
      await user.keyboard("{Enter}");
      expect(await screen.findByText("Session saved")).toBeInTheDocument();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("explicit consent sends exactly one request that records the notice agreed to", async () => {
      const fetchImpl = vi.fn(async () => reply(201, SAVED));
      renderPanel(fetchImpl);
      agree();
      clickSave();
      expect(await screen.findByText("Session saved")).toBeInTheDocument();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const init = (fetchImpl.mock.calls[0] as unknown[])[1] as RequestInit;
      const body = JSON.parse(String(init.body)) as { consent: unknown };
      expect(body.consent).toEqual({
        confirmed: true,
        notice_version: "HB-NOTICE-0.1-PROVISIONAL",
      });
    });

    it("agreement covers one attempt: after a failure, retrying without ticking again sends nothing", async () => {
      const fetchImpl = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(reply(201, SAVED));
      renderPanel(fetchImpl);
      agree();
      clickSave();
      expect(
        await screen.findByText("Could not reach the test server"),
      ).toBeInTheDocument();
      expect(checkbox()).not.toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Nothing has been sent/)).toBeInTheDocument();
      expect(
        screen.getByText("Could not reach the test server"),
      ).toBeInTheDocument();
      agree();
      fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
      expect(await screen.findByText("Session saved")).toBeInTheDocument();
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("declining, then reviewing again, still needs a fresh tick", () => {
      const fetchImpl = vi.fn();
      renderPanel(fetchImpl);
      agree();
      fireEvent.click(screen.getByRole("button", { name: "Don't save" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Review saving again" }),
      );
      clickSave();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nothing has been sent",
      );
    });

    it("agreement is not remembered between sessions or page visits, and nothing is written to browser storage", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      const fetchImpl = vi.fn();
      const first = renderPanel(fetchImpl);
      agree();
      expect(checkbox()).toBeChecked();
      first.unmount();
      renderPanel(fetchImpl);
      expect(checkbox()).not.toBeChecked();
      clickSave();
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(document.cookie).toBe("");
    });
  });

  it("for a session that is not complete, offers no consent or save at all", () => {
    const fetchImpl = vi.fn();
    renderPanel(fetchImpl, { ...save, status: "incomplete" });
    expect(
      screen.getByText(/Only complete sessions can be saved/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
