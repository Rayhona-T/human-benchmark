# HUMAN BENCHMARK — Static Hosting Requirements

Status (Cycle 10, Task 10.4): **no hosting provider, domain, or deployment
exists.** Nothing below is configured or verified on a real host. This
document states what the approved release (Option A: a client-only static
build) needs from any host, and how to verify a host before release.

## 1. What is deployed

`npm run build` (in `frontend/`) writes `frontend/dist/`:

| Path | Content | Changes between releases |
| --- | --- | --- |
| `index.html` | The single HTML entry point | Same name, new content |
| `assets/index-<hash>.js` | The whole application (one script) | New hash when content changes |
| `assets/index-<hash>.css` | All styles (one stylesheet) | New hash when content changes |

The production build makes no network requests beyond loading these files,
sets no cookies, and stores nothing in the browser. The development backend,
saving, the Observatory, and the design-system preview are not in it
(`frontend/e2e/bundle.spec.ts` checks the built files).

## 2. Deep links (required)

The app routes in the browser. A participant may open, reload, or bookmark
any of these addresses, so the host must answer each with `index.html`
(status 200):

`/`, `/experiments`, `/methodology`, `/experiments/stroop`,
`/experiments/flanker`

Unknown paths should also be answered with `index.html`; the app then shows
its own "Page not found" page. Only paths under `/assets/` must be served as
files (and give a real 404 when missing).

`vite preview`, which the browser tests use, behaves this way. A real host
needs an explicit "single-page application" fallback rule.

## 3. Caching (required)

| Path | Recommended `Cache-Control` | Why |
| --- | --- | --- |
| `/assets/*` | `public, max-age=31536000, immutable` | File names change whenever content changes |
| `index.html` and every fallback route | `no-cache` | Always revalidate, so a release is picked up at once and never points at deleted assets |

Keep the previous release's `/assets/` files available for a while after a
release, so a page loaded just before the release can still load its files.

## 4. Security headers (recommended)

Defined once in `frontend/e2e/support/securityHeaders.ts`. The browser tests
serve the production build with exactly these headers and check that every
page, a session of each experiment, the CSV download, and clearing work with
**no Content Security Policy violation in Chromium, Firefox, and WebKit**
(`frontend/e2e/security-headers.spec.ts`, which also checks the policy is
enforced). That verifies the recommendation against the bundle, not any host.

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; manifest-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` |
| `X-Frame-Options` | `DENY` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000` — **only** once the site is served exclusively over HTTPS (not testable locally) |

Notes:
- `connect-src 'none'` enforces the client-only scope in the browser: even a
  future accidental request would be blocked. A change that needs network
  access must change this policy, visibly, in review.
- The policy needs no `'unsafe-inline'`: the build has no inline script or
  style, and React applies element styles through the CSSOM, which
  `style-src` does not restrict.
- Serve over HTTPS only, and redirect HTTP to HTTPS.
- Hosts differ in how headers are configured (a headers file, a
  configuration file, or a dashboard). Configure them for `index.html`, every
  fallback route, and `/assets/*`.

## 5. Verifying a host before release

Run against the deployed address (replace `$SITE`):

1. **Deep links.** Every route in §2, and one unknown path, return 200 and
   the app's HTML:
   `curl -s -o /dev/null -w "%{http_code}\n" $SITE/experiments/stroop`
   Then open each in a browser and reload it.
2. **Assets.** A missing asset returns 404, not the HTML:
   `curl -s -o /dev/null -w "%{http_code}\n" $SITE/assets/missing.js`
3. **Caching.** `curl -sI $SITE/` shows `Cache-Control: no-cache`;
   `curl -sI $SITE/assets/<a real file>` shows the long `immutable` value.
4. **Headers.** `curl -sI $SITE/experiments/stroop` shows every header in §4
   with the exact values.
5. **Browser check.** Open the site with the browser's developer tools on
   the Console and Network panels, run a session of each experiment to the
   results, download the CSV, and clear the data: no CSP messages in the
   console, and no requests other than the page and its `/assets/` files.
6. **HTTPS.** `http://` redirects to `https://`; then add HSTS.

Record the date, address, and results. Until this is done, real-host
behavior is **unverified**.
