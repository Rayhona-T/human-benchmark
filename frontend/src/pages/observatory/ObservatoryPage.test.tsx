import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRoutes } from "../../app/router";
import { TYPED_CONFIRMATION } from "./DeleteAllPanel";
import {
  API,
  createFakeBackend,
  fakeSession,
  type FakeSession,
} from "./fakeBackend";

let backend: ReturnType<typeof createFakeBackend>;

function start(sessions: FakeSession[], path = "/observatory") {
  backend = createFakeBackend(sessions);
  vi.stubGlobal("fetch", backend.fetchImpl);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

const many = (count: number, experiment: "stroop" | "flanker" = "stroop") =>
  Array.from({ length: count }, (_, i) => fakeSession(i + 1, experiment));

/** Data rows of the history table. */
async function rows() {
  const table = await screen.findByRole("table");
  return within(table).getAllByRole("row").slice(1);
}

const listRequests = () =>
  backend.requests.filter(
    (r) => r.method === "GET" && r.url.pathname === "/api/v1/sessions",
  );

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

describe("session history", () => {
  it("shows a loading state, then each session's summary", async () => {
    const session = fakeSession(1, "flanker");
    start([session]);
    expect(
      await screen.findByText("Loading saved sessions"),
    ).toBeInTheDocument();

    const [row] = await rows();
    expect(within(row).getByRole("rowheader")).toHaveTextContent("Flanker");
    expect(row.querySelector("time")).toHaveAttribute(
      "dateTime",
      session.detail.created_at,
    );
    expect(row).toHaveTextContent("Complete");
    expect(row).toHaveTextContent("12 practice · 60 main");
    expect(row).toHaveTextContent("HB-FLANKER-1.0");
    expect(
      within(row).getByRole("link", { name: /Open the Flanker session/ }),
    ).toHaveAttribute(
      "href",
      `/observatory/sessions/${session.detail.session_id}`,
    );
    // "Saved" is explained as the server's save time, not when it was run.
    expect(screen.getByRole("table")).toHaveAccessibleName(
      /when the test server stored the session.*not when it was run/,
    );
  });

  it("never requests trial data to build the list", async () => {
    start(many(3));
    await rows();
    expect(backend.requests).toHaveLength(1);
    expect(backend.requests[0].url.pathname).toBe("/api/v1/sessions");
    expect(backend.requests[0].url.search).toBe("?limit=20");
  });

  it("explains the local-owner model and what deletion does not reach", async () => {
    start([fakeSession(1)]);
    await rows();
    const notice = screen.getByText(/no proof that a session is yours/);
    expect(notice).toHaveTextContent(API);
    expect(
      screen.getByText(/does not remove CSV files you downloaded/),
    ).toHaveTextContent(/not a guaranteed, unrecoverable erasure/);
    expect(
      screen.getByText(/provisional, unapproved notice/),
    ).toBeInTheDocument();
  });

  it("pages through older sessions with the cursor", async () => {
    start(many(25));
    expect(await rows()).toHaveLength(20);
    fireEvent.click(
      screen.getByRole("button", { name: "Show older sessions" }),
    );
    await waitFor(async () => expect(await rows()).toHaveLength(25));
    expect(
      screen.queryByRole("button", { name: "Show older sessions" }),
    ).toBeNull();
    expect(listRequests().map((r) => r.url.searchParams.get("cursor"))).toEqual(
      [null, "o20"],
    );
  });

  it("keeps the shown sessions when older ones fail to load", async () => {
    start(many(25));
    await rows();
    backend.failures.list = 500;
    fireEvent.click(
      screen.getByRole("button", { name: "Show older sessions" }),
    );
    expect(
      await screen.findByText("Older sessions could not be loaded"),
    ).toBeInTheDocument();
    expect(await rows()).toHaveLength(20);
  });

  it("filters by experiment", async () => {
    const router = start([...many(2, "stroop"), fakeSession(10, "flanker")]);
    expect(await rows()).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Experiment"), {
      target: { value: "flanker" },
    });
    await waitFor(async () => expect(await rows()).toHaveLength(1));
    expect(within((await rows())[0]).getByRole("rowheader")).toHaveTextContent(
      "Flanker",
    );
    expect(router.state.location.search).toBe("?experiment=flanker");
    expect(listRequests().at(-1)?.url.searchParams.get("experiment_id")).toBe(
      "flanker",
    );
  });

  it("explains an empty filter result and offers all experiments", async () => {
    start(many(2, "stroop"), "/observatory?experiment=flanker");
    expect(
      await screen.findByText("No saved Flanker sessions"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Show all experiments" }),
    );
    await waitFor(async () => expect(await rows()).toHaveLength(2));
  });

  it("shows an empty state when nothing is saved", async () => {
    start([]);
    expect(
      await screen.findByRole("heading", { name: "No saved sessions" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to the experiments" }),
    ).toHaveAttribute("href", "/experiments");
    expect(
      screen.getByRole("button", { name: "Delete all saved sessions…" }),
    ).toBeDisabled();
  });

  it("flags a session stored under a version this app cannot analyse", async () => {
    start([
      fakeSession(1, "stroop", (d) => {
        d.protocol_version = "2.0";
      }),
    ]);
    const [row] = await rows();
    expect(row).toHaveTextContent("Not analysable in this version");
  });

  it("explains when local-owner access is switched off, and asks nothing else", async () => {
    backend = createFakeBackend([fakeSession(1)]);
    backend.disableAccess();
    vi.stubGlobal("fetch", backend.fetchImpl);
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ["/observatory"],
    });
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByText("Viewing saved sessions is switched off"),
    ).toBeInTheDocument();
    expect(screen.getByText(/HB_LOCAL_OWNER_ACCESS=true/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete all/ })).toBeNull();
    expect(backend.requests).toHaveLength(1);
  });

  it.each([
    [500, "The test server reported an error."],
    [
      "network" as const,
      "The test server could not be reached. Check that it is running.",
    ],
  ])("shows an error (%s) and can try again", async (mode, message) => {
    backend = createFakeBackend([fakeSession(1)]);
    backend.failures.list = mode;
    vi.stubGlobal("fetch", backend.fetchImpl);
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ["/observatory"],
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    delete backend.failures.list;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await rows()).toHaveLength(1);
  });
});

describe("deleting one session", () => {
  async function openDelete(index = 0) {
    const row = (await rows())[index];
    fireEvent.click(within(row).getByRole("button", { name: /^Delete the/ }));
    return screen.getByRole("dialog");
  }

  const deletes = () => backend.requests.filter((r) => r.method === "DELETE");

  it("identifies the session, starts on Cancel, and cancelling sends nothing", async () => {
    const session = fakeSession(7, "flanker");
    start([session]);
    const dialog = await openDelete();
    expect(dialog).toHaveAccessibleName("Delete this Flanker session?");
    expect(dialog).toHaveTextContent(session.detail.session_id.slice(0, 8));
    expect(dialog.querySelector("time")).toHaveAttribute(
      "dateTime",
      session.detail.created_at,
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deletes()).toHaveLength(0);
    expect(await rows()).toHaveLength(1);
  });

  it("Escape cancels", async () => {
    start([fakeSession(1)]);
    await openDelete();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deletes()).toHaveLength(0);
  });

  it("deletes on confirmation, updates at once and re-checks with the server", async () => {
    const sessions = many(3);
    start(sessions);
    await openDelete(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete this session" }),
    );

    expect(await screen.findByText("Session deleted")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deletes().map((r) => r.url.pathname)).toEqual([
      `/api/v1/sessions/${sessions[1].detail.session_id}`,
    ]);
    expect(deletes()[0].body).toBeUndefined();
    await waitFor(async () => expect(await rows()).toHaveLength(2));
    // Reconciled with the server after the deletion.
    await waitFor(() => expect(listRequests()).toHaveLength(2));
    expect(backend.store.has(sessions[1].detail.session_id)).toBe(false);
  });

  it("does not claim a deletion the server refused", async () => {
    start([fakeSession(1)]);
    backend.failures.deleteOne = 403;
    const dialog = await openDelete();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete this session" }),
    );
    expect(await within(dialog).findByText("Not deleted")).toBeInTheDocument();
    expect(dialog).toHaveTextContent(
      "Deleting is switched off on the test server. Nothing was deleted.",
    );
    expect(screen.queryByText("Session deleted")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(await rows()).toHaveLength(1);
  });

  it("says the outcome is unknown when the server's answer is lost, then re-checks", async () => {
    start([fakeSession(1)]);
    backend.failures.deleteOne = 500;
    const dialog = await openDelete();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete this session" }),
    );
    expect(
      await within(dialog).findByText("Deletion not confirmed"),
    ).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/not known whether anything was deleted/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(
      await screen.findByText("The list was checked again"),
    ).toBeInTheDocument();
    await waitFor(() => expect(listRequests()).toHaveLength(2));
  });

  it("handles a session that was already gone", async () => {
    const session = fakeSession(1);
    start([session, fakeSession(2)]);
    await rows();
    backend.store.delete(session.detail.session_id);
    await openDelete(0);
    fireEvent.click(
      screen.getByRole("button", { name: "Delete this session" }),
    );
    expect(
      await screen.findByText("That session was no longer stored"),
    ).toBeInTheDocument();
    await waitFor(async () => expect(await rows()).toHaveLength(1));
  });
});

describe("deleting all sessions", () => {
  const openDeleteAll = async () => {
    await rows();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete all saved sessions…" }),
    );
    return screen.getByRole("dialog", { name: "Delete all saved sessions?" });
  };

  it("is separate from single deletion and explains its scope", async () => {
    start(many(2), "/observatory?experiment=stroop");
    await rows();
    const panel = screen.getByRole("region", {
      name: "Delete all saved sessions",
    });
    expect(panel).toHaveTextContent(
      /every.*session in the local test server’s database/i,
    );
    expect(panel).toHaveTextContent(
      /including any not shown by the current filter/,
    );
  });

  it("needs the typed phrase before anything can be sent", async () => {
    start(many(2));
    const dialog = await openDeleteAll();
    const confirm = within(dialog).getByRole("button", {
      name: "Delete all sessions",
    });
    const input = within(dialog).getByLabelText(/To confirm, type/);
    expect(confirm).toBeDisabled();
    for (const attempt of [
      "delete",
      "Delete All Sessions",
      "delete-all-local-sessions",
    ]) {
      fireEvent.change(input, { target: { value: attempt } });
      expect(confirm).toBeDisabled();
    }
    fireEvent.click(confirm);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(backend.requests.filter((r) => r.method === "DELETE")).toHaveLength(
      0,
    );
    expect(await rows()).toHaveLength(2);
  });

  it("sends exactly the backend's confirmation and clears the list", async () => {
    start(many(3));
    const dialog = await openDeleteAll();
    fireEvent.change(within(dialog).getByLabelText(/To confirm, type/), {
      target: { value: TYPED_CONFIRMATION },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete all sessions" }),
    );

    expect(
      await screen.findByText("All saved sessions deleted"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3 sessions \(216 trials\) were deleted/),
    ).toBeInTheDocument();
    const [request] = backend.requests.filter((r) => r.method === "DELETE");
    expect(request.url.pathname).toBe("/api/v1/sessions");
    expect(request.url.search).toBe("");
    expect(request.body).toBe('{"confirm":"delete-all-local-sessions"}');
    expect(
      await screen.findByRole("heading", { name: "No saved sessions" }),
    ).toBeInTheDocument();
    expect(backend.store.size).toBe(0);
  });

  it("reports when there was nothing to delete", async () => {
    start([fakeSession(1)]);
    const dialog = await openDeleteAll();
    backend.store.clear(); // emptied elsewhere in the meantime
    fireEvent.change(within(dialog).getByLabelText(/To confirm, type/), {
      target: { value: TYPED_CONFIRMATION },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete all sessions" }),
    );
    expect(
      await screen.findByText("There was nothing to delete"),
    ).toBeInTheDocument();
  });

  it("does not claim deletion when it failed", async () => {
    start(many(2));
    backend.failures.deleteAll = 422;
    const dialog = await openDeleteAll();
    fireEvent.change(within(dialog).getByLabelText(/To confirm, type/), {
      target: { value: TYPED_CONFIRMATION },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete all sessions" }),
    );
    expect(await within(dialog).findByText("Not deleted")).toBeInTheDocument();
    expect(screen.queryByText("All saved sessions deleted")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(await rows()).toHaveLength(2);
    expect(backend.store.size).toBe(2);
  });
});
