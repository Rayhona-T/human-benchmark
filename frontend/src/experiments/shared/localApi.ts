/**
 * The ONE rule for which local test-backend addresses the frontend accepts,
 * shared by saving (persistence/saveConfig.ts) and the Personal Observatory
 * (observatory/observatoryClient.ts), so neither can be configured with an
 * address the backend refuses.
 *
 * The backend (Cycle 9 Task 9.2):
 *   - serves plain HTTP only, bound to 127.0.0.1;
 *   - accepts only the Host names `localhost` and `127.0.0.1`, on any port
 *     (TRUSTED_HOSTS in backend/app/main.py; a test keeps both in step).
 * So only `http://127.0.0.1[:port]` and `http://localhost[:port]` are
 * accepted, as a plain origin. `[::1]`, `https:`, other hosts, credentials,
 * paths, queries and fragments are refused.
 */
export const TRUSTED_LOCAL_HOSTS: readonly string[] = [
  "localhost",
  "127.0.0.1",
];

/** The plain origin of a supported local backend address, or null. */
export function parseLocalApiOrigin(raw: string | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const plainOrigin =
    url.protocol === "http:" &&
    url.username === "" &&
    url.password === "" &&
    (url.pathname === "/" || url.pathname === "") &&
    url.search === "" &&
    url.hash === "";
  if (!plainOrigin || !TRUSTED_LOCAL_HOSTS.includes(url.hostname)) return null;
  return url.origin;
}
