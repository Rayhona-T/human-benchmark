/**
 * Tests for the strict CSV parser the browser tests use to read exports
 * (support/csv.ts). No browser is needed. The round-trip tests feed the
 * parser text produced by the app's own export functions, so the parser is
 * checked against the real writer, not only against hand-written samples.
 */
import { expect, test } from "@playwright/test";
import { CsvError, parseCsvRows, parseCsvTable } from "./support/csv";
import {
  BASE_COLUMNS_AFTER,
  BASE_COLUMNS_BEFORE,
  MISSING,
  buildTrialCsv,
  csvField,
} from "../src/experiments/shared/exportTrials";
import type { TrialRecord } from "../src/engine/contracts";

test.describe("CSV parser (RFC 4180)", () => {
  test("plain fields, CRLF and LF row endings, optional final line ending", () => {
    expect(parseCsvRows("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsvRows("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsvRows("")).toEqual([]);
  });

  test("quoted fields with commas, escaped quotes, and line breaks", () => {
    expect(
      parseCsvRows('"x, y","say ""hi""","line 1\r\nline 2","a\nb"\r\n'),
    ).toEqual([["x, y", 'say "hi"', "line 1\r\nline 2", "a\nb"]]);
    expect(parseCsvRows('""""\r\n')).toEqual([['"']]);
  });

  test("empty fields: leading, middle, trailing, quoted, and a whole empty row", () => {
    expect(parseCsvRows(",a,,b,\r\n")).toEqual([["", "a", "", "b", ""]]);
    expect(parseCsvRows('"",x\r\n')).toEqual([["", "x"]]);
    expect(parseCsvRows("a\r\n\r\nb\r\n")).toEqual([["a"], [""], ["b"]]);
  });

  test("malformed input is an error, never repaired", () => {
    expect(() => parseCsvRows('"open')).toThrow(CsvError);
    expect(() => parseCsvRows('ab"c,d')).toThrow(/Quote inside an unquoted/);
    expect(() => parseCsvRows('"a"b,c')).toThrow(/after a closing quote/);
    expect(() => parseCsvRows("a\rb")).toThrow(/Bare CR/);
  });

  test("header, row lengths, and byte-order mark", () => {
    const table = parseCsvTable("﻿name,value\r\nx,1\r\ny,\r\n");
    expect(table.hadByteOrderMark).toBe(true);
    expect(table.header).toEqual(["name", "value"]);
    expect(table.records).toEqual([
      { name: "x", value: "1" },
      { name: "y", value: "" },
    ]);
    expect(parseCsvTable("a\r\n1\r\n").hadByteOrderMark).toBe(false);
    expect(() => parseCsvTable("a,b\r\n1\r\n")).toThrow(
      /Row 1 has 1 fields; the header has 2/,
    );
    expect(() => parseCsvTable("a,b\r\n1,2,3\r\n")).toThrow(/Row 1 has 3/);
    expect(() => parseCsvTable("a,a\r\n")).toThrow(/Duplicate column/);
    expect(() => parseCsvTable("a,\r\n")).toThrow(/Empty column name/);
    expect(() => parseCsvTable("")).toThrow(/No header row/);
  });

  test("round trip through the app's csvField", () => {
    const values = [
      "plain",
      "comma, inside",
      'quote " inside',
      '"fully quoted"',
      "line\r\nbreak",
      "lf\nonly",
      "",
      " spaced ",
      "→←—",
    ];
    const text = `${values.map(csvField).join(",")}\r\n`;
    expect(parseCsvRows(text)).toEqual([values]);
    // Missing values are written as NA, never as an empty or zero value.
    expect(csvField(null)).toBe(MISSING);
    expect(csvField(0)).toBe("0");
  });

  test("round trip through the app's buildTrialCsv", () => {
    const record = {
      experiment: { protocolId: "HB-TEST, with comma" },
      randomization: {
        seedUnsigned32: 42,
        prngAndScheduleId: 'id "quoted"',
      },
      phase: "main",
      trialIndex: 1,
      condition: "congruent",
      correctResponse: "f",
      response: null,
      outcome: { category: "timeout" },
      timing: {
        reactionTimeMs: null,
        fixationOnsetMs: 1.23456,
        stimulusOnsetMs: 501,
        responseTimestampMs: null,
        deadlineMs: 2501,
        stimulusOffsetMs: null,
        itiEndMs: null,
      },
      stimulus: { label: "multi\nline" },
    } as unknown as TrialRecord<{ label: string }, string, unknown>;
    const text = buildTrialCsv(
      [record],
      {
        experimentId: "stroop",
        analysisVersion: "HB-ANALYSIS-1.1",
        status: "complete",
      },
      [
        {
          name: "label",
          description: "test column",
          value: (r) => r.stimulus.label,
        },
      ],
    );
    const table = parseCsvTable(text);
    expect(table.hadByteOrderMark).toBe(true);
    expect(table.header).toEqual([
      ...BASE_COLUMNS_BEFORE.map((c) => c.name),
      "label",
      ...BASE_COLUMNS_AFTER.map((c) => c.name),
    ]);
    expect(table.records).toHaveLength(1);
    const [row] = table.records;
    expect(row.protocol_id).toBe("HB-TEST, with comma");
    expect(row.prng_id).toBe('id "quoted"');
    expect(row.label).toBe("multi\nline");
    expect(row.outcome).toBe("timeout");
    expect(row.correct).toBe(MISSING);
    expect(row.rt_ms).toBe(MISSING);
    expect(row.response_key).toBe(MISSING);
    expect(row.fixation_onset_ms).toBe("1.235");
  });
});
