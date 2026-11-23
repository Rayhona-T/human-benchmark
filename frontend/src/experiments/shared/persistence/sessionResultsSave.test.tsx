/**
 * Regression: with saving not configured (production, or a dev server without
 * VITE_HB_LOCAL_SAVE_API), the results page is exactly as before: no save
 * panel, the original CSV wording, and no network access.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { computeFlankerResults } from "../../flanker/flankerAnalysis";
import {
  FLANKER_EXPORT_COLUMNS,
  FLANKER_RESULTS_COPY,
  flankerStimulusToApi,
} from "../../flanker/flankerResultsCopy";
import { FLANKER_SESSION_DEFINITION } from "../../flanker/useFlankerSession";
import { SessionResults } from "../SessionResults";
import { buildTestRecords } from "./testSessions";

const records = buildTestRecords(FLANKER_SESSION_DEFINITION, 4242);
const results = computeFlankerResults({
  status: "complete",
  records,
  breakTaken: false,
  breakDurationMs: 0,
});
const saveData = {
  experimentId: "flanker" as const,
  status: "complete" as const,
  records,
  breakTaken: false,
  breakDurationMs: 0,
  stimulusToApi: flankerStimulusToApi,
};
const ORIGINAL_EXPORT_TEXT =
  /The file is created in your browser; nothing is uploaded or stored by HUMAN BENCHMARK, and the data is gone once you leave this page\./;

function renderResults(saveConfig?: { apiBase: string } | null) {
  return render(
    <SessionResults
      results={results}
      copy={FLANKER_RESULTS_COPY}
      exportData={{
        experimentId: "flanker",
        records,
        stimulusColumns: FLANKER_EXPORT_COLUMNS,
      }}
      saveData={saveData}
      {...(saveConfig === undefined ? {} : { saveConfig })}
    />,
  );
}

describe("results page with saving not configured", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shows no save panel and keeps the original export wording (no env set)", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderResults();
    expect(
      screen.queryByRole("heading", { name: "Save this session (optional)" }),
    ).toBeNull();
    expect(screen.getByText(ORIGINAL_EXPORT_TEXT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download trial data (CSV)" }),
    ).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a non-loopback address does not enable saving", () => {
    vi.stubEnv("VITE_HB_LOCAL_SAVE_API", "https://collector.example.com");
    renderResults();
    expect(
      screen.queryByRole("heading", { name: "Save this session (optional)" }),
    ).toBeNull();
    expect(screen.getByText(ORIGINAL_EXPORT_TEXT)).toBeInTheDocument();
  });

  it("an explicit null configuration hides it too", () => {
    renderResults(null);
    expect(
      screen.queryByRole("heading", { name: "Save this session (optional)" }),
    ).toBeNull();
  });

  it("with a local configuration, the panel appears and the export wording is corrected", () => {
    renderResults({ apiBase: "http://127.0.0.1:8000" });
    expect(
      screen.getByRole("heading", { name: "Save this session (optional)" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(ORIGINAL_EXPORT_TEXT)).toBeNull();
    expect(
      screen.getByText(/downloading it uploads nothing/),
    ).toBeInTheDocument();
  });
});
