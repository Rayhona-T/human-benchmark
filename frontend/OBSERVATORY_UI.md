# HUMAN BENCHMARK — Personal Observatory UI (Cycle 9, Task 9.4)

**Status:** complete, awaiting review. This is the MVP: session history,
session detail, deleting one session, and deleting all sessions.
**Not included:** trends, insights, comparisons, export from saved sessions,
accounts and deployment.

Related documents:

- [OBSERVATORY_DATA_LAYER.md](OBSERVATORY_DATA_LAYER.md): the client, the
  adapter and the version policy;
- [docs/PERSONAL_OBSERVATORY.md](../docs/PERSONAL_OBSERVATORY.md): scope and
  display rules;
- [docs/backend/DATA_AND_PRIVACY.md](../docs/backend/DATA_AND_PRIVACY.md) §8:
  the local-owner model.

## 1. Where it lives

| Path                                                                                       | Role                                                                                                 |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `src/app/devFeatures.ts`                                                                   | `observatoryEnabled()`: true only in a dev build with a supported local API address                  |
| `src/app/router.tsx`                                                                       | `/observatory` and `/observatory/sessions/:sessionId`, lazily imported, registered only when enabled |
| `src/components/layout/AppShell.tsx`                                                       | The "Observatory" navigation entry, under the same gate                                              |
| `src/pages/observatory/ObservatoryPage.tsx`                                                | History: filter, pagination, delete one, delete all                                                  |
| `src/pages/observatory/SessionDetailPage.tsx`                                              | One session: identity, limitations, approved results, delete                                         |
| `src/pages/observatory/ConfirmDialog.tsx`, `DeleteSessionDialog.tsx`, `DeleteAllPanel.tsx` | Confirmation and deletion                                                                            |
| `src/pages/observatory/observatoryCopy.tsx`, `observatoryFormat.ts`, `Observatory.css`     | Wording, formatting and styles, using the existing design tokens                                     |
| `src/experiments/shared/localApi.ts`                                                       | The one address rule for saving and the Observatory (§6)                                             |

## 2. Production gating

The Observatory exists only when **both** hold:

- it is a dev-server build (`import.meta.env.DEV`);
- `VITE_HB_LOCAL_SAVE_API` is a supported local address (§6).

The backend must also run with `HB_LOCAL_OWNER_ACCESS=true`. Otherwise the page
explains that access is off and reads nothing.

**How it is removed from production builds:**

- every call site tests `import.meta.env.DEV` literally;
- Vite replaces it with `false` in production;
- the routes are lazy `import()`s inside that dead branch, so the bundler drops
  the routes, the navigation entry, the pages, their CSS and the Observatory
  client.

**Verified on real builds** (Task 9.4):

| Build                                                            | Observatory chunks                                              | "Personal Observatory", `/observatory`, `delete-all-local-sessions`, `observatory-dialog`, `HB_LOCAL_OWNER_ACCESS` in the bundle |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `vite build` (no API configured)                                 | none                                                            | 0 occurrences each                                                                                                               |
| `vite build` with `VITE_HB_LOCAL_SAVE_API=http://127.0.0.1:8000` | none                                                            | 0 occurrences each                                                                                                               |
| Control: `NODE_ENV=development` build, configured                | `ObservatoryPage`, `SessionDetailPage` and `Observatory` chunks | found                                                                                                                            |

The control build shows that the search would find the code if it were there.
The production CSS file is identical to the build before this task (same hash).

## 3. History (`/observatory`)

**What it shows:**

- each saved session's experiment, save time, status, trials stored
  (practice · main) and protocol/configuration version;
- a warning badge for a version this app cannot analyse.

**Save time:**

- shown in the viewer's local time zone, with seconds, so sessions saved
  within the same minute can still be told apart;
- labelled as the time the server **saved** the session, not when it was run;
- the `<time>` element carries the exact UTC value.

**No trial data:**

- only `GET /api/v1/sessions` is called (summaries);
- per-session metrics are not shown in the list, because they would need every
  session's trials;
- results are calculated when a session is opened.

**Controls:**

- **Experiment filter** (All, Stroop, Flanker), kept in the URL as
  `?experiment=`;
- **Pagination:** 20 per page, newest first; "Show older sessions" follows the
  backend cursor. If a later page fails, the rows already shown stay.

**States:**

- loading;
- empty, either with nothing saved, or with nothing matching the filter;
- error, with a "Try again" button;
- access switched off: an explanation of `HB_LOCAL_OWNER_ACCESS`, and no other
  request.

**Responsive:** below 720 px, each session becomes a labelled block. There is no
horizontal page scroll at 390 px (checked in the browser).

## 4. Session detail (`/observatory/sessions/:id`)

**Data:** one `GET /api/v1/sessions/{id}`, then `analyseStoredSession` (Task
9.3). Nothing is recalculated any other way.

**What it shows:**

- the experiment;
- the save time (the server's, not when the session was run);
- protocol and configuration versions;
- trials stored, status and consent notice version;
- the session ID.

**"Before you read these results"**, shown before the results:

- descriptive, not diagnostic;
- the analysis version used at save time was not recorded; the results are
  calculated now with HB-ANALYSIS-1.1;
- sessions are not compared here, and what comparability would need;
- device, browser and screen size are not recorded. For Flanker, the arrows'
  size and spacing also depend on the screen.

**Results:** the existing `SessionResults` component, with the experiment's
approved wording, `exportData` omitted and `saveConfig={null}`. So there is no
CSV export and no save panel, and the metrics and visuals are exactly those of
the original results page.

**Sessions it cannot analyse.** For an unsupported version or malformed data, it
shows the adapter's plain-language reason, "The stored data was not changed",
and the stored identity. No results are shown.

**Other states:**

- not stored;
- not a valid link (no request is sent);
- access switched off;
- error, with "Try again".

**Layout.** The results component is aligned with the page here, a layout-only
CSS override. Its content is unchanged.

## 5. Deletion safety

**All dialogs:**

- a modal (`role="dialog"`, `aria-modal`);
- focus starts on **Cancel**, Tab stays inside, Escape cancels (except while
  deleting), and focus returns to the opener;
- nothing is sent until the danger button is pressed.

**Delete one** (from a history row, or from the detail page):

- The dialog names the experiment, the exact save time and the first 8
  characters of the ID. It also says that CSV files, backups and synced copies
  are not affected.
- **When the server confirms (204):**
  - in the history, the row is removed at once, a confirmation is shown, and
    the list is fetched again to match the server;
  - on the detail page, it returns to the history with the confirmation.
- **When the server no longer has the session (404):** it is reported as such,
  and the list is updated.
- **When the server refuses** (access off, rejected): the dialog says
  "Not deleted … Nothing was deleted."
- **When the outcome is unknown** (no answer, timeout, server error, unreadable
  reply): the dialog says "Deletion not confirmed … not known whether anything
  was deleted", and the page asks the server again.
- **No deletion is ever claimed unless the server confirmed it.**

**Delete all:**

- It has its own section with a red outline, apart from the rows. The section
  says it deletes **every** session in the local database, including any not
  shown by the current filter.
- The dialog needs **delete all sessions** typed exactly. Until then the button
  is disabled.
- The request carries the backend's own body,
  `{"confirm":"delete-all-local-sessions"}`, with no query string.
- After success it reports the counts (or "There was nothing to delete"), and
  the list is fetched again.
- The button is disabled when the unfiltered list is known to be empty.
- Failures are reported in the same way as for one session.

**Nothing is deleted automatically.** The consent-incident session is not
singled out, and its ID is not in the code. The owner deletes it by hand before
any longitudinal use (PERSONAL_OBSERVATORY.md §6).

## 6. One address rule (the IPv6 fix)

**Before:** saving accepted `http://[::1]:…` and `https:` loopback addresses,
which the backend rejects. Its Host allowlist is `localhost` and `127.0.0.1`,
and it serves plain HTTP on 127.0.0.1.

**Now:**

- `parseLocalApiOrigin` (`localApi.ts`) is used by both `readSaveConfig` and
  `readObservatoryConfig`;
- it accepts only `http://127.0.0.1[:port]` and `http://localhost[:port]`, as a
  plain origin;
- `localApi.test.ts` checks both readers against the same accepted and refused
  lists, and compares the hosts with `TRUSTED_HOSTS` in `backend/app/main.py`.

No backend behaviour changed.

## 6a. Trends (`/observatory/trends`, Task 9.5)

The methodology is in docs/PERSONAL_OBSERVATORY.md §4a. This section covers the
UI only.

- **Navigation:**
  - "History | Trends" tabs on the Observatory pages;
  - a Stroop/Flanker switch, kept in the URL as `?experiment=flanker` (Stroop
    by default);
  - the selected experiment is always named. Stroop and Flanker are never
    shown together.
- **"Read this first",** before any chart: self-observation, not assessment;
  practice and familiarity; noise; the analysis-version note; save time, not
  run time.
- **Status:**
  - the number of comparable sessions, and what "comparable" means;
  - warnings when some sessions could not be loaded (with "Try again");
  - a window notice whenever not every saved session was considered. It gives
    the exact counts (read, unsupported, analysed, comparable, older and not
    analysed, replacements), says whether older summaries exist unread, and
    explains numbering and ranges within the window
    (docs/PERSONAL_OBSERVATORY.md §4a).
- **Accuracy values:** in the table and the selected-session panel (one shared
  helper), each response accuracy appears with its key-press count, its
  timeouts and the successful response rate, each on its own line.
- **Fewer than 3 comparable sessions:** a plain explanation (have N, need 3,
  how many more), plus links to each session's own results. No chart.
- **3 or more:**
  - a "Session to inspect" selector, newest by default;
  - two chart sections (median correct RT, response accuracy), each with a
    legend, an explanation, a note on spacing and gaps, and a collapsible table
    of every value with its interval since the previous session;
  - a panel for the selected session: its values, the earlier-session range
    per condition (or why it is not shown), and a link to its full results.
- **Left out:** each excluded session, with its save time, reason and a link.
- **States:**
  - loading, with progress ("Loading saved sessions (3 of 7)");
  - access switched off (one request, then an explanation);
  - errors, with retry.

**Requests and StrictMode.** The page keeps its requests in a cache for its own
lifetime, and the effect does not abort on cleanup. React StrictMode's
development-only second mount therefore reuses the same requests: each summary
page and each session detail is fetched once (tested under `<StrictMode>`, and
checked in the browser). The History and detail pages are unchanged; their
StrictMode duplicate is aborted immediately and is harmless.

**Detail-page 404 (fixed in 9.5).**

- When a detail request returns 404, the page makes one summary request
  (`GET /api/v1/sessions?limit=1`). If that answers 405, local-owner access is
  off and the page says so. Otherwise the session is not stored.
- This reveals nothing new: the list endpoint already shows whether access is
  on, and an unauthorised caller learns nothing about any session.

## 7. Verification

**Automated tests:**

- `observatoryRouting.test.tsx`: gating with no address, `[::1]`, `https`, a
  remote address and a non-dev build, plus the navigation entry and
  summary-only requests;
- `ObservatoryPage.test.tsx`: states, pagination, filtering, the
  unsupported-version badge, access off, delete one (cancel, Escape, success,
  refused, unknown, already gone) and delete all (typed phrase, exact body,
  nothing to delete, failure);
- `SessionDetailPage.test.tsx`: identity, the approved numbers, limitations, no
  export or save, unsupported or malformed sessions, not found, invalid link,
  access off, retry, and delete with and without confirmation from the server.

These tests use an in-memory backend (`fakeBackend.ts`) built from **real
recorded backend replies**.

**Browser check** (Edge, headless). It used a **scratch database** and the real
backend with local-owner access on. It never touched the developer database.

- 23 sessions were seeded through the real API.
- Checked: the navigation entry; the 20-row first page and paging to 23;
  summary-only list requests; the Flanker filter (11 rows); no horizontal
  scroll at 390 px; the detail page with its disclosures and no export.
- One detail request completes. In a development build, React StrictMode starts
  and aborts one extra request; production makes one.
- Deletion from the detail page (22 left), Escape cancelling, deletion from the
  list (21 left), and delete-all with the exact body (0 left).
- The empty state, and the access-off state with only the list request.
- Viewport screenshots of both dialogs, on desktop and mobile.

## 8. Known limitations

- **Not ownership proof.** While local-owner access is on, anyone using this
  computer can view and delete every session (stated on the page).
- **Notice 0.2 is not active.** Its text was updated to match this UI and is
  ready for the owner's activation decision (docs/backend/CONSENT_NOTICES.md).
  Saving still shows 0.1, whose "viewing or deleting … is not available from
  this page yet" no longer tells the whole story.
- **No metrics in the list,** by design: that would need trial data.
- **Save time only.** The time the session was run, the device and the time
  zone are not stored.
- **Ambiguous 404 on detail: resolved in Task 9.5** (§6a).
- **Development double requests.** On History and detail pages, StrictMode
  sends, and immediately aborts, one extra request per page load in
  development builds only. Trends avoids this with its request cache.
