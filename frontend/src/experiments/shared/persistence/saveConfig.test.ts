import { describe, expect, it } from "vitest";
import { CONSENT_NOTICE, readSaveConfig } from "./saveConfig";

describe("save configuration", () => {
  it("is off in production builds, even when configured", () => {
    expect(
      readSaveConfig({
        DEV: false,
        VITE_HB_LOCAL_SAVE_API: "http://127.0.0.1:8000",
      }),
    ).toBeNull();
  });

  it("is off unless explicitly configured", () => {
    expect(readSaveConfig({ DEV: true })).toBeNull();
    expect(
      readSaveConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: "  " }),
    ).toBeNull();
  });

  it.each([
    ["http://127.0.0.1:8000", "http://127.0.0.1:8000"],
    ["http://localhost:8000/", "http://localhost:8000"],
  ])("accepts the supported local address %s", (raw, origin) => {
    expect(readSaveConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw })).toEqual({
      apiBase: origin,
    });
  });

  it.each([
    "https://example.com",
    // The backend refuses these (Host allowlist; plain HTTP on 127.0.0.1 only).
    "http://[::1]:8000",
    "https://127.0.0.1:8000",
    "https://localhost:8000",
    "http://192.168.1.20:8000",
    "http://127.0.0.1.example.com",
    "http://user:pass@127.0.0.1:8000",
    "http://127.0.0.1:8000/api",
    "http://127.0.0.1:8000/?x=1",
    "ftp://127.0.0.1",
    "not a url",
  ])("refuses a non-loopback or non-plain address: %s", (raw) => {
    expect(
      readSaveConfig({ DEV: true, VITE_HB_LOCAL_SAVE_API: raw }),
    ).toBeNull();
  });

  it("presents the provisional notice, marked as not approved", () => {
    expect(CONSENT_NOTICE.version).toBe("HB-NOTICE-0.1-PROVISIONAL");
    expect(CONSENT_NOTICE.approvedForParticipantData).toBe(false);
  });
});
