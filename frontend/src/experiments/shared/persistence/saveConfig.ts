/**
 * When saving to the backend is offered, and with which consent notice.
 *
 * Saving is a DEVELOPMENT/TEST data flow only (Cycle 8 Task 3):
 *   1. it exists only in a dev-server build (`import.meta.env.DEV`); a
 *      production build never offers it, whatever its configuration;
 *   2. it must be switched on explicitly with VITE_HB_LOCAL_SAVE_API;
 *   3. that address must be this computer, in a form the backend accepts
 *      (`http://127.0.0.1` or `http://localhost`, any port; ../localApi.ts),
 *      so data cannot be sent to another machine by configuration.
 * Approved participant collection would need an approved notice, the
 * deployment requirements in docs/backend/BACKEND_ARCHITECTURE.md §9, and a
 * reviewed code change. It cannot be enabled by configuration alone.
 */
import { parseLocalApiOrigin } from "../localApi";

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

/**
 * Returns the save configuration, or null when saving must not be offered.
 * The address rule is shared with the Observatory (../localApi.ts): only
 * addresses the local backend actually accepts.
 */
export function readSaveConfig(env: SaveEnvironment): SaveConfig | null {
  if (!env.DEV) return null;
  const apiBase = parseLocalApiOrigin(env.VITE_HB_LOCAL_SAVE_API);
  return apiBase ? { apiBase } : null;
}

/** Configuration of the running app (null in production builds). */
export function appSaveConfig(): SaveConfig | null {
  return readSaveConfig({
    DEV: import.meta.env.DEV,
    VITE_HB_LOCAL_SAVE_API: import.meta.env.VITE_HB_LOCAL_SAVE_API as
      string | undefined,
  });
}
