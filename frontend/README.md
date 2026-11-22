# HUMAN BENCHMARK Frontend

This directory contains the frontend foundation for the HUMAN BENCHMARK
educational cognitive-experiment platform.

## Stack

- React and TypeScript
- Vite
- React Router
- CSS
- ESLint and Prettier
- Vitest and Testing Library

The choices follow the technology decisions in the project requirements. React
and Vite provide a small, maintainable browser application; React Router
establishes route boundaries; Vitest and Testing Library cover application
rendering. The foundation intentionally does not include a design system,
experiment engine, backend, or persistence.

## Structure

- `src/app/` — application composition and routing
- `src/components/layout/` — small shared layout components
- `src/pages/` — route-level placeholder pages
- `src/styles/` — global CSS initialization
- `src/test/` — test environment setup
- `public/` — static public assets

Routes and future feature modules can grow from this structure without placing
experiment logic in the application shell.

## Install

```powershell
cd frontend
npm install
```

Copy `.env.example` to `.env.local` only when Vite environment variables are
needed. Browser-visible variables must use the `VITE_` prefix.

## Run

```powershell
npm run dev
```

Open the local URL printed by Vite.

The default route is `/`. Unknown routes render a minimal not-found page.

## Test

```powershell
npm test
npm run test:watch
```

## Quality and build

```powershell
npm run lint
npm run format:check
npm run build
npm run preview
```

## Current scope

The application contains only a branded placeholder home page and a not-found
route. It does not implement Stroop, Flanker, experiment results, analytics,
backend communication, or persistence.

## Core navigation

The MVP foundation currently provides `/`, `/experiments`, and
`/methodology`. Stroop and Flanker appear as clearly marked upcoming
experiment entries only. `/design-system` remains available as a development
preview. Unknown routes use the not-found page.

The top navigation is intentionally limited to Home, Experiments, and
Methodology. Desktop navigation is horizontal; at narrow widths it becomes a
keyboard-operable disclosure menu. The menu closes on navigation or Escape.

## Design system

Design tokens and component conventions are documented in
`DESIGN_SYSTEM.md`. Start the app and open `/design-system` to inspect the
component preview.

## Foundation audit

The frontend foundation was audited for routing, responsive layout, keyboard
navigation, code quality, dependencies, and basic page structure. Core routes
were inspected at 1440px, 1280px, 768px, and 390px widths. No horizontal overflow
was found, and the mobile menu supports open, close, Escape, and focus
restoration behavior.

This is a practical audit, not a claim of complete WCAG 2.2 AA compliance or
cross-browser certification. The dependency audit currently reports no known
production or development vulnerabilities. Experiment implementation,
backend, database, analytics, and persistence remain out of scope.

## Experiment engine contracts

The React-independent contracts for Cycle 4 are under `src/engine/`. They
provide experiment identity/configuration, session and trial state types,
response and timing metadata, trial/session records, experiment adapter
interfaces, a monotonic-clock abstraction, and a pure session-transition model.
The lifecycle controller is implemented for session and trial progression,
breaks, pauses, aborts, and completion. Stimulus rendering, scheduling
algorithms, response capture, actual timing, analysis, and persistence remain
for later tasks.

## Engine integration audit

The complete engine is covered by deterministic unit and integration tests.
The integration suite exercises practice-to-main completion, incorrect
responses, timeout and late input, pause/resume, active interruption, break
pause/resume, abort, technical failure, and race-safe settlement. No UI,
experiment adapter, backend, or persistence implementation is included.

## Timing, input, and validity

The engine exposes an injectable monotonic clock, deadline scheduler, keyboard
event source, interruption event source, response-input controller, and trial
runtime. Browser timing uses `performance.now()` and is expressly documented as
browser-recorded rather than physical stimulus onset. Test implementations use
fake clocks and schedulers.

## Stroop adapter

The approved Stroop configuration and schedule generator are under
`src/experiments/stroop/`. `STROOP_ADAPTER.md` documents protocol mapping,
stimulus rules, schedule constraints, and seed reproducibility. This adapter
does not render or execute experiment UI.

The participant presentation is documented in `STROOP_PARTICIPANT_UI.md` and
is available at `/experiments/stroop`.

Session results (calculations, eligibility rules, and participant-facing
presentation) are documented in `STROOP_RESULTS.md`.

## Flanker adapter

The approved Flanker protocol (`HB-FLANKER-1.0`) is implemented under
`src/experiments/flanker/` and available at `/experiments/flanker`. The adapter
is documented in `FLANKER_ADAPTER.md` and the participant experience in
`FLANKER_PARTICIPANT_UI.md`.

## Shared experiment architecture

Stroop and Flanker share the session flow, analysis, results presentation,
session shell, and deterministic randomization in `src/experiments/shared/`,
documented in `EXPERIMENT_SESSION_ARCHITECTURE.md`.
