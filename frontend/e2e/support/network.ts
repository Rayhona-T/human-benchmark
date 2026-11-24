/**
 * Records every network request a page makes, for the client-only privacy
 * check (Cycle 10 scope: Option A, no participant data leaves the browser).
 *
 * Allowed: same-origin GET requests for the app's own static assets
 * (the HTML document, scripts, stylesheets, images, fonts).
 * Flagged: any other origin; any non-GET method; fetch/XHR, beacons
 * ("ping"), event streams and WebSockets, even to the same origin, because
 * the client-only app has no reason to make them.
 *
 * What this cannot prove: behavior in other browsers, requests made by
 * browser extensions or the browser itself outside the page, or anything a
 * real host logs about ordinary asset requests (IP address, user agent).
 */
import type { Page } from "@playwright/test";

const STATIC_TYPES = new Set([
  "document",
  "script",
  "stylesheet",
  "image",
  "font",
]);

export interface RecordedRequest {
  url: string;
  method: string;
  resourceType: string;
}

export function recordNetwork(page: Page, origin: string) {
  const requests: RecordedRequest[] = [];
  const sockets: string[] = [];
  page.on("request", (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));

  return {
    requests,
    /** Requests that a client-only app should never make. */
    violations(): string[] {
      const found = requests
        // blob: and data: URLs never leave the browser (the CSV download
        // is a blob: URL created in the page).
        .filter((request) => !/^(blob|data):/.test(request.url))
        .filter(
          (request) =>
            !request.url.startsWith(`${origin}/`) ||
            request.method !== "GET" ||
            !STATIC_TYPES.has(request.resourceType),
        )
        .map(
          (request) =>
            `${request.method} ${request.resourceType} ${request.url}`,
        );
      return [...found, ...sockets.map((url) => `websocket ${url}`)];
    },
  };
}

/** Everything the page could have stored in the browser (all should be 0). */
export async function clientStorage(page: Page) {
  const inPage = await page.evaluate(async () => ({
    localStorage: window.localStorage.length,
    sessionStorage: window.sessionStorage.length,
    indexedDb: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
  }));
  return {
    ...inPage,
    cookies: (await page.context().cookies()).length,
    serviceWorkers: page.context().serviceWorkers().length,
  };
}

export const NO_CLIENT_STORAGE = {
  localStorage: 0,
  sessionStorage: 0,
  indexedDb: 0,
  caches: 0,
  cookies: 0,
  serviceWorkers: 0,
};
