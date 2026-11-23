import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRoutes } from "../../app/router";
import { analyseStoredSession } from "../../experiments/shared/observatory/storedSession";
import { formatPercent } from "../../experiments/shared/resultsFormat";
import {
  API,
  createFakeBackend,
  fakeSession,
  type FakeSession,
} from "./fakeBackend";

let backend: ReturnType<typeof createFakeBackend>;

type Detail = FakeSession["detail"];

function open(
  sessions: FakeSession[],
  path = "/observatory/trends",
  options: { strict?: boolean; setup?: () => void } = {},
) {
  backend = createFakeBackend(sessions);
  options.setup?.();
  vi.stubGlobal("fetch", backend.fetchImpl);
  const router = createMemoryRouter(createAppRoutes(), {
    initialEntries: [path],
  });
  const app = <RouterProvider router={router} />;
  render(options.strict ? <StrictMode>{app}</StrictMode> : app);
  return router;
}

const stroopSessions = (count: number, start = 1) =>
  Array.from({ length: count }, (_, i) => fakeSession(start + i, "stroop"));

/** Leaves only `keep` correct main trials in one condition (rest timeouts). */
function keepCorrect(condition: string, keep: number) {
  return (d: Detail) => {
    let kept = 0;
    for (const trial of d.trials) {
      if (trial.phase !== "main" || trial.condition !== condition) continue;
      if (trial.outcome !== "correct") continue;
      if (kept < keep) {
        kept += 1;
        continue;
      }
      trial.outcome = "timeout";
      trial.response_key = null;
      (trial as { reaction_time_ms: number | null }).reaction_time_ms = null;
      (
        trial.timing as { response_timestamp_ms: number | null }
      ).response_timestamp_ms = null;
    }
  };
}

const charts = () => screen.queryAllByRole("img");
const detailRequests = () =>
  backend.requests.filter((r) =>
    /\/api\/v1\/sessions\/[0-9a-f-]{36}$/.test(r.url.pathname),
  );
const listRequests = () =>
  backend.requests.filter(
    (r) => r.method === "GET" && r.url.pathname === "/api/v1/sessions",
  );

async function ready(name = /comparable Stroop session/) {
  return screen.findByRole("heading", { level: 2, name });
}

// The Trends page is a lazily loaded route; its first load can take longer
// than Testing Library's 1 s default under a parallel full run.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Trends: thresholds", () => {
  it("explains what is missing with fewer than 3 comparable sessions, and draws nothing", async () => {
    open(stroopSessions(2));
    expect(await ready(/2 comparable Stroop sessions/)).toBeInTheDocument();
    const panel = screen.getByRole("region", {
      name: "Not enough comparable sessions for a chart yet",
    });
    expect(panel).toHaveTextContent(
      "need at least 3 comparable Stroop sessions. You have 2.",
    );
    expect(panel).toHaveTextContent("After 1 more complete Stroop session");
    expect(
      within(panel).getAllByRole("link", { name: "Open results" }),
    ).toHaveLength(2);
    expect(charts()).toHaveLength(0);
  });

  it("shows an empty-data explanation with no sessions at all", async () => {
    open([]);
    expect(await ready(/0 comparable Stroop sessions/)).toBeInTheDocument();
    expect(screen.getByText(/You have 0\./)).toBeInTheDocument();
    expect(charts()).toHaveLength(0);
    expect(detailRequests()).toHaveLength(0);
  });

  it("draws both charts from exactly 3 comparable sessions", async () => {
    open(stroopSessions(3));
    await ready(/3 comparable Stroop sessions/);
    const [rt, accuracy] = charts();
    expect(rt).toHaveAccessibleName(
      /Median correct response time by condition, Stroop, by session/,
    );
    expect(accuracy).toHaveAccessibleName(
      /Response accuracy by condition, Stroop, by session/,
    );
    // The latest session is inspected by default; no range yet.
    expect(screen.getByLabelText("Session to inspect")).toHaveValue("3");
    expect(
      screen.getAllByText(/Not shown: needs at least 5 earlier sessions/)
        .length,
    ).toBeGreaterThan(0);
  });

  it("with exactly 5 sessions the latest has 4 earlier ones: still no range", async () => {
    open(stroopSessions(5));
    await ready(/5 comparable Stroop sessions/);
    expect(screen.getAllByText(/there are 4\)/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/across your 5 earlier sessions/)).toBeNull();
  });

  it("with 6 sessions the latest is placed against its 5 earlier sessions", async () => {
    open(stroopSessions(6));
    await ready(/6 comparable Stroop sessions/);
    expect(
      screen.getAllByText(/across your 5 earlier sessions/).length,
    ).toBeGreaterThan(0);
    // Inspecting session 5 instead: only 4 earlier sessions.
    fireEvent.change(screen.getByLabelText("Session to inspect"), {
      target: { value: "5" },
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "Session 5" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/across your 5 earlier sessions/)).toBeNull();
  });

  it("chart clicks select a session too", async () => {
    open(stroopSessions(4));
    await ready();
    const [rt] = charts();
    const hits = rt.querySelectorAll(".trend-chart__hit");
    expect(hits).toHaveLength(4);
    fireEvent.click(hits[1]);
    expect(screen.getByLabelText("Session to inspect")).toHaveValue("2");
  });
});

describe("Trends: comparability", () => {
  it("never mixes experiments and switches with the URL", async () => {
    const router = open([
      ...stroopSessions(3),
      fakeSession(10, "flanker"),
      fakeSession(11, "flanker"),
    ]);
    await ready(/3 comparable Stroop sessions/);
    expect(
      listRequests().every(
        (r) => r.url.searchParams.get("experiment_id") === "stroop",
      ),
    ).toBe(true);
    expect(detailRequests()).toHaveLength(3);

    fireEvent.click(screen.getByRole("radio", { name: "Flanker" }));
    expect(await ready(/2 comparable Flanker sessions/)).toBeInTheDocument();
    expect(router.state.location.search).toBe("?experiment=flanker");
    expect(listRequests().at(-1)?.url.searchParams.get("experiment_id")).toBe(
      "flanker",
    );
    expect(
      screen.getByText(/Stroop and Flanker are never combined or compared/),
    ).toBeInTheDocument();
  });

  it("leaves out unsupported versions without loading their trials, and says why", async () => {
    const unsupported = fakeSession(9, "stroop", (d) => {
      d.protocol_version = "2.0";
    });
    open([...stroopSessions(3), unsupported]);
    await ready(/3 comparable Stroop sessions/);
    expect(detailRequests().map((r) => r.url.pathname)).not.toContain(
      `/api/v1/sessions/${unsupported.detail.session_id}`,
    );
    const left = screen.getByRole("region", {
      name: "Saved sessions left out",
    });
    expect(left).toHaveTextContent(
      /protocol or configuration version this app does not analyse/,
    );
  });

  it("leaves out incomplete and inconsistent sessions with a reason", async () => {
    open([
      ...stroopSessions(3),
      fakeSession(8, "stroop", (d) => {
        d.status = "incomplete";
      }),
      fakeSession(9, "stroop", (d) => {
        const trial = d.trials.find(
          (t) => t.phase === "main" && t.outcome === "correct",
        );
        if (trial)
          (trial as { reaction_time_ms: number | null }).reaction_time_ms =
            null;
      }),
    ]);
    await ready(/3 comparable Stroop sessions/);
    const left = screen.getByRole("region", {
      name: "Saved sessions left out",
    });
    expect(left).toHaveTextContent("Not a complete session.");
    expect(left).toHaveTextContent(/could not be analysed/);
  });

  it("shows missing medians as not shown, never as values", async () => {
    open([
      fakeSession(1, "stroop", keepCorrect("neutral", 9)),
      ...stroopSessions(2, 2),
    ]);
    await ready();
    const [rt] = charts();
    // Session 3 (index 1 is the newest) has no neutral median: only 2 neutral marks.
    expect(rt.querySelectorAll(".trend-chart__mark--c2")).toHaveLength(2);
    expect(rt.querySelector("desc")?.textContent).toMatch(
      /Neutral: .*session 3 not available/,
    );
    fireEvent.click(screen.getAllByText("Table of every session’s values")[0]);
    // In the table and in the selected-session panel (session 3 is selected).
    expect(screen.getAllByText("not shown: 9 correct, needs 10")).toHaveLength(
      2,
    );
  });

  it("marks long gaps between sessions instead of hiding them", async () => {
    open([
      fakeSession(1, "stroop", (d) => {
        d.created_at = "2026-03-01T16:00:00.000000Z";
      }),
      fakeSession(2, "stroop", (d) => {
        d.created_at = "2026-01-15T09:00:00.000000Z";
      }),
      fakeSession(3, "stroop", (d) => {
        d.created_at = "2026-01-15T16:00:00.000000Z";
      }),
    ]);
    await ready();
    const [rt] = charts();
    const gaps = rt.querySelectorAll("[data-gap-before]");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].getAttribute("data-gap-before")).toBe("3");
    expect(gaps[0]).toHaveTextContent("45 days");
    fireEvent.click(screen.getAllByText("Table of every session’s values")[0]);
    expect(
      screen.getAllByText("Same day as the previous session").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("45 days after the previous session").length,
    ).toBeGreaterThan(0);
  });
});

describe("Trends: states and requests", () => {
  it("shows progress while loading", async () => {
    open(stroopSessions(3));
    expect(
      await screen.findByText(/Loading saved sessions/),
    ).toBeInTheDocument();
    await ready();
  });

  it("explains when local-owner access is off, after one request", async () => {
    open(stroopSessions(3), "/observatory/trends", {
      setup: () => backend.disableAccess(),
    });
    expect(
      await screen.findByText("Viewing saved sessions is switched off"),
    ).toBeInTheDocument();
    expect(backend.requests).toHaveLength(1);
  });

  it("reports a failure and can try again", async () => {
    open(stroopSessions(3), "/observatory/trends", {
      setup: () => {
        backend.failures.list = "network";
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be reached/,
    );
    delete backend.failures.list;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await ready(/3 comparable Stroop sessions/)).toBeInTheDocument();
  });

  it("reports sessions whose details failed to load and keeps them out", async () => {
    open(stroopSessions(4), "/observatory/trends", {
      setup: () => {
        backend.failures.detail = 500;
      },
    });
    expect(await ready(/0 comparable Stroop sessions/)).toBeInTheDocument();
    expect(
      screen.getByText("Some sessions could not be loaded"),
    ).toBeInTheDocument();
  });

  it("asks only the local API, once per resource, even under StrictMode", async () => {
    open(stroopSessions(4), "/observatory/trends", { strict: true });
    await ready(/4 comparable Stroop sessions/);
    expect(backend.requests.every((r) => r.url.origin === API)).toBe(true);
    expect(listRequests()).toHaveLength(1);
    const paths = detailRequests().map((r) => r.url.pathname);
    expect(paths).toHaveLength(4);
    expect(new Set(paths).size).toBe(4);
  });
});

describe("Trends: scientific integrity", () => {
  it("states the caveats before any chart", async () => {
    open(stroopSessions(3));
    await ready();
    const caveats = screen.getByRole("region", { name: "Read this first" });
    expect(caveats).toHaveTextContent(/not a diagnosis/);
    expect(caveats).toHaveTextContent(/Familiarity, practice/);
    expect(caveats).toHaveTextContent(/noisy/);
    expect(caveats).toHaveTextContent(
      /analysis version used when this session was saved was not recorded/,
    );
    expect(caveats).toHaveTextContent(/Save time, not run time/);
    expect(
      caveats.compareDocumentPosition(charts()[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("draws no lines between sessions, trend, band or forecast", async () => {
    open(stroopSessions(6));
    await ready();
    for (const chart of charts()) {
      expect(chart.querySelectorAll("path, polyline")).toHaveLength(0);
    }
  });

  it("makes no inferential, ranking or diagnostic claims", async () => {
    open(stroopSessions(6));
    await ready();
    fireEvent.click(screen.getAllByText("Table of every session’s values")[0]);
    // The page's own disclaimer names what the range is NOT; leave it out.
    const text = (document.body.textContent ?? "").replace(
      "it is not a normal or expected range",
      "",
    );
    for (const forbidden of [
      /improv/i,
      /declin/i,
      /worse/i,
      /better/i,
      /significan/i,
      /p-value|p\s*[<=]/i,
      /confidence interval/i,
      /trend ?line/i,
      /forecast|predict/i,
      /best session|best result|personal best/i,
      /streak/i,
      /\brank/i,
      /faster|slower/i,
      /% (faster|slower|change)|percent change/i,
      /average of|mean of|overall median|overall (score|rt)/i,
      /normal range|expected range|baseline/i,
    ]) {
      expect(text).not.toMatch(forbidden);
    }
  });
});

describe("Observatory views", () => {
  it("offers History and Trends tabs", async () => {
    open(stroopSessions(1), "/observatory");
    const views = await screen.findByRole("navigation", {
      name: "Observatory views",
    });
    expect(within(views).getByRole("link", { name: "Trends" })).toHaveAttribute(
      "href",
      "/observatory/trends",
    );
    fireEvent.click(within(views).getByRole("link", { name: "Trends" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Trends across your sessions",
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(detailRequests()).toHaveLength(1));
  });
});

describe("Trends: accuracy context (correction task)", () => {
  it("shows accuracy with its key presses, timeouts and successful response rate", async () => {
    const reduced = fakeSession(1, "stroop", keepCorrect("neutral", 9));
    open([reduced, ...stroopSessions(2, 2)]);
    await ready();
    // Numbers expected from the approved analysis of the same stored session.
    const analysed = analyseStoredSession(reduced.detail);
    if (!analysed.ok) throw new Error("fixture must analyse");
    const neutral = analysed.results.conditions?.find(
      (c) => c.condition === "neutral",
    );
    if (!neutral || !neutral.rates.responseAccuracy.available)
      throw new Error("fixture");
    const acc = neutral.rates.responseAccuracy;
    const ok = neutral.rates.successfulResponseRate;
    if (!ok.available) throw new Error("fixture");
    const expected = [
      `${formatPercent(acc.value)} (${acc.numerator} of ${acc.denominator} key presses)`,
      `${neutral.counts.timeout} timeouts`,
      `successful responses ${formatPercent(ok.value)} (${ok.numerator} of ${ok.denominator} trials)`,
    ];
    // Many timeouts: accuracy stays high while successful responses drop.
    expect(neutral.counts.timeout).toBeGreaterThan(5);
    expect(ok.value).toBeLessThan(acc.value);

    fireEvent.click(screen.getAllByText("Table of every session’s values")[1]);
    const cells = Array.from(
      document.querySelectorAll(".observatory-value"),
    ).filter((cell) => cell.textContent?.startsWith(expected[0]));
    // One in the accuracy table, one in the selected-session panel (session 3).
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(Array.from(cell.children).map((part) => part.textContent)).toEqual(
        expected,
      );
    }
    expect(
      screen.getByText(/can stay high even when many trials timed out/),
    ).toBeInTheDocument();
  });

  it("selected-session values match the table for every condition", async () => {
    open(stroopSessions(4));
    await ready();
    fireEvent.click(screen.getAllByText("Table of every session’s values")[1]);
    const tables = Array.from(document.querySelectorAll("table"));
    const accuracyTable = tables.find((t) =>
      t.caption?.textContent?.startsWith("Response accuracy by condition"),
    );
    const panelTable = tables.find((t) =>
      t.caption?.textContent?.startsWith("Response accuracy in session 4"),
    );
    const row4 = Array.from(
      accuracyTable?.querySelectorAll("tbody tr") ?? [],
    ).find((row) => row.querySelector("th")?.textContent === "4");
    const tableValues = Array.from(
      row4?.querySelectorAll(".observatory-value") ?? [],
    ).map((v) => v.textContent);
    const panelValues = Array.from(
      panelTable?.querySelectorAll(".observatory-value") ?? [],
    ).map((v) => v.textContent);
    expect(tableValues).toHaveLength(3);
    expect(panelValues).toEqual(tableValues);
  });
});

describe("Trends: analysed window (correction task)", () => {
  it("states the window, the counts left out and what numbering and ranges mean", async () => {
    open(stroopSessions(65));
    expect(
      await ready(/^60 comparable Stroop sessions in the analysed window$/),
    ).toBeInTheDocument();
    const notice = screen.getByText(
      "Trends shows a recent window, not your whole history",
    ).parentElement as HTMLElement;
    expect(notice).toHaveTextContent(
      "Read: the 65 most recently saved Stroop sessions.",
    );
    expect(notice).toHaveTextContent("Analysed: the newest 60 sessions");
    expect(notice).toHaveTextContent(
      "5 older sessions of that version were read but not analysed.",
    );
    expect(notice).toHaveTextContent(
      "Session 1 is the oldest session in this window, which may not be your first session.",
    );
    expect(notice).toHaveTextContent(
      "Earlier-session ranges use only earlier sessions inside this window.",
    );
    expect(notice).not.toHaveTextContent("were not read");
  });

  it("shows no window notice when every session was analysed", async () => {
    open(stroopSessions(6));
    expect(await ready(/^6 comparable Stroop sessions$/)).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Trends shows a recent window, not your whole history",
      ),
    ).toBeNull();
  });

  it("never implies a full history when older summaries were not read", async () => {
    const list = Array.from({ length: 205 }, (_, i) =>
      fakeSession(i + 1, "stroop", (d) => {
        if (i < 200) d.protocol_version = "2.0";
      }),
    );
    open(list);
    expect(
      await ready(/^0 comparable Stroop sessions in the analysed window$/),
    ).toBeInTheDocument();
    const notice = screen.getByText(
      "Trends shows a recent window, not your whole history",
    ).parentElement as HTMLElement;
    expect(notice).toHaveTextContent(
      "Read: the 200 most recently saved Stroop sessions.",
    );
    expect(notice).toHaveTextContent(
      "Older Stroop sessions exist but were not read, so how many is not known.",
    );
    expect(notice).toHaveTextContent(
      "200 of these are stored under a version this app does not analyse.",
    );
    expect(screen.getByText(/The analysed window has 0\./)).toBeInTheDocument();
    expect(screen.queryByText(/You have 0\./)).toBeNull();
    expect(detailRequests()).toHaveLength(0);
  });
});
