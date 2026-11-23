/**
 * Page-level save tests on REAL engine records: a full Stroop and a full
 * Flanker session are run through the actual pages (fake timers, fixed seed),
 * then saved through the optional development panel with a mocked network.
 * The captured request bodies are compared with committed fixtures, which a
 * backend test (backend/tests/test_frontend_contract.py) posts to the real
 * validation.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlankerExperimentPage } from "../../flanker/FlankerExperimentPage";
import { createFlankerSchedule } from "../../flanker/flankerSchedule";
import { StroopExperimentPage } from "../../stroop/StroopExperimentPage";
import { createStroopSchedule } from "../../stroop/stroopSchedule";

const SEED = 1234;
const API = "http://127.0.0.1:8000";
const FIXED_SAVE_ID = "5d1c9a3e-7b2f-4c6d-8e1a-3f5b7d9c1e24";

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const nextFrame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });
const key = (value: string) =>
  act(() => {
    fireEvent.keyDown(window, { key: value });
  });

/** Lets pending promises (the mocked request and its JSON) settle. Timers
 * are faked here, so Testing Library's polling helpers cannot be used. */
async function flushPromises() {
  for (let round = 0; round < 10; round++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

type Plan = "correct" | "wrong" | "none";
const planFor = (index: number): Plan =>
  index % 7 === 0 ? "none" : index % 5 === 0 ? "wrong" : "correct";

interface ExperimentCase {
  name: "Stroop" | "Flanker";
  page: () => ReactElement;
  keys: readonly string[];
  schedule: () => {
    practice: readonly { correctResponse: string }[];
    main: readonly { correctResponse: string }[];
  };
  begin: () => void;
}

const CASES: ExperimentCase[] = [
  {
    name: "Stroop",
    page: () => <StroopExperimentPage seedOverride={SEED} />,
    keys: ["d", "f", "j", "k"],
    schedule: () => createStroopSchedule(SEED),
    begin: () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
      for (const value of ["d", "f", "j", "k"]) key(value);
    },
  },
  {
    name: "Flanker",
    page: () => <FlankerExperimentPage seedOverride={SEED} />,
    keys: ["f", "j"],
    schedule: () => createFlankerSchedule(SEED),
    begin: () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Flanker" }));
      key("f");
      key("j");
    },
  },
];

function answer(plan: Plan, correctKey: string, keys: readonly string[]) {
  advance(500); // fixation
  nextFrame(); // stimulus onset frame
  if (plan === "none") {
    advance(2000);
    nextFrame();
  } else {
    advance(400);
    key(
      plan === "correct"
        ? correctKey
        : (keys.find((k) => k !== correctKey) as string),
    );
    nextFrame();
  }
  advance(500); // inter-trial interval
}

function runCompleteSession(experiment: ExperimentCase) {
  render(<MemoryRouter>{experiment.page()}</MemoryRouter>);
  experiment.begin();
  fireEvent.click(
    screen.getByRole("button", { name: "Begin 12 practice trials" }),
  );
  const schedule = experiment.schedule();
  schedule.practice.forEach((trial) =>
    answer("correct", trial.correctResponse, experiment.keys),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start 60 main trials" }));
  schedule.main.forEach((trial, position) => {
    answer(planFor(position + 1), trial.correctResponse, experiment.keys);
    if (position + 1 === 30) {
      fireEvent.click(screen.getByRole("button", { name: "Skip break" }));
    }
  });
  expect(
    screen.getByRole("heading", {
      name: `${experiment.name} session complete`,
    }),
  ).toBeInTheDocument();
}

function savedResponse(body: string) {
  const payload = JSON.parse(body) as { experiment_id: string };
  return new Response(
    JSON.stringify({
      session_id: "0a86e32e-fe7e-4026-b44f-8087457442b1",
      experiment_id: payload.experiment_id,
      status: "complete",
      created_at: "2026-11-22T14:52:47.667816Z",
      trials_stored: { practice: 12, main: 60 },
    }),
    { status: 201, headers: { "Content-Type": "application/json" } },
  );
}

describe("saving a finished session from the results page", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_SAVE_ID);
    vi.stubEnv("VITE_HB_LOCAL_SAVE_API", API);
    fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      savedResponse(String(init.body)),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  for (const experiment of CASES) {
    it(`${experiment.name}: nothing is sent until consent and an explicit save; one request; payload matches the fixture`, async () => {
      runCompleteSession(experiment);

      // Completion alone sends nothing.
      expect(fetchMock).not.toHaveBeenCalled();
      expect(
        screen.getByRole("heading", { name: "Save this session (optional)" }),
      ).toBeInTheDocument();
      expect(screen.getByText("HB-NOTICE-0.1-PROVISIONAL")).toBeInTheDocument();
      // The CSV wording no longer claims nothing can ever be stored.
      expect(
        screen.getByText(
          /Nothing is stored by HUMAN BENCHMARK unless you choose to save/,
        ),
      ).toBeInTheDocument();

      // Saving without ticking the agreement sends nothing.
      fireEvent.click(
        screen.getByRole("button", { name: "Save this session" }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nothing has been sent",
      );
      expect(fetchMock).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole("checkbox", {
          name: /I have read this provisional notice/,
        }),
      );
      await act(async () => {
        const save = screen.getByRole("button", { name: "Save this session" });
        fireEvent.click(save);
        fireEvent.click(save); // a double click must not send twice
      });
      await flushPromises();
      expect(screen.getByText("Session saved")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API}/api/v1/sessions`);
      expect(init.method).toBe("POST");
      expect(init.credentials).toBe("omit");
      const body = String(init.body);
      // The engine's own session ID never leaves the page.
      expect(body).not.toMatch(
        /"sessionId"|"trialId"|"inputSource"|"timingSource"/,
      );
      const lower = experiment.name.toLowerCase();
      await expect(
        JSON.stringify(JSON.parse(body), null, 2) + "\n",
      ).toMatchFileSnapshot(`./__fixtures__/${lower}-engine-save-payload.json`);

      // Saved: no further save button, results still on the page.
      expect(
        screen.queryByRole("button", {
          name: /Save this session|Try saving again/,
        }),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: "Download trial data (CSV)" }),
      ).toBeEnabled();
    }, 60_000);
  }

  it("an exited (incomplete) session cannot be saved and sends nothing", () => {
    render(
      <MemoryRouter>
        <FlankerExperimentPage seedOverride={SEED} />
      </MemoryRouter>,
    );
    CASES[1].begin();
    fireEvent.click(
      screen.getByRole("button", { name: "Begin 12 practice trials" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit session" }));
    expect(
      screen.getByRole("heading", { name: "Session ended" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Only complete sessions can be saved/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save this session" }),
    ).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
