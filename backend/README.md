# HUMAN BENCHMARK — Backend (Cycle 8 saving, Cycle 9 local-owner access)

This is a standalone FastAPI service that can store **complete** Stroop and
Flanker sessions. It runs locally only.

> **Before saving any more sessions, move the database out of OneDrive.** The
> default file, `backend/human_benchmark.db`, is inside a OneDrive-synced folder
> on the development machine. Follow "Database location" below. The steps copy
> the file and never delete it.

Since Cycle 8 Task 3, the frontend can call it from an optional, opt-in save
panel. That panel exists only in a dev-server build configured with
`VITE_HB_LOCAL_SAVE_API`, and shows a **provisional, unapproved** notice. See
[frontend/PERSISTENCE_INTEGRATION.md](../frontend/PERSISTENCE_INTEGRATION.md).
It is a development and test flow, not approved data collection.

Design documents:
- [BACKEND_ARCHITECTURE.md](../docs/backend/BACKEND_ARCHITECTURE.md);
- [DATA_AND_PRIVACY.md](../docs/backend/DATA_AND_PRIVACY.md);
- [API.md](../docs/backend/API.md);
- [ADR-001](../docs/decisions/ADR-001-backend-stack.md).

## Prerequisites

Python 3.12 or later. It was developed and tested with Python 3.14.6 on Windows
11. Nothing else is needed: SQLite is built into Python.

All commands below run **from the `backend/` folder**, in PowerShell or Git Bash.
They call tools as `python -m <tool>` on purpose (see "Windows note").

## First-time setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m alembic upgrade head      # creates backend/human_benchmark.db
```

In Git Bash, write `./.venv/Scripts/python` instead of `.\.venv\Scripts\python`.

## Run the API

```powershell
.\.venv\Scripts\python -m app
```

- **API:** http://127.0.0.1:8000/api/v1/health should return `{"status":"ok", …}`.
- **Interactive docs:** http://127.0.0.1:8000/docs. You can send requests from the
  browser. An example payload comes from
  `python -c "import json; from tests.factories import session_payload; print(json.dumps(session_payload()))"`.
- Stop the server with `Ctrl+C`.

`python -m app` binds to `127.0.0.1` and turns off Uvicorn's access log, because
that log records client IP addresses. The app's own log records only method,
route template, status and duration.

**Host header.** Requests must use `localhost` or `127.0.0.1` as the host, on
any port. Any other `Host` gets `400 Invalid host header`, which blocks DNS
rebinding. Use `http://127.0.0.1:8000` or `http://localhost:8000`.

### Local-owner access (list, read and delete sessions)

These endpoints are **off by default**:
- `GET /api/v1/sessions`
- `DELETE /api/v1/sessions`
- `GET /api/v1/sessions/{id}`
- `DELETE /api/v1/sessions/{id}`

To turn them on in one PowerShell window (the setting lasts until that window is closed):

```powershell
$env:HB_LOCAL_OWNER_ACCESS = "true"; .\.venv\Scripts\python -m app
```

- **Persistent:** set `HB_LOCAL_OWNER_ACCESS=true` in `backend/.env` (edit it in
  VS Code; see "Moving the existing database safely", step 5).
- **While they are on:** anyone using this computer can list, read and delete
  every saved session. Turn them off when you are not using them.
- **While they are off:** saving still works. The list and delete-all routes
  answer 405, and the per-session routes answer 404.
- **Details:** docs/backend/API.md.

## Configuration

Settings come from environment variables prefixed `HB_`, or from `backend/.env`.
Copy `.env.example` to `.env`; `.env` is git-ignored.

| Variable | Default | Notes |
| --- | --- | --- |
| `HB_ENV` | `development` | Only `development` or `test`. Any other value stops start-up, because deployment is not supported yet |
| `HB_LOCAL_OWNER_ACCESS` | `false` | `true` turns on the endpoints that **list, read and delete** stored sessions (Cycle 9 local-owner scope). Effective only with `HB_ENV=development`. Not ownership proof: anyone on this computer can then read and delete every session. Values that are not booleans stop start-up |
| `HB_DATABASE_URL` | `sqlite:///<backend>/human_benchmark.db` | `sqlite:///…` or `postgresql…`. In-memory SQLite is refused. PostgreSQL needs a driver that isn't installed yet |
| `HB_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Explicit origins only; `*` is refused |
| `HB_MAX_REQUEST_BYTES` | `262144` | 1 KiB to 2 MiB |
| `HB_HOST`, `HB_PORT` | `127.0.0.1`, `8000` | |
| `HB_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING` or `ERROR` |

There are no secrets in this foundation. Never commit `.env` or any `*.db` file;
both are git-ignored.

## Database and migrations

| Task | Command |
| --- | --- |
| Create or upgrade the schema | `python -m alembic upgrade head` |
| Show the current revision | `python -m alembic current` |
| Undo everything (deletes all tables and data) | `python -m alembic downgrade base` |
| Preview PostgreSQL SQL without a server | `$env:HB_DATABASE_URL="postgresql://x/y"; python -m alembic upgrade head --sql` |
| New migration after a model change | `python -m alembic revision --autogenerate -m "describe change"`, then **review it by hand** |

(These use the virtualenv's Python, for example `.\.venv\Scripts\python -m alembic upgrade head`.)

The app never creates tables by itself. If `/api/v1/health` reports
`schema_not_current`, run the upgrade.

To start over locally, stop the server, delete the database file
(`backend/human_benchmark.db`, or the file set in `HB_DATABASE_URL`), and run the
upgrade again.

## Database location (keep it out of OneDrive)

**Why:**
- The default database, `backend/human_benchmark.db`, sits inside the repository.
- On the development machine the repository is under a OneDrive-synced Desktop,
  so OneDrive can upload the database and keep old versions of it.
- That breaks "local-only" (docs/backend/DATA_AND_PRIVACY.md §8.4).
- Cycle 9 decision O3: move the database outside OneDrive **before saving any
  more sessions**.

**Recommended location:**
- **Path:** `%LOCALAPPDATA%\HumanBenchmark\human_benchmark.db`, which is usually
  `C:\Users\<username>\AppData\Local\HumanBenchmark\human_benchmark.db`. OneDrive
  folder backup covers Desktop, Documents and Pictures, not `AppData\Local`.
- **Check this yourself:**
  - in OneDrive settings, under "Manage back up", that only those folders are
    backed up;
  - that no other backup tool (File History, or a third-party tool) includes
    `AppData`.

**Configuration:**
```text
HB_DATABASE_URL=sqlite:///C:/Users/<username>/AppData/Local/HumanBenchmark/human_benchmark.db
```
- Three slashes, then the drive letter, then forward slashes throughout.
- Write the full path literally. `%LOCALAPPDATA%` is **not** expanded in
  `.env`.
- Print your own value with `$env:LOCALAPPDATA` in PowerShell.

### Moving the existing database safely

Run these steps from `backend/`, in PowerShell. They only **copy** the database;
nothing is deleted.

1. **Stop everything that uses the database.** Stop the API with `Ctrl+C`, and
   close any database viewer. Then check that no journal file is left over:
   ```powershell
   Test-Path .\human_benchmark.db-journal      # must print False
   ```
   If it prints `True`, a write was interrupted. Start the API once and stop it
   again so SQLite can recover the file, then check again. Never copy the
   database without its journal.
2. **Create the folder, and make sure nothing is already there:**
   ```powershell
   New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\HumanBenchmark"
   Test-Path "$env:LOCALAPPDATA\HumanBenchmark\human_benchmark.db"   # must print False
   ```
3. **Copy the database. Do not move it:**
   ```powershell
   Copy-Item .\human_benchmark.db "$env:LOCALAPPDATA\HumanBenchmark\human_benchmark.db"
   ```
4. **Check that the copy is complete.** This opens both files read-only. Both
   lines must show `ok` and the same counts:
   ```powershell
   .\.venv\Scripts\python -c "import os,sqlite3; [print(p, c.execute('pragma integrity_check').fetchone()[0], [c.execute(f'select count(*) from {t}').fetchone()[0] for t in ('sessions','trials','participants')]) for p in ('human_benchmark.db', os.path.expandvars(r'%LOCALAPPDATA%\HumanBenchmark\human_benchmark.db')) for c in [sqlite3.connect(f'file:{p}?mode=ro', uri=True)]]"
   ```
5. **Point the backend at the copy.** Copy `.env.example` to `.env`. Open `.env`
   in VS Code, uncomment the `HB_DATABASE_URL` line, set it to your path, and
   save.
   - Don't write `.env` with PowerShell's `Set-Content` or `Out-File`. Windows
     PowerShell 5.1 adds a byte-order mark, which hides the first setting.
   - `.env` stays inside the repository folder, so OneDrive syncs it too. It
     holds no secret, but it does contain your Windows user name.
6. **Confirm the backend uses the new file:**
   ```powershell
   .\.venv\Scripts\python -c "from app.config import get_settings; print(get_settings().database_url)"
   .\.venv\Scripts\python -m alembic current        # must show the head revision
   ```
   Start the API. `http://127.0.0.1:8000/api/v1/health` must report the schema
   as current.
7. **Decide what happens to the old file. It is not deleted automatically.**
   - Until you decide, rename it so that nothing uses it by mistake. Keep the
     `.db` ending, for example `human_benchmark.old-onedrive.db`, so it stays
     git-ignored (`*.db`). Confirm with `git status`, which must not list it.
   - It still contains every session saved so far, including the Cycle 8
     incident session (docs/PERSONAL_OBSERVATORY.md §6).
   - Deleting it from the OneDrive folder moves it to the Windows Recycle Bin and
     to the OneDrive recycle bin. OneDrive may also hold earlier **versions** of
     it.
   - **Do not assume that deleting it locally removes those copies.** Check the
     OneDrive web interface (the file's version history, and both stages of its
     recycle bin) against Microsoft's current documentation.
   - This is an open owner decision (DATA_AND_PRIVACY.md §7).

### Backups

- After the move, the database has **no automatic backup.** OneDrive no longer
  copies it, and nothing else is set up. A disk failure loses it. For local test
  data that is acceptable.
- If you want a backup, make one on purpose, outside any synced folder. For
  example, use the step 3 copy with a dated name while the API is stopped.
- **Every backup is another copy that deletion does not reach.** Deleting a
  session in the app does not remove it from backups (DATA_AND_PRIVACY.md
  §8.2). Keep backups only as long as you need them, and delete them by hand.
- Windows features such as System Restore or volume shadow copies may also keep
  older versions of files. The project does not manage them.

## Checks

```powershell
.\.venv\Scripts\python -m pytest            # all tests; each uses its own temporary database
.\.venv\Scripts\python -m ruff check .      # lint
.\.venv\Scripts\python -m ruff format --check .
.\.venv\Scripts\python -m mypy              # strict type check
.\.venv\Scripts\python -m pip_audit -r requirements-dev.txt   # known vulnerabilities
```

Tests never touch `human_benchmark.db` or `.env`.

## Layout

```text
app/            config, database, models (DB constraints), schemas (request shape),
                protocols + validation (protocol rules), session_store (transactions), scope (local-owner access),
                errors, middleware, routes/
migrations/     Alembic environment and versions/0001_initial_schema.py
tests/          pytest suite and deterministic payload factories
```

## Windows note: Smart App Control

On the development machine, Windows **Smart App Control** blocks compiled
Python extensions that have no established reputation. The newest
`pydantic-core` and `SQLAlchemy` builds failed to import with "An Application
Control policy has blocked this file".

The pinned versions (`pydantic 2.12.5` / `pydantic-core 2.41.5`,
`SQLAlchemy 2.0.44`) were chosen because they load. Some `.exe` launchers in
`.venv\Scripts` (for example `mypy.exe`) are also blocked, which is why every
command uses `python -m …`.

Do not turn Smart App Control off for this project: on Windows 11 it cannot be
turned back on without reinstalling Windows. If a future upgrade is blocked,
pin a version that loads and record it in `requirements.txt`.

## Known limitations

- **Reading and deleting have no ownership proof.**
  - They use the local-owner scope: development only, and off unless
    `HB_LOCAL_OWNER_ACCESS=true`.
  - Deployment blockers are listed in BACKEND_ARCHITECTURE.md §9.
- **`secure_delete` limits.** Deleted rows are overwritten inside the database
  file only. Backups, synced copies, old journal files and the disk itself are
  not reached (DATA_AND_PRIVACY.md §8.2).
- **mypy cannot currently run on the development machine.** Smart App Control
  blocks `librt`, a compiled dependency of mypy 2.4. The error is "DLL load
  failed while importing internal: An Application Control policy has blocked
  this file". Tests and ruff are unaffected. Fix it as described in the Windows
  note: pin a mypy version whose compiled parts load. Do not turn Smart App
  Control off.
- **No live PostgreSQL test has been run.** PostgreSQL is verified by rendering
  SQL offline, and the driver reached a local server only as far as
  authentication. The suite can run against a real server, see below.

## Optional: run the tests against a live PostgreSQL server

Create an **empty** database whose name ends in `_test`, plus a throwaway role
for it (do not reuse a real password), then:

```powershell
$env:HB_TEST_POSTGRES_URL = "postgresql+pg8000://hb_tester:<password>@127.0.0.1:5432/human_benchmark_test"
.\.venv\Scripts\python -m pytest
Remove-Item Env:HB_TEST_POSTGRES_URL
```

Every database-backed test then runs on PostgreSQL. That covers migrations,
inserts, every constraint, duplicates, rollback, cascading deletion, and an
exact schema-to-model comparison.

**The schema is dropped and re-created before each test.** The suite refuses
any database not named `*_test`. In this mode tracebacks are kept short so the
password is not printed. `pg8000` is a pure-Python driver (Smart App Control
safe) and is only needed for this.
- Requests to non-API routes (`/docs`, `/openapi.json`) are logged with the route
  `unmatched`.
