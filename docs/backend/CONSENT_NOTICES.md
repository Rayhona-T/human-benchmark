# HUMAN BENCHMARK — Consent Notice Register

Every save notice has an ID. Changing its text means a new ID (DATA_AND_PRIVACY.md
§5, R2). This register keeps each text so that a stored `consent_notice_version`
can always be traced to the words shown.

**No notice here is approved for real participant data.** Both are provisional
and for local development and testing only.

| ID | Status | Accepted by the backend? | Shown by the frontend? |
| --- | --- | --- | --- |
| `HB-NOTICE-0.1-PROVISIONAL` | Provisional, in use. Not approved | Yes (`backend/app/consent.py`) | Yes (`saveConfig.ts`, `SaveSessionPanel.tsx`) |
| `HB-NOTICE-0.2-PROVISIONAL` | **Draft (Cycle 9; text updated in Task 9.4 to match the built Observatory).** Not active. Not approved | No | No |

## Activation rule for `HB-NOTICE-0.2-PROVISIONAL`

The 0.2 text describes the Observatory (viewing and deletion). It may be listed
and shown **only** when all of these hold:
1. Tasks 9.2–9.4 are implemented and verified.
2. Each statement below has been checked against what the code actually does,
   and corrected under a new ID if it no longer matches.
3. The project owner approves the activation. That approval is for local testing
   only, not for real participant data.

**Status after Task 9.4:**
- **Conditions 1 and 2 are met.** The Observatory UI exists. Each statement in
  the draft was checked against the code and the browser verification
  (frontend/OBSERVATORY_UI.md), and the "Viewing and deleting" and "Who can see"
  paragraphs were corrected to match: the development version only, local-owner
  access on, results recalculated, a typed confirmation for delete-all.
- **Condition 3 is not met.** No activation has been approved, so 0.2 is still
  not listed or shown. Saving still uses 0.1.

**Known gap while 0.1 is in use.** The 0.1 panel text says "Viewing or deleting
a saved session is not available from this page yet". That remains literally
true of the results page, but it no longer tells the whole story: the separate
Observatory page can now view and delete sessions. Changing the shown text needs
a new ID (R2), which is exactly what activating 0.2 does.

When it is activated:
- the frontend sends the new ID;
- the backend adds it with `approved_for_participant_data=False`;
- stored sessions keep the ID they were saved with. Sessions saved under 0.1 keep
  `HB-NOTICE-0.1-PROVISIONAL`.

Whether the backend should then stop accepting 0.1 for new saves is an open
decision (DATA_AND_PRIVACY.md §7).

## `HB-NOTICE-0.1-PROVISIONAL` (as shown at commit `a68b3b4`)

This is a summary of the panel text in `SaveSessionPanel.tsx`. That source file is
authoritative.

- **Warning:** the notice is a provisional draft, with no approval and no ethics or
  research approval. Save only your own test sessions.
- **Saved:** the experiment and protocol version, and that the session was complete;
  the seed and planned trial order; for every practice and main trial, the
  condition and what was shown, the key pressed (or none), correctness, response
  time and the browser's timestamps; whether the break was taken, and its length;
  the notice version, and the time the server stored the session.
- **Not stored:** no name, email, account or password; no calculated results; no
  browser or device details, and no cookies; not the page's internal session ID
  (a new random save ID only prevents duplicates); no IP address (and none in the
  request log, when started with the documented command).
- **Where and how long:** only to the test server at the configured address on
  this computer. There is no automatic deletion; the session stays until the
  person running the server deletes it.
- **Viewing and deletion:** "Viewing or deleting a saved session is not available
  from this page yet, because there is no safe way to prove the session is yours."

Known discrepancy: the docstring in `backend/app/consent.py` says "no notice text
exists yet", but the panel shows the draft text above. That is a code comment,
so it is left for a later code task.

## `HB-NOTICE-0.2-PROVISIONAL` (draft)

The changes from 0.1 are in the sections on where it goes, viewing and deletion,
and who can see it. The "Saved" and "Not stored" lists are unchanged, because
Cycle 9 adds no stored fields (O10).

> **This is a development test, not a study.**
> This notice (version `HB-NOTICE-0.2-PROVISIONAL`) is a provisional draft. It has
> not been approved, and there is no ethics or research approval. Save only your
> own test sessions.
>
> **What would be saved**
> - Which experiment and protocol version this was, and that the session was
>   complete.
> - The trial order: the random seed and the planned sequence of trials.
> - For every practice and main trial: its condition and what was shown, the key
>   you pressed (or none), whether it was correct, your response time, and the
>   browser's timestamps for the trial.
> - Whether you took the break, and how long it lasted.
> - The notice version you agreed to, and the time the server stored the session.
>
> **What is not stored**
> - No name, email, account or password. None is asked for.
> - None of the results calculated on this page. When you view a saved session
>   later, its results are calculated again from the stored trials.
> - No browser or device details. Like any web request, your browser
>   automatically sends standard information such as its name, version and
>   preferred language. The test server does not store or log it. No cookies are
>   sent.
> - This page's internal session ID is not sent. A new random save ID is created
>   only so that the same session cannot be stored twice.
> - Your IP address is not stored with the session. When the test server is
>   started with its documented command, its request log does not record it
>   either.
>
> **Where it goes, and for how long**
> Only to the test server at `<configured address>`, which this page accepts only
> when it is on this computer. The server keeps the session in a database file
> on this computer. There is no automatic deletion: the session stays until it
> is deleted.
>
> **Viewing and deleting**
> On this computer, the Personal Observatory page lists every session stored in
> this test server's database. It is available only in the development version
> of HUMAN BENCHMARK, and only while the test server runs with local-owner access
> switched on. It can show any saved session, with its results calculated again
> from the stored trials. It can delete one session, or, after you type a
> confirmation, all of them. Deletion cannot be undone.
>
> **Who can see and delete it**
> There is no account and no proof that a session is yours. While the test
> server runs with local-owner access switched on, anyone who can use a browser
> on this computer can view and delete **every** saved session, including
> sessions saved by someone else. Programs on this computer can do the same.
>
> **What deletion does not reach**
> Deleting removes the session and its trials from the test server's database.
> It does not remove:
> - CSV files you downloaded;
> - copies of the database file made by backups, or by cloud sync such as
>   OneDrive, including their version history and recycle bins;
> - traces the operating system or disk may keep.
>
> Keep the database file in a folder that is not synced or backed up if you do
> not want such copies.
>
> **Consent checkbox:** "I have read this provisional notice, and I agree to save
> this session to the local test server."

### Notes for the reviewer

- **"Anyone who can use a browser on this computer"** holds only with the Host
  allowlist. Without it, a website the person visits could also try to reach
  the local server (DNS rebinding, DATA_AND_PRIVACY.md §8.3).
  - *Task 9.2 status:* the allowlist is implemented, tested and checked live.
    If it is ever removed, this text is wrong and must not be activated.
  - The statement also assumes `HB_LOCAL_OWNER_ACCESS=true`. With it off,
    nobody can view or delete through the API.
- **"Programs on this computer"** is stated deliberately. The local API has no
  authentication.
- **No claim of secure erasure.** `PRAGMA secure_delete` (implemented in 9.2) reduces
  leftovers inside the database file. It cannot reach backups, synced copies or
  the disk itself, so the text promises only removal from the database.
