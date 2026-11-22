# HUMAN BENCHMARK — Persistence Data and Privacy Policy (Cycle 8, Task 1)

**Status:**
- **Decisions D1–D8** are implemented by the backend foundation.
- **Recommendations R1–R7** are for Cycle 8 Task 3 and need project-owner
  approval.
- **No participant data is collected yet.** The frontend does not call the
  backend.

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
5. **Participant control.** Participants can delete their data, and deletion is
   real.

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

## 4. Pseudonymous participant identifier (design for Task 3; not implemented)

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

## 5. Consent and notice (recommendations for Task 3)

- **R1, opt-in per session.**
  - After results are shown, offer "Save this session" with a short notice (what
    is stored, why, how long, how to delete).
  - The default is *not saved*. Results and CSV export keep working without
    saving.
- **R2, versioned notices.**
  - Each notice text gets an ID (for example `HB-NOTICE-1.0`). The server accepts
    only IDs on an explicit allowlist in `backend/app/consent.py` (exact,
    case-sensitive match). Anything else is rejected with 422 and nothing is
    stored. *Implemented.*
  - The only listed ID today is **`HB-NOTICE-0.1-PROVISIONAL`**. It is a
    placeholder for local development and tests, marked
    `approved_for_participant_data=False`. **No notice text exists yet, and this
    ID is not approved for collecting real participant data.** Task 3 writes the
    notice, gives it a new ID, and lists it after your approval.
  - Changing the notice text means a new ID.
- **R3, which statuses can be saved.** Recommend offering saving for `complete`
  and `incomplete` sessions only. `interrupted` sessions (page closed) cannot be
  saved in practice. `technical_error` sessions have little value to the
  participant. The API accepts all four statuses so the decision stays in the
  UI.
- **R4, age and audience.** The intended audience is adults. Any research use or
  recruitment needs separate consent and oversight (protocols, REQUIREMENTS
  §Risks). Persistence must not be presented as research participation.

## 6. Retention and deletion

- **R5, deletion by the participant.** In the UI: "Delete this session" and
  "Delete all my saved data" (a participant-level cascade). Both are hard
  deletes, and the UI should confirm them. The UI must say that copies already
  downloaded as CSV are outside the platform's control (FR-PRI-03).
- **R6, maximum retention.** Recommend a fixed maximum, for example **12 months**
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
  deletes their sessions and trials), verified by tests.

## 7. Open questions for the project owner

1. Approve R1–R7, or adjust them, especially the retention period (R6) and
   saveable statuses (R3).
2. Approve the participant-key design in §4, or choose sessions with no linking
   at all. That would mean Cycle 9 could show only the current browser's sessions.
3. The deployment host and jurisdiction, which affect notice wording and backup
   handling.
