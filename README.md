# HUMAN BENCHMARK

HUMAN BENCHMARK is an educational platform for exploring cognitive psychology and neuroscience through carefully designed, research-inspired experiments and personal behavioral data.

## Mission

Make cognitive science more approachable by helping people take part in experiments, understand their own behavioral data, and learn how researchers study cognition.

## What makes it different

The project emphasizes transparent methods and scientific context. It is not a clinical diagnostic tool, an IQ test, or a way to rank people's intelligence. The planned experiments are educational and research-inspired; the platform is not a validated cognitive assessment tool.

## Experiments

- Stroop task (`HB-STROOP-1.0`)
- Flanker task (`HB-FLANKER-1.0`)

## Technology

- Frontend: React, TypeScript, and Vite. The experiments, session results
  (`HB-ANALYSIS-1.1`), and the CSV export all run in the browser.
- Backend (development and testing only): Python, FastAPI, and SQLite, with
  PostgreSQL prepared. It is **not part of the production release**.
- Planned, not in use: scientific analysis with NumPy, pandas, and SciPy
  (REQUIREMENTS §10).

## Development status

Cycles 1–9 are committed: Stroop and Flanker run in the browser, with session
results and a local CSV export. A development-only backend and a personal
Observatory (session history and trends) exist for local testing only.

Cycle 10 (testing, pilot, and deployment) is in progress. The approved release
scope is a **client-only static build**: no account, no network requests, and
nothing stored, and the backend, saving, and Observatory are excluded from it.
Nothing has been deployed. No scientific results are being reported. See
[docs/ROADMAP.md](docs/ROADMAP.md) for status and [TESTING.md](TESTING.md) for
the checks.

## Screenshots and demo

_Coming later._

## Documentation

See the [documentation directory](docs/) for project documentation, decisions, and research materials.
