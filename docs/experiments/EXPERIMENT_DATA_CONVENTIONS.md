# Experiment and Data Conventions

**Status:** Harmonized for Cycle 2 Task 4. These conventions guide protocol review and later data-dictionary work; they are not a database schema, API, or implementation specification.

## 1. Shared Trial Outcomes

Each presented trial must be distinguishable as one of the following:

| Outcome | Meaning | Metric treatment |
|---|---|---|
| Correct | First valid mapped response matches the protocol-defined target response. | Included as correct in response accuracy and successful response rate; eligible for primary RT. |
| Incorrect | First valid mapped response does not match the target response. | Included in response-accuracy and successful-response-rate denominators, not their numerators; excluded from primary correct-response RT but retained as an observation. |
| Timeout | No valid mapped response before the protocol deadline. | Excluded from response-accuracy denominator; included in successful-response-rate and timeout-rate denominators; not a response RT. |
| Technical/protocol-invalid | A predeclared technical or presentation issue makes the trial's data uninterpretable under the protocol. | Excluded from metric denominators and primary RT; report the invalidity reason separately. |

An unrecognized key is not a valid response. A scheduled trial that was never presented because the session ended is not a timeout. It contributes to incomplete-session status rather than being represented as a completed trial outcome.

## 2. Shared Metrics

For each experiment and condition, let `C` be correct, `I` incorrect, `T` timeout, and `V` technical/protocol-invalid trial counts.

- **Response accuracy:** `C / (C + I)`; describes correctness among trials with a valid mapped response.
- **Successful response rate:** `C / (C + I + T)`; counts timeouts as no successful response.
- **Timeout rate:** `T / (C + I + T)`.
- **Invalid-trial count:** report `V` and reasons separately; invalid trials are excluded from all three denominators.

Show the counts and denominator with each rate. If a denominator is zero, report the rate as unavailable rather than zero. Incorrect responses are never removed from the accuracy denominator.

The preliminary primary RT is the median of valid correct main-trial reaction times by condition. Practice and incorrect-response RTs are excluded from this primary measure, but incorrect response and timing observations remain in the trial record. A proposed **minimum of 10 valid correct responses per condition** is a pragmatic product rule for displaying a condition median or a contrast involving that condition. It is not a scientifically validated threshold or a power calculation.

## 3. Shared Timing Convention

- Record stimulus onset and the first valid mapped keydown with the same monotonic clock (`performance.now()` origin, or an explicitly equivalent monotonic timestamp source).
- Use a recorded browser/animation-frame stimulus-onset timestamp, not a claim of physical photon onset.
- RT is the elapsed time from recorded stimulus onset to the first valid mapped keydown handler timestamp.
- End a trial at the next stimulus-offset animation frame after a valid response or at the first frame at or after the deadline for a timeout.
- Ignore keypresses before stimulus onset, keyboard auto-repeat, and key events after the first valid response or outside the active stimulus.
- If focus or visibility is lost during an active stimulus, mark that trial technically invalid, not a timeout; record the reason and do not silently replay it.
- Do not begin an active stimulus while the page is hidden or unfocused; wait until both states are restored.
- Browser timing is device- and environment-dependent. Do not claim laboratory-grade timing or cross-device equivalence without configuration-specific validation.

Each protocol may specify additional timing details, but should not redefine these shared basics without an explicit decision.

## 4. Practice, Main Trials, and Session Completeness

- Practice trials are identified separately, may provide correctness feedback, and are excluded from main-trial metrics.
- Main-trial feedback behavior is specified per experiment; the current proposals provide no correctness feedback during main trials.
- A **complete** session means the planned trial sequence reached its end; it may still contain explicitly invalid trials.
- An **incomplete** session did not reach the planned end through participant departure or another non-technical stop.
- An **interrupted** session stopped because of page closure/reload or an unrecoverable runtime termination.
- A **technical_error** session stops during pre-trial setup or schedule generation and has no usable main-session completion state.
- Neither complete nor incomplete/interrupted/technical-error sessions should be silently presented as normal complete-session results.
- Session completion and trial validity are separate: an invalid trial does not by itself make every other trial invalid.
- Do not calculate or display complete-session contrasts from incomplete, interrupted, or technical-error sessions.

An individual focus/visibility interruption invalidates one presented active trial but does not by itself interrupt the whole session. Unpresented scheduled trials are neither timeout nor invalid outcomes; they contribute to incomplete-session status.

## 5. Minimum Conceptual Trial Record

Every trial must be interpretable in its session and experiment-version context. Preserve at least:

- Trial index and practice/main designation.
- Experiment, protocol/configuration version, and configuration identifier.
- Stimulus identity and task-relevant attributes (for example, word and ink color or arrow pattern and target direction).
- Correct response mapping and participant response, or no response.
- Outcome category and timeout/invalid reason where applicable.
- RT where defined, plus recorded stimulus-onset and response timestamps.
- Associated session randomization seed, PRNG/shuffle identifier, randomization configuration version, schedule-generation status, and realized practice/main trial order.

The conceptual session record must also retain:

- Session identifier, experiment and protocol/version identifiers, practice and main trial counts, and session status.
- Break offered/taken and elapsed duration, and focus/visibility interruption status.
- Seed and realized schedule context, but no unnecessary participant identity or device fingerprint.

These are information requirements only. The data dictionary must later define field names, types, units, export representation, and treatment of missing values. No database or API design is implied.

## 6. Configuration and Reproducibility

- Record the protocol/configuration version and the implemented experiment configuration for every session.
- Record a 32-bit unsigned session seed and the PRNG/schedule identifier for valid schedule generation.
- Record the realized practice and main schedules, schedule-generation status, and any selected stimulus-allocation detail required to reproduce the session.
- A seed or protocol version without the realized order is not sufficient to reconstruct a session.
- Randomization configuration names and algorithms may differ between experiments only when the protocol intentionally defines a different balanced schedule.

## 7. Privacy and Transparency

- Collect only data necessary to present, interpret, reproduce, or export the session.
- Avoid names, contact details, and device fingerprinting for guest participation unless a separate, justified decision is made.
- Explain collection and handling before participation.
- Keep trial outcomes, session status, experiment version, and randomization context explicit rather than inferring them from a final score.
- Do not create a combined score, rank participants, or infer diagnosis or general ability from these records.

## 8. Remaining Implementation Inputs

- Finalize the data dictionary and export representation without prematurely defining persistence or database structure.
- Determine whether browser and device metadata are justified for the supported testing scope; collect only privacy-preserving metadata needed to interpret timing or reproducibility.
- Define the exact export field names, missing-value representation, and active-session clear behavior.
