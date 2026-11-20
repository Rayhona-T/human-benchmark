# Stroop Experiment — Proposed Protocol

**Status:** Cycle 1 foundational defaults consolidated. The proposal remains preliminary and requires Cycle 2 scientific and methodological review; it is not validated and does not measure an individual trait or ability.

## 1. Purpose and Evidence Status

This task asks participants to name the ink color of a displayed word while ignoring the word's meaning. The proposed conditions contrast color words whose meaning agrees with the ink, conflicts with the ink, or is a neutral non-color word. The classic color-word Stroop task and its extensive research history are established; the exact HUMAN BENCHMARK stimuli, timing, trial counts, response mapping, and analysis below are project design choices, not a validated protocol [1, 2].

The three planned comparisons are distinct operational contrasts. Their interpretation depends on the selected neutral stimuli and other task details; they are not interchangeable measures of a general cognitive ability [2, 3].

## 2. Proposed Design at a Glance

| Element | Current proposal |
|---|---|
| Design | Within-participant, repeated-measures; each completed session includes all three conditions. |
| Initial MVP language | English; a product default, not a claim that the stimuli are suitable for every English-reading participant. |
| Conditions | Congruent, incongruent, and neutral. |
| Target ink colors | Red, blue, green, and yellow. |
| Responses | Keyboard keys D, F, J, K using the proposed fixed mapping below. |
| Practice | 12 trials with correctness feedback; practice is excluded from all main analyses. |
| Main task | 60 trials: 20 per condition; no correctness feedback. |
| Trial timings | 500 ms fixation; stimulus until response or 2,000 ms; 500 ms inter-trial interval. |
| Break | Optional break offered after main trial 30. |
| Sequence | Constrained randomization with no more than 3 consecutive trials from one condition; balance colors and stimuli as reasonably as possible. |
| Outcomes | Response accuracy, successful response rate, timeout rate, and reaction time reported separately; no combined score. |

## 3. Participant-Facing Instructions

> In this task, a word will appear in a color. Your job is to respond to the **ink color**, not to read the word.  
>
> Use the keys shown below:
>
> - **D** = Red
> - **F** = Blue
> - **J** = Green
> - **K** = Yellow
>
> First, you will try 12 practice trials and receive correctness feedback. The main task has 60 trials and does not provide correctness feedback. Respond as accurately and promptly as you can. A trial ends after your first valid response or after 2 seconds if no valid response is received.  
>
> You may take an optional break after trial 30. Your results describe this task session only. They are not a diagnosis, IQ estimate, or validated assessment of your general cognitive ability.

This wording is a draft. The final briefing should also state what session data are recorded and how participants can export or clear their session data, consistent with the product requirements.

English is the Cycle 1 default for the initial MVP's instructions and stimuli. This does not resolve participant fluency or inclusion criteria; language familiarity remains a Cycle 2 methodological question.

## 4. Stimulus and Condition Design

The task is a proposed color-naming version of the Stroop task: the relevant response is the display ink color.

| Condition | Proposed stimulus rule | Count |
|---|---|---:|
| Congruent | A color word is displayed in ink matching the word's color meaning; for example, `RED` in red ink. | 20 |
| Incongruent | A color word is displayed in a different one of the four target ink colors; for example, `RED` in blue ink. | 20 |
| Neutral | A non-color word is displayed in one of the four target ink colors. Use the proposed five-word set below. | 20 |

### Neutral word selection

The Cycle 1 language default is English. Participants need sufficient familiarity with the task language to recognize the color words and read the neutral words; differences in language familiarity may affect task performance. A bilingual study reported differences between interference involving a participant's languages and discussed familiarity as a possible factor [6]. This does not determine the appropriate language or participant criteria for HUMAN BENCHMARK; review both in Cycle 2.

The proposed neutral set is:

| Word | Letters | Initial review note |
|---|---:|---|
| `BOOK` | 4 | Review familiarity and possible object/color associations. |
| `CHAIR` | 5 | Review familiarity and possible object/color associations. |
| `FLOWER` | 6 | Longest item; may evoke varied color associations. |
| `HOUSE` | 5 | Review familiarity and possible object/color associations. |
| `STAR` | 4 | Review familiarity; may evoke yellow/gold associations. |

Each word appears four times across the 20 neutral trials, once with each target ink color. This gives balanced word-by-ink presentation, but does not establish that the words are matched or neutral for all participants.

Cycle 2 should review:

- Language familiarity and likely comprehension for the intended participant audience.
- Word length and visual width, including whether the set can be displayed comparably.
- Familiarity or frequency differences between candidate words.
- Direct or indirect association with a particular color.
- Consistent capitalization, font, size, position, and visual presentation across conditions.

Words can differ in semantic associations; Klein's study of semantic power in color naming is a reason to treat word choice as a design variable rather than assume that all non-color words are equivalent [3]. The five words and four repetitions each are Cycle 1 working defaults only. Review the list and replace items if needed before scientific approval; do not describe the set as validated.

### Proposed balance

- Within each condition, each target ink color appears 5 times.
- Congruent trials use each of the four matching word/ink colors 5 times.
- Incongruent trials use each target ink color 5 times and each color word 5 times. The 12 possible non-matching word/ink pairs cannot all occur equally often in 20 trials; distribute them as evenly as possible, with the exact allocation saved in the trial schedule.
- Neutral trials use each target ink color 5 times. Distribute the selected neutral words as evenly as the final word list permits.
- Use consistent display position and typography across all conditions. Exact color values, background, font, and stimulus dimensions still need to be specified and checked for legibility and color contrast.

These are balancing targets for the proposed schedule, not claims that the resulting stimulus set has been psychometrically matched.

## 5. Response Mapping and Limitations

### Proposed fixed mapping

| Key | Response |
|---|---|
| D | Red |
| F | Blue |
| J | Green |
| K | Yellow |

Show this mapping in the instructions and practice. Accept only the first mapped keypress during an active stimulus as that trial's response. Unmapped keys are not valid color responses. Do not provide correctness feedback during main trials.

### Mapping limitations to review

- D/F and J/K are located on opposite sides of a typical QWERTY keyboard, but layouts and physical key positions differ. Participants may use different fingers, hands, or keyboard layouts.
- The fixed assignment associates particular colors with particular keys, hands, and fingers. Differences in key familiarity or motor response can contribute to observed reaction times.
- The mapping is proposed for a simple MVP, not established as optimal. Counterbalancing mappings could reduce mapping-specific bias in a group study, but would add design and analysis complexity and is not specified here.
- Keyboard navigation and the color-naming task may not be usable or comparable for every participant, including some participants with motor, visual, or color-vision differences. The task must not imply that alternative response modes produce directly comparable timing.
- Whether to bind responses to key characters or physical key positions, and how to communicate layouts beyond QWERTY, remains unresolved.

## 6. Practice and Main Experiment

### Practice

- 12 trials, with correctness feedback after each valid response.
- Proposed allocation: 4 trials per condition, with each target ink color represented once in each condition. This gives participants exposure to all conditions and response colors; approve or revise this allocation before implementation.
- Practice records, if retained for task-flow debugging or participant export, must be marked as practice and excluded from main-trial results.
- Whether feedback should also show the correct color/key after an incorrect answer is unresolved; the current requirement is correctness feedback.

### Main trials

- 60 trials total: 20 congruent, 20 incongruent, 20 neutral.
- No correctness feedback after responses or timeouts.
- Progress information may indicate trial count, but must not reveal correctness or condition-level performance during the task.
- A completed session is distinguished from an incomplete session. Technical-invalid trials are marked and reported separately and do not automatically invalidate the entire session.

## 7. Trial Flow and Timing

For each trial:

1. Present a fixation cross for **500 ms**.
2. Record stimulus onset with a **monotonic clock** when the stimulus is presented. A monotonic clock is used for elapsed-time measurement and does not depend on wall-clock time.
3. Accept the first valid mapped `keydown` timestamp after recorded stimulus onset and before the **2,000 ms** deadline. Define reaction time as `keydown timestamp − stimulus-onset timestamp`, using the same monotonic clock for both. Remove the stimulus when the response is registered.
4. Ignore keypresses before stimulus onset; do not carry them into the active trial. Ignore keyboard auto-repeat and any further key events after the first valid response.
5. If no valid mapped response arrives within **2,000 ms** of recorded stimulus onset, end the stimulus and classify the trial as a timeout.
6. Start a **500 ms inter-trial interval** after response or timeout, then begin the next trial. Ignore key events during the interval rather than applying them to the next trial.

The sequence and interval above define the proposed schedule. They do not guarantee that the stimulus is physically displayed for exactly the requested duration on every browser and device. Timing limitations are described in Section 12.

Do not start a timed stimulus while the page is hidden or has lost focus. If visibility or focus is lost after stimulus onset and before the trial ends, mark that trial technically invalid, do not count it as a timeout, and do not accept a later keypress for it. Record the invalid reason and wait until the page is visible and focused before proceeding. Do not silently replay the trial; the session may therefore contain fewer than 20 valid trials in that condition. Interruption behavior is further discussed in Section 11.

### Optional halfway break

Offer a break after main trial 30 and before trial 31. The break is not a trial and is not included in reaction-time or inter-trial-interval calculations. Whether the break is self-paced, skippable, and how its use is recorded should be confirmed before implementation.

## 8. Experimental Design and Randomization

### Design factors

- **Within-session condition:** congruent, incongruent, neutral.
- **Target ink color:** red, blue, green, yellow; balanced within each condition as specified above.
- **Word stimulus:** color word for congruent/incongruent trials; selected neutral word for neutral trials.
- **Primary outcomes:** accuracy and reaction time, analyzed and presented separately.

No directional hypothesis is established by this protocol. The planned contrasts in Section 10 are intended descriptive comparisons, not evidence that a specific effect has already been demonstrated in HUMAN BENCHMARK.

### Constrained randomization proposal

Generate a session schedule satisfying all of the following:

1. Exactly 20 main trials per condition.
2. No run longer than 3 consecutive trials from the same condition.
3. Target ink colors balanced within each condition (5 each).
4. Color words and neutral words distributed as evenly as possible under the approved stimulus set and condition constraints.
5. Avoid an identical complete stimulus on adjacent trials. Additional limits on repeated target colors or response keys may be considered, but are not yet approved.

Record the random seed for each session. A seed alone may not reproduce a schedule if the generator changes; also retain the realized trial order and the randomization algorithm/configuration version. The algorithm, exact constraints for avoiding repetition, and whether a generated schedule is regenerated when constraints fail remain unresolved.

## 9. Trial Validity and Data Recorded

### Trial outcome categories

| Category | Definition | Response accuracy | Successful response rate / timeout rate | Primary RT treatment |
|---|---|---|---|---|
| Correct response | First valid mapped key matches the target ink color. | Numerator and denominator. | Numerator and denominator for successful response rate. | Include. |
| Incorrect response | First valid mapped key does not match the target ink color. | Denominator, not numerator. Do not discard it. | Denominator, not numerator for successful response rate. | Exclude from primary correct-response RT; retain its response and RT as an error observation. |
| Timeout | No valid mapped response by the 2,000 ms deadline. | Excluded because there was no response. | Denominator for successful response rate and numerator for timeout rate; not a successful response. | No response RT. |
| Invalid technical/protocol trial | A predefined technical or protocol event prevents valid stimulus presentation or timing. | Exclude from the denominator and report with its reason. | Exclude from both denominators and report with its reason. | Exclude from primary RT and report with its reason. |

Incorrect responses are valid behavioral observations, not invalid trials. A timeout is not relabeled as an incorrect keypress. Define technical/protocol-invalid trials before collection; a participant must not be excluded for being slow or making errors. Report invalid-trial counts separately. If a denominator is zero, report the corresponding rate as unavailable rather than as zero.

### Proposed records

Each trial record, with its session context, should retain at least:

- Experiment/protocol version, session identifier, trial index, and whether it is practice or main.
- Condition, displayed word, target ink color, and correct response mapping.
- Received mapped response or no response; correctness/outcome category; timeout or invalid reason where applicable.
- Recorded stimulus-onset and first valid mapped keydown timestamps from the same monotonic clock, and derived reaction time where a valid response exists.
- Random seed and schedule/version context associated with the session.

Record only metadata justified for interpreting the task. Avoid unnecessary identifying or device-fingerprinting data. The final data dictionary must define exact fields and timing conventions before implementation.

## 10. Proposed Analysis Plan

All calculations use **main trials only**. Practice trials are excluded. Results are descriptive for this session and should show the number of trials contributing to each statistic.

### Accuracy

Report these separate, overall and per condition:

- **Response accuracy** (among trials with a valid mapped response):  
  `correct / (correct + incorrect)`
- **Successful response rate** (among analysable main trials, including timeouts):  
  `correct / (correct + incorrect + timeout)`
- **Timeout rate** (among analysable main trials):  
  `timeout / (correct + incorrect + timeout)`

Predefined technical/protocol-invalid trials are excluded from all three denominators, but their counts and reasons are reported separately. Response accuracy excludes timeouts because it describes correctness among responses; successful response rate includes timeouts because it describes correct responses among all analysable trials. Incorrect responses remain in both applicable denominators. Show the counts used for each rate so the difference is clear.

### Reaction time

Proposed primary reaction-time measure: the **median reaction time for correct, valid main-trial responses**, separately by condition. Include the number of correct trials contributing to each median. Retain reaction times for incorrect mapped responses in the trial data, but do not pool them into the primary correct-response RT measure. This separates correct-response speed from accuracy; it does not make error latencies uninformative.

The median is a proposed descriptive summary, not a settled standard for this product. **Proposed minimum-count display rule:** display a condition's primary RT median only when that condition has at least **10 valid correct responses**. Display an RT contrast only when each of its two conditions meets that rule. Below the threshold, show the available count and explain that the RT summary/contrast is not displayed under this product rule. This is a pragmatic guard against presenting a median from very few observations; it is **not a validated scientific threshold**, power calculation, or declaration that the underlying trials are scientifically invalid.

The choice between median and mean and the presentation of spread remain open for review. Do not remove unusually fast or slow valid responses using a post-hoc cutoff. Any future RT exclusion threshold must be specified and justified before collecting data.

### Intended condition contrasts

Compute each contrast separately for reaction time, response accuracy, and successful response rate; do not create a combined score. Show each condition's numerator, denominator, and timeout count alongside the rates.

| Intended interpretation | Reaction-time contrast | Response-accuracy contrast | Successful-response-rate contrast |
|---|---|---|
| **Interference:** Incongruent vs Neutral | `RT_incongruent − RT_neutral` | `ResponseAccuracy_neutral − ResponseAccuracy_incongruent` | `SuccessRate_neutral − SuccessRate_incongruent` |
| **Facilitation:** Neutral vs Congruent | `RT_neutral − RT_congruent` | `ResponseAccuracy_congruent − ResponseAccuracy_neutral` | `SuccessRate_congruent − SuccessRate_neutral` |
| **Overall congruency effect:** Incongruent vs Congruent | `RT_incongruent − RT_congruent` | `ResponseAccuracy_congruent − ResponseAccuracy_incongruent` | `SuccessRate_congruent − SuccessRate_incongruent` |

For RT, a positive contrast means the first RT operand is slower: incongruent for interference, neutral for facilitation, and incongruent for the overall effect. Thus, a positive facilitation RT contrast means neutral trials were slower than congruent trials. For either rate measure, a positive contrast means the first rate operand is higher: neutral than incongruent for interference, congruent than neutral for facilitation, and congruent than incongruent for the overall effect. These labels describe planned contrasts, not a causal or diagnostic conclusion. Neutral-word properties can influence these baselines [2, 3].

### Exclusions and incomplete sessions

- Do not exclude an incorrect response from accuracy.
- Do not classify a timeout as a technical invalidity; include it in successful-response and timeout-rate denominators, but not response-accuracy denominators.
- Exclude only pre-specified technical/protocol-invalid trials from all metric denominators, and report counts/reasons.
- Do not present an incomplete session as complete or calculate a complete-session contrast from an incomplete set without clearly labeling it.
- The proposed RT display threshold is 10 valid correct responses in each condition; it is a product rule only. No session-level maximum-invalid-trial threshold is set yet.
- Do not exclude a session because its results are unexpected or because a participant is comparatively slow or inaccurate.

## 11. Exclusion Rules Requiring Pre-Implementation Review

The following are proposed trial-invalidity candidates, not yet final operational rules:

- The page loses visibility or focus while a stimulus is active, making the response interval unreliable. Mark that trial invalid, not a timeout; record the reason, ignore later key events for it, and wait for visibility/focus before continuing.
- The page loses visibility or focus before a stimulus begins. Do not start the timed stimulus until visibility and focus return.
- A known presentation/input failure prevents the assigned stimulus or response from being registered correctly.
- The experiment is interrupted or a session ends before required main trials finish.

Do not silently replay a focus-interrupted trial. Define what other events are detectable, whether the affected trial or the rest of the session is invalidated, and how the participant is informed. Do not invent timing thresholds or discard a trial after seeing its outcome. Session-level exclusion thresholds and criteria for displaying an accuracy contrast remain unresolved.

## 12. Browser Timing Limitations

Browser-recorded reaction time is defined here as the elapsed time, measured with a monotonic clock, from the recorded stimulus-onset timestamp to the first valid mapped keydown timestamp. It is not a direct measurement of when photons reached the participant's eyes or when the key physically moved. Browser scheduling, display refresh and rendering, operating system, keyboard hardware, load, and tab visibility can affect timing.

Methodological comparisons have found timing performance varies across software, operating systems, browsers, and measurement components. Some tested online configurations have performed close to millisecond precision on particular measures, while performance is not uniform; the findings support validating the actual setup rather than claiming laboratory-grade timing for a browser task [4, 5].

Accordingly:

- Describe RT as browser-recorded and device-dependent.
- Keep timing precision and interpretation modest; do not imply laboratory-grade measurement.
- Use the same monotonic clock for stimulus onset, response, and the 2,000 ms deadline; ignore pre-stimulus keypresses and repeated key events as described in Section 7.
- Mark a trial invalid if focus or visibility is lost during its active stimulus, as described in Section 11; do not count that event as a timeout.
- Test the actual supported browser/device combinations before release and mark trials invalid only under predeclared, testable timing/presentation rules.
- Do not compare sessions as though device and timing conditions were identical unless justified.

## 13. Accessibility and Participant Care

- Make instructions, response mapping, controls, status, and results accessible to keyboard and assistive-technology users where feasible.
- Do not communicate response mapping or task state using color alone; include text labels and visible key labels.
- Keep the stimulus legible and avoid unnecessary motion or visual decoration.
- Recognize that a rapid color-naming task with keyboard responses may not be comparable for participants with color-vision, visual, motor, or keyboard-access needs. Do not infer inability, diagnosis, or general cognitive capacity from task completion or performance.
- Explain the task and its limitations before participation; let participants leave without implying failure.
- If an alternative input or presentation mode is offered, document how it changes the task and do not assume its RT is directly comparable to the primary mode.

## 14. Limitations and Responsible Interpretation

- This is a proposed educational task, not a validated assessment, clinical instrument, IQ test, or measure of a single isolated brain ability.
- A single session reflects a specific protocol, stimulus set, device, response mapping, and moment. It does not establish a stable personal characteristic.
- The neutral condition uses words whose familiarity, length, language, and associations may affect performance. Neutral is a designed comparison condition, not an absence of all cognitive processing.
- Sixty main trials (20 per condition) may be adequate for a minimal educational MVP that demonstrates the task and presents clearly labeled descriptive results. They do not establish statistical power, validated measurement, or stable individual estimates. Each condition has at most 20 observations; errors, timeouts, and technical invalidities reduce some denominators further. With all 20 trials analysable, successful-response and timeout rates change in 5-percentage-point increments; response-accuracy resolution depends on the number of trials with a response. This is arithmetic resolution, not evidence of precision. The proposed 10-correct-response RT display rule is only a pragmatic product safeguard.
- Speed and accuracy are separate outcomes. A fast RT must not be described as better performance without considering accuracy and timeouts.
- Browser timing and response-key differences limit cross-device comparisons.
- The planned contrasts should be presented with condition counts and limitations, not population norms, rankings, significance claims, or causal claims.

## 15. Unresolved Decisions for Review

1. **Language and audience:** English is the initial MVP default. What participant fluency assumptions and inclusion criteria are appropriate? Are any age or participation restrictions needed?
2. **Neutral stimuli:** Does the proposed five-word list (`BOOK`, `CHAIR`, `FLOWER`, `HOUSE`, `STAR`) suit the intended language/audience? Review familiarity, length, visual width, repetition, and color associations; approve or replace it before Cycle 2 protocol sign-off.
3. **Visual presentation:** What exact ink values, background, font, size, and display dimensions will be used?
4. **Response mapping:** Approve D=Red, F=Blue, J=Green, K=Yellow? Should the mapping remain fixed, or be counterbalanced in any future group-research mode?
5. **Practice feedback:** Should incorrect practice responses reveal the correct response, or only indicate correctness?
6. **Randomization:** Which schedule-generation method and additional repetition constraints will be used? What generator/version details are recorded with the seed?
7. **Break:** Is the break self-paced and skippable? How should break use be recorded?
8. **Analysis:** Approve median correct-response RT and its spread statistic? The proposed 10-response RT display rule is pragmatic, not scientific; does it suit the product? Confirm the response-accuracy, successful-response-rate, and timeout-rate denominators.
9. **Invalidity rules:** Which specific browser/focus/presentation events invalidate a trial? Should focus-interrupted trials remain unreplayed as proposed? When should an incomplete session be excluded from contrasts?
10. **Accessibility and comparability:** Which alternative modes are feasible, and how will their results be labeled?
11. **Timing validation:** Which browser/device combinations will be supported and tested, and what timing checks are feasible for this educational project?
12. **Research use:** Is the experiment strictly for individual educational sessions, or might any future pilot use participant data for research? Any research use needs separate consent, privacy, protocol, and oversight review as applicable.

## 16. References

The bibliographic details below were checked against Crossref metadata and/or the publisher landing information. They support background and methodological context; they do **not** validate this proposed HUMAN BENCHMARK protocol.

1. Stroop, J. R. (1935). Studies of interference in serial verbal reactions. *Journal of Experimental Psychology, 18*(6), 643–662. [https://doi.org/10.1037/h0054651](https://doi.org/10.1037/h0054651)
2. MacLeod, C. M. (1991). Half a century of research on the Stroop effect: An integrative review. *Psychological Bulletin, 109*(2), 163–203. [https://doi.org/10.1037/0033-2909.109.2.163](https://doi.org/10.1037/0033-2909.109.2.163)
3. Klein, G. S. (1964). Semantic power measured through the interference of words with color-naming. *The American Journal of Psychology, 77*(4), 576. [https://doi.org/10.2307/1420768](https://doi.org/10.2307/1420768)
4. Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. *Behavior Research Methods, 47*(2), 309–327. [https://doi.org/10.3758/s13428-014-0471-1](https://doi.org/10.3758/s13428-014-0471-1)
5. Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. [https://doi.org/10.7717/peerj.9414](https://doi.org/10.7717/peerj.9414)
6. Kiyak, H. A. (1982). Interlingual interference in naming color words. *Journal of Cross-Cultural Psychology, 13*(1), 125–135. [https://doi.org/10.1177/0022022182131011](https://doi.org/10.1177/0022022182131011)
