# HUMAN BENCHMARK — API Reference (v1: Cycle 8 saving, Cycle 9 local-owner access)

- **Base URL (local):** `http://127.0.0.1:8000/api/v1`
- **Interactive documentation:** `http://127.0.0.1:8000/docs` (generated from the
  code, so it always matches)
- **Status:** local development and test only.
  - **The only frontend caller is `POST /sessions`**, from the optional save
    panel on a complete session's results page. That panel exists only in a
    dev-server build configured with a loopback address
    (frontend/PERSISTENCE_INTEGRATION.md).
  - The consent notice accepted today (`HB-NOTICE-0.1-PROVISIONAL`) is
    **provisional and not approved** for real participant data.

## Access model

| Endpoint | Available |
| --- | --- |
| `GET /health`, `POST /sessions` | Always (local server) |
| `GET /sessions`, `DELETE /sessions`, `GET /sessions/{id}`, `DELETE /sessions/{id}` | **Only** when `HB_ENV=development` **and** `HB_LOCAL_OWNER_ACCESS=true` (local-owner scope) |

- **Local-owner scope** is "every session in this database". It is **not
  ownership proof**: anyone who can reach the server on this computer can read
  and delete everything (DATA_AND_PRIVACY.md §8.1).
- **Fail closed.** `HB_LOCAL_OWNER_ACCESS` defaults to off. When the scope is
  not enabled, these four routes are not registered at all: `GET` and `DELETE
  /sessions` answer **405**, and `/sessions/{id}` answers **404**.
- **Second check.** Every one of them depends on one scope function
  (`app/scope.py`). It re-reads the live settings and answers **403
  `local_owner_access_disabled`** if they no longer allow it. That check runs
  before the path or body is validated.
- **Caller:** the development-only Observatory UI (Task 9.4,
  frontend/OBSERVATORY_UI.md), through the validated client of Task 9.3.

## Host header (all endpoints)

Every request must carry a `Host` of `localhost` or `127.0.0.1`, on any port and
in any letter case. Anything else gets **400** with the plain-text body
`Invalid host header`, before routing, CORS or validation.

This is Starlette's built-in `TrustedHostMiddleware`, with `www_redirect` off. It
blocks **DNS rebinding**: a hostile page whose own domain has been re-pointed to
`127.0.0.1` still sends its own name as `Host`.

Rejected, among others (each tested):
- other names: `evil.example`, `127.0.0.1.nip.io`, `localhost.evil.example`,
  `sub.localhost`;
- the trailing-dot form `localhost.`;
- other loopback addresses (`127.0.0.2`, `[::1]`), and `0.0.0.0`;
- malformed ports (`localhost:abc`);
- user-info tricks (`localhost@evil.example`);
- an empty or missing `Host`.

Checked live against Uvicorn on 2026-11-23, with raw HTTP requests on a scratch
database. Everything above behaved as described. A missing `Host`, and two `Host`
headers in either order, were refused by Uvicorn's HTTP parser before reaching
the app.

The rejection body is plain text, not the JSON error envelope, because it comes
from the built-in middleware.

## Conventions

- **Format:** JSON in UTF-8, with `Content-Type: application/json`. Field names
  are snake_case, matching the CSV export.
- **Versioning:**
  - the URL prefix `/api/v1` is bumped only for breaking changes;
  - the request body carries `data_schema_version` (currently `1`), which is
    stored with every session.
- **Unknown fields are rejected** (422), not ignored.
- **No coercion:** `"12"` is not `12`, and `1` is not `true`.
- **Numbers must be finite** (`NaN` and `Infinity` are rejected).
- **Times:**
  - `*_ms` fields are milliseconds;
  - trial timestamps are the browser's `performance.now()` values relative to
    page load, as in the CSV export;
  - `created_at` is the server's UTC time of saving (ISO 8601 with `Z`).
- **Body size:** at most 256 KiB by default (`HB_MAX_REQUEST_BYTES`). A complete
  session is about 50 KB.

## Errors

Every error uses one envelope:

```json
{
  "error": {
    "code": "invalid_session",
    "message": "The session breaks protocol or consistency rules. See details.",
    "details": [
      { "location": "trials[3].reaction_time_ms", "message": "must equal response timestamp minus stimulus onset" }
    ]
  }
}
```

- `details` lists every problem found, up to 50, each with a `location` (a
  path into the request body) and a `message`.
- Submitted values are **never** echoed in errors.
- `500` errors contain no stack trace.

| HTTP | `code` | Meaning |
| --- | --- | --- |
| 400 | (plain text `Invalid host header`) | Untrusted or malformed `Host` (see above) |
| 403 | `local_owner_access_disabled` | Local-owner scope not enabled on this server |
| 404 | `not_found` | Unknown session ID or route |
| 405 | `method_not_allowed` | Method not supported on that route |
| 409 | `duplicate_session` | This `client_session_id` is already stored |
| 413 | `payload_too_large` | Body over the size limit |
| 422 | `invalid_request` | Malformed JSON, wrong type, unknown or missing field, out-of-range value, invalid query parameter or cursor |
| 422 | `invalid_session` | Well-formed, but breaks a protocol or consistency rule |
| 500 | `internal_error` | Unexpected server error |
| 503 | (health body) | Database unreachable or not migrated |

---

## `GET /api/v1/health`

Reports whether the process is up, the database is reachable, and the schema is
at the latest migration.

**200**

```json
{ "status": "ok", "api_version": "v1", "database": "ok" }
```

**503**: `database` is `"unreachable"` or `"schema_not_current"`, and `status` is
`"unavailable"`. If you see `schema_not_current`, run `python -m alembic upgrade
head`.

---

## `POST /api/v1/sessions`

Stores one session and all of its trials in **one transaction**: either
everything is stored, or nothing is. The server generates the session ID.

### Request body

```json
{
  "data_schema_version": 1,
  "client_session_id": "0f8b8f4e-3b7a-4c55-9a6e-5d2c1b0a9f01",
  "consent": { "confirmed": true, "notice_version": "HB-NOTICE-0.1-PROVISIONAL" },
  "experiment_id": "flanker",
  "protocol_id": "HB-FLANKER-1.0",
  "protocol_version": "1.0",
  "configuration_id": "HB-FLANKER-1.0",
  "configuration_version": "1.0",
  "status": "complete",
  "break_taken": true,
  "break_duration_ms": 15000.5,
  "randomization": {
    "seed": 123456789,
    "prng_id": "HB-FLANKER-shuffle-v1",
    "randomization_version": "1",
    "schedule_generation_status": "generated",
    "allocation_details": { "practiceSeedUnsigned32": 2654435769, "baseItemOrder": ["congruent-left"] },
    "practice_order": [
      { "trial_index": 1, "condition": "congruent",
        "stimulus": { "target_direction": "left", "flanker_type": "left", "symbols": "←←←←←" },
        "correct_response": "f" }
    ],
    "main_order": [ "… 60 entries, same shape …" ]
  },
  "trials": [
    {
      "phase": "practice",
      "trial_index": 1,
      "condition": "congruent",
      "stimulus": { "target_direction": "left", "flanker_type": "left", "symbols": "←←←←←" },
      "correct_response": "f",
      "response_key": "f",
      "outcome": "correct",
      "invalid_reason": null,
      "reaction_time_ms": 407.25,
      "timing": {
        "fixation_onset_ms": 1000.0,
        "stimulus_onset_ms": 1500.0,
        "response_timestamp_ms": 1907.25,
        "deadline_ms": 3500.0,
        "stimulus_offset_ms": 1917.25,
        "iti_end_ms": 2417.25
      }
    }
  ]
}
```

### Fields

| Field | Type | Rules |
| --- | --- | --- |
| `data_schema_version` | int | Must be `1` |
| `client_session_id` | UUID string | Version-4 (random) UUID, for example from `crypto.randomUUID()`. Used only to refuse duplicate saves. Never returned |
| `consent.confirmed` | bool | Must be `true` |
| `consent.notice_version` | string | The ID of the notice shown. It must be on the server allowlist (`app/consent.py`, exact case-sensitive match), otherwise 422 `invalid_session` at `consent.notice_version`. Currently only `HB-NOTICE-0.1-PROVISIONAL`: **a provisional placeholder for development and tests, not approved for real participant data** |
| `experiment_id` | string | `stroop` or `flanker` |
| `protocol_id`, `protocol_version`, `configuration_id`, `configuration_version` | string | Must be the approved values for the experiment: `HB-STROOP-1.0` / `1.0`, or `HB-FLANKER-1.0` / `1.0` |
| `status` | string | One of `complete`, `incomplete`, `interrupted` or `technical_error`, but **only `complete` can be saved** (Cycle 8 Task 3 policy). Any other value is rejected with 422 `invalid_session` at `status` |
| `break_taken` | bool | If `true`, `break_duration_ms` is required |
| `break_duration_ms` | number or null | ≥ 0. Allowed only after at least 30 main trials (the break is offered after trial 30) |
| `randomization.seed` | int or null | 0 … 4,294,967,295. Required when the schedule was generated |
| `randomization.prng_id`, `randomization_version` | string or null | Approved values: `HB-STROOP-shuffle-v1` or `HB-FLANKER-shuffle-v1`; `1` |
| `randomization.schedule_generation_status` | string | `not_started`, `generated` or `failed`. Without `generated`, both orders and `trials` must be empty |
| `randomization.allocation_details` | object or null | At most 16 keys. Values are integers, strings of up to 64 characters, or lists of up to 64 of them; at most 2,048 characters as JSON |
| `randomization.practice_order` / `main_order` | list | When generated: exactly 12 / 60 entries, indexed 1..N in order, with condition counts 4/4/4 and 20/20/20 |
| `trials[]` | list | At most 500 entries; rules below |

**Stimulus by experiment.** Extra keys are rejected.
- **Stroop:** `{ "word": RED|BLUE|GREEN|YELLOW|BOOK|CHAIR|HOUSE|TABLE|MUSIC, "ink_color": red|blue|green|yellow }`.
  - congruent means the word names its ink color;
  - incongruent means a different color word;
  - neutral means a neutral word.
  - Correct key: D = red, F = blue, J = green, K = yellow.
- **Flanker:** `{ "target_direction": left|right, "flanker_type": left|right|neutral, "symbols": "<5 symbols>" }`.
  - `symbols` must be exactly the two flankers, the target, then two flankers
    (`←` U+2190, `→` U+2192, `—` U+2014).
  - Condition comes from `flanker_type`: the same direction as the target is
    congruent, the opposite direction is incongruent, and neutral is neutral.
  - Correct key: F = left, J = right.

**Trial rules:**
- **Identity:** `(phase, trial_index)` is unique. Each phase's indices are 1..k
  with no gaps. Main trials require all 12 practice trials. `complete` requires
  12 + 60 trials.
- **Schedule match:** each trial equals its planned entry (condition, stimulus,
  correct key).
- **Outcome rules:**

  | `outcome` | `response_key` | `reaction_time_ms` | `response_timestamp_ms` | `invalid_reason` |
  | --- | --- | --- | --- | --- |
  | `correct` | required; equals `correct_response` | required | required | null |
  | `incorrect` | required; a different mapped key | required | required | null |
  | `timeout` | null | null | null | null |
  | `invalid` | null | null | null | required: `focus_lost`, `visibility_lost`, `presentation_failed`, `input_failed`, `timing_error`, `deadline_unavailable`, `interrupt` or `protocol_error` |

- **Timing:**
  - RT is at least 0 and below 2,000 ms, and equals response minus stimulus
    onset (±0.001 ms);
  - `deadline_ms` equals onset + 2,000;
  - fixation ≤ onset ≤ response < deadline;
  - onset ≤ stimulus offset ≤ ITI end;
  - correct, incorrect and timeout trials need an onset and a deadline;
  - every timestamp is between 0 and 10⁹.

### Responses

**201 Created**

```json
{
  "session_id": "0a86e32e-fe7e-4026-b44f-8087457442b1",
  "experiment_id": "flanker",
  "status": "complete",
  "created_at": "2026-11-22T14:52:47.667816Z",
  "trials_stored": { "practice": 12, "main": 60 }
}
```

Errors: 409, 413 and 422, as above.

---

## `GET /api/v1/sessions` (local-owner scope)

Lists stored sessions as **summaries**, newest first.

**Query parameters.** Unknown parameters are rejected (422).

| Name | Type | Default | Rule |
| --- | --- | --- | --- |
| `experiment_id` | `stroop` or `flanker` | all | exact, lowercase |
| `limit` | integer | `20` | 1 to 100 |
| `cursor` | string | none | exactly a `next_cursor` from an earlier response (at most 128 characters) |

**Order.** By `created_at` descending, then `session_id` descending. The order is
total, so sessions that share a timestamp are neither repeated nor skipped
across pages.

**Pagination** uses keyset cursors.
- `next_cursor` is `null` on the last page.
- The cursor is opaque: it encodes the last entry's `created_at` and
  `session_id`. It is not signed. A crafted cursor can only pick a different
  page inside the same scope.
- A cursor stays usable even if its session has since been deleted.
- An invalid cursor gets 422 with location `query.cursor`.

**200 OK:**
```json
{
  "sessions": [
    {
      "session_id": "…",
      "data_schema_version": 1,
      "experiment_id": "flanker",
      "protocol_id": "…",
      "protocol_version": "…",
      "configuration_id": "…",
      "configuration_version": "…",
      "status": "complete",
      "consent_notice_version": "HB-NOTICE-0.1-PROVISIONAL",
      "created_at": "2026-11-22T20:29:01.201217Z",
      "trial_counts": { "practice": 12, "main": 60 }
    }
  ],
  "next_cursor": null
}
```

- **Not in a summary, by design:** trials, stimuli, responses, reaction times,
  the schedule, seed and allocation details, break data, `client_session_id`,
  `participant_id`. Use `GET /sessions/{id}` for a session's data.
- **No analysis version:** results are not stored (D8). The frontend recomputes
  them with its own analysis version.

Errors: 403, 422.

## `DELETE /api/v1/sessions` (local-owner scope): delete all

**Permanently deletes every session in scope**, and through the database cascade
all of their trials, in one transaction. There is no undo.

The body must be **exactly**:
```json
{ "confirm": "delete-all-local-sessions" }
```
- It must be JSON (`Content-Type: application/json`).
- The value is exact and case-sensitive.
- Extra fields are rejected.
- **Any query string is rejected** (422, location `query`). There is no filtered
  delete, and ignoring `?experiment_id=` would delete more than was asked.

Anything else gets 422 `invalid_request`, and nothing is deleted.

**200 OK** (also when nothing was stored):
```json
{ "deleted_sessions": 3, "deleted_trials": 216 }
```

Participant rows are not deleted. None are created today, and they hold no
session data.

Errors: 403, 413, 422.

## `GET /api/v1/sessions/{session_id}` (local-owner scope)

Returns the stored session. The body has the request's fields (without
`client_session_id` and `consent`), plus:
- `session_id`;
- `consent_notice_version`;
- `created_at`.

Trials are ordered practice first, then by index.

Errors: 403, 404 for an unknown ID, 422 for a malformed UUID.

## `DELETE /api/v1/sessions/{session_id}` (local-owner scope)

**Permanently deletes** the session and, through the database cascade, all of its
trials. There is no undo and no soft delete.

**204 No Content.** Errors: 403, 404, 422.

### Deletion and SQLite

Every SQLite connection sets `PRAGMA secure_delete=ON`, so deleted rows are
overwritten with zeros inside the database file (tested). That is **not**
guaranteed erasure. Copies outside the file are not reached
(DATA_AND_PRIVACY.md §8.2).

---

## Not provided (deliberately)

- **Ownership proof** (participant key or account). The local-owner scope above
  is the only scope, and it is development-only. Ownership proof is required
  before any deployment (BACKEND_ARCHITECTURE.md §9).
- **Search, other sort orders, or filtered deletion.**
- **Participant endpoints** (deferred to Cycle 9; DATA_AND_PRIVACY.md §4).
- **Updates (`PUT`/`PATCH`).** Stored sessions are immutable records; a
  correction is a delete plus a new save.
- **Analysis or summary endpoints.** Results stay in the frontend's
  `HB-ANALYSIS-1.1`.
