/**
 * Strict RFC 4180 CSV parser for the browser tests (Cycle 10, Task 10.3).
 *
 * It reads the files the app exports, so the tests verify what a
 * participant actually downloads. Strict on purpose: malformed input
 * (an unterminated quote, a quote inside an unquoted field, text after a
 * closing quote, a bare CR, or rows of different lengths) is an error,
 * never silently repaired, because a lenient parser could hide an export
 * defect.
 *
 * Supported: quoted fields; commas, CR/LF and escaped quotes ("") inside
 * quoted fields; empty fields; CRLF or LF row endings; one optional final
 * line ending; an optional UTF-8 byte-order mark (reported, then removed).
 */

export class CsvError extends Error {}

/** Parses CSV text into rows of raw string fields. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let closedQuote = false; // just after the closing quote of a field
  let line = 1;

  const endField = () => {
    row.push(field);
    field = "";
    closedQuote = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    line += 1;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }
    if (char === ",") {
      endField();
    } else if (char === "\r") {
      if (text[i + 1] !== "\n") {
        throw new CsvError(`Bare CR (not part of CRLF) on line ${line}`);
      }
      i += 1;
      endRow();
    } else if (char === "\n") {
      endRow();
    } else if (closedQuote) {
      throw new CsvError(
        `Unexpected ${JSON.stringify(char)} after a closing quote on line ${line}`,
      );
    } else if (char === '"') {
      if (field !== "") {
        throw new CsvError(
          `Quote inside an unquoted field on line ${line}: ${JSON.stringify(field)}`,
        );
      }
      inQuotes = true;
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new CsvError("Unterminated quoted field at end of file");
  // A final line ending does not start another row.
  if (field !== "" || closedQuote || row.length > 0) endRow();
  return rows;
}

export interface CsvTable {
  /** True when the text started with a UTF-8 byte-order mark (U+FEFF). */
  hadByteOrderMark: boolean;
  header: string[];
  /** One object per data row, keyed by header name, in file order. */
  records: Record<string, string>[];
}

/**
 * Parses a CSV file with a header row. Header names must be unique and
 * non-empty, and every data row must have exactly as many fields as the
 * header.
 */
export function parseCsvTable(text: string): CsvTable {
  const hadByteOrderMark = text.startsWith("﻿");
  const rows = parseCsvRows(hadByteOrderMark ? text.slice(1) : text);
  if (rows.length === 0) throw new CsvError("No header row");
  const [header, ...data] = rows;
  const seen = new Set<string>();
  for (const name of header) {
    if (name === "") throw new CsvError("Empty column name in the header");
    if (seen.has(name)) throw new CsvError(`Duplicate column name: ${name}`);
    seen.add(name);
  }
  const records = data.map((fields, index) => {
    if (fields.length !== header.length) {
      throw new CsvError(
        `Row ${index + 1} has ${fields.length} fields; the header has ${header.length}`,
      );
    }
    return Object.fromEntries(header.map((name, i) => [name, fields[i]]));
  });
  return { hadByteOrderMark, header, records };
}
