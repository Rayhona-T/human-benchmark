# HUMAN BENCHMARK — Observatory Data Layer (Cycle 9, Task 9.3)

**Status:**

- **Approved** (Task 9.3).
- The pages that use it are Task 9.4 ([OBSERVATORY_UI.md](OBSERVATORY_UI.md)).
  They are loaded only in development builds, so neither the pages nor this
  data layer are in the production bundle (verified on the built bundle).
- Task 9.4 added `experimentName` and `isSupportedVersion` (summary fields
  only) to `storedSession.ts`, and moved the address rule to the shared
  `../localApi.ts`.

Code: `src/experiments/shared/observatory/`.

| File                                       | Role                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `observatoryClient.ts`                     | Configuration gate, requests (list, detail, delete one, delete all) and strict reply validation |
| `storedSession.ts`                         | Adapter: stored session → input for the approved analysis, with the version policy              |
| `__fixtures__/*-stored-{detail,list}.json` | **Real backend replies**, recorded by `scripts/generate_observatory_fixtures.py`                |
| `*.test.ts(x)`                             | Client, adapter, and live-versus-stored equivalence tests                                       |

Related: [docs/PERSONAL_OBSERVATORY.md](../docs/PERSONAL_OBSERVATORY.md),
[docs/backend/API.md](../docs/backend/API.md),
[ANALYSIS_METHODOLOGY.md](ANALYSIS_METHODOLOGY.md).

## 1. Data flow

```text
local backend (SQLite)
  │ GET /api/v1/sessions             -> parseSessionPage    -> StoredSessionSummary[] (no trial data)
  │ GET /api/v1/sessions/{id}        -> parseSessionDetail  -> StoredSessionDetail (as stored)
  ▼
storedSession.adaptStoredSession     identity, version and consistency checks; refuse, never repair
  ▼
StoredTrialRecord[]                  each stored value unchanged, in the engine's field names
  ▼
computeStroopResults / computeFlankerResults   the approved HB-ANALYSIS-1.1, unchanged
  ▼
results, labelled "calculated now with HB-ANALYSIS-1.1"
```

## 2. Client behaviour (`observatoryClient.ts`)

**Gate (fail closed). Nothing is sent unless all of these hold:**

1. **Dev-server build:** `import.meta.env.DEV`, re-checked on every call. A
   production build never sends these requests, even with a configuration.
2. **Valid configuration:** `readObservatoryConfig` reuses the saving opt-in
   (`VITE_HB_LOCAL_SAVE_API`), but accepts only a plain `http://` origin whose
   host the backend trusts: `127.0.0.1` or `localhost`.
   - The configuration is re-validated on every call. A missing, remote or
     malformed address gives `not_configured`, with no request.
3. **Local inputs are valid:**
   - session IDs are lowercase UUIDs;
   - `limit` is an integer from 1 to 100;
   - a cursor is at most 128 URL-safe characters;
   - the experiment is `stroop` or `flanker`;
   - delete-all requires the exact phrase `delete-all-local-sessions`.

   Anything else gives `rejected`, with no request.

**The backend still decides.** Without `HB_LOCAL_OWNER_ACCESS=true`, its 405
(route absent) or 403 `local_owner_access_disabled` becomes `access_disabled`.
The client never works around it.

**Requests:**

- `credentials: "omit"`, `referrerPolicy: "no-referrer"`, `cache: "no-store"`,
  `redirect: "error"`;
- a 10 s timeout, and an optional abort signal that reports `cancelled`, not
  `timeout`.

**Reply validation is strict:**

- Every field is type-checked, and **unknown or missing fields are rejected**.
  A summary that carried trial data, a seed or any other extra field is refused
  (`unexpected`), not passed on.
- A detail reply for a different session ID is refused.
- A list reply with entries outside the requested experiment, or more entries
  than the requested page size, is refused.
- Server text is never surfaced.

**Outcomes:**

- **Success:** `ok`, `deleted`.
- **Session missing:** `not_found`. With access off, the detail route is also
  absent, so a detail 404 cannot tell "no such session" from "access off". The
  UI should list sessions first.
- **Gate or input:** `not_configured`, `access_disabled`, `rejected`.
- **Transport:** `unavailable`, `timeout`, `cancelled`.
- **Server or contract:** `server_error`, `unexpected`.

## 3. Adapter validation and compatibility policy (`storedSession.ts`)

A stored session is analysed **only** if all of these hold:

| Check                                                                                                                                                                                                                                                                                                     | Refusal code                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| The reply has exactly the backend's detail shape and types                                                                                                                                                                                                                                                | `invalid_format`                   |
| It is the requested session and experiment (when given)                                                                                                                                                                                                                                                   | `identity_mismatch`                |
| The experiment is `stroop` or `flanker`                                                                                                                                                                                                                                                                   | `unknown_experiment`               |
| `data_schema_version` is 1                                                                                                                                                                                                                                                                                | `unsupported_schema`               |
| The protocol and configuration do not belong to the other experiment                                                                                                                                                                                                                                      | `identity_mismatch`                |
| Protocol ID and version, and configuration ID and version, equal exactly those this app runs (`STROOP_CONFIGURATION`, `FLANKER_CONFIGURATION`: `HB-STROOP-1.0`/`1.0`, `HB-FLANKER-1.0`/`1.0`)                                                                                                             | `unsupported_version`              |
| `status` is `complete`                                                                                                                                                                                                                                                                                    | `not_complete`                     |
| The trials are 12 practice then 60 main, numbered 1..N in order. Each has a known condition, mapped keys, consistent outcome, key and RT, an invalid reason exactly for invalid trials, an RT of at least 0 and below the deadline, no negative timestamps, and a break duration when the break was taken | `malformed` (every problem listed) |

**Rules:**

- **Exactly one supported version per experiment.** A session from any other
  protocol or configuration version is listed by the client but **not
  analysed**, because the analysis definition (conditions, planned counts, the
  RT display minimum) belongs to one design. Supporting a future version means
  adding it deliberately, with its own equivalence tests.
- **No defaults, no repair.** Nothing is filled in, sorted, rounded or inferred.
  - A correct or incorrect trial without an RT is refused, because the backend
    never stores one.
  - Missing RTs are accepted only where the protocol has none: timeouts and
    invalid trials.
- **Faithful.** Stored values pass through unchanged, including the stimulus,
  keys, all six timestamps and the randomization record. They are also the
  values the CSV export uses.
- **Messages.** Each refusal has a plain-language `message` for the
  participant, plus exact `details` for developers, which are never shown as
  they are.

## 4. Analysis version: not stored

The backend stores no analysis results and no analysis version (D8). The
results page's version at save time is therefore unknown.

- **The adapter does not claim it.** `analysisVersion` is
  `{ recordedAtSave: null, appliedNow: "HB-ANALYSIS-1.1", note }`, and the UI
  must show the note: _"The analysis version used when this session was saved
  was not recorded. These results are calculated now from the stored trials
  with HB-ANALYSIS-1.1."_
- **This is the stated policy, not a guess about the past.** Sessions are
  recomputed with the current approved analysis.
- **If the analysis version changes later,** stored sessions will be recomputed
  with the new version, which is labelled the same way. They are never presented
  as the numbers originally shown.

## 5. Why analysis runs in the browser

- **One source of truth.** The approved TypeScript analysis that produced the
  original results page is reused unchanged. Porting it to Python would create a
  second implementation that could drift.
- **The approved design.** Results are never stored (D8), so there are no
  derived values to keep consistent or delete.
- **Cheap.** About 72 trials per session.
- **Verifiable.** The equivalence tests below prove the stored path gives
  identical results.

## 6. Analysis input narrowing (type-only)

`SessionResultsInput.records` is now `readonly AnalysableTrial[]` (in
`sessionAnalysis.ts`). It holds only the fields the analysis reads: `phase`,
`trialIndex`, `condition`, `outcome` and `timing.reactionTimeMs`.

- **The previous type** was the full engine `TrialRecord`.
- **Engine records satisfy the new type unchanged.** No call site changed, and
  no formula, threshold, rule, condition or contrast changed (the diff is
  type-only).
- **Records are analysed in the order given.** The adapter therefore requires
  the backend's order: practice first, then by index.

## 7. Equivalence tests

For all four save-contract fixtures, live results and stored results must be
**strictly deep-equal**. That covers every count, rate, median, quartile,
contrast and trial-series entry.

| Fixture                                                               | Live side                                                                                                                                                                                             | Stored side                                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `stroop-save-payload.json`, `flanker-save-payload.json`               | Records from the real schedule generators (`buildTestRecords`). They must rebuild the committed fixture exactly                                                                                       | The same payload saved and read back by the **real backend** (`*-stored-detail.json`) |
| `stroop-engine-save-payload.json`, `flanker-engine-save-payload.json` | A full session run through the **real page**. The analysis functions are wrapped, not replaced, to capture the page's own records and results. The records must rebuild the committed fixture exactly | The same, from the real backend                                                       |

**Also tested:**

- invalid formats and missing fields;
- unknown experiments, unsupported schema and versions, identity contradictions;
- incomplete statuses;
- 18 kinds of inconsistent session or trial data;
- missing RTs where they are permitted;
- too few correct responses: the median is `unavailable`, never 0;
- the input is not mutated.

**Mutation check:** reversing the record order, or relabelling invalid trials as
timeouts, makes the equivalence tests fail (6 and 5 failures).

**Regenerating the recorded replies.** Do this after a backend contract change:

```text
backend/.venv/Scripts/python scripts/generate_observatory_fixtures.py
```

- Each payload is saved into a **temporary** database through the real backend
  (local-owner access on), and the real replies are written.
- The developer database is never touched.
- The files are excluded from Prettier so that they stay exactly as recorded.

## 8. Known limitations

- **No analysis version at save time** (§4).
- **Save time, not run time.** `created_at` is when the server saved the
  session. No time zone or device is stored (O10).
- **One supported version per experiment.** Old versions are refused, never
  approximated.
- **Session IDs.** A detail 404 alone cannot tell an unknown session from
  access being off (§2). Since Task 9.5, the detail page asks the list
  endpoint once to tell them apart (OBSERVATORY_UI.md §6a).
- **Trends (Task 9.5)** builds on this layer without changing it:
  `trends.ts` selects and orders comparable sessions and reads values from the
  approved results, and `trendData.ts` loads summaries and details through this
  client (docs/PERSONAL_OBSERVATORY.md §4a).
- **Resolved in Task 9.4: one address rule.** Saving and the Observatory now
  share `src/experiments/shared/localApi.ts`: only `http://127.0.0.1[:port]`
  and `http://localhost[:port]`. `[::1]` and `https:` are refused by both,
  matching the backend, and a test compares the list with the backend's
  `TRUSTED_HOSTS`.
- **Not ownership proof.** Local-owner access lets anyone on this computer read
  and delete every session while it is on (DATA_AND_PRIVACY.md §8.1).
- **The incident session** (`8a902683…`) is analysable like any other, because
  its stored data is valid. It is excluded from research and analysis **by
  decision, not by code** (PERSONAL_OBSERVATORY.md §6), and is marked for
  deletion by hand in the Observatory. It must be deleted before any trend
  (Task 9.5) or other longitudinal use of personal sessions.
