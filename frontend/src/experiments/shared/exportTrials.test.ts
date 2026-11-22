import dictionaryDoc from "../../../EXPORT_DATA_DICTIONARY.md?raw";
import { describe, expect, it } from "vitest";
import type { TrialOutcome, TrialRecord } from "../../engine/contracts";
import {
  BASE_COLUMNS_AFTER,
  BASE_COLUMNS_BEFORE,
  buildTrialCsv,
  csvField,
  exportFileName,
  type ExportColumn,
} from "./exportTrials";

interface Stim {
  word: string;
}

function record(
  phase: "practice" | "main",
  trialIndex: number,
  outcome: TrialOutcome,
  rt: number | null,
  response: string | null,
): TrialRecord<Stim, string, unknown> {
  return {
    experiment: {
      experimentId: "stroop",
      protocolId: "HB-STROOP-1.0",
      protocolVersion: "1.0",
      configurationId: "HB-STROOP-1.0",
      configurationVersion: "1.0",
    },
    sessionId: "secret-session-id",
    trialId: `t${trialIndex}`,
    phase,
    trialIndex,
    condition: "incongruent",
    stimulus: { word: 'RE"D, x' },
    correctResponse: "d",
    response: response
      ? {
          value: response,
          inputSource: "keyboard",
          timestampMs: 1412.34567,
          accepted: true,
        }
      : null,
    lifecycleState: "completed",
    outcome,
    timing: {
      fixationOnsetMs: 500,
      stimulusOnsetMs: 1000.25,
      responseTimestampMs: response ? 1412.34567 : null,
      deadlineMs: 3000.25,
      trialEndMs: null,
      stimulusOffsetMs: response ? 1420 : null,
      itiEndMs: null,
      reactionTimeMs: rt,
      trialDurationMs: null,
      timingSource: "performance.now",
    },
    randomization: {
      seedUnsigned32: 1234,
      prngAndScheduleId: "HB-STROOP-shuffle-v1",
      randomizationConfigurationVersion: "1",
      scheduleGenerationStatus: "generated",
      realizedPracticeOrder: [],
      realizedMainOrder: [],
    },
  };
}

const STIMULUS: ExportColumn<Stim>[] = [
  { name: "stimulus_word", description: "Word", value: (r) => r.stimulus.word },
];

function parse(csv: string) {
  expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  return csv.slice(1).trimEnd().split("\r\n");
}

describe("csvField", () => {
  it("quotes only when needed and doubles embedded quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line\nbreak")).toBe('"line\nbreak"');
    expect(csvField(0)).toBe("0");
    expect(csvField(null)).toBe("NA");
  });
});

describe("buildTrialCsv", () => {
  const records = [
    record("practice", 1, { category: "correct" }, 380.1234, "d"),
    record("main", 1, { category: "incorrect" }, 412.09567, "f"),
    record("main", 2, { category: "timeout" }, null, null),
    record(
      "main",
      3,
      { category: "invalid", reason: "visibility_lost" },
      null,
      null,
    ),
    record("main", 4, { category: "correct" }, Number.NaN, "d"),
  ];
  const csv = buildTrialCsv(
    records,
    {
      experimentId: "stroop",
      analysisVersion: "HB-ANALYSIS-1.1",
      status: "incomplete",
    },
    STIMULUS,
  );
  const lines = parse(csv);
  const header = lines[0].split(",");
  const row = (i: number) => {
    // Field 9 is the quoted stimulus containing a comma; split carefully.
    const match = lines[i].match(/^(.*?),("(?:[^"]|"")*"),(.*)$/)!;
    return [...match[1].split(","), match[2], ...match[3].split(",")];
  };
  const value = (i: number, name: string) => row(i)[header.indexOf(name)];

  it("writes the documented columns in order, with stimulus columns in the middle", () => {
    expect(header).toEqual([
      ...BASE_COLUMNS_BEFORE.map((c) => c.name),
      "stimulus_word",
      ...BASE_COLUMNS_AFTER.map((c) => c.name),
    ]);
    expect(lines).toHaveLength(1 + records.length);
  });

  it("identifies experiment, analysis version, status, phase, and trial", () => {
    expect(value(1, "experiment")).toBe("stroop");
    expect(value(1, "analysis_version")).toBe("HB-ANALYSIS-1.1");
    expect(value(1, "session_status")).toBe("incomplete");
    expect(value(1, "phase")).toBe("practice");
    expect(value(2, "phase")).toBe("main");
    expect(value(2, "trial_index")).toBe("1");
    expect(value(2, "condition")).toBe("incongruent");
    expect(value(2, "seed")).toBe("1234");
    expect(value(2, "stimulus_word")).toBe('"RE""D, x"');
  });

  it("scores outcomes and keeps missing values as NA, never zero", () => {
    expect(value(2, "outcome")).toBe("incorrect");
    expect(value(2, "correct")).toBe("0");
    expect(value(2, "response_key")).toBe("f");
    expect(value(2, "rt_ms")).toBe("412.096");
    expect(value(3, "outcome")).toBe("timeout");
    expect(value(3, "correct")).toBe("NA");
    expect(value(3, "rt_ms")).toBe("NA");
    expect(value(3, "response_key")).toBe("NA");
    expect(value(4, "outcome")).toBe("invalid");
    expect(value(4, "invalid_reason")).toBe("visibility_lost");
    expect(value(4, "rt_ms")).toBe("NA");
    // Correct response whose RT is not usable: still correct, RT is NA.
    expect(value(5, "correct")).toBe("1");
    expect(value(5, "rt_ms")).toBe("NA");
    expect(value(2, "stimulus_offset_ms")).toBe("1420");
    expect(value(2, "iti_end_ms")).toBe("NA");
    expect(value(2, "stimulus_onset_ms")).toBe("1000.25");
  });

  it("does not export the session identifier", () => {
    expect(csv).not.toContain("secret-session-id");
  });

  it("names the file by experiment and status", () => {
    expect(exportFileName("flanker", "complete")).toBe(
      "human-benchmark-flanker-complete-trials.csv",
    );
  });
});

describe("data dictionary documentation", () => {
  it("documents every exported column", () => {
    const doc = dictionaryDoc;
    for (const column of [
      ...BASE_COLUMNS_BEFORE,
      ...BASE_COLUMNS_AFTER,
      { name: "stimulus_word" },
      { name: "stimulus_ink" },
      { name: "stimulus_symbols" },
      { name: "target_direction" },
      { name: "flanker_direction" },
    ]) {
      expect(doc, column.name).toContain(`\`${column.name}\``);
    }
  });
});
