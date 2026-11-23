/// <reference types="node" />
// Node types are referenced here only: this test reads a backend source file.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLocalApiOrigin, TRUSTED_LOCAL_HOSTS } from "./localApi";
import { readObservatoryConfig } from "./observatory/observatoryClient";
import { readSaveConfig } from "./persistence/saveConfig";

const ACCEPTED: [string, string][] = [
  ["http://127.0.0.1:8000", "http://127.0.0.1:8000"],
  ["http://127.0.0.1:8000/", "http://127.0.0.1:8000"],
  ["http://localhost:8000", "http://localhost:8000"],
  ["http://LOCALHOST:8011", "http://localhost:8011"],
  ["  http://localhost:8000  ", "http://localhost:8000"],
  ["http://127.0.0.1", "http://127.0.0.1"],
];

const REFUSED = [
  // The backend's Host allowlist refuses these, and it binds 127.0.0.1 only.
  "http://[::1]:8000",
  "http://[0:0:0:0:0:0:0:1]:8000",
  "http://127.0.0.2:8000",
  "http://0.0.0.0:8000",
  // The backend serves plain HTTP only.
  "https://127.0.0.1:8000",
  "https://localhost:8000",
  // Not this computer, or not a plain origin.
  "http://192.168.1.20:8000",
  "http://127.0.0.1.example.com",
  "http://localhost.example.com",
  "http://user:pass@127.0.0.1:8000",
  "http://127.0.0.1:8000/api",
  "http://127.0.0.1:8000/?x=1",
  "http://127.0.0.1:8000/#x",
  "ftp://127.0.0.1",
  "127.0.0.1:8000",
  "not a url",
  "",
  "   ",
];

describe("supported local backend addresses (shared by saving and the Observatory)", () => {
  it.each(ACCEPTED)("accepts %j", (raw, origin) => {
    expect(parseLocalApiOrigin(raw)).toBe(origin);
    expect(readSaveConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw })).toEqual({
      apiBase: origin,
    });
    expect(
      readObservatoryConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toEqual({ apiBase: origin });
  });

  it.each(REFUSED)("refuses %j for saving and for the Observatory", (raw) => {
    expect(parseLocalApiOrigin(raw)).toBeNull();
    expect(
      readSaveConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toBeNull();
    expect(
      readObservatoryConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toBeNull();
  });

  it("refuses a missing address", () => {
    expect(parseLocalApiOrigin(undefined)).toBeNull();
  });

  it("matches the backend's Host allowlist exactly", () => {
    // backend/app/main.py: TRUSTED_HOSTS = ("localhost", "127.0.0.1")
    const backendMain = readFileSync(
      // Vitest runs from frontend/.
      resolve(process.cwd(), "../backend/app/main.py"),
      "utf-8",
    );
    const match = /^TRUSTED_HOSTS = \(([^)]*)\)/m.exec(backendMain);
    expect(match).not.toBeNull();
    const backendHosts = [...(match?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
      (entry) => entry[1],
    );
    expect([...backendHosts].sort()).toEqual([...TRUSTED_LOCAL_HOSTS].sort());
  });
});
