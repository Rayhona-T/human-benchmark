import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRoutes } from "../../app/router";
import { analyseStoredSession } from "../../experiments/shared/observatory/storedSession";
import {
  API,
  createFakeBackend,
  fakeSession,
  type FakeSession,
} from "./fakeBackend";

let backend: ReturnType<typeof createFakeBackend>;

function open(sessions: FakeSession[], id: string, setup?: () => void) {
  backend = createFakeBackend(sessions);
  setup?.();
  vi.stubGlobal("fetch", backend.fetchImpl);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [`/observatory/sessions/${id}`],
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** The value shown next to a label in a description list. */
function shownValue(label: string, scope: HTMLElement = document.body) {
  const term = within(scope)
    .getAllByText(label, { selector: "dt" })
    .at(0) as HTMLElement;
  return term.nextElementSibling?.textContent ?? "";
}

beforeEach(() => {
  vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
});

// The Observatory pages are lazily loaded routes; under a parallel full run
// their first load can take longer than Testing Library's 1 s default.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("session detail", () => {
  it("shows the session's identity, versions and the approved results", async () => {
    const session = fakeSession(3, "stroop");
    const id = session.detail.session_id;
    open([session], id);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Stroop session" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not when it was run/)).toBeInTheDocument();
    const meta = screen.getByRole("region", { name: "Session details" });
    expect(shownValue("Protocol", meta)).toBe("HB-STROOP-1.0, version 1.0");
    expect(shownValue("Configuration", meta)).toBe(
      "HB-STROOP-1.0, version 1.0",
    );
    expect(shownValue("Trials stored", meta)).toBe("12 practice · 60 main");
    expect(shownValue("Consent notice", meta)).toBe(
      "HB-NOTICE-0.1-PROVISIONAL",
    );
    expect(shownValue("Session ID", meta)).toBe(id);
    expect(meta.querySelector("time")).toHaveAttribute(
      "dateTime",
      session.detail.created_at,
    );

    // The numbers shown are exactly the approved analysis of the stored trials.
    const expected = analyseStoredSession(session.detail);
    expect(expected.ok).toBe(true);
    if (!expected.ok) return;
    const overview = screen.getByRole("region", { name: "Session overview" });
    expect(shownValue("Correct", overview)).toBe(
      String(expected.results.main.correct),
    );
    expect(shownValue("Incorrect", overview)).toBe(
      String(expected.results.main.incorrect),
    );
    expect(shownValue("Main trials presented", overview)).toBe("60 of 60");
    for (const heading of [
      "Response times",
      "Results by condition",
      "Condition comparisons",
      "How to read these results",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeInTheDocument();
    }

    // Only the one detail request was made.
    expect(
      backend.requests.map((r) => `${r.method} ${r.url.pathname}`),
    ).toEqual([`GET /api/v1/sessions/${id}`]);
  });

  it("states the limitations before the results", async () => {
    const session = fakeSession(1, "flanker");
    open([session], session.detail.session_id);
    const limits = await screen.findByRole("region", {
      name: "Before you read these results",
    });
    expect(limits).toHaveTextContent(/not a diagnosis/);
    expect(limits).toHaveTextContent(
      /analysis version used when this session was saved was not recorded.*calculated now.*HB-ANALYSIS-1\.1/,
    );
    expect(limits).toHaveTextContent(/Sessions are not compared here/);
    expect(limits).toHaveTextContent(/screen size used were not stored/);
    expect(limits).toHaveTextContent(/arrows’ on-screen size and spacing/);
  });

  it("offers no export or saving for a stored session", async () => {
    const session = fakeSession(1);
    open([session], session.detail.session_id);
    await screen.findByRole("heading", { level: 1, name: "Stroop session" });
    expect(screen.queryByRole("button", { name: /Download|CSV/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Your data/ })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /Save this session/ }),
    ).toBeNull();
  });

  it.each<[string, (d: FakeSession["detail"]) => void, RegExp]>([
    [
      "an unsupported version",
      (d) => {
        d.protocol_version = "1.1";
      },
      /recorded with a version of the experiment/,
    ],
    [
      "inconsistent trial data",
      (d) => {
        const trial = d.trials.find(
          (t) => t.phase === "main" && t.outcome === "correct",
        );
        if (trial)
          (trial as { reaction_time_ms: number | null }).reaction_time_ms =
            null;
      },
      /incomplete or inconsistent/,
    ],
  ])(
    "refuses to calculate results for %s, but shows what was stored",
    async (_l, change, message) => {
      const session = fakeSession(1, "stroop", change);
      open([session], session.detail.session_id);
      expect(
        await screen.findByText("Results cannot be shown for this session"),
      ).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(
        screen.getByText("The stored data was not changed."),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Session overview" }),
      ).toBeNull();
      expect(
        screen.getByRole("region", { name: "Session details" }),
      ).toBeInTheDocument();
    },
  );

  it("explains a session that is not stored", async () => {
    open([], "00000000-0000-4000-8000-000000000099");
    expect(
      await screen.findByText("This session is not stored"),
    ).toBeInTheDocument();
  });

  it("tells access switched off apart from a missing session", async () => {
    // With access off the backend has no per-session route (404); one summary
    // request (405) shows that access is off, not that the session is gone.
    const session = fakeSession(1);
    open([session], session.detail.session_id, () => backend.disableAccess());
    expect(
      await screen.findByText("Viewing saved sessions is switched off"),
    ).toBeInTheDocument();
    expect(screen.queryByText("This session is not stored")).toBeNull();
    expect(
      backend.requests.map(
        (r) => `${r.method} ${r.url.pathname}${r.url.search}`,
      ),
    ).toEqual([
      `GET /api/v1/sessions/${session.detail.session_id}`,
      "GET /api/v1/sessions?limit=1",
    ]);
  });

  it("refuses a malformed link without asking the server", async () => {
    open([fakeSession(1)], "not-a-session");
    expect(
      await screen.findByText("This is not a link to a saved session"),
    ).toBeInTheDocument();
    expect(backend.requests).toHaveLength(0);
  });

  it("explains when local-owner access is switched off", async () => {
    const session = fakeSession(1);
    open([session], session.detail.session_id, () => {
      backend.failures.detail = 403;
    });
    expect(
      await screen.findByText("Viewing saved sessions is switched off"),
    ).toBeInTheDocument();
  });

  it("can try again after an error", async () => {
    const session = fakeSession(1);
    open([session], session.detail.session_id, () => {
      backend.failures.detail = "network";
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be reached/,
    );
    delete backend.failures.detail;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Stroop session" }),
    ).toBeInTheDocument();
  });

  it("deletes the session after confirmation and returns to the history", async () => {
    const session = fakeSession(1);
    const router = open([session, fakeSession(2)], session.detail.session_id);
    await screen.findByRole("heading", { level: 1, name: "Stroop session" });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete this session…" }),
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(session.detail.session_id.slice(0, 8));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete this session" }),
    );

    // The history route is loaded lazily; its first load can take a moment.
    expect(
      await screen.findByText("Session deleted", undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/observatory");
    expect(backend.store.has(session.detail.session_id)).toBe(false);
    expect(
      backend.requests
        .filter((r) => r.method === "DELETE")
        .map((r) => r.url.pathname),
    ).toEqual([`/api/v1/sessions/${session.detail.session_id}`]);
  });

  it("stays on the session when deletion is not confirmed", async () => {
    const session = fakeSession(1);
    const router = open([session], session.detail.session_id, () => {
      backend.failures.deleteOne = 403;
    });
    await screen.findByRole("heading", { level: 1, name: "Stroop session" });
    fireEvent.click(
      screen.getByRole("button", { name: "Delete this session…" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete this session" }),
    );
    expect(await screen.findByText("Not deleted")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(
      `/observatory/sessions/${session.detail.session_id}`,
    );
    expect(backend.store.has(session.detail.session_id)).toBe(true);
  });
});
