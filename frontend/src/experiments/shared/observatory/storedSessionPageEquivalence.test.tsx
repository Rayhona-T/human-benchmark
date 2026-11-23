/**
 * Round-trip equivalence for the two PAGE-RUN contract fixtures
 * (persistence/__fixtures__/{stroop,flanker}-engine-save-payload.json).
 *
 * A full session is run through the real experiment page, with the same
 * seed, timing and answer plan as persistence/experimentSave.test.tsx. The
 * analysis functions are wrapped (not replaced) so the test sees exactly the
 * live records the page analysed and the results it showed. Then:
 *   1. those live records must rebuild the committed fixture exactly, which
 *      proves they are its live format;
 *   2. the session as stored and returned by the REAL backend
 *      (observatory/__fixtures__/*-engine-stored-detail.json) is adapted and
 *      analysed, and must give results identical to the page's own.
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
import { computeFlankerResults } from "../../flanker/flankerAnalysis";
import { flankerStimulusToApi } from "../../flanker/flankerResultsCopy";
import { createFlankerSchedule } from "../../flanker/flankerSchedule";
import { StroopExperimentPage } from "../../stroop/StroopExperimentPage";
import { computeStroopResults } from "../../stroop/stroopAnalysis";
import { stroopStimulusToApi } from "../../stroop/stroopResultsFormat";
import { createStroopSchedule } from "../../stroop/stroopSchedule";
import flankerPayload from "../persistence/__fixtures__/flanker-engine-save-payload.json";
import stroopPayload from "../persistence/__fixtures__/stroop-engine-save-payload.json";
import { CONSENT_NOTICE } from "../persistence/saveConfig";
import { buildSessionSavePayload } from "../persistence/sessionPayload";
import type { SessionResultsInput } from "../sessionAnalysis";
import flankerStored from "./__fixtures__/flanker-engine-stored-detail.json";
import stroopStored from "./__fixtures__/stroop-engine-stored-detail.json";
import { analyseStoredSession } from "./storedSession";

vi.mock("../../stroop/stroopAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../stroop/stroopAnalysis")>();
  return {
    ...actual,
    computeStroopResults: vi.fn(actual.computeStroopResults),
  };
});
vi.mock("../../flanker/flankerAnalysis", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../flanker/flankerAnalysis")>();
  return {
    ...actual,
    computeFlankerResults: vi.fn(actual.computeFlankerResults),
  };
});

// --- Same session as persistence/experimentSave.test.tsx --------------------

const SEED = 1234;
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

type Plan = "correct" | "wrong" | "none";
const planFor = (index: number): Plan =>
  index % 7 === 0 ? "none" : index % 5 === 0 ? "wrong" : "correct";

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

interface PageCase {
  name: "Stroop" | "Flanker";
  experimentId: "stroop" | "flanker";
  page: () => ReactElement;
  keys: readonly string[];
  schedule: () => {
    practice: readonly { correctResponse: string }[];
    main: readonly { correctResponse: string }[];
  };
  begin: () => void;
  analysis: ReturnType<typeof vi.fn>;
  stimulusToApi: (stimulus: unknown) => Record<string, string>;
  payload: unknown;
  stored: { session_id: string };
}

const CASES: PageCase[] = [
  {
    name: "Stroop",
    experimentId: "stroop",
    page: () => <StroopExperimentPage seedOverride={SEED} />,
    keys: ["d", "f", "j", "k"],
    schedule: () => createStroopSchedule(SEED),
    begin: () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Stroop" }));
      for (const value of ["d", "f", "j", "k"]) key(value);
    },
    analysis: vi.mocked(computeStroopResults),
    stimulusToApi: stroopStimulusToApi as (
      stimulus: unknown,
    ) => Record<string, string>,
    payload: stroopPayload,
    stored: stroopStored,
  },
  {
    name: "Flanker",
    experimentId: "flanker",
    page: () => <FlankerExperimentPage seedOverride={SEED} />,
    keys: ["f", "j"],
    schedule: () => createFlankerSchedule(SEED),
    begin: () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Flanker" }));
      key("f");
      key("j");
    },
    analysis: vi.mocked(computeFlankerResults),
    stimulusToApi: flankerStimulusToApi as (
      stimulus: unknown,
    ) => Record<string, string>,
    payload: flankerPayload,
    stored: flankerStored,
  },
];

function runCompleteSession(testCase: PageCase) {
  render(<MemoryRouter>{testCase.page()}</MemoryRouter>);
  testCase.begin();
  fireEvent.click(
    screen.getByRole("button", { name: "Begin 12 practice trials" }),
  );
  const schedule = testCase.schedule();
  schedule.practice.forEach((trial) =>
    answer("correct", trial.correctResponse, testCase.keys),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start 60 main trials" }));
  schedule.main.forEach((trial, position) => {
    answer(planFor(position + 1), trial.correctResponse, testCase.keys);
    if (position + 1 === 30) {
      fireEvent.click(screen.getByRole("button", { name: "Skip break" }));
    }
  });
  expect(
    screen.getByRole("heading", { name: `${testCase.name} session complete` }),
  ).toBeInTheDocument();
}

describe("stored-session equivalence for real page runs", () => {
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
    for (const testCase of CASES) testCase.analysis.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  for (const testCase of CASES) {
    it(`${testCase.name}: the stored session analyses exactly like the live page session`, () => {
      runCompleteSession(testCase);

      // What the page itself analysed and showed (its latest analysis).
      const calls = testCase.analysis.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const liveInput = calls.at(-1)?.[0] as SessionResultsInput;
      const liveResults = testCase.analysis.mock.results.at(-1)
        ?.value as unknown;
      expect(liveInput.status).toBe("complete");

      // 1. These live records are the committed fixture's live format.
      const rebuilt = buildSessionSavePayload(
        {
          experimentId: testCase.experimentId,
          status: liveInput.status,
          records: liveInput.records as Parameters<
            typeof buildSessionSavePayload
          >[0]["records"],
          breakTaken: liveInput.breakTaken,
          breakDurationMs: liveInput.breakDurationMs,
          stimulusToApi: testCase.stimulusToApi,
        },
        {
          clientSessionId: FIXED_SAVE_ID,
          noticeVersion: CONSENT_NOTICE.version,
        },
      );
      expect(rebuilt).toEqual(testCase.payload);

      // 2. The REAL backend's stored copy analyses identically.
      const callsBefore = calls.length;
      const stored = analyseStoredSession(testCase.stored, {
        expectedSessionId: testCase.stored.session_id,
        expectedExperimentId: testCase.experimentId,
      });
      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      // It went through the same approved analysis function, once.
      expect(testCase.analysis.mock.calls.length).toBe(callsBefore + 1);
      expect(stored.results).toStrictEqual(liveResults);
      expect(stored.session.analysisInput.breakTaken).toBe(
        liveInput.breakTaken,
      );
      expect(stored.session.analysisInput.breakDurationMs).toBe(
        liveInput.breakDurationMs,
      );
    }, 60_000); // a full page-run session, as in persistence/experimentSave.test.tsx
  }
});
