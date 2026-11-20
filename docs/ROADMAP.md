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
| Cycle 2 — Scientific Protocol & Literature | In progress — Tasks 1–2 approved; Task 3 awaiting review; Task 4 complete awaiting human review |
| Cycle 2 — Task 1: Literature & Evidence Review | Approved |
| Cycle 2 — Task 2: Stroop Scientific Protocol | Approved |
| Cycle 2 — Task 3: Flanker Scientific Protocol | Complete — awaiting review |
| Cycle 2 — Task 4: Scientific Harmonization & Approval | Complete — awaiting human review |
| Cycle 3 — Frontend Foundation | Planned — not started |
| Cycle 4 — Experiment Engine | Planned — not started |
| Cycle 5 — Stroop Implementation | Planned — not started |
| Cycle 6 — Flanker Implementation | Planned — not started |
| Cycle 7 — Analysis & Results | Planned — not started |
| Cycle 8 — Backend & Persistence | Planned — not started |
| Cycle 9 — Personal Observatory | Planned — not started |
| Cycle 10 — Testing, Pilot & Deployment | Planned — not started |
| Application implementation | Not started |

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
