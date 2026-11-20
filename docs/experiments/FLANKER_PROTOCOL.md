# Flanker Experiment — Foundation Proposal

**Status:** Cycle 1 foundation proposal. The structure below is preliminary and is not a scientifically approved or validated protocol. Cycle 2 must review the paradigm, stimuli, trial counts, timing, and analyses against verified literature.

## 1. Purpose

Participants respond to the direction of a central arrow while ignoring surrounding symbols. This proposal establishes a starting point for the initial Flanker experiment; it does not claim that a session measures a single isolated cognitive ability.

## 2. Instructions and Response Mapping

### Draft participant instructions

> Look at the **center arrow** and respond to its direction. Ignore the symbols on either side.  
>
> Press **F** for Left and **J** for Right.  
>
> You will complete practice trials with correctness feedback before the main task. The main task does not provide correctness feedback. Respond as accurately and promptly as you can. A trial ends after your first valid response or after 2 seconds if no valid response is received.

The initial MVP instructions are in English, consistent with the proposed Stroop MVP language. Show the key mapping throughout practice and explain the task's limits before participation.

### Proposed response mapping

| Key | Response |
|---|---|
| F | Left |
| J | Right |

This is a simple two-choice proposal, not a researched or validated mapping. Keyboard layout, hand/finger differences, and accessibility may affect responses. The mapping and whether it should be counterbalanced remain Cycle 2 questions.

## 3. Conditions and Stimuli

Use a five-symbol horizontal display with the target arrow in the center position and two flankers on each side.

| Condition | Example with left-pointing target | Example with right-pointing target | Main trials |
|---|---|---|---:|
| Congruent | `<<<<<` | `>>>>>` | 20 |
| Incongruent | `>><>>` | `<<><<` | 20 |
| Neutral | `--<--` | `-->--` | 20 |

The center symbol determines the correct response. In the proposed neutral condition, hyphens are non-directional surrounding symbols. The exact symbol, spacing, font, visual size, and display contrast remain open for Cycle 2 review.

## 4. Practice and Main Trial Proposal

- **Practice:** 12 trials with correctness feedback. Proposed allocation: 4 trials per condition, with two left and two right targets in each condition. Practice is excluded from all main analyses.
- **Main task:** 60 scheduled trials: 20 per condition, with 10 left and 10 right targets within each condition.
- **Feedback:** No correctness feedback during main trials.
- **Break:** Offer the same optional break after main trial 30 as in the Stroop proposal. Whether it is self-paced and skippable should be aligned across both experiments.

Matching the Stroop's proposed counts makes an initial shared experience easier to reason about; it is a product consistency choice, not evidence that these counts are scientifically adequate for the Flanker task.

## 5. Timing and Trial Flow

Use the same preliminary timing convention proposed for Stroop:

1. Fixation cross for 500 ms.
2. Record stimulus onset.
3. Present the five-symbol stimulus until the first valid F/J keydown or the 2,000 ms response deadline.
4. Start a 500 ms inter-trial interval after response or timeout.

Measure elapsed time from the recorded stimulus-onset timestamp to the first valid mapped keydown timestamp using one monotonic clock. Ignore pre-stimulus keypresses, repeated key events, and key events outside the active stimulus. A focus/visibility interruption during the active stimulus makes the trial technically invalid, not a timeout; record the reason, do not replay the trial silently, and wait for visibility/focus before continuing. These are preliminary shared conventions, not a browser timing validation.

## 6. Randomization Proposal

- Constrained randomization: 20 trials per condition and balanced left/right target directions within each condition.
- Do not allow more than three consecutive trials from the same condition.
- Avoid an identical complete stimulus on adjacent trials where the approved schedule permits.
- Record the random seed, schedule/configuration version, randomization method version, and realized trial order.
- Exact sequence constraints and schedule-generation method require Cycle 2 review.

## 7. Outcomes and Trial-Level Data

Report reaction time and response outcomes separately, using the shared conventions in [EXPERIMENT_DATA_CONVENTIONS.md](EXPERIMENT_DATA_CONVENTIONS.md):

- Correct responses, incorrect responses, timeouts, and technical/protocol-invalid trials remain distinguishable.
- Proposed primary RT is the median of correct, valid main-trial responses, with a pragmatic product display rule of at least 10 valid correct responses in each condition.
- Report response accuracy, successful response rate, and timeout rate separately. Do not create a combined score.
- Preliminary descriptive contrasts are incongruent versus neutral, neutral versus congruent, and incongruent versus congruent. Their interpretation and direction require Cycle 2 review.

Minimum information to preserve for each trial, associated with its session context:

- Trial index and practice/main designation.
- Condition and stimulus identity/pattern, including target direction and surrounding symbols.
- Correct response mapping and participant response, if any.
- Outcome category, reaction time where applicable, stimulus-onset and response timestamps.
- Timeout or invalid reason where applicable.
- Randomization seed and schedule/configuration version.

This is a conceptual record checklist, not a database schema.

## 8. Questions for Cycle 2

- Verify the central-arrow paradigm and the rationale for the proposed neutral-symbol baseline.
- Review the number, identity, spacing, and visual properties of flankers and neutral symbols.
- Justify the practice/main trial counts, direction balance, optional break, and response deadline.
- Review the F/J mapping, motor effects, counterbalancing, and accessibility.
- Verify RT and accuracy metrics, intended contrasts, and the shared minimum-count display rule.
- Validate timing and interruption behavior on the intended browser/device set.
- Establish and test the constrained randomization method and its reproducibility.
- Define data-quality, session-completion, and pilot requirements before any research use.
