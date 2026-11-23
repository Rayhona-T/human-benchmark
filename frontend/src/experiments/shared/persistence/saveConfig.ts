/**
 * When saving to the backend is offered, and with which consent notice.
 *
 * Saving is a DEVELOPMENT/TEST data flow only (Cycle 8 Task 3):
 *   1. it exists only in a dev-server build (`import.meta.env.DEV`); a
 *      production build never offers it, whatever its configuration;
 *   2. it must be switched on explicitly with VITE_HB_LOCAL_SAVE_API;
 *   3. that address must be this computer (loopback), so data cannot be sent
 *      to another machine by configuration.
 * Approved participant collection would need an approved notice, the
 * deployment requirements in docs/backend/BACKEND_ARCHITECTURE.md §9, and a
 * reviewed code change. It cannot be enabled by configuration alone.
 */

/** The consent notice this page presents. Must be on the backend allowlist
 * (backend/app/consent.py); a backend test checks both stay in step. */
export const CONSENT_NOTICE = {
  version: "HB-NOTICE-0.1-PROVISIONAL",
  /** Provisional: NOT approved for collecting real participant data. */
  approvedForParticipantData: false,
} as const;

export interface SaveConfig {
  /** Origin of the local test backend, e.g. "http://127.0.0.1:8000". */
  apiBase: string;
}

export interface SaveEnvironment {
  DEV: boolean;
  VITE_HB_LOCAL_SAVE_API?: string;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Returns the save configuration, or null when saving must not be offered. */
export function readSaveConfig(env: SaveEnvironment): SaveConfig | null {
  if (!env.DEV) return null;
  const raw = env.VITE_HB_LOCAL_SAVE_API?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const plainOrigin =
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.username === "" &&
    url.password === "" &&
    (url.pathname === "/" || url.pathname === "") &&
    url.search === "" &&
    url.hash === "";
  if (!plainOrigin || !LOOPBACK_HOSTS.has(url.hostname)) return null;
  return { apiBase: url.origin };
}

/** Configuration of the running app (null in production builds). */
export function appSaveConfig(): SaveConfig | null {
  return readSaveConfig({
    DEV: import.meta.env.DEV,
    VITE_HB_LOCAL_SAVE_API: import.meta.env.VITE_HB_LOCAL_SAVE_API as
      string | undefined,
  });
}
