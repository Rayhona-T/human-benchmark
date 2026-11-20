# Cycle 2 — Scientific Protocol, Questions, and Approval Package

**Status:** Cycle 2 Task 4 is complete and awaiting human review. Task 1 and Task 2 are approved. Task 3 remains awaiting human review. Cycle 2 is not fully approved and Cycle 3 is not started.

## 1. Approval Package

The package is intentionally distributed across existing project documents:

1. **Literature foundation:** [LITERATURE_REVIEW.md](../scientific/LITERATURE_REVIEW.md)
2. **Approved Stroop protocol:** [STROOP_PROTOCOL.md](STROOP_PROTOCOL.md)
3. **Flanker protocol draft:** [FLANKER_PROTOCOL.md](FLANKER_PROTOCOL.md)
4. **Harmonized conventions:** [EXPERIMENT_DATA_CONVENTIONS.md](EXPERIMENT_DATA_CONVENTIONS.md)
5. **Resolved and unresolved decisions:** this document
6. **Implementation scope:** [REQUIREMENTS.md](../REQUIREMENTS.md) and [ROADMAP.md](../ROADMAP.md)

## 2. Cross-Protocol Consistency Audit

| Area | Stroop | Flanker | Audit result |
|---|---|---|---|
| Purpose | Color-word interference adaptation | Arrow-Flanker response competition adaptation | Agree: descriptive, task-specific, and within-session |
| Conditions | Congruent, incongruent, neutral | Congruent, incongruent, neutral | Terminology agrees; stimulus definitions remain paradigm-specific |
| Neutral | Unnormed non-color English words, four per ink | Four em dashes around the target | Intentionally different baselines; both expressly non-inert and unvalidated |
| Practice | 12; 4/condition; no mastery threshold | 12; 4/condition and 2/direction | Harmonized structure; allocation differs only because of target-direction balance |
| Main trials | 60; 20/condition | 60; 20/condition | Agree as pragmatic short-MVP choices |
| Timing | 500 ms fixation, 2,000 ms deadline, 500 ms ITI | Same | Harmonized |
| Break | Skippable after trial 30; record taken/duration | Same | Harmonized |
| Responses | Fixed logical D/F/J/K for four colors | Fixed logical F/J for left/right | Intentionally paradigm-specific; both bind `event.key`, not `event.code` |
| Unmapped/repeat input | Ignored | Ignored | Harmonized |
| RT | rAF onset to first valid keydown; median correct RT | Same convention | Harmonized |
| Accuracy | Correct/(correct + incorrect) | Same | Harmonized |
| Successful response | Correct/(correct + incorrect + timeout) | Same | Harmonized |
| Invalid/timeout | Invalid excluded; timeout included in successful and timeout rates | Same | Harmonized |
| Contrast display | Three descriptive RT/rate contrasts | Three descriptive RT/rate contrasts | Harmonized formulas and positive-direction definitions |
| RT display floor | 10 valid correct RTs per condition | Same | Pragmatic product rule, explicitly not validated |
| Randomization | Seeded pool shuffle with condition/repetition constraints | Concealed seeded six-item balancing sets | Both reproducible; algorithm differs intentionally |
| Session state | Complete, incomplete, interrupted, technical_error | Same | Harmonized |
| Focus/visibility | Active-trial invalidation; pre-onset pause | Same | Harmonized |
| Incomplete session | No complete contrasts | Same | Harmonized |
| Stimulus geometry | 48 px uppercase word, dark background | 272 px five-cell row, fixed 48 px cells | Paradigm-specific, both require fixed layout and no trial-time rescaling |
| Feedback | Practice feedback; no main feedback | Same | Harmonized |
| Privacy | Guest/minimal collection; no unnecessary identity/fingerprinting | Same | Harmonized |

### Meaningful differences

- Stroop uses four response keys and a color/word stimulus family; Flanker uses two direction keys and a five-glyph array.
- The neutral conditions are not equivalent baselines. Stroop neutral words remain semantic words; Flanker em dashes are spatial symbols and a different perceptual stimulus family.
- Stroop exact randomization allocates a balanced 60-item pool and constrained shuffle. Flanker uses ten concealed balanced six-item sets.
- Stroop adds exact 12-item practice allocation and a seed-selected derangement. Flanker adds exact condition-by-direction balance.

These differences are scientifically justified and should not be standardized away.

### Harmonized risks

- Browser and input timing remain the primary cross-protocol measurement limitation.
- The fixed key mappings introduce key-layout and motor effects.
- Condition counts are short-MVP choices, not power or individual-reliability validation.
- Fixed trial counts and 10-correct thresholds can produce sparse or unavailable summaries after timeouts and invalid trials.
- Incomplete or interrupted sessions must never be relabeled complete or used for complete-session contrasts.

## 3. Resolved Decisions

| Decision | Status | Rationale |
|---|---|---|
| Shared outcome categories | **Resolved** | Correct, incorrect, timeout, and technical/protocol-invalid are distinct and are handled consistently. |
| Shared RT calculation | **Resolved** | Both protocols use browser-recorded stimulus onset and the first valid mapped keydown on one monotonic clock. |
| Shared accuracy and denominators | **Resolved** | Accuracy excludes timeout; successful-response and timeout rates include timeout; invalid trials are excluded. |
| 10-correct RT display floor | **Resolved as pragmatic MVP** | Applied consistently to condition medians and contrasts, while explicitly documented as unvalidated. |
| Complete/incomplete/interrupted/technical-error status | **Resolved** | Unpresented trials are not outcomes, and no complete contrasts are shown for non-complete sessions. |
| Active focus/visibility interruption | **Resolved** | Invalidates the active trial, never a timeout or silent replay. |
| Practice/main separation | **Resolved** | Practice is separately identified and excluded from main metrics. |
| Configuration/version and realized schedule recording | **Resolved** | Session reproducibility requires seed, PRNG/schedule identifier, configuration version, and realized order. |
| Privacy baseline | **Resolved** | Guest participation, minimal collection, disclosure, clearing of active session state, and no combined/diagnostic score. |
| No combined cognitive score | **Resolved** | Accuracy, success, timeout, and RT remain separate task observations. |
| Stroop approval metadata | **Resolved** | Roadmap and protocol metadata now agree that Task 2 is approved; approval does not claim scientific or clinical validation. |

Evidence-based decisions distinguish paradigm evidence and browser-timing evidence from product choices. The following are pragmatic MVP choices, not scientific validations: 12 practice/60 main trials, 500/2,000/500 ms timings, break at trial 30, fixed mappings, and the 10-correct RT display rule.

## 4. Remaining Unresolved Questions

The items below are explicit limitations or future-review items, not hidden assumptions.

### Human review required for Flanker

- Confirm that the em-dash baseline is acceptable in the stated protocol or require a future replacement study.
- Approve the fixed five-cell geometry, 48 px cells, 40 px glyph, font fallback, and fixed F/J mapping for the intended MVP scope.
- Confirm that concealed six-item balancing sets are acceptable given restricted schedule distributions and possible regularity.

### Before release

- Select and document the supported desktop browser/device scope.
- Test actual layout, legibility, keyboard behavior, focus/visibility behavior, and browser timing on that scope.
- Finalize exact data-dictionary field names, units, missing-value representation, and export format.
- Complete accessible keyboard and screen-reader review of briefings, controls, status, and results.
- Decide whether alternative input or presentation modes belong in a later release and, if added, document that they are not timing-equivalent.

### Future research, not MVP blockers

- Whether longer schedules or other neutral stimuli improve reliability or power.
- Whether mapping, stimulus, and baseline variants need counterbalancing.
- Participant eligibility, consent language, recruitment, retention, anonymization/deletion, oversight, and pilot protocol.
- Whether browser timing should receive external hardware validation.
- Whether a future personal observatory or data persistence feature is scientifically and ethically justified.

## 5. Scientific Claims and Safeguards

- The literature review supports established Stroop and Flanker condition differences and broad browser-measurement feasibility, but not protocol or individual-score validation.
- Protocol descriptions distinguish the established task phenomenon from protocol-specific product choices.
- Participant-facing text does not claim diagnosis, IQ measurement, clinical validity, universal cognitive ability, stable traits, or rankings.
- Group-level effects do not imply reliable individual differences.
- Neutral baselines are described as chosen comparison conditions, not inert or absence conditions.
- Browser RT is described as browser-recorded; physical stimulus onset and cross-device equivalence are not claimed.
- Results require counts, denominators, invalid/timeout reporting, and the relevant limitations.
- Accessibility and participant-care sections disclose color, visual, motor, keyboard-layout, timing, and English-language limitations.
- Formal research use requires separate consent, privacy, protocol, eligibility, and oversight review.

## 6. Implementation-Readiness Assessment

**Verdict:** The scientific specifications are sufficiently complete for a frontend foundation and for implementation planning of the documented shared mechanics, subject to the remaining items below. The Flanker protocol itself remains awaiting human approval.

### Directly implementable from approved/harmonized specifications

- Shared session and trial lifecycle, outcome categories, and session statuses.
- Monotonic timestamp capture and browser-recorded RT rule.
- Shared denominator and contrast formulas.
- Practice/main separation, feedback policy, deadlines, fixation, ITI, and break flow.
- Stroop's approved stimuli and schedule rules.
- Flanker's draft stimuli and schedule rules, which can be implemented only if the Task 3 draft is approved or used in a non-release implementation.
- No combined result; no diagnosis, intelligence, ranking, or normative comparison.

### Implementation ambiguities

- Final export field names and data types.
- Exact browser/device support scope.
- Whether and how browser/device metadata are collected.
- Final active-session clear behavior and export presentation details.
- Human approval of the remaining Flanker design items.

### Risks requiring attention

- rAF timing and keyboard event variance.
- Focus/visibility interruption testing.
- Schedule reproducibility and schedule-generation failure paths.
- Screen-size/viewport handling, especially the fixed Flanker array.
- Sparse medians and contrasts after invalid, timeout, or incomplete outcomes.
- Accessibility of timing-dependent controls and stimuli.

### Items that do not block frontend foundation

- Database/API implementation.
- Server-side persistence and retention policy.
- Personal session history or cross-session observatory.
- Formal population pilot, recruitment, or research oversight.
- External hardware validation of browser timing.
- Future alternative input modes.

## 7. Cycle 2 Completion Summary

Task 4 has completed the cross-protocol audit, shared conventions, open-question review, scientific claim audit, and implementation-readiness assessment using existing documentation. No application code or implementation architecture was added.

The package is coherent for human review, but does not constitute Cycle 2 full approval until Task 3 is explicitly approved and Task 4 is separately accepted.
