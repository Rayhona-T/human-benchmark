# Experiment and Data Conventions

**Status:** Cycle 1 conceptual decisions for the initial Stroop and Flanker experiments. These conventions guide protocol review and later data-dictionary work; they are not a database schema, API, or implementation specification.

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

- Record stimulus onset and the first valid mapped keydown with the same monotonic clock.
- RT is the elapsed time from recorded stimulus onset to the first valid mapped keydown timestamp.
- Ignore keypresses before stimulus onset, keyboard auto-repeat, and key events after the first valid response or outside the active stimulus.
- If focus or visibility is lost during an active stimulus, mark that trial technically invalid, not a timeout; record the reason and do not silently replay it.
- Browser timing is device- and environment-dependent. Do not claim laboratory-grade timing; deeper timing validation belongs in Cycle 2.

Each protocol may specify additional timing details, but should not redefine these shared basics without an explicit decision.

## 4. Practice, Main Trials, and Session Completeness

- Practice trials are identified separately, may provide correctness feedback, and are excluded from main-trial metrics.
- Main-trial feedback behavior is specified per experiment; the current proposals provide no correctness feedback during main trials.
- A **complete** session means the planned trial sequence reached its end; it may still contain explicitly invalid trials.
- An **incomplete** session did not reach the planned end. An **interrupted** session stopped because of a technical interruption. Neither should be presented as a completed session.
- Session completion and trial validity are separate: an invalid trial does not by itself make every other trial invalid.
- Do not calculate or display a complete-session contrast from an incomplete/interrupted session without clearly labeling it and defining the rule in the protocol.

Exact session-level invalidity thresholds and incomplete-session presentation rules remain for Cycle 2.

## 5. Minimum Conceptual Trial Record

Every trial must be interpretable in its session and experiment-version context. Preserve at least:

- Trial index and practice/main designation.
- Experiment and protocol/configuration version; condition.
- Stimulus identity and task-relevant attributes (for example, word and ink color or arrow pattern and target direction).
- Correct response mapping and participant response, or no response.
- Outcome category and timeout/invalid reason where applicable.
- RT where defined, plus recorded stimulus-onset and response timestamps.
- Associated session randomization seed, randomization/schedule version, and realized trial order.

These are information requirements only. The data dictionary must later define field names, types, units, export representation, and treatment of missing values.

## 6. Privacy and Transparency

- Collect only data necessary to present, interpret, reproduce, or export the session.
- Avoid names, contact details, and device fingerprinting for guest participation unless a separate, justified decision is made.
- Explain collection and handling before participation.
- Keep trial outcomes, session status, experiment version, and randomization context explicit rather than inferring them from a final score.
- Do not create a combined score, rank participants, or infer diagnosis or general ability from these records.

## 7. Cycle 2 Questions

- Finalize a data dictionary and export representation without prematurely defining persistence or database structure.
- Review the outcome and denominator conventions for each experiment against its protocol and analysis rationale.
- Define missing, invalid, interrupted, and session-level data-quality rules.
- Specify how seeds, randomization method versions, configurations, and realized order support reproducibility.
- Determine which timing, browser, or device metadata are justified, privacy-preserving, and useful.
- Define which trial and session information participants can inspect, export, and clear.
