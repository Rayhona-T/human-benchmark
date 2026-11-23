# HUMAN BENCHMARK — Backend (Cycle 8 foundation)

This is a standalone FastAPI service that can store **complete** Stroop and
Flanker sessions. It runs locally only.

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

## Configuration

Settings come from environment variables prefixed `HB_`, or from `backend/.env`.
Copy `.env.example` to `.env`; `.env` is git-ignored.

| Variable | Default | Notes |
| --- | --- | --- |
| `HB_ENV` | `development` | Only `development` or `test`. Any other value stops start-up, because deployment is not supported yet |
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

To start over locally, stop the server, delete `backend/human_benchmark.db`, and
run the upgrade again.

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
                protocols + validation (protocol rules), session_store (transactions),
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

- GET and DELETE have no ownership proof. They are for local development only;
  deployment blockers are listed in BACKEND_ARCHITECTURE.md §9.
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
