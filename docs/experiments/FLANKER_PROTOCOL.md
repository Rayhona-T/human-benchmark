# Flanker Experiment — Approved Protocol

**Protocol ID:** `HB-FLANKER-1.0`

**Status:** Approved by the project owner in Cycle 6 (decisions in §14). Written in Cycle 2 Task 3 and reviewed against the literature in Cycle 6 Task 1+2 ([FLANKER_EVIDENCE_REVIEW.md](../scientific/FLANKER_EVIDENCE_REVIEW.md)); no parameter was changed. Approval does not mean scientific or clinical validation: the protocol is research-informed, not validated.

## 1. Purpose and Evidence Status

Participants identify the direction of a central arrow while ignoring four surrounding symbols. Operationally, this protocol measures browser-recorded response time to the first valid mapped keydown and response accuracy across congruent, incongruent, and neutral flanker arrangements. The Flanker effect is the task-specific difference in response behavior when flankers indicate a response compatible or incompatible with the central target [F1, F3].

The original Eriksen and Eriksen experiment used target and noise letters in a nonsearch identification task [F1]. This protocol instead uses an **arrow-Flanker variant**: arrows indicate left/right response direction and em dashes form the neutral flankers. Arrow arrays are a later variant used in other paradigms, including the Attention Network Test; they are not a literal reproduction of the original letter task [F1, F4].

The task demonstrates a condition difference in this particular setup. It does not isolate a single process or establish a participant's general attention, inhibition, intelligence, personality, or clinical status. Spatial selection, response competition, target visibility, task strategy, and other features can contribute to the observed behavior [F2, F3].

## 2. Design at a Glance

| Element | Protocol decision |
|---|---|
| Design | Mixed-trial, within-participant; all three conditions appear in each complete session. |
| Language | English instructions; an MVP scope choice, not a claim of cross-language equivalence. |
| Stimulus family | Arrow-Flanker variant, not the original Eriksen letter paradigm. |
| Conditions | Congruent, incongruent, neutral. |
| Stimulus | Five fixed cells in one horizontal row; central arrow target and two flankers on each side. |
| Response mapping | Logical `F` = Left; logical `J` = Right; fixed for all participants in this MVP draft. |
| Practice | 12 trials, 4 per condition and 2 per target direction in each condition; correctness feedback; excluded from main analysis. |
| Main task | 60 trials, 20 per condition and 10 per target direction in each condition; no correctness feedback. |
| Timing | 500 ms fixation; 2,000 ms response deadline from recorded browser onset; 500 ms inter-trial interval. |
| Break | Self-paced, skippable offer after main trial 30; record whether taken and duration. |
| Outcomes | Response accuracy, successful-response rate, timeout rate, and RT reported separately; no combined score. |

These counts and timings are short-MVP product choices. They are not universal standards, a power calculation, or evidence of validated individual measurement [F3, F4, S7].

## 3. Participant-Facing Instructions

> This educational task explores how responses to a center arrow can differ depending on the symbols around it. Respond to the **center arrow only**:
>
> - Press **F** for Left.
> - Press **J** for Right.
>
> First, you will check the key mapping and complete 12 practice trials with feedback. Then you will complete 60 main trials without correctness feedback. Respond as accurately and promptly as you can. A trial ends after your first valid response or after 2 seconds if no valid response is received. You may take or skip a break after trial 30.
>
> Your results describe this task session only. They are not a diagnosis, IQ estimate, or validated measure of general ability. Browser timing, keyboard, and display differences can affect responses.

Before participation, explain the task, data recorded, limitations, and the participant's ability to leave. Do not communicate a response or task state through color alone. Participants who cannot comfortably see the symbols or use the response keys should be able to stop without implying failure.

## 4. Conditions, Stimuli, and Geometry

The central arrow determines the correct response. All four flanker positions are occupied. Congruent flankers indicate the target's direction; incongruent flankers all indicate the opposite direction; neutral flankers are nondirectional dashes [F1, F3].

| Condition | Left-pointing target | Right-pointing target | Main trials |
|---|---|---|---:|
| Congruent | `← ← ← ← ←` | `→ → → → →` | 20 |
| Incongruent | `→ → ← → →` | `← ← → ← ←` | 20 |
| Neutral | `— — ← — —` | `— — → — —` | 20 |

The target occupies the third (center) cell. The two cells on each side are flankers. For congruent and incongruent trials, all four flankers point in the same direction; in an incongruent trial, that direction is opposite to the target. For neutral trials, all four flankers are em dashes and the center remains a left or right arrow.

### Visual presentation

- Render exactly five fixed cells, each **48 × 48 CSS pixels**, in one centered row with **8 CSS pixels** between neighboring cells. The row is **272 CSS pixels** wide; adjacent symbol centers are 56 CSS pixels apart. The target is centered in the third cell.
- Use `Arial, Helvetica, sans-serif`, bold weight 700, **40 CSS pixel** glyphs, and 48 CSS-pixel line height. Keep all cells, font size, weight, and spacing identical across conditions and directions.
- Use `#F9FAFB` for all five symbols on `#111827`; no symbol is distinguished by color. Do not animate, resize, wrap, or move the array during a trial.
- If the viewport cannot display the full array at its specified geometry, do not start a timed trial; do not silently scale or alter the spacing.
- The browser's font fallback, display scaling, viewing distance, and physical display remain uncontrolled. The fixed CSS geometry is reproducible as a layout rule, not a guarantee of identical visual angle or physical display.

### Neutral baseline and caveat

The em dash does not map to either response and is the selected neutral flanker. It preserves four occupied flanker locations while removing directional arrowheads. It is not perceptually or cognitively inert: dash and arrow glyphs differ in shape, spatial frequency, and visual energy, and their rendering may differ across fonts and displays. Therefore, Incongruent − Neutral and Neutral − Congruent depend on this particular dash baseline; they are not pure estimates of one process [F1–F3]. This stimulus choice is pragmatic and has not been normed or validated.

### Exact balancing

- Each condition contains **20** trials: **10** left-target and **10** right-target trials.
- Each of the six condition-by-target-direction patterns in the table occurs **10** times in the main schedule.
- Congruent and incongruent flanker directions are thereby balanced: each direction occurs on 10 trials within each of those conditions.
- Neutral trials use the same four em-dash flankers in both target directions.
- Practice uses each of the six condition-by-direction patterns twice: 4 trials per condition and 6 per target direction.

This balances counts, not perceptual salience, visual angle, or equivalence of the dash and arrow baselines.

## 5. Response Mapping and Accessibility

| Logical key | Response |
|---|---|
| F (`event.key` `f`, case-insensitive) | Left |
| J (`event.key` `j`, case-insensitive) | Right |

Bind the logical key characters, not physical `event.code` positions. Before practice, show a central left arrow and require `F`, then a central right arrow and require `J`; after an incorrect key, show the correct mapping and repeat that demonstration prompt. This untimed mapping check is not scored. Do not communicate direction by color.

The fixed two-key mapping keeps the participant instructions simple and is consistent with the preliminary proposal. It is not established as optimal. On a typical QWERTY keyboard, F and J are on opposite sides, but participants' keyboard layouts, hand/finger use, and key familiarity differ. The mapping remains fixed and is not counterbalanced in this MVP draft; motor and mapping effects are not eliminated. A task requiring rapid left/right keyboard responses may not be usable or comparable for all participants, including some with motor or keyboard-access needs. Do not offer alternative response modes as timing-equivalent without separate evaluation.

## 6. Participant Flow and Trial Counts

### Practice

- **12 trials:** four per condition; within each condition, two left targets and two right targets.
- Each of the six condition-by-direction patterns appears twice.
- After a response, show correct/incorrect and the correct direction/key. On timeout, show the missed correct direction/key. Show feedback during the 500 ms inter-trial interval.
- Practice ends after all 12 scheduled trials, regardless of errors or timeouts. There is no accuracy mastery threshold or practice retake; this is familiarization, not a qualification test.
- Mark practice records separately and exclude them from every main-task metric.

### Main task and break

- **60 scheduled trials:** 20 per condition; 10 left and 10 right targets within each condition.
- Do not show correctness feedback during main trials. Progress may show trial count but not condition-level performance.
- After trial 30 and its inter-trial interval, offer a self-paced break with explicit **Continue** and **Skip break** actions. No trial timer runs during the break. Record whether it was taken and its elapsed duration; the schedule does not change.

Matching the short Stroop session's counts and break point is a product consistency choice, not evidence that these counts are scientifically adequate for Flanker [F3, F4, S7].

### Completion

After all 60 scheduled main trials have ended, show completion status and descriptive results under Section 10, including contributing counts, timeouts, invalid trials, and limitations. Do not assign a grade, ranking, ability label, or combined cognitive score. If the task ends early, show an explicitly incomplete/interrupted status and do not show complete-session contrasts.

## 7. Timing, Trial Validity, and Interruptions

Use the same software timing convention as the Stroop protocol:

1. Present a fixation cross for **500 ms**.
2. Record stimulus onset as the `requestAnimationFrame` callback timestamp for the frame that first renders the five-symbol array. Use the same `performance.now()` time origin for event-handler timestamps and deadline calculations.
3. Accept the first mapped, non-repeat `keydown` whose handler timestamp is at or after recorded onset and strictly before the **2,000 ms** deadline. RT is `keydown handler timestamp − recorded browser onset`.
4. Ignore keys before stimulus onset, unmapped keys, `keydown` events with `repeat = true`, and all later events after the first valid mapped response. A wrong mapped key is an incorrect response; later correction is not accepted.
5. If no valid mapped response occurs before the deadline, classify a timeout. An event handler at or after the deadline cannot become a response, even if the browser's timeout callback was delayed.
6. End the stimulus on the next animation-frame callback after a response, or the first frame callback at/after deadline for a timeout. Start the **500 ms inter-trial interval** at that stimulus-offset callback. Show practice feedback during the interval and only the background during main-task intervals; ignore key events during the interval.

The recorded browser onset is not a measurement of photon onset or proof of when the glyphs physically reached the participant's eyes. Frame scheduling, rendering, refresh rate, input hardware, operating system, browser, and load can affect timing. Browser timing studies support conditional feasibility, not laboratory-grade or device-equivalent timing [W1, W3–W5, P1, P2].

Do not begin a timed trial while the page is hidden or unfocused; wait until visible and focused. If visibility or focus is lost after stimulus onset and before response/deadline, mark that trial technically invalid, not a timeout; reject later responses for it, record the reason, and do not silently replay it. Wait until visible/focused before proceeding. An invalid trial does not by itself invalidate the rest of the session.

If the participant leaves before all scheduled main trials end, mark the session `incomplete`. If page closure/reload or an unrecoverable runtime error terminates it, mark it `interrupted`. Do not automatically resume or regenerate a schedule. Unpresented trials are not outcomes or timeouts. Do not display complete-session condition contrasts for incomplete/interrupted sessions; partial trial counts/status may be shown with a clear label. A schedule-generation failure before any trial begins is a `technical_error`.

## 8. Randomization and Reproducibility

### Main schedule algorithm

1. Obtain and record a 32-bit unsigned session seed from the platform's cryptographically secure random source. If that source is unavailable, stop before the session and report a technical error; do not silently substitute a constant seed.
2. Initialize the 32-bit `mulberry32` PRNG with the seed. Identify this Flanker randomization configuration as `HB-FLANKER-shuffle-v1`.
3. Define the six unique items as each pair of condition (`congruent`, `incongruent`, `neutral`) and target direction (`left`, `right`). Build **10 six-item balancing sets**, each containing each of the six items exactly once. Concatenate the accepted permutations without a pause or participant-visible block marker. This yields exactly 10 of each item.
4. For each set, use Fisher–Yates with the continuing PRNG stream to shuffle the six items. Check the candidate together with up to the last three already accepted trials. Accept it only if the combined sequence has no run longer than **3** identical conditions, no run longer than **3** identical target directions, and no identical five-symbol stimulus on adjacent trials. On rejection, reshuffle the same six items with the continuing stream. Permit at most **10,000 candidates per set**.
5. If a set cannot be generated within the limit, stop with an explicit schedule-generation error; do not relax constraints, alter balances, or substitute an unseeded order.
6. Generate practice with a separate `mulberry32` stream initialized by `(seed XOR 0x9E3779B9) >>> 0`, using two six-item balancing sets and the same constraints. Preserve the seed, PRNG/shuffle identifier, protocol/configuration version, accepted practice and main order, and schedule-generation status.

Use the Mulberry32 recurrence: set `t = state = (state + 0x6D2B79F5) mod 2^32`; then `t = imul(t XOR (t >>> 15), t OR 1) mod 2^32`; then `t = t XOR ((t + imul(t XOR (t >>> 7), t OR 61)) mod 2^32)`; return unsigned `(t XOR (t >>> 14)) / 2^32`. `imul` is 32-bit signed multiplication with result interpreted modulo `2^32`; `>>>` is unsigned right shift. Fisher–Yates iterates `i` from `n−1` down to 1, chooses `j = floor(random() * (i+1))`, and swaps entries `i` and `j`.

These are concealed balancing sets, not condition blocks; trial timing and feedback do not change at their boundaries. Local exact balancing is a pragmatic compromise that restricts the sequence distribution and may introduce regularity. It supports reproducibility, not a claim of uniformly sampling all possible schedules or eliminating sequential effects. A feasible witness order for one set is `congruent-left, incongruent-right, neutral-left, congruent-right, incongruent-left, neutral-right`; repeating this order satisfies the balance and adjacency limits. The generator randomizes each set rather than repeating that witness order.

## 9. Trial Record and Outcomes

Each conceptual trial record, with its session context, should include:

- Experiment/protocol/configuration version, session identifier, one-based trial index within phase (practice 1–12; main 1–60), and practice/main designation.
- Condition, target direction, exact five-symbol string, flanker identities/directions, and the correct logical response key.
- Participant's first valid mapped response key/direction or no response; outcome (`correct`, `incorrect`, `timeout`, `invalid`); timeout/invalid reason where applicable.
- Monotonic timestamps for fixation onset, stimulus-onset rAF callback, first valid response handler if any, response deadline, stimulus offset/trial end, and ITI end; derived RT where a valid mapped response exists.
- Session seed, PRNG/shuffle identifier, randomization configuration version, and realized practice/main order.
- Focus/visibility interruption status, break taken/duration, and session status (`complete`, `incomplete`, `interrupted`, or `technical_error`).

Do not collect unnecessary identifying or device-fingerprinting data. The final data dictionary must define field names, types, units, and missing-value representation before implementation.

| Outcome | Definition and metric treatment |
|---|---|
| Correct | First valid mapped key matches the target arrow direction; numerator for response accuracy and successful-response rate; eligible for primary RT. |
| Incorrect | First valid mapped key does not match the target; remains in response-accuracy and successful-response-rate denominators, not their numerators; retain its response and RT but exclude it from primary correct RT. |
| Timeout | No valid mapped response before deadline; exclude from response accuracy, include in successful-response and timeout-rate denominators; no response RT. |
| Technical/protocol-invalid | A predeclared presentation, timing, focus, or visibility issue makes the trial uninterpretable; exclude from all metric denominators and RT, and report reason/count. |

Unmapped keys are not responses. An unpresented scheduled trial is not a timeout. Do not exclude a participant or trial because of a slow response or an incorrect response.

## 10. Analysis Plan and Contrasts

Use main trials only; practice is excluded. Report counts and denominators overall and by condition. Let `C` = correct, `I` = incorrect, `T` = timeout, and `V` = technical/protocol-invalid:

- **Response accuracy:** `C / (C + I)`; correct responses divided by trials with a valid mapped response.
- **Successful-response rate:** `C / (C + I + T)`; timeouts count as no successful response.
- **Timeout rate:** `T / (C + I + T)`.
- **Invalid trials:** report `V` and reasons separately; exclude them from all three denominators.
- **Primary RT:** median RT for correct, valid main-trial responses, separately by condition; show the number contributing to each median. Retain incorrect RTs in trial data, but do not pool them into primary correct RT.

If a rate denominator is zero, show the rate as unavailable rather than zero. Show a condition's RT median only with at least **10 valid correct RT observations**; show an RT contrast only if both conditions meet that same threshold. This 10-trial display rule is a pragmatic product decision, not a validated threshold, power calculation, or assertion that other trials are invalid. Do not apply post-hoc RT cutoffs.

| Contrast | RT formula | Response-accuracy formula | Successful-response-rate formula |
|---|---|---|---|
| **Flanker interference** (Incongruent vs Neutral) | `RT_incongruent − RT_neutral` | `Accuracy_neutral − Accuracy_incongruent` | `Success_neutral − Success_incongruent` |
| **Facilitation** (Neutral vs Congruent) | `RT_neutral − RT_congruent` | `Accuracy_congruent − Accuracy_neutral` | `Success_congruent − Success_neutral` |
| **Overall congruency** (Incongruent vs Congruent) | `RT_incongruent − RT_congruent` | `Accuracy_congruent − Accuracy_incongruent` | `Success_congruent − Success_incongruent` |

A positive RT contrast means the first RT condition is slower. In particular, positive facilitation means neutral RT exceeds congruent RT. A positive accuracy or successful-response contrast means the first condition in that rate formula has the higher rate; it does not mean slower or faster performance. Show counts with each result. Show a rate contrast only when both condition denominators are nonzero. Do not show any complete-session condition contrast for an incomplete/interrupted session. These are descriptive contrasts whose interpretation depends on this protocol's em-dash neutral baseline; they are not causal or diagnostic conclusions. Do not combine them into a cognitive score.

## 11. Limitations and Participant Safeguards

- The original Eriksen task used letters; this is an arrow adaptation. Results apply to this specified arrow/dash task, not automatically to letter-flanker tasks or other variants [F1, F4].
- The dash baseline is not perceptually matched to arrows and can affect neutral-relative contrasts. Spatial arrangement, distance, visual angle, font fallback, display scaling, and target visibility matter [F1–F3].
- A fixed F/J mapping creates hand, key-layout, and motor influences. Keyboard accessibility needs may make the task unusable or non-comparable for some participants.
- Practice, repetition, sequence regularity, fatigue, and strategy may change responses; practice/main separation and randomized order do not remove all such effects.
- Condition-to-condition transition frequencies are not controlled by the balancing sets, so sequential (previous-trial) effects [F5, F7] may contribute to session means. This is disclosed to participants with their results (approved decision §14.4).
- Sixty trials (20 per condition) are a deliberately short educational session. Errors, timeouts, and invalid trials reduce usable counts. The schedule provides descriptive observations, not demonstrated statistical power, validated measurement, or stable individual estimates.
- Robust group-level task effects do not imply reliable individual differences; test-retest reliability concerns have been documented for classic cognitive tasks including Flanker [S7].
- RT and accuracy can trade off. Display them separately with counts and timeouts; do not present faster RT as unqualified better performance [S5].
- Browser/device timing varies. A `requestAnimationFrame` timestamp is a browser record, not physical onset verification, and the protocol makes no laboratory-grade timing or cross-device equivalence claim [W1, W3–W5, P1–P3].
- Present results as educational, session-specific descriptions only. No diagnosis, IQ inference, intelligence ranking, personality claim, or stable-trait conclusion is permitted.

## 12. Remaining Questions for Human Review

The first three questions below (neutral baseline, geometry/mapping, balancing sets) were resolved by the Cycle 6 decisions in §14. The remaining items stay open for any future release scope or research use.

- Is the em-dash neutral baseline acceptable, given its visual differences from arrow flankers, or should a different explicitly justified neutral be evaluated?
- Are the five-cell geometry, font/glyph fallback, CSS dimensions, and fixed F/J mapping suitable for the intended MVP and supported devices?
- Is the hidden six-item balancing-set randomization acceptable despite its restricted schedule distribution and possible sequence regularity?
- The 12 practice/60 main counts, 2-second deadline, 500 ms fixation/ITI, and 10-correct-RT display threshold are pragmatic; any future research use would need a separate design justification and reliability/power review.
- Accessibility accommodations, intended participant audience, browser/device support and any future research-use consent/oversight require review before release or research use.

## 13. References

Bibliographic details and DOI links below were checked in the approved Cycle 2 literature review. They support background or methodological context; they do not validate this HUMAN BENCHMARK protocol.

**[F1]** Eriksen, B. A., & Eriksen, C. W. (1974). Effects of noise letters upon the identification of a target letter in a nonsearch task. *Perception & Psychophysics, 16*(1), 143–149. Original experimental paper. [https://doi.org/10.3758/BF03203267](https://doi.org/10.3758/BF03203267)

**[F2]** Eriksen, C. W., & St. James, J. D. (1986). Visual attention within and around the field of focal attention: A zoom lens model. *Perception & Psychophysics, 40*(4), 225–240. [https://doi.org/10.3758/BF03211502](https://doi.org/10.3758/BF03211502)

**[F3]** Eriksen, C. W. (1995). The flankers task and response competition: A useful tool for investigating a variety of cognitive problems. *Visual Cognition, 2*(2–3), 101–118. Review. [https://doi.org/10.1080/13506289508401726](https://doi.org/10.1080/13506289508401726)

**[F4]** Fan, J., McCandliss, B. D., Sommer, T., Raz, A., & Posner, M. I. (2002). Testing the efficiency and independence of attentional networks. *Journal of Cognitive Neuroscience, 14*(3), 340–347. Experimental Attention Network Test paper with an arrow-flanker component. [https://doi.org/10.1162/089892902317361886](https://doi.org/10.1162/089892902317361886)

**[S5]** Heitz, R. P. (2014). The speed-accuracy tradeoff: History, physiology, methodology, and behavior. *Frontiers in Neuroscience, 8*, 150. Review. [https://doi.org/10.3389/fnins.2014.00150](https://doi.org/10.3389/fnins.2014.00150)

**[S7]** Hedge, C., Powell, G., & Sumner, P. (2018). The reliability paradox: Why robust cognitive tasks do not produce reliable individual differences. *Behavior Research Methods, 50*(3), 1166–1186. Empirical test-retest studies and methodological analysis including Flanker. [https://doi.org/10.3758/s13428-017-0935-1](https://doi.org/10.3758/s13428-017-0935-1)

**[W1]** Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. *Behavior Research Methods, 47*(2), 309–327. Empirical timing validation across computer systems. [https://doi.org/10.3758/s13428-014-0471-1](https://doi.org/10.3758/s13428-014-0471-1)

**[W3]** Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: Comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. [https://doi.org/10.7717/peerj.9414](https://doi.org/10.7717/peerj.9414)

**[W4]** Anwyl-Irvine, A., Dalmaijer, E. S., Hodges, N., & Evershed, J. K. (2021). Realistic precision and accuracy of online experiment platforms, web browsers, and devices. *Behavior Research Methods, 53*(4), 1407–1425. [https://doi.org/10.3758/s13428-020-01501-5](https://doi.org/10.3758/s13428-020-01501-5)

**[W5]** Gao, Z., Chen, B., Sun, T., Chen, H., Wang, K., Xuan, P., & Liang, Z. (2020). Implementation of stimuli with millisecond timing accuracy in online experiments. *PLOS ONE, 15*(7), e0235249. Physical display-timing study; findings are specific to tested configurations. [https://doi.org/10.1371/journal.pone.0235249](https://doi.org/10.1371/journal.pone.0235249)

**[P1]** MDN Web Docs. (n.d.). *Window.requestAnimationFrame()*. Mozilla Developer Network. Browser API behavior reference; not empirical timing validation. [https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

**[P2]** MDN Web Docs. (n.d.). *Performance.now()*. Mozilla Developer Network. Browser API behavior reference; not empirical timing validation. [https://developer.mozilla.org/en-US/docs/Web/API/Performance/now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

**[P3]** MDN Web Docs. (n.d.). *Page Visibility API*. Mozilla Developer Network. Browser API behavior reference; not empirical timing validation. [https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

**[F5]–[F9]** Cycle 6 additions (sequential effects, spacing, online replication, broad-population use) are listed with their verification status in [FLANKER_EVIDENCE_REVIEW.md](../scientific/FLANKER_EVIDENCE_REVIEW.md).

## 14. Cycle 6 Approved Decisions

The project owner approved the following in Cycle 6. No parameter in §1–§11 changed.

1. **Approval.** This protocol is approved as `HB-FLANKER-1.0` (formerly `HB-FLANKER-1.0-draft`).
2. **Em-dash neutral baseline** (§4) is retained, with the §4 caveat. Non-directional line flankers are an established neutral in the Attention Network Test [F4].
3. **Geometry and F/J mapping** (§4–§5) are retained, with the visual-angle limitation in §11.
4. **Concealed six-item balancing sets** (§8) are retained. Uncontrolled condition transitions must be disclosed (added to §11 and to the participant results).
5. **Base item order** for `HB-FLANKER-shuffle-v1` is ratified as listed in §8.3: `congruent-left, congruent-right, incongruent-left, incongruent-right, neutral-left, neutral-right`.
6. **Mapping check** (§5): only a wrong mapped key shows the correct mapping and repeats the prompt; unmapped and auto-repeated keys are ignored.
7. **Narrow viewport protection** (§4) is required: no timed trial starts, and no record is created, unless the full 272 px array is visible; the participant is told why and can resume once it fits.
