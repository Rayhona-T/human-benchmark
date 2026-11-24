# HUMAN BENCHMARK — Development Roadmap

This roadmap is a sequence of learning and delivery phases for an individual beginner developer working with AI assistance. It has no deadline commitments. Phase completion depends on exit criteria, not elapsed time. The Cycle tracker below records current milestone status; the numbered phases remain a planned delivery breakdown, not status claims.

The MVP boundary is the guest experience, the two initial experiments, session results, and data export described in [REQUIREMENTS.md](REQUIREMENTS.md). Accounts, server-side persistence, session history, and research mode are later decisions rather than prerequisites for that MVP.

## Project Evolution Tracker

This table tracks the current Cycle 1–10 milestone sequence. The numbered phases below remain a longer-range delivery breakdown; they are not status claims for the cycle milestones. Cycle 2 questions are collected in [CYCLE_2_QUESTIONS.md](experiments/CYCLE_2_QUESTIONS.md).

| Milestone | Status |
|---|---|
| Cycle 1 — Task 1: Repository foundation | Approved |
| Cycle 1 — Task 2: Vision, requirements, roadmap | Approved |
| Cycle 1 — Task 3: Scientific Blueprint | Approved |
| Cycle 1 — Task 4: Protocol/data decisions | Approved |
| Cycle 1 — Foundation | Complete |
| Cycle 2 — Scientific Protocol & Literature | Complete |
| Cycle 2 — Task 1: Literature & Evidence Review | Approved |
| Cycle 2 — Task 2: Stroop Scientific Protocol | Approved |
| Cycle 2 — Task 3: Flanker Scientific Protocol | Drafted in Cycle 2; formally approved as `HB-FLANKER-1.0` in Cycle 6 (protocol §14) |
| Cycle 2 — Task 4: Scientific Harmonization & Approval | Approved |
| Cycle 3 — Frontend Foundation | Complete |
| Cycle 3 — Task 1: Frontend Architecture & Foundation | Approved |
| Cycle 3 — Task 2: Design System & UI Components | Approved |
| Cycle 3 — Task 3: Core Navigation & Application Shell | Approved |
| Cycle 3 — Task 4: Frontend Foundation Review & Approval | Approved |
| Cycle 4 — Experiment Engine | Approved |
| Cycle 4 — Task 1: Engine Architecture & Core Contracts | Approved |
| Cycle 4 — Task 2: Session & Trial Lifecycle | Approved |
| Cycle 4 — Task 3: Timing, Input & Validity | Approved |
| Cycle 4 — Task 4: Integration, Testing & Engine Approval | Approved |
| Cycle 5 — Stroop Implementation | Approved |
| Cycle 5 — Task 1: Stroop Adapter & Experiment Configuration | Approved (PRNG protocol-conformance correction approved) |
| Cycle 5 — Task 2: Stroop Practice & Main Presentation | Approved (after verification audit) |
| Cycle 5 — Task 3: Stroop Session Results & Data Interpretation | Approved |
| Cycle 5 — Task 4: Stroop Integration, Scientific Audit & Approval | Approved |
| Cycle 6 — Flanker Implementation | Complete — committed (`dee737a`) |
| Cycle 6 — Task 1+2: Flanker Scientific Protocol, Architecture & Engine Integration | Approved (protocol approved as `HB-FLANKER-1.0`; decisions in protocol §14) |
| Cycle 6 — Task 3+4: Flanker Participant Experience, Final Audit & Approval Readiness | Complete — committed (`dee737a`) |
| Cycle 7 — Analysis & Results | Complete — committed (`7e91caa`) |
| Cycle 7 — Task 1+2: Scientific Analysis Framework, Results Methodology & Architecture | Complete — decisions approved for implementation (`HB-ANALYSIS-1.1`) |
| Cycle 7 — Task 3+4: Participant Results Experience, Scientific Audit & Approval Readiness | Complete — committed (`7e91caa`) |
| Cycle 8 — Backend & Persistence | Complete — checkpoint committed (`a68b3b4`), approved with conditions: local development and test use only under the provisional, unapproved notice `HB-NOTICE-0.1-PROVISIONAL` (no real participant data); live PostgreSQL run still not performed; development database to be moved outside OneDrive before more sessions are saved |
| Cycle 8 — Tasks 1+2: Backend Architecture, Data Policy & Foundation | Complete — approved with the Cycle 8 conditions ([BACKEND_ARCHITECTURE.md](backend/BACKEND_ARCHITECTURE.md), [DATA_AND_PRIVACY.md](backend/DATA_AND_PRIVACY.md), [API.md](backend/API.md), [ADR-001](decisions/ADR-001-backend-stack.md)) |
| Cycle 8 — Task 3: Experiment persistence integration | Complete — approved with the Cycle 8 conditions. Local development and test flow only, under the provisional, unapproved notice `HB-NOTICE-0.1-PROVISIONAL`; not approved for real participant data ([PERSISTENCE_INTEGRATION.md](../frontend/PERSISTENCE_INTEGRATION.md)), including the consent-incident fix. Participant key deferred beyond the Cycle 9 MVP |
| Cycle 8 — Task 4: End-to-end audit & approval readiness | Complete — approved with the Cycle 8 conditions. Live PostgreSQL run not performed (prepared; needs credentials) |
| Cycle 9 — Personal Observatory | Complete — committed (`67fb153`). Development-only, local-only; not part of the production build ([PERSONAL_OBSERVATORY.md](PERSONAL_OBSERVATORY.md)) |
| Cycle 9 — Task 9.1: Decisions, requirements & privacy documentation | Approved. Owner action outstanding: move the database outside OneDrive before saving more sessions |
| Cycle 9 — Task 9.2: Backend reads & deletion (Host allowlist, session list, delete-all) | Approved (mypy limitation documented). Local-owner access is development-only and off unless `HB_LOCAL_OWNER_ACCESS=true`; notice 0.2 not active ([API.md](backend/API.md)) |
| Cycle 9 — Task 9.3: Frontend data layer (stored-session adapter, type-only analysis input narrowing) | Approved. Identical results for all four fixtures ([OBSERVATORY_DATA_LAYER.md](../frontend/OBSERVATORY_DATA_LAYER.md)) |
| Cycle 9 — Task 9.4: History, session detail & deletion UI (MVP) | Approved with conditions. Development builds with a local test backend only; absent from production builds; notice 0.2 updated but not activated ([OBSERVATORY_UI.md](../frontend/OBSERVATORY_UI.md)) |
| Cycle 9 — Task 9.5: Within-experiment session trends | Complete — committed (`67fb153`), including the accuracy-context and window-transparency correction. Descriptive only: comparable sessions, ≥3 for charts, ≥5 earlier sessions for a range, no inference ([PERSONAL_OBSERVATORY.md](PERSONAL_OBSERVATORY.md) §4a) |
| Cycle 10 — Testing, Pilot & Deployment | In progress. Approved release scope: **Option A, client-only static production build** (no network calls, no storage). The Observatory and the design-system preview are excluded from production builds; the development save client was still bundled (unreachable) until Task 10.4 removed it |
| Cycle 10 — Tasks 10.0–10.1: Reconnaissance, release scope & QA matrix | Delivered (read-only reports) |
| Cycle 10 — Task 10.2: CI & browser-test harness | Committed (`550b750`). First GitHub Actions run failed at mypy (type errors in two backend tests); fixed in Task 10.3; CI run 2 (`9f5ab7e`) passed all four jobs ([TESTING.md](../TESTING.md)) |
| Cycle 10 — Task 10.3: Regression, data integrity & interruption testing | Committed (`9f5ab7e`); CI run 2 passed |
| Cycle 10 — Task 10.4: Cross-browser, accessibility & production hardening | Committed (`01d638f`; WebKit scan-timing fix `1d4e6f6`); CI run 4 passed all six jobs. Chromium, Firefox, WebKit; axe and keyboard checks; clearing session data (FR-PRI-03) and departure warnings (owner-approved); development-only code removed from the production bundle; `/design-system` development-only; hosting requirements documented, no host chosen ([HOSTING.md](HOSTING.md), [TESTING.md](../TESTING.md)) |
| Cycle 10 — Task 10.5: Release blockers, protocol decisions & deployment readiness | Complete — awaiting review. Methodology page: protocol and analysis versions, verified references (FR-DIS-04, NFR-SCI-01); participant guidance on staying on the page; manual verification checklist ([MANUAL_VERIFICATION.md](MANUAL_VERIFICATION.md)); hosting audit. Awaiting owner decisions: D4 landscape height guard, focus-ring color. Not yet performed: manual checks; no host chosen |
| Application product implementation | Not started |

## Phase 0 — Product/Foundation

- **Objective:** Establish the repository and agree on product purpose, boundaries, and requirements.
- **Deliverables:** Repository foundation; project vision, requirements, and roadmap.
- **Key learning topics:** Git basics, product scope, requirements writing, documentation, distinguishing decisions from assumptions.
- **Dependencies:** None.
- **Exit criteria:** Project purpose and non-goals are explicit; MVP and unresolved decisions can guide the scientific blueprint.
- **Not included yet:** Application code, final experimental protocols, database/API design, deployment.

## Phase 1 — Scientific Blueprint

- **Objective:** Specify what the Stroop and Flanker experiences will do and how their session data will be interpreted.
- **Deliverables:** Verified literature notes; reviewed Stroop and Flanker protocols; hypotheses where appropriate; stimulus and condition plans; trial and randomization rules; analysis plans; data dictionary; scientific limitations.
- **Key learning topics:** Experimental design, operational definitions, independent/dependent variables, confounds, descriptive statistics, measurement limits, source evaluation.
- **Dependencies:** Phase 0 product boundaries.
- **Exit criteria:** Each experiment has a reviewed, versionable protocol and analysis plan detailed enough to implement and test; data fields and export needs are agreed. Scientific claims and references are verified rather than invented.
- **Not included yet:** Frontend implementation, collection of public participant data, claims of validation, formal research conclusions.

## Phase 2 — Frontend Foundation

- **Objective:** Create the first accessible product shell and informational experience.
- **Deliverables:** Frontend scaffolding; routing; initial visual conventions and reusable interface components; landing page; experiment catalogue; experiment detail and briefing pages.
- **Key learning topics:** React, TypeScript, Vite, component design, routing, semantic HTML, responsive layout, accessibility.
- **Dependencies:** Phase 0 scope; Phase 1 content and experiment descriptions.
- **Exit criteria:** Visitors can navigate the informational pages on the documented development browsers; content clearly communicates purpose, data handling, and limits; core navigation is keyboard usable.
- **Not included yet:** Main trial collection, results calculations, server communication, user accounts.

## Phase 3 — Experiment Engine

- **Objective:** Build and test reusable mechanics for protocol-defined experiments.
- **Deliverables:** Experiment flow/state handling; trial sequencing and randomization behavior; stimulus presentation; response handling; timing capture; trial records; practice trials; session status and interruption behavior.
- **Key learning topics:** State modeling, event handling, deterministic testing, timing APIs and their limitations, randomization, data quality, accessibility trade-offs.
- **Dependencies:** Phase 1 trial/data rules; Phase 2 frontend foundation.
- **Exit criteria:** A small, non-scientific test configuration can exercise the engine end to end; focused tests verify state transitions, record creation, invalid inputs, practice/main separation, and interruption status.
- **Not included yet:** Final Stroop/Flanker content, population comparisons, laboratory-grade timing claims, persistence.

## Phase 4 — Stroop Experiment

- **Objective:** Implement the first experiment against the reviewed protocol using the reusable engine.
- **Deliverables:** Stroop instructions and briefing; practice and main trials; condition and response logic; trial logging; protocol-driven results calculations and limitations.
- **Key learning topics:** Turning a protocol into software, stimulus/response mapping, trial-level analysis, descriptive statistics, testing scientific behavior.
- **Dependencies:** Phases 1–3.
- **Exit criteria:** The implemented version matches its protocol; tests cover representative conditions and edge cases; summaries can be reproduced from recorded session data.
- **Not included yet:** Claims that the task diagnoses or measures a single isolated ability; comparison to population norms; backend persistence.

## Phase 5 — Flanker Experiment

- **Objective:** Implement the second experiment while reusing—not duplicating—the engine where appropriate.
- **Deliverables:** Flanker briefing and instructions; practice and main trials; protocol-defined stimuli, conditions, responses, trial records, results, and limitations.
- **Key learning topics:** Reuse boundaries, condition design, experiment configuration, comparative testing, scientific interpretation.
- **Dependencies:** Phases 1–4.
- **Exit criteria:** The Flanker version matches its reviewed protocol; experiment-specific behavior is tested; shared mechanics remain consistent without hiding meaningful protocol differences.
- **Not included yet:** Additional experiments, cross-experiment scores, clinical or intelligence comparisons.

## Phase 6 — Analysis and Results

- **Objective:** Deliver understandable, traceable results and data export for completed sessions.
- **Deliverables:** Analysis calculations; data-quality checks; session summaries and appropriate condition comparisons; labeled visualizations; interpretation and limitations; documented participant export; active-session clearing.
- **Key learning topics:** Data cleaning, descriptive statistics, visualization, interpretation, export formats, analysis testing.
- **Dependencies:** Phases 1, 4, and 5; Phase 3 session records.
- **Exit criteria:** Results match documented analysis plans and can be reproduced from session records; invalid/missing data are handled visibly; export includes the agreed fields; participant-facing explanation avoids unsupported claims.
- **Not included yet:** Cross-session history, population-level analysis, predictive modeling, backend persistence.

**MVP review gate:** At the end of Phase 6, assess the MVP acceptance criteria in [REQUIREMENTS.md](REQUIREMENTS.md). The initial product can remain guest-based and non-persistent; do not add a backend solely to make the MVP appear more complete.

## Phase 7 — Backend and Persistence

- **Objective:** Decide whether server-side storage is justified and, only if approved, add a carefully bounded persistence layer.
- **Deliverables:** A documented persistence decision; if proceeding, FastAPI service, PostgreSQL persistence, validation, migrations, session-saving behavior, and deletion/retention handling.
- **Key learning topics:** HTTP and API design, Python/FastAPI, database fundamentals, data validation, migrations, security, privacy, backup and deletion implications.
- **Dependencies:** MVP review; a clear use case; privacy, retention, and deletion requirements; the data dictionary.
- **Exit criteria:** The persistence decision and trade-offs are documented. If implemented, data paths are validated and tested, retention/deletion behavior is demonstrated, and security/privacy review is complete before participant data is stored.
- **Not included yet:** Accounts or identity collection unless separately justified; unrestricted collection; research data sharing.

## Phase 8 — Personal Observatory

- **Objective:** Explore whether participants benefit from viewing and comparing their own sessions.
- **Deliverables:** Only if approved: session history, comparison views, contextual explanations, and participant controls for saved data.
- **Key learning topics:** Longitudinal data interpretation, version comparability, data lifecycle, dashboard design, uncertainty communication.
- **Dependencies:** Phase 7 persistence or a separately reviewed local-storage design; explicit privacy and retention decisions.
- **Exit criteria:** Comparable sessions are identified transparently; version and quality differences are explained; deletion and export remain understandable; no stable-trait or diagnostic inference is made.
- **Not included yet:** Leaderboards, population norms, predictive scoring, automatic psychological profiling.

### Cycle 9 approved scope (Task 9.1)

The full decisions (O1–O12), display safeguards and deferred features are in
[PERSONAL_OBSERVATORY.md](PERSONAL_OBSERVATORY.md). The privacy model is in
[DATA_AND_PRIVACY.md](backend/DATA_AND_PRIVACY.md) §8.

- **Ownership:** local-owner mode. Whoever runs the local backend owns all of
  its sessions. There is no participant key, and this is not ownership proof.
- **Availability:** development-only and local-only, behind the same gate as
  saving. Not part of production builds, and no deployment.
- **Database:** moved outside OneDrive by the owner before more sessions are
  saved (backend/README.md, "Database location").
- **MVP:** session history, details of one session (recalculated with
  `HB-ANALYSIS-1.1`), and manual deletion of one or all sessions.
- **After the MVP:**
  - within-experiment trends, which need at least 3 comparable sessions;
  - an earlier-session range, which needs at least 5 comparable earlier
    sessions.
- **Excluded:** trend lines, smoothing, significance tests, confidence
  intervals, automatic insights, rankings, cross-experiment comparisons and
  device tracking.
- **Deferred:**
  - automatic retention;
  - participant key, which is required before deployment;
  - export from stored sessions.
- **Notice:** `HB-NOTICE-0.2-PROVISIONAL` is drafted, not active, and not
  approved for real participants ([CONSENT_NOTICES.md](backend/CONSENT_NOTICES.md)).
- **Task sequence:** 9.1 documentation → 9.2 backend reads and deletion → 9.3
  frontend data layer → 9.4 MVP UI → MVP review → 9.5 trends. Each task needs
  approval of the previous one.

## Phase 9 — Quality and Pilot

- **Objective:** Evaluate usability, accessibility, reliability, and privacy before wider release.
- **Deliverables:** Cross-browser and responsive checks; accessibility review; usability feedback; bug fixes; privacy review; if appropriate, a bounded consenting-adult pilot under suitable protocol and oversight.
- **Key learning topics:** Test planning, accessibility evaluation, usability research, ethical handling of participant data, pilot limitations.
- **Dependencies:** A stable feature set from Phases 6–8 as applicable; documented protocols and data handling. Any research use requires appropriate consent and any required oversight before recruitment or data use.
- **Exit criteria:** Critical usability, accessibility, and data-integrity issues are addressed or documented; pilot scope and limitations are clear; feedback is not misrepresented as scientific validation.
- **Not included yet:** Generalizable research claims, unsupervised recruitment, clinical use, or public release of participant data.

## Phase 10 — Deployment

- **Objective:** Decide whether and how to make a reviewed version available to others.
- **Deliverables:** Deployment configuration; operational and privacy documentation; monitoring appropriate to the chosen hosting model; user-facing help; portfolio presentation.
- **Key learning topics:** Build and release processes, hosting, configuration and secrets, operational monitoring, incident response, maintenance.
- **Dependencies:** MVP review and Phase 9 quality work; deployment-specific privacy and security assessment; persistence decisions if applicable.
- **Exit criteria:** A reproducible release process is documented; secrets are not committed; the deployed version matches reviewed documentation; monitoring does not introduce undisclosed data collection.
- **Not included yet:** Guaranteed uptime, large-scale operation, or claims beyond the reviewed evidence and intended educational scope.

## Ongoing Change Control

- Review scope and unresolved questions before beginning each phase.
- Update requirements and protocols when decisions change; preserve experiment version context for implemented changes.
- Keep scientific citations verified and do not infer validation from successful software tests or usability feedback.
- Reassess privacy, accessibility, and data integrity whenever collection, persistence, or sharing changes.
- Do not advance to a later feature phase solely because it appears in the roadmap; complete its dependencies and exit criteria first.
