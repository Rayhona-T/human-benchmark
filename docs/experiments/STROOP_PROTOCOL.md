# Stroop Experiment — Approved Scientific Protocol

**Protocol ID:** `HB-STROOP-1.0`
**Status:** Cycle 2 Task 2 approved. This protocol is research-informed but not scientifically validated.

## 1. Purpose and Evidence Status

Participants identify the ink color of a centrally displayed word while ignoring its meaning. Operationally, this protocol measures browser-recorded response time to the first valid mapped keydown and response accuracy across congruent, incongruent, and neutral word-color trials. The intended phenomenon is that response behavior can differ when a word's color meaning agrees or conflicts with the required ink-color response [1, 2].

The planned contrasts describe this task's condition differences. They do not isolate one mental process, establish a stable personal characteristic, or measure general inhibition, intelligence, personality, or clinical status. The classic Stroop procedure used serial spoken responses; this single-trial keyboard task is an adaptation with different timing and motor demands [1, 2].

Stroop's original study examined interference in serial verbal reactions. Later accounts differ in how they explain the effect, including automaticity/controlled-processing and connectionist accounts; the condition difference alone does not adjudicate between them [2, 7]. Familiarity with reading and the chosen words, response modality, and stimulus set can shape the observed effect. The protocol therefore describes task performance rather than an isolated cognitive mechanism.

## 2. Design at a Glance

| Element | Protocol decision |
|---|---|
| Design | Mixed-trial, within-participant; each complete session contains all three conditions. |
| Language | English instructions and stimuli. This is an MVP scope choice, not a claim of cross-language equivalence. |
| Conditions | Congruent, incongruent, and neutral. |
| Color words | `RED`, `BLUE`, `GREEN`, `YELLOW`; uppercase. |
| Neutral words | `BOOK`, `CHAIR`, `HOUSE`, `TABLE`, `MUSIC`; each paired once with every ink color. This is a pragmatic, unvalidated set. |
| Ink colors/background | Red `#F87171`, Blue `#60A5FA`, Green `#4ADE80`, Yellow `#FACC15` on dark `#111827`. |
| Responses | Logical key characters D, F, J, K using the fixed mapping in Section 5. |
| Practice | 12 trials, four per condition, with correctness feedback; excluded from main analysis. |
| Main task | 60 trials, 20 per condition; no correctness feedback. |
| Timing | 500 ms fixation; response deadline 2,000 ms from recorded browser onset; 500 ms inter-trial interval. |
| Break | Self-paced, skippable offer after main trial 30; record whether taken and its duration. |
| Sequence | Seeded constrained shuffle; exact item balance and run/repetition constraints in Section 8. |
| Outcomes | Response accuracy, successful response rate, timeout rate, and RT reported separately; no combined score. |

## 3. Participant-Facing Instructions

> This educational task explores how responses can differ when a word's meaning agrees or conflicts with its ink color. Your job is to respond to the **ink color**, not to read the word. This is not a diagnosis, IQ test, or validated assessment of general ability.
>
> Use the keys shown below:
>
> - **D** = Red
> - **F** = Blue
> - **J** = Green
> - **K** = Yellow
>
> You can first check the key mapping and then complete 12 practice trials with feedback. The main task has 60 trials and no correctness feedback. Respond as accurately and promptly as you can. A trial ends after your first valid mapped key or after 2 seconds if no valid mapped response is received.
>
> You may take or skip a self-paced break after trial 30. Your results describe this task session only. Browser timing, keyboard, and color perception can affect responses.

Before participation, the briefing must explain the data recorded, the task's limitations, and the participant's ability to leave. Results are descriptive, not diagnostic or normative. Participants who are unfamiliar with English color words or unable to distinguish the displayed colors should be invited to stop; no proficiency test or identifying language data are collected.

## 4. Stimulus and Condition Design

The relevant response is the ink color. A neutral word is a comparison baseline, not an absence of reading or semantic processing [2, 3].

| Condition | Stimulus rule | Main trials |
|---|---|---:|
| Congruent | A color word is displayed in ink matching the word's color meaning; for example, `RED` in red ink. | 20 |
| Incongruent | A color word is displayed in a different one of the four target ink colors; for example, `RED` in blue ink. | 20 |
| Neutral | A non-color English word is displayed in one of the four target ink colors. | 20 |

### Final stimulus presentation choices

- Color words: `RED`, `BLUE`, `GREEN`, and `YELLOW`, in uppercase.
- Font: Arial, Helvetica, sans-serif fallback; bold weight 700; 48 CSS pixels; one line; horizontally and vertically centered. Use the same font and size in every condition; do not resize individual words to equalize their width.
- Background: `#111827` throughout the timed trial.
- Ink: Red `#F87171`; Blue `#60A5FA`; Green `#4ADE80`; Yellow `#FACC15`.
- Contrast: these sRGB color values have approximate WCAG relative-luminance contrast ratios of 6.41:1, 6.98:1, 10.18:1, and 11.58:1 respectively against `#111827`. This calculation addresses text/background contrast only; it does not guarantee that each participant can distinguish the hues or that all displays render them identically.
- Position: one centered word; no other colored marks, labels, or decorative motion during the active trial. The response key legend is shown during instruction/practice, not alongside main-task stimuli.

### Neutral word set and rationale

The selected English neutral set is `BOOK`, `CHAIR`, `HOUSE`, `TABLE`, and `MUSIC`. `STAR` is excluded because it can evoke a conventional yellow/gold association; `FLOWER` is excluded because it commonly evokes varied vivid colors and is the longest word in the original set. These are pragmatic judgments, not empirical norms: no candidate list is completely association-free and this set has not been normed or validated.

| Word | Letters | Review note |
|---|---:|---|
| `BOOK` | 4 | Familiar object word; material/color associations may vary. |
| `CHAIR` | 5 | Common object word; familiarity and semantic associations may vary. |
| `HOUSE` | 5 | Common object word; personal color associations may vary. |
| `TABLE` | 5 | Common object word; material/color associations may vary. |
| `MUSIC` | 5 | Common non-color word; familiarity may vary across participants. |

Each neutral word occurs four times, once in each ink color. Differing familiarity, frequency, semantic class, width, or personal color association may influence the neutral baseline [2, 3]. This set is not matched to color words and is not scientifically validated. All stimuli use the same typography and center position; word width varies naturally.

### Exact stimulus balance

- Within each condition, each target ink color appears 5 times.
- Congruent trials use each of the four matching word/ink colors 5 times.
- Incongruent trials use each target ink color 5 times and each color word 5 times. Each of the 12 nonmatching ordered pairs occurs once or twice: a seed-selected derangement of four colors identifies the four pairs that occur once; the other eight occur twice.
- Neutral trials use each target ink color 5 times; each of the five words occurs four times, once in each ink.
- Store the exact trial sequence and selected pair allocations with the session schedule.

Counts are balanced, but words are not psychometrically matched for familiarity, length, semantics, or perceptual salience.

## 5. Response Mapping and Limitations

### Fixed logical-key mapping

| Key | Response |
|---|---|
| D | Red |
| F | Blue |
| J | Green |
| K | Yellow |

Bind the logical `event.key` values `d`, `f`, `j`, and `k` case-insensitively; do not bind physical `event.code` positions. Show this mapping in the instructions and practice and accept only the first mapped `keydown` during an active stimulus. Unmapped keys are ignored. This favors visible key labels over fixed physical positions, but layout, keyboard, and software differences remain. No remapping or counterbalancing is used in this single-MVP configuration; key/color/hand effects are therefore confounded with color condition comparisons. Do not provide correctness feedback during main trials.

### Mapping limitations

- D/F and J/K are located on opposite sides of a typical QWERTY keyboard, but layouts and physical key positions differ. Participants may use different fingers, hands, or keyboard layouts.
- The fixed assignment associates particular colors with particular keys, hands, and fingers. Differences in key familiarity or motor response can contribute to observed reaction times.
- The mapping is proposed for a simple MVP, not established as optimal. Counterbalancing mappings could reduce mapping-specific bias in a group study, but would add design and analysis complexity and is not specified here.
- Keyboard navigation and the color-naming task may not be usable or comparable for every participant, including some participants with motor, visual, or color-vision differences. The task must not imply that alternative response modes produce directly comparable timing.
- Participants whose physical keyboard does not produce the mapped logical key characters, or who cannot use this four-key response mode, may not be able to complete a comparable session. Explain this before starting; do not offer an alternative mode as equivalent without separate evaluation.

## 6. Practice and Main Experiment

### Practice

- Before timed practice, show the four color/key pairs as text-labeled color swatches. Require one press of each mapped key in any order; echo the recognized key/color and enable practice only after each mapping is demonstrated once. This untimed check is not scored.
- 12 trials, with correctness feedback after each valid response.
- Allocation: 4 trials per condition. In congruent practice, each color is shown once; in incongruent practice, each ink and each color word appears once, paired as a seed-selected derangement; in neutral practice, four distinct words are selected from the five-word set and each ink appears once.
- After a response, show correct/incorrect and the correct color/key; on timeout, show the missed correct color/key. Show feedback during the 500 ms inter-trial interval. Feedback is a learning aid, not a scored outcome.
- Practice ends after all 12 trials, regardless of accuracy or timeout. There is no mastery threshold and no practice retake in this specification; the task is not presented as a qualification test.
- Practice records are marked as practice and excluded from main-trial results.

### Main trials

- 60 trials total: 20 congruent, 20 incongruent, 20 neutral.
- No correctness feedback after responses or timeouts.
- Progress information may indicate trial count, but must not reveal correctness or condition-level performance during the task.
- A completed session is distinguished from an incomplete session. Technical-invalid trials are marked and reported separately and do not automatically invalidate the entire session.

### Completion screen

After all 60 scheduled main trials have ended, show a completion message and descriptive results according to Section 10, with contributing counts, invalid/timeout counts, and limitations. Do not assign a grade, rank, combined cognitive score, or ability label. If the task ends early, show an explicitly incomplete/interrupted status instead; do not show complete-session contrasts.

## 7. Trial Flow and Timing

For each trial:

1. Present a fixation cross for **500 ms**.
2. Record browser stimulus onset using the `requestAnimationFrame` callback timestamp for the frame that first renders the stimulus. Use the same `performance.now()` time origin for event-handler timestamps and deadline calculations.
3. Accept the first valid mapped `keydown` whose handler timestamp is at or after recorded browser onset and strictly before the **2,000 ms** deadline. Define RT as `keydown handler timestamp − recorded browser onset`. End the active stimulus on the next render update after response registration.
4. Ignore all keys before onset. Ignore `keydown` events with `repeat = true`; only the first mapped non-repeat keydown counts. Ignore additional key events after that response.
5. If no valid mapped response arrives before the deadline, classify the trial as a timeout. If an event handler runs at or after the deadline, it cannot become a response; record timeout even if the browser's timeout callback was delayed.
6. End the stimulus on the next animation-frame callback after a response, or on the first frame callback at/after deadline for a timeout. Begin a **500 ms inter-trial interval** from that stimulus-offset callback, then begin the next trial with fixation. Show practice feedback during this interval; show only the background during the main-task interval. Ignore key events during the interval rather than applying them to the next trial.

The browser callback timestamp is not a measurement of physical photon onset; frame scheduling, rendering, display refresh, and input-event delivery create timing uncertainty. Timing limitations are described in Section 12.

Do not start a timed stimulus while the page is hidden or has lost focus; pause before onset until both visibility and focus return. If visibility or focus is lost after stimulus onset and before response/deadline, mark that trial technically invalid, do not count it as a timeout, and do not accept a later keypress for it. Record the invalid reason and wait until the page is visible and focused before proceeding. Do not silently replay the trial; the session may therefore contain fewer than 20 valid trials in that condition.

If the participant leaves before all scheduled main trials end, mark the session `incomplete`; if the page closes/reloads or an unrecoverable runtime error terminates it, mark it `interrupted`. Do not automatically resume or regenerate a schedule. Unpresented trials are not outcomes and are not timeouts. Do not display complete-session condition contrasts for an incomplete/interrupted session; show only clearly labeled trial counts/status if partial data are available. An individual focus-interrupted trial does not by itself interrupt the session. A schedule-generation failure before any trial begins is a `technical_error`.

### Optional halfway break

After main trial 30 and its inter-trial interval, offer a self-paced break with explicit “Continue” and “Skip break” actions. No stimulus or trial timer runs during the break. Record whether it was taken and its elapsed duration; this does not change the remaining schedule.

## 8. Experimental Design and Randomization

### Design factors

- **Within-session condition:** congruent, incongruent, neutral.
- **Target ink color:** red, blue, green, yellow; balanced within each condition as specified above.
- **Word stimulus:** color word for congruent/incongruent trials; selected neutral word for neutral trials.
- **Primary outcomes:** accuracy and reaction time, analyzed and presented separately.

No directional hypothesis is established by this protocol. The planned contrasts in Section 10 are intended descriptive comparisons, not evidence that a specific effect has already been demonstrated in HUMAN BENCHMARK.

### Reproducible schedule generation

1. Obtain a 32-bit unsigned seed for each session from the platform's available cryptographically secure random source. If that source is unavailable, stop before the session and report a technical error; do not silently substitute a constant seed. Record seed as an unsigned integer.
2. Initialize the `mulberry32` PRNG with the seed; identify this rule as `HB-STROOP-shuffle-v1`. Enumerate the nine derangements of four colors in the order specified below and choose one using `floor(random() * 9)`. Build the balanced 60-item pool, including the selected four incongruent pairs once each and the other eight nonmatching pairs twice.
3. Use that continuing PRNG stream and Fisher–Yates to shuffle the complete 60-item pool.
4. Accept a shuffled order only if it has no run of more than 3 identical conditions and no identical complete stimulus (condition + word + ink) on adjacent trials. On rejection, reshuffle the same pool using the continuing PRNG stream. Permit at most 10,000 candidates.
5. If no candidate meets the constraints, stop with an explicit schedule-generation error; do not relax constraints, alter balances, or substitute an unseeded schedule.
6. Generate practice from the same session seed using a separate PRNG stream initialized with `seed XOR 0x9E3779B9`; create its 12 balanced items as specified in Section 6 and shuffle once. Practice has no additional adjacency constraints.
7. Preserve the seed, PRNG/shuffle identifier, protocol/configuration version, chosen derangement, realized main and practice orders, and session schedule creation status. A seed and version alone are insufficient if the realized order was not retained.

The PRNG and schedule constraints support reproducibility, not cryptographic security or experimental randomization guarantees. Generation occurs before the first timed main trial; an interrupted session is not silently restarted with a new schedule.

For reproducibility, the PRNG is the 32-bit Mulberry32 recurrence: set `t = state = (state + 0x6D2B79F5) mod 2^32`; then `t = imul(t XOR (t >>> 15), t OR 1) mod 2^32`; then `t = t XOR ((t + imul(t XOR (t >>> 7), t OR 61)) mod 2^32)`; return unsigned `(t XOR (t >>> 14)) / 2^32`. `imul` is 32-bit signed multiplication with the result interpreted modulo `2^32`; `>>>` is unsigned right shift. Enumerate the nine derangements lexicographically by the color order Red, Blue, Green, Yellow and select index `floor(random() * 9)`. For Fisher–Yates, iterate `i` from `n−1` down to 1, select `j = floor(random() * (i+1))`, and swap entries `i` and `j`. Each retry reshuffles the original pool using the continuing PRNG state.

## 9. Trial Validity and Data Recorded

### Trial outcome categories

| Category | Definition | Response accuracy | Successful response rate / timeout rate | Primary RT treatment |
|---|---|---|---|---|
| Correct response | First valid mapped key matches the target ink color. | Numerator and denominator. | Numerator and denominator for successful response rate. | Include. |
| Incorrect response | First valid mapped key does not match the target ink color. | Denominator, not numerator. Do not discard it. | Denominator, not numerator for successful response rate. | Exclude from primary correct-response RT; retain its response and RT as an error observation. |
| Timeout | No valid mapped response by the 2,000 ms deadline. | Excluded because there was no response. | Denominator for successful response rate and numerator for timeout rate; not a successful response. | No response RT. |
| Invalid technical/protocol trial | A predefined technical or protocol event prevents valid stimulus presentation or timing. | Exclude from the denominator and report with its reason. | Exclude from both denominators and report with its reason. | Exclude from primary RT and report with its reason. |

Incorrect responses are valid behavioral observations, not invalid trials. A timeout is not relabeled as an incorrect keypress. Define technical/protocol-invalid trials before collection; a participant must not be excluded for being slow or making errors. Report invalid-trial counts separately. If a denominator is zero, report the corresponding rate as unavailable rather than as zero.

### Trial-level record

Each trial record, with its session context, should retain at least:

- Experiment and protocol/configuration version, session identifier, one-based trial index within each phase (practice 1–12; main 1–60), and practice/main designation.
- Condition, displayed word, ink color, correct response color, and expected logical key.
- Participant's first valid mapped response key/color or no response; outcome (`correct`, `incorrect`, `timeout`, `invalid`); invalidity/timeout reason where applicable.
- Monotonic timestamps for fixation onset, stimulus-onset rAF callback, first valid response handler (if any), response deadline, trial end, and ITI end. Derived RT is response timestamp minus recorded onset only for a valid mapped response.
- Auto-repeat/unmapped/pre-onset key events need not be retained individually; record protocol-invalid or timing error reason if they affect the trial.
- Session seed, PRNG/shuffle identifier, randomization configuration version, selected derangement, and realized schedule order.
- Focus/visibility interruption status and break taken/duration at session level; session status (`complete`, `incomplete`, `interrupted`, or `technical_error`).

Record only metadata justified for interpreting the task. Avoid unnecessary identifying or device-fingerprinting data. The final data dictionary must define exact fields and timing conventions before implementation.

## 10. Analysis Plan

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

Primary reaction-time measure: the **median reaction time for correct, valid main-trial responses**, separately by condition. Include the number of correct trials contributing to each median. Retain reaction times for incorrect mapped responses in the trial data, but do not pool them into the primary correct-response RT measure. This separates correct-response speed from accuracy; it does not make error latencies uninformative.

The median is a proposed descriptive summary, not a settled standard for this product. **Proposed minimum-count display rule:** display a condition's primary RT median only when that condition has at least **10 valid correct responses**. Display an RT contrast only when each of its two conditions meets that rule. Below the threshold, show the available count and explain that the RT summary/contrast is not displayed under this product rule. This is a pragmatic guard against presenting a median from very few observations; it is **not a validated scientific threshold**, power calculation, or declaration that the underlying trials are scientifically invalid.

Median is selected as a descriptive summary for this MVP; this is a methodological/product choice, not a claim that the median is universally preferable or that this trial count yields reliable individual estimates. Do not remove unusually fast or slow valid responses using a post-hoc cutoff. Any future RT exclusion threshold must be specified and justified before collecting data.

### Intended condition contrasts

Compute each contrast separately for reaction time, response accuracy, and successful response rate; do not create a combined score. Show each condition's numerator, denominator, and timeout count alongside the rates.

| Intended interpretation | Reaction-time contrast | Response-accuracy contrast | Successful-response-rate contrast |
|---|---|---|
| **Interference:** Incongruent vs Neutral | `RT_incongruent − RT_neutral` | `ResponseAccuracy_neutral − ResponseAccuracy_incongruent` | `SuccessRate_neutral − SuccessRate_incongruent` |
| **Facilitation:** Neutral vs Congruent | `RT_neutral − RT_congruent` | `ResponseAccuracy_congruent − ResponseAccuracy_neutral` | `SuccessRate_congruent − SuccessRate_neutral` |
| **Overall congruency effect:** Incongruent vs Congruent | `RT_incongruent − RT_congruent` | `ResponseAccuracy_congruent − ResponseAccuracy_incongruent` | `SuccessRate_congruent − SuccessRate_incongruent` |

For RT, a positive contrast means the first RT operand is slower: incongruent for interference, neutral for facilitation, and incongruent for the overall effect. Thus, a positive facilitation RT contrast means neutral trials were slower than congruent trials. For either rate measure, a positive contrast means the first rate operand is higher: neutral than incongruent for interference, congruent than neutral for facilitation, and congruent than incongruent for the overall effect. Report a rate contrast only when both condition denominators are nonzero. Report an RT contrast only when each of its two conditions has at least 10 correct valid RT observations. These labels describe planned contrasts, not a causal or diagnostic conclusion. Neutral-word properties can influence these baselines [2, 3].

### Exclusions and incomplete sessions

- Do not exclude an incorrect response from accuracy.
- Do not classify a timeout as a technical invalidity; include it in successful-response and timeout-rate denominators, but not response-accuracy denominators.
- Exclude only pre-specified technical/protocol-invalid trials from all metric denominators, and report counts/reasons.
- Do not display condition contrasts for an incomplete/interrupted session. A complete session may contain invalid trials; report the valid counts and calculate rates from their defined denominators.
- The proposed RT display threshold is 10 valid correct responses in each condition; it is a product rule only. No session-level maximum-invalid-trial threshold is set yet.
- Do not exclude a session because its results are unexpected or because a participant is comparatively slow or inaccurate.

## 11. Trial and Session Validity

The following trial-invalidity and session rules are operational for this protocol:

- The page loses visibility or focus while a stimulus is active, making the response interval unreliable. Mark that trial invalid, not a timeout; record the reason, ignore later key events for it, and wait for visibility/focus before continuing.
- The page loses visibility or focus before a stimulus begins. Do not start the timed stimulus until visibility and focus return.
- A known presentation/input failure prevents the assigned stimulus or response from being registered correctly.
- The experiment is interrupted or a session ends before required main trials finish; mark the session incomplete/interrupted, not the unpresented trials invalid or timed out.

Do not silently replay a focus-interrupted trial or invalidate trials based on their response outcome. Do not exclude a completed session based on an arbitrary invalid-trial percentage; show the invalid count and reason. Rates require nonzero denominators, and contrasts follow the display rules in Section 10.

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
- The neutral condition uses words whose familiarity, length, language, and associations may affect performance [2, 3, 6]. Neutral is a designed comparison condition, not an absence of all cognitive processing.
- Sixty main trials (20 per condition) may be adequate for a minimal educational MVP that demonstrates the task and presents clearly labeled descriptive results. They do not establish statistical power, validated measurement, or stable individual estimates. Each condition has at most 20 observations; errors, timeouts, and technical invalidities reduce some denominators further. With all 20 trials analysable, successful-response and timeout rates change in 5-percentage-point increments; response-accuracy resolution depends on the number of trials with a response. This is arithmetic resolution, not evidence of precision. The proposed 10-correct-response RT display rule is only a pragmatic product safeguard.
- Speed and accuracy are separate outcomes. A fast RT must not be described as better performance without considering accuracy and timeouts.
- Browser timing and response-key differences limit cross-device comparisons.
- The planned contrasts should be presented with condition counts and limitations, not population norms, rankings, significance claims, or causal claims.

## 15. Remaining Uncertainties for Human Review

- The selected neutral words are pragmatic and unnormed. A pilot with the intended English-reading audience may be needed to identify unfamiliar words or salient personal color associations; this protocol does not prescribe participant data collection for that purpose.
- The fixed key mapping, CSS colors, chosen font, and 48 px text size are not experimentally optimized. Human review and supported-device legibility/accessibility checks remain necessary.
- A 60-trial, 20-per-condition session is deliberately short. It has no demonstrated power or individual-level reliability; established task effects do not imply reliable individual differences [8]. Whether longer schedules are needed for any future research use remains open.
- Browser timing should be tested on the intended supported configurations. The specification makes no laboratory-grade timing claim.
- Any future research use, recruitment, data retention, or population-level analysis requires separate consent, privacy, protocol, and oversight review as applicable.

### Changes from the Cycle 1 working proposal

The 60 main trials, 20 per condition, 12 practice trials, fixed D/F/J/K color mapping, 500 ms fixation and ITI, 2,000 ms response deadline, optional halfway break, median correct RT, and pragmatic 10-correct-response display threshold are retained. The neutral list changes from `BOOK`, `CHAIR`, `FLOWER`, `HOUSE`, `STAR` to `BOOK`, `CHAIR`, `HOUSE`, `TABLE`, `MUSIC`, excluding the more obvious or variable color associations of `STAR` and `FLOWER`; this replacement remains unvalidated. Visual values, logical-key behavior, practice feedback/completion, exact balance and seeded randomization, timing event semantics, interruption handling, and display rules are now explicitly specified rather than left open.

The protocol is approved for this Cycle 2 specification but remains unvalidated as a psychological measure. Implementation may proceed only within the roadmap's later phase gates.

## 16. References

The bibliographic details below were checked against Crossref metadata and/or the publisher landing information. They support background and methodological context; they do **not** validate this proposed HUMAN BENCHMARK protocol.

1. Stroop, J. R. (1935). Studies of interference in serial verbal reactions. *Journal of Experimental Psychology, 18*(6), 643–662. [https://doi.org/10.1037/h0054651](https://doi.org/10.1037/h0054651)
2. MacLeod, C. M. (1991). Half a century of research on the Stroop effect: An integrative review. *Psychological Bulletin, 109*(2), 163–203. [https://doi.org/10.1037/0033-2909.109.2.163](https://doi.org/10.1037/0033-2909.109.2.163)
3. Klein, G. S. (1964). Semantic power measured through the interference of words with color-naming. *The American Journal of Psychology, 77*(4), 576. [https://doi.org/10.2307/1420768](https://doi.org/10.2307/1420768)
4. Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. *Behavior Research Methods, 47*(2), 309–327. [https://doi.org/10.3758/s13428-014-0471-1](https://doi.org/10.3758/s13428-014-0471-1)
5. Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. [https://doi.org/10.7717/peerj.9414](https://doi.org/10.7717/peerj.9414)
6. Kiyak, H. A. (1982). Interlingual interference in naming color words. *Journal of Cross-Cultural Psychology, 13*(1), 125–135. [https://doi.org/10.1177/0022022182131011](https://doi.org/10.1177/0022022182131011)
7. Cohen, J. D., Dunbar, K., & McClelland, J. L. (1990). On the control of automatic processes: A parallel distributed processing account of the Stroop effect. *Psychological Review, 97*(3), 332–361. [https://doi.org/10.1037/0033-295X.97.3.332](https://doi.org/10.1037/0033-295X.97.3.332)
8. Hedge, C., Powell, G., & Sumner, P. (2018). The reliability paradox: Why robust cognitive tasks do not produce reliable individual differences. *Behavior Research Methods, 50*(3), 1166–1186. [https://doi.org/10.3758/s13428-017-0935-1](https://doi.org/10.3758/s13428-017-0935-1)
