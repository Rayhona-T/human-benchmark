# HUMAN BENCHMARK — Persistence Data and Privacy Policy (Cycle 8, Task 1)

**Status (Cycle 8 Tasks 3+4, awaiting review):**
- **Decisions D1–D8** are implemented by the backend foundation.
- **Implemented in Task 3:**
  - R1 (opt-in per session);
  - R2 (notice allowlist);
  - R3, narrowed to complete sessions only.
- **R4–R7 remain recommendations.** In particular, no participant-facing
  deletion and no retention limit exist yet.
- **No approved collection.** Saving exists only as a local development and
  test flow (frontend/PERSISTENCE_INTEGRATION.md), under the **provisional,
  unapproved** notice `HB-NOTICE-0.1-PROVISIONAL`. It must not be used for real
  participants.
- **Cycle 9 decisions (Task 9.1, approved).** These cover the local-owner
  ownership model, deletion and retention, the OneDrive risk, and a draft notice
  `HB-NOTICE-0.2-PROVISIONAL`. They are in §8 and
  [CONSENT_NOTICES.md](CONSENT_NOTICES.md).
- **Cycle 9 Task 9.2 (backend, approved).** Implemented: the local-owner
  scope, development-only and off unless `HB_LOCAL_OWNER_ACCESS=true`; the Host
  allowlist; listing; delete-all; `secure_delete`.
- **Cycle 9 Task 9.4 (Observatory UI, awaiting review).** In a development
  build with a local test backend configured, the Observatory page lists,
  shows and deletes saved sessions (one, or all after a typed confirmation).
  It is absent from production builds (verified on the built bundle).
  - Notice 0.2 is still not active (CONSENT_NOTICES.md).

This document is a project design document, not legal advice. Before real
participants' data is stored, it needs a privacy review appropriate to the
deployment (REQUIREMENTS.md NFR-PRI-01 and FR-PRI-04; ROADMAP Phase 7 exit
criteria).

## 1. Principles

1. **Purpose limitation.** Data is stored only so that participants can see their
   own sessions again (Cycle 9) and so that a session can be reproduced and
   interpreted. It is not used for marketing, profiling, ranking or diagnosis.
2. **Minimization.** A field is stored only if it is needed to interpret,
   reproduce or show a session.
3. **Opt-in.** Nothing is saved unless the participant chooses to save it after a
   notice (R1).
4. **Pseudonymous at most.** There are no accounts and no direct identifiers.
5. **Participant control (met only locally, for development).**
   Participants should be able to delete their data, and deletion should be
   real (a hard delete).
   - **Since Task 9.4,** the person running the local test server can view and
     delete saved sessions in the Observatory page of a development build,
     while local-owner access is on (§8). This is a local-owner tool, not
     participant control with ownership proof.
   - There is no deletion in production builds, and none for anyone without
     access to this computer.
   - Participant-level ownership proof (§4) is still required before any
     deployment.

## 2. What exists in a session today (verified in `frontend/src/engine/contracts.ts`)

| Engine field | Stored? | Reason |
| --- | --- | --- |
| `identity` (experiment, protocol, configuration IDs and versions) | **Yes** | Needed to interpret every value |
| `sessionId` (browser-generated) | **No** | Replaced by a server UUID. Its fallback is guessable |
| `status` | **Yes** | Complete and incomplete sessions are analysed differently |
| `lifecycleState` | No | Redundant with `status` |
| `practiceTrialCount`, `mainTrialCount` (counts *presented*) | No | Derived from stored trials, so they cannot disagree |
| `breakTaken`, `breakDurationMs` | **Yes** | Part of the protocol's session record |
| `randomization.seed`, PRNG ID, version, generation status | **Yes** | Reproducibility (protocols §7 / §8) |
| `randomization.realizedPracticeOrder` and `realizedMainOrder` | **Yes** (compact) | Protocols require the realized order; also used to check each trial |
| `randomization.allocationDetails` | **Yes** (bounded JSON) | Needed to reproduce Stroop's derangement and Flanker's base order |
| Per-trial `experiment`, `sessionId`, `randomization` copies | No | Repeats session-level data |
| `trialId` | No | Derived from seed and index |
| `phase`, `trialIndex`, `condition`, `correctResponse` | **Yes** | Core trial identity |
| `stimulus` | **Yes**, task-relevant attributes only | Stroop: `word`, `ink_color`. Flanker: `target_direction`, `flanker_type`, `symbols`. Fonts and colors are fixed by the protocol ID |
| `response.value` | **Yes** (`response_key`) | Core measure |
| `response.inputSource`, `accepted`, `rejectionReason` | No | Constant or always `true` for stored responses |
| `outcome` and invalid reason | **Yes** | Core measure |
| `timing.reactionTimeMs` | **Yes** | Core measure |
| `timing` fixation, onset, response, deadline, stimulus offset, ITI end | **Yes** | The same six timestamps as the approved CSV export, for checking timing |
| `timing.trialEndMs`, `trialDurationMs`, `timingSource` | No | Not exported or analysed; can be derived or are constant |

## 3. Decisions implemented now (D1–D8)

| ID | Decision | How it is enforced |
| --- | --- | --- |
| D1 | **No direct identifiers.** No name, email, phone, password, precise location, IP address, user agent, screen size, locale or time zone in the schema | No such columns. `extra="forbid"` rejects unknown request fields (tested with `email`) |
| D2 | **Anonymous sessions.** The API takes no participant ID; `participant_id` stays NULL | No endpoint creates participants; the request schema has no such field |
| D3 | **Server-generated session IDs.** The client UUID is only a duplicate guard | UUIDv4 primary key; unique `client_session_id` |
| D4 | **Server save time only.** No client clock or time zone | `created_at` is set by the server in UTC |
| D5 | **A save requires a recorded consent affirmation** | `consent.confirmed` must be `true`, and `notice_version` must be on the server allowlist (`app/consent.py`; currently only the provisional `HB-NOTICE-0.1-PROVISIONAL`). The version is stored |
| D6 | **No IPs or payloads in logs** | Uvicorn access log off. The app logs method, route template, status and time. Database errors hide parameters. Error details never echo input |
| D7 | **Hard deletion** | `DELETE` removes the session; `ON DELETE CASCADE` removes its trials (tested) |
| D8 | **No derived results stored** | No result columns exist |

The seed is not personal data. It is a random number that only reproduces trial
order.

Even without identifiers, session data is **behavioral data**, and RT patterns are
not treated as harmless. Pseudonymous data can still be personal data under laws
such as the GDPR when it can be linked to a person. That is why R1–R7 exist.

## 4. Pseudonymous participant identifier (deferred beyond the Cycle 9 MVP; not implemented)

Task 3 decision: single-session saving does not need a participant key, so
none was created. Every saved session has `participant_id` NULL and cannot be
linked to a person later.

Cycle 9 decision (O1): the MVP uses local-owner mode (§8) instead of a key. The
design below stays the recommended ownership proof **before any deployment**
(BACKEND_ARCHITECTURE.md §9).

Cycle 9 needs to group one person's sessions without an account.

**Recommended:**
- On the first opt-in save, the server creates a `participants` row and returns a
  random **participant key** once. The key is at least 128 bits, from
  `secrets.token_urlsafe`.
- The browser keeps the key in `localStorage`.
- The server stores only a **hash** of the key (a new `key_hash` column in a later
  migration). A database leak then does not reveal working keys.
- Reading or deleting a participant's sessions requires the key (an
  `Authorization` header).
- Losing the key, or clearing browser data, means losing access. The UI must
  explain this.
- An export of the key lets participants move it between devices if they choose.

**Rejected:**
- **Account or email login:** it collects identifiers the project doesn't need.
- **IP- or fingerprint-based linking:** covert and inaccurate.
- **Using the participant UUID itself as the secret:** a leaked database would
  then expose every key.

## 5. Consent and notice

- **R1, opt-in per session.** *Implemented (development flow).*
  - After results are shown, an optional "Save this session" panel gives the
    notice: what is stored, what is not, where it goes, how long it stays, and
    that viewing and deletion are not available yet.
  - Nothing is sent without a ticked agreement and an explicit Save. The
    default is *not saved*. Results and CSV export keep working without
    saving.
- **R2, versioned notices.**
  - Each notice text gets an ID (for example `HB-NOTICE-1.0`). The server accepts
    only IDs on an explicit allowlist in `backend/app/consent.py` (exact,
    case-sensitive match). Anything else is rejected with 422 and nothing is
    stored. *Implemented.*
  - The only listed ID today is **`HB-NOTICE-0.1-PROVISIONAL`**. It is a
    placeholder for local development and tests, marked
    `approved_for_participant_data=False`. **No notice text exists yet, and this
    ID is not approved for collecting real participant data.** The development
    panel shows its draft text, labeled provisional. Approved text needs a new
    ID, listed only after your approval.
  - Changing the notice text means a new ID.
  - **Cycle 9:** the 0.1 text says viewing and deletion are not available, so
    the Observatory needs a new ID. **`HB-NOTICE-0.2-PROVISIONAL`** is drafted
    in [CONSENT_NOTICES.md](CONSENT_NOTICES.md). It is still provisional, not
    approved for real participants, and **not active**: neither the backend nor
    the frontend lists it. It may be activated only under the conditions in
    that file.
- **R3, which statuses can be saved.** *Implemented, narrowed:* only
  `complete` sessions, the engine's own completion status. The frontend does not
  offer saving for any other status, and the backend rejects them (422 at
  `status`). Widening this to `incomplete` would be a later, explicit decision.
  The backend's structural rules for incomplete sessions remain, ready for it.
- **R4, age and audience.** The intended audience is adults. Any research use or
  recruitment needs separate consent and oversight (protocols, REQUIREMENTS
  §Risks). Persistence must not be presented as research participation.

## 6. Retention and deletion

- **R5, deletion by the participant.** *Not implemented.* The page offers no
  viewing or deletion, because session IDs are not authorization credentials,
  and it says so. Planned for when ownership proof exists (§4): "Delete this
  session" and
  "Delete all my saved data" (a participant-level cascade). Both are hard
  deletes, and the UI should confirm them. The UI must say that copies already
  downloaded as CSV are outside the platform's control (FR-PRI-03).
  - **Cycle 9 decision:** for local development, R5 is met by the **local
    owner** deleting through the Observatory (§8.2), not by a participant with
    ownership proof. This is manual deletion only. The participant version
    above still applies before any deployment.
  - **Status after Task 9.4:** the local owner can delete one session, or all
    of them after a typed confirmation, in the development Observatory page.
    R5 is met **locally, for the local owner only**; the participant version
    above is still required before any deployment.
- **R6, maximum retention.** **Cycle 9 decision (O9): deferred.** No automatic
  retention or purge will be built in Cycle 9; sessions stay until they are
  deleted by hand. The recommendation below stays open for a later cycle and
  remains required before release. Recommend a fixed maximum, for example **12 months**
  after `created_at`, enforced by a scheduled purge that deletes expired
  sessions with the same cascade.
  - Inactive participant rows with no sessions are purged too.
  - The exact period is a **project-owner decision** and must appear in the
    notice before release.
  - Backups must expire on the same schedule or the deletion promise is not
    met.
- **R7, operator access.** Only the project owner has database access. There is
  no export or sharing of stored data for research without a separate, approved
  protocol.

**Implemented now:**
- hard deletion of one session, with cascade, verified by tests;
- participant-level cascade at the database level (deleting a participant row
  deletes their sessions and trials), verified by tests;
- *(Cycle 9 Task 9.2)* delete-all, with an exact confirmation body, in one
  transaction, through the same database cascade. Verified by tests;
- *(Cycle 9 Task 9.2)* `PRAGMA secure_delete=ON` on every SQLite connection (§8.2);
- all deletion endpoints are local-owner scope only: development, explicit
  opt-in, not ownership proof (§8.1). **No UI offers deletion yet.**

## 7. Open questions for the project owner

1. Approve R1–R7, or adjust them, especially the retention period (R6) and
   saveable statuses (R3). *(Cycle 9: R5 is met locally by the local owner
   deleting by hand (§8.2); the R6 period is deferred.)*
2. Approve the participant-key design in §4, or choose sessions with no linking
   at all. That would mean Cycle 9 could show only the current browser's sessions.
   *(Cycle 9: local-owner mode for the MVP. Open again before deployment.)*
3. The deployment host and jurisdiction, which affect notice wording and backup
   handling.
4. *(Cycle 9.)* Once `HB-NOTICE-0.2-PROVISIONAL` is activated, should the
   backend stop accepting `HB-NOTICE-0.1-PROVISIONAL` for **new** saves? Stored
   sessions keep their recorded ID either way.
5. *(Cycle 9.)* What should happen to the old OneDrive copy of the database once
   the move is verified (§8.4)?

## 8. Cycle 9: Personal Observatory, local-owner model

Decided in Cycle 9 Task 9.1. The tasks that implement it are listed in
[PERSONAL_OBSERVATORY.md](../PERSONAL_OBSERVATORY.md).

**Implementation status:**
- **The backend side is implemented** (Task 9.2, awaiting review): the scope,
  the Host allowlist, listing, delete-all and `secure_delete`. The endpoints are
  documented in [API.md](API.md).
- **The Observatory UI is implemented** (Task 9.4, awaiting review;
  frontend/OBSERVATORY_UI.md).
- **Not implemented:** notice 0.2 (drafted, not active). Saving still uses
  notice 0.1.

### 8.1 Ownership model (O1, O2)

- **Local-owner mode.** Whoever runs the local backend owns every session in its
  database. The Observatory lists, shows and deletes **all** of them. It cannot
  tell whose a session is.
- **This is not ownership proof.**
  - There is no participant key, account or authentication.
  - Anyone who can use a browser on this computer while the backend runs can see
    and delete everything, and so can any local program.
  - The model is acceptable only because the backend binds to `127.0.0.1`, runs
    with `HB_ENV=development`, and holds only the owner's own test sessions.
- **Development-only.** The Observatory follows the same gate as saving: a
  development build, `VITE_HB_LOCAL_SAVE_API`, and a loopback address. It is
  absent from production builds.
  - **Backend (implemented in 9.2):** the four endpoints that read or delete
    stored sessions exist only when `HB_ENV=development` **and**
    `HB_LOCAL_OWNER_ACCESS=true`.
  - The opt-in defaults to **off**. Because `HB_ENV` itself defaults to
    `development`, a missing configuration must not be enough to enable
    access, so both are required.
  - Otherwise the routes are not registered, and a per-request check answers
    403 if the live settings stop allowing it (`app/scope.py`).
- **Replaceable.** Every read and delete endpoint, and every store query behind
  it, goes through one scope (`OwnerScope` in `app/scope.py`). A participant key
  (§4) can replace local-owner mode before any deployment without changing the
  endpoints.
- **Sessions saved under 0.1.** Their notice said viewing and deletion were not
  available. In local-owner mode they become viewable and deletable by the
  owner. All are the owner's own test sessions, so this is acceptable for local
  testing. It would not be acceptable for real participants.

### 8.2 Deletion and retention (O9)

- **Manual deletion only:** delete one session, or delete all, each confirmed,
  both hard deletes using the existing cascade (D7).
  - The backend endpoints exist (Task 9.2). Delete-all requires the exact body
    `{"confirm": "delete-all-local-sessions"}` and refuses any query string.
  - The UI (Task 9.4) confirms each deletion in a dialog that names the
    session. Delete-all also needs the phrase "delete all sessions" typed; the
    request then carries the backend's exact confirmation body.
- **No automatic retention.** Sessions remain until deleted by hand. R6 stays an
  open requirement before release.
- **What deletion reaches:** only rows in the configured database. It does **not**
  reach:
  - downloaded CSVs;
  - backups;
  - synced copies, such as OneDrive and its version history and recycle bins;
  - traces the disk keeps. On SSDs, overwriting does not guarantee erasure.
- **`PRAGMA secure_delete=ON`** (implemented in 9.2).
  - **Where:** every SQLite connection, both the app and migrations, through
    one connection hook (`configure_sqlite_connection` in `app/database.py`).
  - **What it does:** SQLite overwrites deleted rows and freed pages with zeros
    **inside the database file**. A test checks that a deleted session's IDs no
    longer appear anywhere in the file. A control test shows they do remain
    when the setting is off.
  - **What it does not do:**
    - It does not reach anything outside the file: CSVs, backups, OneDrive
      copies and their history.
    - It does not reach rollback-journal files. SQLite deletes these after each
      write, and their old content can remain on the disk.
    - It does not clean data deleted **before** it was turned on. Whether the
      current development database holds such leftovers has not been checked.
      `VACUUM` would rebuild the file, but it is not run automatically.
    - It does not stop the operating system, the SSD or filesystem snapshots
      from keeping old blocks.
  - **It is not forensic erasure,** and must not be described as such.
  - **PostgreSQL** has no equivalent. Deleted rows stay in the table files until
    `VACUUM` reuses the space.
- **The incident session** (`8a90268339ef4a7a9d779632b92070fa`, saved without
  confirmed consent during the Cycle 8 consent incident) is **excluded from
  research and analysis**. It is **marked for deletion** through the Observatory
  once Task 9.4 is verified (PERSONAL_OBSERVATORY.md §6). It is not deleted now.

### 8.3 Local-only limitations and threats

| Threat | Today | Planned mitigation | Residual risk |
| --- | --- | --- | --- |
| Other people or programs on the same computer | Can call `GET` and `DELETE` by ID if they know an ID | None in local-owner mode; stated in the 0.2 notice | Accepted, for local testing only |
| A website using **DNS rebinding** (a page whose domain resolves to `127.0.0.1`) | **Implemented (9.2):** Host allowlist (`localhost`, `127.0.0.1`, any port), Starlette `TrustedHostMiddleware`. Tested, and checked live against Uvicorn | — | Low |
| Cross-origin requests from other sites | CORS allows only the two local origins, with no credentials | Unchanged | Low. CORS does not stop "simple" requests whose replies are never read. `DELETE` is never a simple method, so a cross-site page must send a preflight first, and CORS refuses that for other origins. Delete-all also refuses `text/plain` and form-encoded bodies (tested) |
| Accidental delete-all | **Implemented (9.2, 9.4):** an exact confirmation body is required and any query string is refused; the UI also requires a typed phrase in a separate dialog | — | Low |
| Local-owner endpoints left on by mistake | **Implemented (9.2):** off by default; needs `HB_LOCAL_OWNER_ACCESS=true` and `HB_ENV=development`; re-checked per request | — | Anyone on this computer can use them while they are on |
| Database file synced to the cloud | **Likely today** (§8.4) | The owner moves the file (O3) | Copies made before the move remain |
| Copies outside the database | CSV downloads, backups | Stated in the notice | Outside the platform's control |

### 8.4 OneDrive risk (O3)

Facts:
- The repository is under the OneDrive user folder (`C:\Users\<user>\OneDrive\Desktop\…`).
- Desktop under OneDrive means OneDrive's folder backup (Known Folder Move) is on
  for Desktop.
- The default database path is `backend/human_benchmark.db` (`app/config.py`),
  so the database is in that synced folder.
- On 2026-11-23 it held 3 sessions, the incident session among them.

Not verified: whether OneDrive has actually uploaded the file. Treat it as
uploaded.

Consequences:
- Copies of the database may exist on Microsoft's servers, in OneDrive **version
  history**, in the OneDrive **recycle bin** once deleted, and on other devices
  signed in to the same account.
- **Deleting a session in the app, or deleting the local file, does not remove
  those copies.** Do not assume deletion from OneDrive removes historical
  versions. Check them in the OneDrive web interface (version history, and the
  recycle bin with its second stage) against Microsoft's current documentation.
- "Local-only" is therefore **not true today** for this database. It becomes true
  for new data only after the move.

Decision: the owner moves the database outside OneDrive **before collecting
further sessions**. The procedure, including backups, is in
[backend/README.md](../../backend/README.md), "Database location". The move has
not been done; the assistant does not move or delete databases.

### 8.5 Not added in Cycle 9

- no device, screen, browser or time-zone fields (O10, D1);
- no participant key, cookies or browser storage for identity;
- no stored results (D8);
- no new stored fields of any kind. The 0.2 notice's "What would be saved" list
  is the same as 0.1.
