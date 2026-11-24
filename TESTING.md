# HUMAN BENCHMARK — Running the Checks

How to run locally the same checks CI runs, what each covers, and what to do
when one fails. CI is defined in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Requirements

| Tool | Version | Where it is pinned |
| --- | --- | --- |
| Node.js | 24 (Vitest needs 22.12+ or 24) | `frontend/.nvmrc` |
| npm packages | exact, from the lockfile | `frontend/package-lock.json` (`npm ci`) |
| Python | 3.12 or later (CI uses 3.12) | `backend/pyproject.toml` |
| Python packages | exact, including the dev tools' own dependencies | `backend/requirements.txt`, `backend/requirements-dev.txt` |
| Chromium for Playwright | the build matching `@playwright/test` | installed by `npx playwright install chromium` |

## Frontend (from `frontend/`)

```bash
npm ci                    # clean install from the lockfile
npx tsc -b                # type check: app, tooling and browser tests
npm run lint              # ESLint
npm run format:check      # Prettier
npm test                  # Vitest unit and component tests (jsdom)
npm run build             # production build into dist/
```

Run part of the Vitest suite: `npx vitest run src/experiments/stroop`, or one
test by name: `npx vitest run -t "mapping check"`.

## Backend (from `backend/`)

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows
# .venv/bin/python -m pip install -r requirements-dev.txt     # macOS/Linux
python -m ruff check .
python -m ruff format --check .
python -m mypy
python -m pytest
```

Each test uses its own temporary SQLite database. **The tests never touch
`backend/human_benchmark.db` or `backend/.env`.** Run part of the suite:
`python -m pytest tests/test_sessions_api.py -k duplicate`.

**Windows note.** On the development machine, Windows Smart App Control blocks
the compiled mypy 2.4 build (its `librt` dependency), so `python -m mypy` fails
to start (see backend/README.md). Workaround, outside the repository: install
mypy's pure-Python wheel of the same version in a separate virtualenv,

```bash
python -m pip download --no-deps --only-binary :all: --platform any   --python-version 3.12 --implementation py --abi none mypy==2.4.1 -d wheels
<venv>/python -m pip install -r requirements.txt pytest==9.2.0 httpx==0.28.1   mypy_extensions==1.2.0 pathspec==1.1.1 librt==0.17.0 ast_serialize==0.13.1
<venv>/python -m pip install --no-deps wheels/mypy-2.4.1-py3-none-any.whl
<venv>/python -m mypy --platform linux     # same checks as CI
```

It reports `compiled: no` and is slower, but checks the same rules. CI runs the
normal compiled mypy on Linux.

`tests/test_observatory_fixtures.py` replays each frontend save fixture through
the real API and fails if the committed Observatory fixtures
(`frontend/src/experiments/shared/observatory/__fixtures__/`) no longer match
what the backend returns. Regenerate them with
`scripts/generate_observatory_fixtures.py` and review the diff.

## Browser tests (Playwright, from `frontend/`)

```bash
npx playwright install chromium firefox webkit   # once per machine (Linux CI adds --with-deps)
npm run test:e2e                    # build, serve with `vite preview`, run all specs in all three browsers
npm run test:e2e -- --project=firefox           # one browser (chromium, firefox, webkit)
npx playwright test e2e/app.spec.ts             # one file
npx playwright test -g "Flanker"                # by test name
npx playwright show-report                      # open the last HTML report
```

**Headed real-focus tests** (a visible Chromium window; needs a display; not
run in CI). They repeat the real focus-loss tests one at a time:

```bash
HB_HEADED=1 npx playwright test --project=chromium-headed          # bash
$env:HB_HEADED=1; npx playwright test --project=chromium-headed    # PowerShell
```

Do not use the computer while they run: they minimize and restore their own
window, and other windows taking focus would interfere.

**Browsers (Task 10.4).** Chromium, Firefox, and WebKit each run every spec,
with these exceptions (`playwright.config.ts`):
- tests tagged `@chromium-only`: real window focus loss uses the Chrome
  DevTools Protocol; one long multi-reload journey (42 trials, four reloads)
  is not repeated (the reload prompt is tested in every browser);
- `csv.spec.ts` and `bundle.spec.ts` need no browser and run once (Chromium).

The complete session of both experiments, with the export-consistency check,
runs in all three browsers.

`npm run test:e2e` always rebuilds and tests the **production bundle**, served
by `vite preview` at `http://127.0.0.1:4173`. Locally an already-running server
on that port is reused. Stop it first if it serves an old build.

| Spec | What it checks |
| --- | --- |
| `e2e/app.spec.ts` | Deep links to every main page; navigation; the not-found page; development-only Observatory routes and link absent; no uncaught page or console errors |
| `e2e/experiments.spec.ts` | For Stroop and Flanker: briefing and data notice; mapping check (wrong and unmapped keys); practice responses and feedback; a **complete session** (12 practice + 60 main trials, unchanged protocol) to results, with the full export-consistency check below; no save panel |
| `e2e/interruptions.spec.ts` | For Stroop and Flanker: hidden page and window focus loss during a stimulus (one invalid trial, not repeated, no auto-resume), during fixation, between stimulus commit and its onset frame, during feedback, with simultaneous events, at the instant of a response, repeated while paused, and during the break; a complete session with interruptions |
| `e2e/session-lifecycle.spec.ts` | For Stroop and Flanker: reload before starting, during practice, the main task, and the break; navigating away, Back and Forward; Exit (incomplete) then Restart (no shared records); closing the page. Nothing is restored and the browser stores nothing |
| `e2e/privacy.spec.ts` | Browsing makes only same-origin GET requests for static assets; no cookies, local/session storage, IndexedDB or service workers; a self-test proving the network check catches a cross-origin or POST request |
| `e2e/csv.spec.ts` | The strict RFC 4180 parser used to read exports (quoting, commas, escaped quotes, line breaks, empty fields, row lengths, byte-order mark), including round trips through the app's own CSV writer. No browser needed |
| `e2e/session-departure.spec.ts` | Clearing session data (FR-PRI-03): not offered while running; Cancel keeps it; clearing after export; the next session shares no records. Leaving an active session: in-app links, Back, Forward, and Escape (pause, Stay resumes, Leave goes); the browser's reload and close prompt only while active |
| `e2e/a11y.spec.ts` | axe-core (WCAG 2.0–2.2 A/AA and best practice) on the site pages and every session state, including the dialogs and incomplete results; the break and completed results are scanned in `experiments.spec.ts` |
| `e2e/keyboard.spec.ts` | The whole journey without a mouse: visible focus at every stop, focus moved to new screens, Enter/Space never active during trials, Pause/Resume, every dialog keeps focus inside (Tab and Shift+Tab) and starts on the safe choice, Escape cancels |
| `e2e/responsive.spec.ts` | 1440, 1280, 768, 390, and 320 px wide: no horizontal page overflow, usable navigation, the first stimulus fully visible. Flanker's width guard when the window is resized. A measurement of where the stimulus appears in phone landscape |
| `e2e/security-headers.spec.ts` | The recommended headers (`docs/HOSTING.md`) applied to every response: pages, a session of each experiment, the CSV download, and clearing work with no Content Security Policy violation; a self-test that the policy is enforced |
| `e2e/bundle.spec.ts` | The production files contain no development-only code (save client and endpoint, consent notice, Observatory, design-system page) and are one script and one stylesheet |

**Export consistency (`e2e/support/results.ts`).** Every session-ending
browser test downloads the real CSV, parses it with the strict parser
(`e2e/support/csv.ts`, never `split(",")`), and checks:
- **each row against what the test did:** phase, trial number, stimulus
  columns (read from the screen), condition, correct key, key pressed,
  outcome, invalid reason, missing values as `NA`, and response time equal
  to key press − onset;
- **session-level columns:** identical on every row, with the right status in
  the file name and the `session_status` column;
- **the results page:** every overview count and, for complete sessions,
  every cell of the condition table (counts, three rates, medians or "Not
  shown") and the headline rates, recomputed from the CSV with the documented
  formulas.

These checks were confirmed to fail on deliberately broken application code
(a mislabelled phase, a swapped count, a wrong accuracy denominator), each then
reverted.

**Long tests.** Tests that drive a full session (72 trials) are marked
`test.slow()` (three times the 120 s limit). On a busy development machine they
can take about two minutes each; in CI the whole suite is much faster.

**How full sessions run.**
- **Clock:** the tests use Playwright's simulated clock (`page.clock`).
- **Driving:** they read each stimulus from the screen (the Stroop ink color,
  the Flanker center arrow), press keys, and advance time in small steps until
  the screen changes. A stimulus counts as presented only one frame after it
  appears, because the app records onset in the next animation frame.
- **Interruptions:** focus loss is real (the window is minimized through the
  DevTools protocol, with Playwright's focus emulation off). A hidden page is
  emulated (`document.hidden` and a `visibilitychange` event), because
  headless Chromium never hides a page.
- **Unchanged application:** nothing in the application was changed for
  testing. There is no test mode, the trial counts are unchanged, and there are
  no shortcuts.
- **Counts:** the counts asserted are those the test itself produced (it
  decides every response). They are not scientific expectations.

**Accessibility checks (axe-core).** axe waits on timers internally, and
session tests pause the fake clock, so the scan is started in the page and
the clock is stepped 5 ms at a time until it finishes (about 10 ms of
simulated time per scan). Each scan first waits for CSS transitions to end,
so colors are measured at rest. Automated checks find only part of all
accessibility problems; no screen reader was used (see below).

**What the privacy check cannot prove.**
- Behavior in other browsers.
- Requests made by browser extensions or by the browser outside the page.
- What a real host logs about ordinary asset requests.

**Known browser and tool limitations (observed in Task 10.4).**
- **Real tab hiding** could not be produced under automation in any browser,
  headless or headed (Playwright's browsers keep pages visible). Hidden
  pages are emulated; real focus loss (a minimized window) is tested in
  Chromium only. Check real tab switching by hand (below).
- **WebKit** never puts links in the Tab order (like Safari's default);
  keyboard access to links is checked in Chromium and Firefox.
- **After a focused control disappears** (Resume, Continue, Stay), Chromium
  and Firefox continue the Tab sequence from where it was; WebKit restarts at
  the top of the page.
- **Tabbing past the first or last control** moves focus into the browser's
  own interface: during a session that is a real loss of page focus, and the
  session pauses as the protocol requires.
- **Firefox:** running axe on the leave confirmation and on the completed
  results crashed the page in every attempt (Playwright's Firefox build on
  Windows). Both work in Firefox (the sessions, dialogs, and export checks
  pass there); those two scans run in Chromium and WebKit only. Re-check on
  Linux CI and with newer Playwright releases.
- **Playwright's WebKit** does not close a page through a
  beforeunload-running close even when nothing objects; the test checks that
  no prompt appears instead.

**Manual checks before release (not automated).**
- **Real tab switching:** in each browser, start a session, switch to
  another tab during a stimulus and come back: the session is paused and
  that trial is invalid (CSV `invalid_reason` `visibility_lost`).
- **Screen reader:** NVDA with Firefox or Chrome, and VoiceOver with Safari:
  the briefing, practice feedback, pause, break, results, dialogs, and
  clearing are announced meaningfully.
- **Zoom:** 200% and 400% browser zoom on the briefing and results.

**Not covered yet.**
- **Timing:** real timing (the clock is simulated).
- **Touch-only devices:** the experiments need a physical keyboard; phone
  and tablet sizes are checked for layout only.
- **Hosting-specific behavior:** the host's deep-link fallback, response
  headers and caching. `vite preview` is not the production host. See
  `docs/HOSTING.md` for the requirements and the verification procedure.

## CI

**Triggers:** pull requests to `main`, pushes to `main`, and manual runs
("Run workflow" in the Actions tab). The workflow has read-only access and no
secrets.

| Job | Blocks a merge? | Runs |
| --- | --- | --- |
| Frontend checks | Yes | `npm ci`, type check, lint, format, Vitest, build |
| Backend checks | Yes | pinned install, ruff, ruff format, mypy, pytest (Python 3.12) |
| Browser tests (chromium, firefox, webkit) | Yes | One job per browser engine, Playwright against the production build; each job's report and traces are uploaded as `playwright-report-<browser>` (kept 7 days). A failure in one engine does not cancel the others |
| Dependency audit | No (reported) | `npm audit --audit-level=high`, `pip-audit` on the pinned requirements. Findings are reviewed, and fixes are separate changes. Needs network access to the advisory databases |

"Blocks a merge" takes effect only once these jobs are made required checks in
the repository's branch protection settings. The browser job names changed in
Task 10.4 ("Browser tests (chromium)", "(firefox)", "(webkit)"): update any
required checks that name the old "Browser tests (Chromium)".

## When something fails

- **Vitest timeout:** the global limit is 20 s (`vite.config.ts`). It exists
  because the full page-run tests are slow under parallel load. Find the slow
  test before raising it.
- **Playwright "Gave up after … ms of simulated time waiting for: …":** the
  screen never reached the expected state. Open the trace:
  `npx playwright show-trace test-results/<test>/trace.zip`. It shows each step,
  screenshot and console message.
- **Playwright cannot start the server:** port 4173 is in use, or the build
  failed. Run `npm run build` on its own to see the error.
- **`npx playwright test` reports a missing browser:** run
  `npx playwright install chromium` again. This is needed after upgrading
  `@playwright/test`.
- **Prettier fails on Windows after a script edited a file:** the line endings
  may have changed to CRLF. Run `npx prettier --write <file>`.
- **The backend install fails in CI but not locally:** a dev tool may have been
  upgraded without updating its pinned dependencies. Regenerate them from
  `pip freeze` (see the comment in `requirements-dev.txt`).
