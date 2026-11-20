# HUMAN BENCHMARK — Product Requirements

## 1. Purpose and Scope

This document defines product-level requirements for the educational, research-inspired HUMAN BENCHMARK platform. It is intended to guide incremental design and implementation of the initial Stroop and Flanker experiences.

The document distinguishes the **MVP** from deferred and future functionality. It does not specify application architecture, database schemas, API endpoints, or final experimental protocols. Those require later design work. Requirements marked **Must** define the MVP baseline; **Should** items are desirable but may be deferred with an explicit reason; **Could** items are optional; **Future** items are outside the MVP.

The platform is not a clinical diagnostic tool, validated neuropsychological assessment, IQ test, or intelligence-ranking service.

## 2. Definitions and Glossary

| Term | Definition |
|---|---|
| Cognitive construct | A concept used to describe a pattern or process of cognition, such as selective attention. It is not directly observed in the same way as a button press; researchers use task behavior and theory to study it. |
| Experiment | A structured procedure that presents stimuli or tasks under defined conditions and records participant responses for a stated purpose. |
| Experimental condition | A defined version or context of a trial that allows responses to be described or compared, such as a compatible versus conflicting stimulus arrangement. |
| Trial | One instance of presenting a task stimulus and collecting the participant's response or recording that no response occurred. |
| Stimulus | The information presented to a participant on a trial, such as text, color, or an arrangement of arrows. |
| Response | An action recorded from the participant for a stimulus, such as a key press or click. |
| Reaction time | The elapsed time between a defined stimulus or response-ready event and a recorded response. In a browser, it is affected by the device, browser, display, input hardware, and implementation; it is not laboratory-grade timing by default. |
| Accuracy | Whether a response matches the response rule defined for a trial. It may be correct, incorrect, or not scorable under the protocol. |
| Practice trial | A familiarization trial intended to help a participant learn the instructions and response mapping. It is distinct from a main trial and is not included in the main-trial analysis unless a protocol explicitly says otherwise. |
| Main trial | A trial designated by the experiment protocol for the primary session analysis, distinct from practice. |
| Session | One participant's run of an experiment, including its experiment version, trial records, status, and relevant session metadata. A session does not itself imply an account or identified person. |
| Independent variable | A factor defined or varied by an experiment's design, such as a stimulus condition. |
| Dependent variable | An observed outcome recorded for analysis, such as accuracy or reaction time. |
| Confound | A factor that varies with the condition of interest and could offer an alternative explanation for an observed difference. |
| Data quality | The extent to which recorded session data are complete and interpretable for the analysis defined by the protocol. It does not mean that a participant is good or bad at a task. |
| Cognitive interference | A term for a task-specific performance cost or influence associated with competing or conflicting information. Its operational meaning depends on the experiment design and analysis. |
| Invalid trial | A trial that the documented protocol or data-quality rule says should not contribute to a particular analysis, for example because a response was not scorable. It should remain distinguishable from a valid trial in the record. |

## 3. Stakeholders and Users

- **Participants:** people who voluntarily try an experiment and review or export their session data.
- **Learner-users:** participants primarily interested in psychology, neuroscience, or behavioral data methods.
- **Project creator/developer:** the individual learning and maintaining the product, its experiments, and analysis.
- **Scientific reviewers or educators (possible future stakeholders):** people who may review explanations, protocols, or educational use; no formal collaboration is assumed.
- **Privacy, accessibility, or research-oversight reviewers (as applicable):** reviewers needed before collecting, sharing, or using data beyond personal educational sessions.

## 4. User Personas

- **The curious visitor:** wants to try a short task, understand what it explores, and see an explanation without creating an account.
- **The psychology student:** wants a clear briefing and a way to connect task conditions with behavioral measures.
- **The methods learner:** wants to understand what trial-level data contain and how descriptive results are produced.
- **The returning participant (future):** wants to compare their own earlier sessions while understanding that session-to-session variation is not a diagnosis or trait judgment.

These personas describe product needs, not demographic profiles or clinical categories.

## 5. User Journeys

### A. First-time guest discovers and completes an experiment — MVP

1. The visitor arrives at a landing page that explains the platform's educational purpose and boundaries.
2. They browse the experiment catalogue and open an experiment's details.
3. They read a scientific briefing and a plain-language privacy/data notice.
4. They choose to begin, review instructions, and complete practice trials.
5. If practice is sufficient under the protocol, they begin the main trials; otherwise, the experience provides the protocol-defined next step.
6. On completion, they see a session summary with measures, data-quality context, interpretation, and limitations.
7. They may export or clear the session data.

### B. Participant reads instructions, practices, completes trials, and views results — MVP

1. The participant reviews response mappings and experiment instructions.
2. Practice responses receive appropriate feedback and do not become main-trial observations.
3. The experience presents trials in the protocol-defined order or randomized sequence and records condition, stimulus, response, timing, accuracy, and trial status as applicable.
4. The participant receives a clear indication of progress and completion.
5. Results use the documented analysis rules and explain exclusions or quality limitations.

### C. Participant exports session data — MVP

1. From the completed session summary, the participant selects the export option.
2. The platform provides a documented, machine-readable export containing the session's available trial-level data and experiment/version context.
3. The participant can inspect the downloaded file outside the platform.
4. The export does not silently add unnecessary personal information.

The exact export format and field contract are to be decided with the data dictionary before implementation.

### D. Returning user compares previous sessions — Future

1. A returning participant accesses their own saved sessions.
2. They select sessions that are sufficiently comparable in experiment version and protocol.
3. The platform explains differences in versions, conditions, and data quality before presenting a comparison.
4. Results remain descriptive and do not imply diagnosis, stable traits, or population norms.

This journey depends on a separate decision about persistence, identity or local storage, deletion, and privacy. It is not an MVP requirement.

## 6. Functional Requirements

Priorities: **Must** = MVP baseline; **Should** = recommended, but may be deferred; **Could** = optional; **Future** = explicitly outside MVP.

### Discovery and scientific context

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-DIS-01 | Must | The product shall provide a landing page that explains its educational purpose and non-diagnostic status. | A first-time visitor can find the purpose and the statement that the product is not a validated assessment, IQ test, or intelligence ranking. |
| FR-DIS-02 | Must | The product shall provide a catalogue of the available experiments. | Each available experiment has a name and a route to its details; unavailable experiments are not presented as runnable. |
| FR-DIS-03 | Must | Each runnable experiment shall have a details page and scientific briefing. | The page explains the task's general research theme, what the session records, its limitations, and how to begin. |
| FR-DIS-04 | Should | The science library shall provide discoverable explanations of relevant concepts, methods, and verified references. | Each published reference can be checked against a reliable source; unverified references are not fabricated or presented as fact. |

### Participation and session flow

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-PAR-01 | Must | A participant shall be able to take part as a guest without creating an account. | A complete MVP experiment can be started and finished without account creation or identity fields. |
| FR-PAR-02 | Must | Before starting, the participant shall receive instructions, response mappings, and a clear notice about session data. | Instructions and the data notice are available before the first trial; the participant explicitly chooses whether to proceed. |
| FR-PAR-03 | Must | Each experiment shall provide protocol-defined practice trials before its main trials. | Practice and main trials are distinguishable; practice trials do not enter main-trial results unless a documented protocol specifically requires it. |
| FR-PAR-04 | Must | The participant shall be able to start, progress through, and complete the experiment's trials. | The flow follows the approved experiment configuration, indicates progress, and reaches a completion state only when the required trials are complete. |
| FR-PAR-05 | Must | The experiment shall accept only the response inputs defined for the current task and record the response or non-response. | Valid inputs map to the configured response choices; unexpected input does not silently become a valid response. |
| FR-PAR-06 | Must | Trial order and condition assignment shall follow the experiment's documented sequencing and randomization rules. | The recorded session identifies the experiment version and condition/order information needed to interpret the trials; behavior matches the approved protocol. |
| FR-PAR-07 | Must | The session shall represent its status, including incomplete or interrupted sessions. | Leaving or interruption does not silently create a completed result; incomplete sessions are visibly labeled and handled according to the protocol. |
| FR-PAR-08 | Should | The experience shall support restarting or resuming only where the experiment protocol permits it. | A restart/resume action does not mix old and new trial data or misrepresent the session's completion status. |
| FR-PAR-09 | Must | The experience shall provide a clear completion transition to results. | Results are shown only for a session in a completed state, with any protocol-defined exclusions or missing data explained. |

### Experiment data and results

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-DAT-01 | Must | The platform shall collect trial-level records sufficient to reproduce the documented session summaries. | Each recorded trial can be associated with its session, experiment version, condition, stimulus, response, timing, accuracy/scorability, and practice/main status as applicable. |
| FR-DAT-02 | Must | A session shall include the experiment version/configuration identifier and the minimum metadata required by its protocol. | The session context is available alongside trial records; metadata collection is documented and excludes unnecessary personal information. |
| FR-DAT-03 | Must | Invalid, missing, and incomplete trial data shall be represented explicitly. | A trial excluded by a documented rule remains distinguishable from a valid trial, and the reason or status is available for analysis and explanation. |
| FR-DAT-04 | Must | The results shall present accuracy and reaction-time measures where the experiment protocol supports them. | Displayed values can be traced to documented calculations; missing, invalid, or non-scorable observations are handled according to that protocol. |
| FR-DAT-05 | Must | The results shall provide appropriate descriptive statistics and condition comparisons defined by the analysis plan. | Every displayed summary matches the documented analysis plan; no unplanned inference or population comparison is implied. |
| FR-DAT-06 | Should | Results shall include visualizations that clarify the task's data without overstating precision. | Each visualization labels its measure and conditions, is consistent with the displayed summary, and has an accessible text equivalent or explanation. |
| FR-DAT-07 | Must | Results shall include data-quality indicators and a plain-language interpretation with limitations. | The participant can identify incomplete or excluded data, understand what the observed measures describe, and find what cannot be concluded. |
| FR-DAT-08 | Must | A participant shall be able to export their completed session data. | The download includes available trial-level records and documented session/experiment context in a format defined before implementation; it contains no unannounced personal information. |

### Privacy and data control

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-PRI-01 | Must | The MVP shall support guest participation and avoid requiring unnecessary personal information. | No name, email, or account is required to complete or export an experiment. |
| FR-PRI-02 | Must | Data collection shall be disclosed before an experiment and limited to documented task and session needs. | The notice describes collected categories and purpose; no hidden tracking or undisclosed analytics are introduced. |
| FR-PRI-03 | Must | The participant shall be able to clear session data held by the active MVP experience. | A clear action removes the active session from the platform's available session state; the interface clarifies that previously downloaded copies are outside the platform's control. |
| FR-PRI-04 | Future | If server-side persistence is introduced, participants shall have a documented means to request deletion of stored session data. | Deletion behavior, scope, and any retention exceptions are disclosed and verified before the persistence feature is released. |

### Science library

| ID | Priority | Requirement | Acceptance criteria |
|---|---|---|---|
| FR-SCI-01 | Must | Each MVP experiment shall explain the cognitive concepts and task design relevant to its briefing and results. | The explanation is linked from the experiment and uses language consistent with the protocol and analysis. |
| FR-SCI-02 | Must | Published scientific explanations shall distinguish task observations from broader interpretation and state relevant limitations. | No explanation claims a single task directly measures a single isolated brain ability or establishes an individual's diagnosis or intelligence. |
| FR-SCI-03 | Should | Methodology and references shall be available for published experiment descriptions. | References are verified and the method description corresponds to the implemented experiment version. |

## 7. Non-Functional Requirements

| ID | Area | Requirement and verification criterion |
|---|---|---|
| NFR-PER-01 | Performance | Trial transitions and response feedback should feel immediate on the documented supported-device set. Measure and review interaction latency during implementation; do not trade scientific timing transparency for cosmetic animation. |
| NFR-REL-01 | Reliability | The flow shall not silently lose, duplicate, or misattribute trial records during an uninterrupted session. Automated tests shall cover trial progression, completion, interruption, and record-to-summary consistency. |
| NFR-COMP-01 | Browser compatibility | Supported browser and version targets shall be documented before release. Each supported target shall pass the experiment-flow smoke tests; unsupported environments shall be identified rather than silently assumed equivalent. |
| NFR-ACC-01 | Accessibility | Core navigation, briefing, results, and export controls shall be keyboard operable and have programmatic names. Accessibility checks shall include automated evaluation and manual keyboard/screen-reader review before MVP release. |
| NFR-ACC-02 | Accessibility | Text, focus, error, and status presentation shall remain understandable without color alone. Timing-dependent tasks shall disclose relevant limitations; accommodations that change timing must not be presented as directly comparable unless justified by the protocol. |
| NFR-USE-01 | Usability | A first-time participant shall be able to find the briefing, understand the response mapping, complete practice, and locate results/export without relying on undocumented developer knowledge. Verify through task-based review with representative users before broad release. |
| NFR-SEC-01 | Security | The MVP shall not expose secrets or collect unnecessary identifying information. Any later network or persistence features require a threat-appropriate security review before release. |
| NFR-PRI-01 | Privacy | Data categories, purposes, retention, and deletion behavior shall be documented before collection. No third-party analytics or tracking shall be added without explicit review and disclosure. |
| NFR-MNT-01 | Maintainability | Experiment instructions, conditions, trial rules, and analysis choices shall be documented and versioned so changes can be reviewed and related results interpreted. |
| NFR-TST-01 | Testability | Trial sequencing, response scoring, invalid-trial handling, and summary calculations shall have focused tests against protocol-defined examples before an experiment is considered complete. |
| NFR-SCI-01 | Scientific transparency | Each experiment release shall link its protocol, analysis plan, version, references when verified, and limitations to the participant-facing explanation. |
| NFR-TIME-01 | Timing integrity | The platform shall document how timing is recorded and acknowledge browser, operating-system, display, and input-device variability. It shall not claim laboratory-grade timing or use unsupported precision in interpretation. |
| NFR-RESP-01 | Responsive design | Briefings, task instructions, and results shall remain usable at the documented supported viewport sizes. Timing-critical trials shall not begin in a layout that obscures stimuli or response instructions. |
| NFR-DATA-01 | Data integrity | Exported records and displayed summaries shall be consistent with the same completed session; missing or invalid values shall not be silently converted into plausible measurements. |

## 8. MVP Scope

The MVP is the smallest coherent guest experience for the two planned experiments:

- A landing page and catalogue with clear non-diagnostic framing.
- A scientific briefing, data notice, task instructions, and practice trials for Stroop and Flanker.
- Protocol-driven trial presentation, response handling, sequencing, and trial-level records.
- Explicit session and trial status, including incomplete and invalid data handling.
- Session results with protocol-defined accuracy, reaction-time, descriptive summaries, condition comparisons where justified, quality indicators, interpretation, and limitations.
- A documented export of completed session data and an action to clear active session data.
- Focused tests for trial flow, data recording, invalid handling, and result calculations.

The MVP does not require accounts, server-side persistence, session history, cross-session comparison, or a large content library. Exact protocol details and export field formats must be agreed in the scientific blueprint before implementation.

## 9. Out of Scope

Initial versions explicitly exclude:

- Diagnosis or clinical decision support.
- IQ estimation or a universal "brain score."
- Ranking participants by intelligence or social leaderboards.
- Claims of clinical validity or validated neuropsychological assessment.
- EEG, neuroimaging, or other physiological measurement.
- AI-generated diagnoses or participant-level psychological judgments.
- Large-scale research claims without appropriate protocol, consent, privacy safeguards, and any required oversight.
- Predictive machine learning without a justified research question and suitable, appropriately governed data.

## 10. Constraints and Assumptions

### Confirmed constraints and decisions

- The project is a monorepo; the planned frontend is React, TypeScript, and Vite.
- The planned backend is Python and FastAPI; scientific analysis is planned with NumPy, pandas, and SciPy.
- PostgreSQL is planned for a later stage.
- Initial experiments are Stroop Effect and Flanker Effect, with a reusable experiment engine intended eventually.
- Participants should receive scientific briefings, complete practice before main trials, and have trial-level data collected.
- The product is educational and research-inspired, not diagnostic or a validated cognitive assessment.
- Guest participation, privacy-first design, and data export are preferred for the MVP.

### Assumptions to verify

- The MVP can provide the complete experiment and export experience without requiring accounts or server-side persistence.
- The initial experiments can be specified with protocols and analysis plans appropriate to an educational product.
- Browser timing is adequate for clearly caveated descriptive exploration, but not a substitute for controlled laboratory timing.
- A supported browser/device set can be chosen and documented during implementation.

### Unresolved decisions

- Exact protocols, hypotheses, stimuli, trial counts, randomization, exclusion rules, and analysis plans.
- Export format and field definitions.
- Whether any session data will persist beyond the active experience, and if so, where and for how long.
- Any analytics, pilot recruitment, research use, consent language, or oversight requirements.
- Supported browsers/devices and accessibility accommodations for timing-dependent tasks.

## 11. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Participants interpret a task-specific result as an intelligence or health judgment. | Avoid rankings and trait labels; explain measures, uncertainty, and limitations beside results. |
| Unspecified protocols lead to inconsistent tasks or post-hoc analysis choices. | Complete and review the scientific blueprint, data dictionary, and analysis plan before implementing each experiment. |
| Browser/device timing variability undermines reaction-time interpretation. | Document timing limits, test across the supported set, record only justified context, and avoid laboratory-grade claims. |
| A superficially random sequence creates condition imbalance or unexpected patterns. | Define and review randomization and condition rules in the protocol; test the implemented sequence against those rules. |
| Privacy expectations are unclear or session data are retained unintentionally. | Minimize collection, disclose data handling, provide active-session clearing, and defer persistence until retention and deletion are decided. |
| Timing-dependent interactions exclude or disadvantage some users. | Make instructions and navigation accessible, disclose task limits, evaluate accommodations, and avoid comparing non-equivalent sessions. |
| A growing scope overwhelms an individual beginner developer. | Keep the MVP to two experiments and phase work; defer accounts, persistence, history, and research mode. |
| AI-assisted explanations introduce unsupported science or false citations. | Verify sources, have scientific content reviewed, and prohibit invented references or automated participant-level conclusions. |
| Pilot activity is mistaken for formal research or yields overclaimed findings. | Treat usability testing separately from research claims; obtain appropriate consent and oversight before research use or public claims. |

## 12. High-Level MVP Acceptance Criteria

The MVP is ready for review when:

1. A guest can discover, read about, and complete each of the two implemented experiments without an account.
2. The implemented stimuli, trial sequence, conditions, practice/main distinction, scoring, and exclusions match reviewed and versioned protocols.
3. Trial-level data and session context are recorded consistently; incomplete and invalid data are represented rather than silently treated as valid.
4. Results are reproducible from the session data and documented analysis rules, include appropriate data-quality context, and state limitations.
5. A participant can export the session data and clear active session data; the data notice accurately explains what the MVP does.
6. Core flows pass focused automated tests and documented manual browser, keyboard, and accessibility checks.
7. Participant-facing content makes no diagnostic, IQ, intelligence-ranking, validation, or unsupported research claims.

## 13. Traceability to the Roadmap

- **Phases 1–2:** define protocols and content, then build discovery and briefing experiences.
- **Phases 3–5:** implement and test the reusable trial flow and both experiments.
- **Phase 6:** complete session analysis, results, quality indicators, and export.
- **Phases 7–8:** consider persistence and personal history only after privacy and retention decisions.
- **Phases 9–10:** review quality and determine whether deployment is appropriate.
