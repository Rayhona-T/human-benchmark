# ADR-001: Backend technology stack

- **Status:** Accepted for Cycle 8 Tasks 1+2 (awaiting project-owner review)
- **Date:** 2026-11-22
- **Context documents:** [BACKEND_ARCHITECTURE.md](../backend/BACKEND_ARCHITECTURE.md),
  [DATA_AND_PRIVACY.md](../backend/DATA_AND_PRIVACY.md)

## Context

HUMAN BENCHMARK needs a small service that can later store Stroop and Flanker
sessions that participants choose to save, and serve them back for the Cycle 9
Personal Observatory. The project is built and maintained by one university
student. [README.md](../../README.md) and [REQUIREMENTS.md](../REQUIREMENTS.md)
already planned **Python + FastAPI** and **PostgreSQL**. This ADR checks that plan
rather than assuming it.

The workload is tiny. One session is about 72 trial rows and about 50 KB of JSON.
Writes happen once, at the end of a session, and are read rarely. Nothing here
needs high throughput, real-time features or background workers.

## Options considered

### Application framework

| Criterion | Python + FastAPI (chosen) | Node/TypeScript (Fastify or Express + Zod + Prisma/Drizzle) | Django + DRF |
| --- | --- | --- | --- |
| Matches existing plan | Yes (README, REQUIREMENTS) | No | Partly (Python) |
| Validation and type safety | Pydantic v2 models are both validators and documentation; mypy for static types | Zod plus TS types; very good | DRF serializers; more ceremony |
| Code sharing with frontend | None; the boundary is a JSON contract | Could share TS types, but the engine types include frontend-only fields | None |
| Scientific analysis later | NumPy, pandas and SciPy available if ever needed (REQUIREMENTS) | Weak | Available |
| Testing | pytest + `TestClient`, no server process needed | Good | Good |
| Learning curve for one student | Small API surface; automatic OpenAPI docs at `/docs` | Two ecosystems in one repo, plus a choice among ORMs | Large framework; admin, auth and templates not needed |
| Infrastructure | One process (Uvicorn) | One process | One process, more settings |

The main argument for Node is sharing TypeScript types. It is weaker than it looks.
The persisted contract deliberately differs from the engine's in-memory records:
- it drops `sessionId`, repeated per-trial identity and presentation constants;
- it uses snake_case to match the CSV export.

So a mapping layer is needed either way, and an explicit JSON contract with tests
on both sides is easier to review than shared types that drift silently.

### Database access and migrations

- **SQLAlchemy 2 (typed ORM) + Alembic (chosen).** It is the standard pairing in
  Python. A single model definition works on SQLite and PostgreSQL, and Alembic
  migrations are plain, reviewable Python files.
- *SQLModel* would merge Pydantic and SQLAlchemy models. That blurs the line
  between "what the API accepts" and "what the database stores", which matters
  here (for example, the API rejects unknown fields while the database never sees
  them), and it adds another layer of abstraction.
- *Raw SQL* would mean writing migrations, row mapping and portability by hand.

### Database

- **SQLite for local development and automated tests (chosen).** It needs no
  installation, every test gets an isolated file, and it supports the foreign
  keys (once enabled per connection), CHECK constraints and unique constraints
  that this design relies on.
- **PostgreSQL as the deployment target (chosen, deferred).** It is more robust
  under concurrent writes, has native UUID and JSONB types, and is offered by
  managed hosts. The schema only uses types and constraints that both databases
  support: SQLAlchemy `Uuid`, `JSON`, `BigInteger`, CHECK, FOREIGN KEY ... ON DELETE
  CASCADE, and UNIQUE.
- **Limitation:** PostgreSQL is not installed on the development machine, so in
  this task PostgreSQL compatibility is checked only by rendering the migration
  as PostgreSQL SQL offline (`alembic upgrade head --sql`). A live PostgreSQL
  test run is a deployment prerequisite.
- *A document database (for example MongoDB)* was rejected. Sessions and trials
  are relational and need integrity constraints (unique trial index per session,
  cascading deletion).

### Supporting libraries

| Library | Purpose | Why it earns its place |
| --- | --- | --- |
| `uvicorn` | ASGI server | Required to run FastAPI |
| `pydantic-settings` | Typed configuration from environment variables and a local `.env` | Validates configuration at start-up, so a wrong value fails loudly |
| `pytest`, `httpx` | Tests and `TestClient` | Standard; `httpx` is needed by `TestClient` |
| `ruff` | Lint and format (one tool) | Plays the role ESLint and Prettier play in the frontend |
| `mypy` | Static type check | Plays the role `tsc` plays in the frontend |
| `pip-audit` | Dependency vulnerability check | Plays the role `npm audit` plays in the frontend |

Not added:
- authentication libraries;
- task queues;
- caches;
- Docker;
- an admin UI;
- monitoring or analytics SDKs;
- a PostgreSQL driver.

Each of these waits for a decision that needs it. The PostgreSQL driver will be
added together with the first live PostgreSQL test.

## Decision

Use Python (3.12 or later; developed and tested on 3.14), FastAPI, Pydantic v2,
SQLAlchemy 2 and Alembic. Use SQLite locally and PostgreSQL for a future
deployment. Pin exact dependency versions in `backend/requirements*.txt`.

**Version pins chosen during implementation.** The development machine runs
Windows Smart App Control, which blocks compiled Python extensions that have no
established reputation. The newest `pydantic-core` (2.50.x) and SQLAlchemy (2.1.x)
builds failed to import. The pins `pydantic 2.12.5` / `pydantic-core 2.41.5` and
`SQLAlchemy 2.0.44` load, are maintained releases, and pass `pip-audit` with no
known vulnerabilities. Smart App Control was left on; see `backend/README.md`.

**A transitive dependency worth knowing about.** FastAPI 0.165 requires
`opentelemetry-api`. This is the instrumentation *interface* only: without an
OpenTelemetry SDK and exporter (neither is installed), it records and sends
nothing.

## Consequences

- There are two languages in the repository. The frontend–backend boundary is a
  versioned JSON contract (`data_schema_version`) documented in
  [API.md](../backend/API.md).
- Protocol rules needed for validation (trial counts, key mappings, condition
  rules) are written down a second time in Python, in `backend/app/protocols.py`.
  This is deliberate: the server must not trust the client. Each value cites the
  protocol section it comes from, and tests check them against the approved
  values.
- No analysis code is duplicated. Medians, rates and contrasts stay in the
  frontend's `HB-ANALYSIS-1.1` implementation (see BACKEND_ARCHITECTURE.md §4).
