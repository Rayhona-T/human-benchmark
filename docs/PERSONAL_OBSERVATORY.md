# HUMAN BENCHMARK — Personal Observatory Requirements (Cycle 9)

**Status:**
- **Task 9.1** (decisions and documentation): approved.
- **Task 9.2** (backend): approved, with the mypy limitation documented.
  Implemented: the local-owner scope, the Host allowlist, listing, delete-all
  and `secure_delete` ([API.md](backend/API.md)).
- **Task 9.3** (frontend data layer): approved
  ([OBSERVATORY_DATA_LAYER.md](../frontend/OBSERVATORY_DATA_LAYER.md)).
- **Task 9.4** (MVP UI): approved with conditions
  ([OBSERVATORY_UI.md](../frontend/OBSERVATORY_UI.md)).
- **Task 9.5** (trends): complete and **awaiting review**. Trends view at
  `/observatory/trends`, with the methodology in §4a.
- **Owner action still outstanding:** move the database out of OneDrive (O3)
  before saving more sessions.

The Personal Observatory lets the person running HUMAN BENCHMARK on their own
computer look back at sessions they saved. It does not judge them. It shows
what was recorded, says what can and cannot be compared, and makes deletion
easy.

Related documents:
- privacy and ownership: [DATA_AND_PRIVACY.md](backend/DATA_AND_PRIVACY.md) §8;
- notice texts: [CONSENT_NOTICES.md](backend/CONSENT_NOTICES.md);
- moving the database out of OneDrive: [backend/README.md](../backend/README.md), "Database location".

## 1. Approved decisions (Cycle 9, Task 9.1)

| ID | Decision |
| --- | --- |
| O1 | **Local-owner mode.** The person running the local backend owns every session in its database. There is no participant key in the MVP |
| O2 | **Development-only and local-only.** The Observatory exists only under the same gate as saving: a development build, the `VITE_HB_LOCAL_SAVE_API` setting, and a backend on this computer. It is not part of any production build or deployment. *Backend, Task 9.2:* also needs `HB_LOCAL_OWNER_ACCESS=true` with `HB_ENV=development` (off by default) |
| O3 | **The SQLite database moves outside OneDrive** before more sessions are collected. The owner moves it by hand (backend/README.md, "Database location") |
| O4 | **Type-only narrowing of the analysis input** is approved. It is conditional on tests showing identical results for live and stored sessions. No calculation in `HB-ANALYSIS-1.1` changes |
| O5 | **Trends need at least 3 comparable sessions** |
| O6 | **An earlier-session range needs at least 5 comparable earlier sessions** |
| O7 | **Excluded:** trend lines, smoothing, significance tests, confidence intervals, automatic insights, rankings and comparisons across experiments |
| O8 | **MVP scope:** session history, details of one session, and deletion |
| O9 | **Deletion is manual only.** Automatic retention is deferred |
| O10 | **No device tracking is added** |
| O11 | **The incident session is excluded** from any research or analysis. It is marked for deletion once the deletion interface exists (§6) |
| O12 | **A new notice version is needed,** because viewing and deletion become available. It stays explicitly provisional and is not approved for real participants (CONSENT_NOTICES.md) |

## 2. Scope

**MVP (Tasks 9.2–9.4):**
- **History:** a list of saved sessions. Each entry shows the experiment, the date the server saved it, status, protocol and configuration versions, and trial counts.
- **Session detail:** results recalculated in the browser from the stored trials, using the existing approved analysis and visuals. Results are not stored (D8).
- **Deletion:** delete one session, or every session, with a confirmation step.

**After the MVP is reviewed (Task 9.5):** session-by-session trend views within
one experiment, following the rules in §4.

## 3. Task sequence

Each task needs the previous one approved first.

| Task | Content | Acceptance criteria |
| --- | --- | --- |
| **9.1** Decisions and documentation | This document; DATA_AND_PRIVACY.md §8; CONSENT_NOTICES.md; the database-location guide | Decisions recorded; no code or data changed. **Owner action outstanding:** move the database (O3) |
| **9.2** Backend reads and deletion (**complete, awaiting review**) | Host-header allowlist (Starlette `TrustedHostMiddleware`, no new dependency); paginated summary list `GET /api/v1/sessions`; delete-all with an explicit confirmation body; one scope dependency for every Observatory endpoint (local-owner mode now, replaceable later); disabled outside `HB_ENV=development` and off unless `HB_LOCAL_OWNER_ACCESS=true`; delete-all refuses query strings; `PRAGMA secure_delete=ON` for SQLite | Tests for ordering and paging; the list contains no trial data; a wrong `Host` is rejected; delete-all needs its confirmation and cascades; disabled outside development; ruff and mypy clean. *Met, except mypy, which could not run (Smart App Control blocks its `librt` library)* |
| **9.3** Frontend data layer (**complete, awaiting review**) | A read-and-delete client; an adapter from stored sessions to the analysis input; the type-only narrowing (O4) | Identical results for live and stored versions of every contract fixture; the existing test suite passes unchanged; sessions with an unknown protocol or configuration version are refused, with a clear message |
| **9.4** History, detail and deletion UI (**MVP**, **complete, awaiting review**) | `/observatory` and `/observatory/sessions/:id` routes; deletion dialogs. *Notice 0.2 was updated to match but not activated: activation needs the owner's approval (CONSENT_NOTICES.md)* | Real-browser check: the list matches the database; details match the original results for the same session; deletion leaves the database without the session; routes are absent from the production build |
| **9.5** Trends (**complete, awaiting review**) | Per-experiment session series of the metrics already computed (§4a) | §4 rules enforced in code and covered by tests |

## 4. Scientific display safeguards

These are **pragmatic display rules, fixed before any data is viewed**. They are
not validated thresholds. That matches the status of the existing
10-correct-response rule (ANALYSIS_METHODOLOGY.md).

1. **Comparable sessions.** Sessions are compared only when all of these match:
   experiment, `protocol_id` and `protocol_version`, `configuration_id` and
   `configuration_version`, and analysis version. Other sessions are shown as a
   separate, labeled group and never merged silently. Only `complete` sessions
   exist (R3).
2. **Minimum data.**
   - **One session:** the existing rule is unchanged. A condition's median correct
     RT appears only with at least 10 correct responses. Otherwise the value is
     shown as missing, never as zero, and is never filled in.
   - **Trends:** at least 3 comparable sessions (O5). With fewer, only the table
     is shown.
   - **Earlier-session range:** at least 5 comparable *earlier* sessions (O6). The
     range is computed without the session being viewed.
3. **No outlier removal.** No trials are trimmed after the fact (the protocols
   forbid post-hoc RT trimming). Spread uses the existing quartiles: the
   interquartile range, not the standard deviation. Sessions with little data
   are flagged, not hidden.
4. **Averages that do not mislead.**
   - no single "overall RT" made by averaging across conditions;
   - accuracy across sessions is pooled from counts, never by averaging
     percentages with different denominators;
   - no "percent faster", no "best session", and no streaks.
5. **Practice and familiarity.** Each point shows its session number as well as
   its date. The page says that early sessions often get faster with
   familiarity, and does not attribute changes to ability.
6. **Difference scores.** Interference, facilitation and congruency are the least
   reliable individual measures (Hedge et al., 2018, cited in the protocols as
   [S7]). They are shown per session with that caution. They are never the
   subject of a statement that something "changed".
7. **Description, not conclusion** (O7): there are no trend lines, smoothing,
   significance tests, confidence intervals or automatic insights. This applies
   the existing decision against significance tests and confidence intervals on
   single-session results (ANALYSIS_EVIDENCE_REVIEW.md).
8. **One experiment at a time.** Stroop and Flanker are never on the same chart
   or in the same summary. Their "neutral" conditions differ: neutral words in
   Stroop, dashes in Flanker.
9. **Limits stated on the page.**
   - Device and screen size are not recorded (O10), so a difference between
     sessions may come from the device. Flanker geometry depends on the display.
   - `created_at` is the time the server saved the session, not when it was
     run, and no time zone is stored.
   - With 20 main trials per condition, much of the difference between sessions
     is noise.
10. **Version changes.** A stored session whose protocol or configuration
    version the current app does not define is not analyzed with the wrong
    design. It is listed, with a note.

## 4a. Longitudinal methodology (Task 9.5, as implemented)

Code: `frontend/src/experiments/shared/observatory/trends.ts` (pure
calculations), `trendData.ts` (loading), and
`frontend/src/pages/observatory/TrendsPage.tsx` and `TrendChart.tsx` (the
view at `/observatory/trends`).

**Comparable sessions.** A session joins a series only if all of these hold:
- it is from the selected experiment (Stroop **or** Flanker, never both);
- it was stored under the one protocol and configuration version this app
  analyses (`isSupportedVersion`);
- the approved adapter accepts it: complete, and with valid, consistent data;
- it was analysed with the current analysis version, `HB-ANALYSIS-1.1`.

Every other saved session of that experiment is listed under "Saved sessions
left out", with its reason. Sessions of an unsupported version are left out
from their summary alone; their trials are never loaded.

**Analysis-version limitation.** No session records the analysis version used
when it was saved. All sessions in a series are recalculated now with
HB-ANALYSIS-1.1, and the page says so. No historical version is claimed or
inferred. They are comparable in the sense that the **same** approved analysis
is applied to each.

**Order and time:**
- **Numbering:** sessions are numbered 1…n in save order (oldest first; ties
  by session ID, as the backend orders them).
- **Chart spacing:** charts space sessions evenly by number and label each one
  with its number and date. The page states that spacing follows order, not
  date.
- **Gaps:** intervals of 7 days or more are marked with a dashed line and their
  length.
- **Table:** gives the interval since the previous session ("same day", or
  N days).
- **Save time only:** times are server save times, and nothing is inferred
  about when or how a session was run.

**Metrics shown, both taken unchanged from the approved per-session results:**

| Metric | Definition (existing analysis) | Eligibility | Why it is shown | Limits |
| --- | --- | --- | --- | --- |
| Median correct response time, per condition | `ConditionResult.medianCorrectRt`: the median RT of that session's correct main trials in that condition | Only when the condition had at least 10 correct responses with a usable RT; otherwise missing, never 0 | The protocols' primary RT summary; robust to a few extreme responses; same definition in every comparable session | About 20 trials per condition, so a noisy, single-session value; practice effects |
| Response accuracy, per condition | `rates.responseAccuracy`: correct ÷ (correct + incorrect) for that session and condition | Missing when there was no key press in that condition | The protocols' primary accuracy measure | Calculated among responses only, so it can stay high when many trials time out. As the protocols require (§10), every table cell and the selected-session panel show it with its own key-press count, the **timeout count** and the **successful response rate** (`rates.successfulResponseRate`: correct ÷ (correct + incorrect + timeouts)), all unchanged from the approved analysis. The chart plots response accuracy only |

**Considered and left out:**
- **Contrasts** (interference, facilitation, congruency): these are difference
  scores, the least reliable individual measure [S7], and must not be read as
  evidence of change.
- **Successful-response and timeout rates:** omitted to keep the set small.
  They remain on each session's detail page.
- **RT spread (quartiles):** too much for a session-by-session view.
- **Any pooled or overall figure across sessions:** see the rule below.

**Aggregation:**
- There is none. No mean or median of medians, no pooled RT, and no pooled
  accuracy.
- Each mark is one session's own value. Each accuracy value keeps its own
  numerator and denominator.

**Thresholds** (O5, O6, and the existing 10-correct rule):
- **3 comparable sessions** before any chart appears. Below that, the page says
  how many exist, how many are needed, and links to each session on its own.
- **Earlier-session range:**
  - It needs at least **5 earlier comparable sessions with a value** for that
    condition and metric.
  - The selected session is never part of its own reference, so the first range
    can appear at session 6.
  - Earlier sessions without a value are skipped, not counted as 0.
- **Median RT** only with at least 10 correct responses in that condition.

**Earlier-session range: definition:**
- The **lowest and highest** value among those earlier sessions, for one
  condition and metric.
- The selected session's own value is then described as within the range, lower
  than every earlier session, or higher than every earlier session. Ends of the
  range count as within.
- The selected session defaults to the newest, and any session can be chosen.

**Why this range, and why only descriptively:**
- Lowest-to-highest is the simplest honest summary of a handful of values. It
  uses no distributional assumption, no interval estimate, no test and no
  percentage.
- It describes the user's **own earlier sessions**, and the page says it is not
  a normal or expected range. A value outside it is not, by itself, a
  meaningful change.
- Quartile or SD bands were rejected: with 5–10 noisy values they would suggest
  more precision than exists.

**Charts:**
- one mark per session and condition, each condition with its own colour (the
  validated categorical palette) **and** its own shape;
- no connecting lines, trend line, smoothing, band or forecast;
- value axes always span the full scale (0–2,000 ms, 0–100 %);
- missing values are left out and listed in the description and the table;
- every value is also in a table, and a session can be selected with a
  labelled selector as well as by clicking its column.

**Loading, the analysed window, and privacy:**
- **Requests:** only the existing local API.
- **Selection, in order:**
  1. read up to **200 summaries** of the experiment, newest first (server order:
     save time, then session ID);
  2. keep those stored under the version this app analyses;
  3. load and analyse the **60 newest** of them, 4 at a time;
  4. if any of those turn out invalid or cannot be loaded, load the next older
     ones in their place, up to **10 extra loads** in total.

  With no invalid sessions, at most 60 details are loaded, as before. The
  analysed window is always the newest contiguous run of supported-version
  sessions among those read.
- **What the page says when the window does not cover everything** (some
  summaries were not read, or supported sessions are older than the window):
  - how many summaries were read;
  - whether older ones exist that were not read (their number is unknown and
    is not guessed);
  - how many of those read are of an unsupported version;
  - how many were analysed, and how many are comparable;
  - how many older supported sessions were read but not analysed;
  - how many replacements were used;
  - that session 1 is the oldest session in the window;
  - that earlier-session ranges use only earlier sessions inside the window.

  The heading then reads "N comparable … sessions in the analysed window".
- **Known limit:** if more than 200 newer sessions exist, older ones are not
  read. The page says so; it never claims that the window holds the newest
  supported sessions overall.
- **No duplicates:** requests are cached for the page's lifetime, so React
  StrictMode's double effect in development sends nothing twice.
- **No new storage:** nothing is stored, exported or sent anywhere else.

**Not done, by design:**
- significance tests, p-values, confidence intervals, effect sizes;
- trend lines, smoothing, forecasts;
- percentage change, "faster/slower" or "improved/declined" wording;
- rankings, best sessions, streaks;
- insights or interpretations, diagnostic labels;
- cross-experiment views;
- export.

**Incident session.** It is not singled out in code. If it is still stored, it
is analysed like any other comparable session. Delete it by hand before using
Trends on personal data (§6).

## 5. Deferred or excluded features

| Feature | Status |
| --- | --- |
| Trend views | Task 9.5, only after the MVP is approved |
| Automatic insights or written interpretations | Deferred beyond Cycle 9. A later proposal would need its own scientific review |
| Trend lines, smoothing, significance tests, confidence intervals | Excluded (O7) |
| Rankings, leaderboards, norms, percentiles, "best session" | Excluded (ROADMAP Phase 8) |
| Comparisons across experiments | Excluded (O7) |
| Participant key or any other ownership proof | Deferred. Required before any deployment (BACKEND_ARCHITECTURE.md §9) |
| CSV export from stored sessions | Deferred. The approved CSV export is unchanged |
| Automatic retention or purge (R6) | Deferred (O9) |
| Device, screen, browser or time-zone tracking | Not added (O10, D1) |
| Saving incomplete sessions | Not changed. Only `complete` sessions are saved (R3) |
| Cross-device use, accounts, deployment, PostgreSQL in use | Out of scope |
| Diagnoses, IQ claims, trait claims, predictions | Never (PROJECT_VISION.md, ROADMAP Phase 8) |

## 6. Incident session

| Session ID | Experiment | Server save time (UTC) | Notice |
| --- | --- | --- | --- |
| `8a90268339ef4a7a9d779632b92070fa` | Flanker | 2026-11-22 20:29:01 | `HB-NOTICE-0.1-PROVISIONAL` |

The participant reported saving this session without ticking the consent box
(the Cycle 8 consent incident; see the incident section of
frontend/PERSISTENCE_INTEGRATION.md). Its stored `consent.confirmed` is
therefore not trusted.

- **Excluded** from every research use, analysis and future trend calculation.
- **To delete** through the Observatory once Task 9.4 is approved. The app
  does not single it out (its ID is not in the code); the owner deletes it by
  hand and must do so before any longitudinal use of personal sessions. It has not
  been deleted, so that it stays available as incident evidence until then.
  The Task 9.2 delete endpoints could remove it already, but the decision
  says to use the deletion interface. It was not deleted during 9.2.
- The database file has been inside a OneDrive-synced folder. Copies of this
  session may therefore also exist in OneDrive and its version history, which
  deleting the session through the Observatory will not remove (DATA_AND_PRIVACY.md §8.4).

On 2026-11-23, a read-only check of the development database found two further
sessions, both saved after the incident and under the same notice:
`7e0ead27…` (Flanker) and `95330736…` (Stroop). They are not part of the incident.
