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
