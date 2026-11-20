# Stroop, Flanker, and Browser-Experiment Evidence Review

**Project:** HUMAN BENCHMARK  
**Cycle:** 2 — Scientific Protocol & Literature  
**Task:** 1 — Literature & Evidence Review  
**Status:** Evidence review for protocol development; not a protocol approval or validation  

## 1. Scope and approach

This focused narrative review supports the next protocol-development tasks for the Stroop and Eriksen Flanker effects. It asks what the paradigms demonstrate, how common design choices alter their interpretation, what can be measured descriptively, and what browser timing evidence permits us to claim. It is not a systematic review, meta-analysis, power analysis, or complete account of either literature.

Bibliographic details were checked against Crossref, OpenAlex, PubMed/PMC, and publisher pages. Accessible abstracts and full text were consulted where available; some seminl or older articles were available only as bibliographic records or summaries. The references note the kind of source and the limits of what this review claims from it. Citations support the specific claims beside them; design implications and recommendations are identified as such.

This review informs, but does not replace, the preliminary Cycle 1 proposals in [STROOP_PROTOCOL.md](../experiments/STROOP_PROTOCOL.md) and [FLANKER_PROTOCOL.md](../experiments/FLANKER_PROTOCOL.md), the shared conceptual rules in [EXPERIMENT_DATA_CONVENTIONS.md](../experiments/EXPERIMENT_DATA_CONVENTIONS.md), or the deferred questions in [CYCLE_2_QUESTIONS.md](../experiments/CYCLE_2_QUESTIONS.md). No protocol is finalized here.

## 2. Stroop effect

### 2.1 Origin, phenomenon, and interpretation

Stroop's 1935 paper examined interference in serial verbal responding. Its familiar color-word demonstration asks people to name ink colors while color words may either agree with or conflict with the ink; it also included word-reading and color-naming comparisons. The classic card-based, spoken-response procedure is not identical to a modern, single-trial keyboard task. Later work has adapted the paradigm in many ways, so “Stroop task” names a family of procedures rather than one interchangeable test [S1, S2].

The central behavioral pattern is that responding to one stimulus dimension can be slower or less accurate when another dimension activates a competing response. In the color-word task, fluent reading can compete with the instructed ink-color response. The interference is an observable condition difference, not direct proof of a single mental operation or brain system. The automaticity/controlled-processing account is influential, but models differ: for example, Cohen, Dunbar, and McClelland presented a parallel-distributed-processing account in which relative processing strengths and task demands can produce the pattern [S2, S3]. Performance also depends on the particular stimulus set, instructions, response mode, and participant experience. It does not isolate a general “inhibition ability” or justify a trait, diagnostic, IQ, or intelligence-ranking inference.

### 2.2 Conditions, baselines, and contrasts

Congruent and incongruent color-word trials are common, and a neutral condition is often added. A neutral baseline is a design choice, not a theoretically empty state: a neutral word, a non-word string, a colored patch, or another control stimulus can differ in reading, visual complexity, and response activation. The chosen baseline therefore affects what a contrast means [S2, S4].

If condition RT is summarized as median correct RT, the conventional signed contrasts for the proposed three-condition design are:

- **Interference:** incongruent − neutral. A positive value means slower correct responding in the incongruent condition.
- **Facilitation:** neutral − congruent. A positive value means faster correct responding in the congruent condition.
- **Overall congruency effect:** incongruent − congruent. A positive value means slower correct responding in the incongruent condition.

These are distinct contrasts, not components to combine into one score. The same direction conventions can be stated for accuracy as a difference in response-accuracy proportions, but a positive value then means greater accuracy in the first-named condition; it does not mean slower or faster responding. The neutral condition must be described explicitly before “interference” or “facilitation” is interpreted.

### 2.3 Stimuli and participant experience

Color names must be legible and well learned for the reading dimension to compete as intended. Language proficiency, reading fluency, and word familiarity can therefore change the strength or even the comparability of word-based trials. This is a task-design concern, not a basis for inferring a participant's reading ability. An English-language MVP would need to say that English color-word familiarity is assumed and should not silently generalize results to other languages [S1, S2, S3].

For a neutral word list, familiarity, frequency, language, length/visual width, and semantic or cultural color associations need review. A set of everyday words is not automatically neutral. Repeating a very short list many times also risks item-specific learning and makes “the neutral condition” dependent on those particular words. These considerations do not establish that any one candidate list is invalid; they establish a need to select, review, and version the list rather than call it validated. The classic literature and later Stroop-test reviews document substantial variation in stimulus and scoring choices [S2, S4].

Ink color, display calibration, text size, font, contrast, and the participant's color perception also matter. Keyboard responses avoid voice onset detection, but introduce motor, hand, and key-layout factors. A fixed color-to-key mapping is easy to explain and reproduce; it does not eliminate mapping or motor effects. Counterbalancing is a candidate research control, especially for group comparisons, but it changes the participant's response mapping and must be considered alongside a consistent MVP experience.

### 2.4 Design and procedure choices

The original paper used serial spoken responses; computerized studies include both response-by-response designs and timed naming of lists. Practice, blocking versus mixing conditions, feedback, deadlines, and trial counts vary across task versions [S1, S2, S4]. This review did not identify a universal “correct” number of practice or main trials for a short online keyboard adaptation. Fixation/foreperiod, stimulus duration or response deadline, and inter-trial interval also vary across versions; these choices set time pressure and total exposure and should be justified for the task rather than copied as universal standards [S1, S2, S4]. Practice can check comprehension and establish the mapping; it should be separated from main-task analysis. Feedback may help learning during practice, but feedback during the main task can change behavior and should be a deliberate, documented choice.

A within-participant design allows each participant to experience the conditions, but condition order and trial sequence can introduce practice, fatigue, expectancy, and sequential effects. Randomization should preserve required condition and response balance while avoiding obvious runs; the algorithm, constraints, seed, configuration version, and realized schedule should be retained. Randomization does not remove every order effect, and a seed alone is not sufficient to reproduce a schedule if the generator or constraints change.

The Cycle 1 proposal of 60 main trials (20 per condition) is feasible as a short descriptive educational activity, but available evidence does not establish that it is statistically powered, validated, or reliable for individual differences. At this count, correct RT summaries may be based on fewer than 20 trials after errors, timeouts, and technical invalidity. The proposed minimum of 10 correct trials for showing a condition RT is a pragmatic display rule, not a scientific threshold. Hedge and colleagues found that well-established Stroop and Flanker effects can coexist with poor test-retest reliability of individual-difference scores; robustness of a group-level effect is not the same as reliability for ranking individuals [S7].

### 2.5 Outcomes and analysis considerations

RT and accuracy should be reported separately. Asking participants to respond both accurately and promptly does not remove the speed-accuracy trade-off: pressure, caution, and strategy can change both measures [S5]. Incorrect responses should remain in accuracy calculations, while response-accuracy rate, successful response rate, timeout rate, and technical-invalid counts should have explicit denominators. A timeout is not an incorrect key response; a technical-invalid trial should not silently become a timeout or disappear from the record.

Correct-response RT is a common descriptive target when the question concerns speed on successful trials, but it must be paired with accuracy/error reporting so a faster condition with more errors is not presented as an unqualified benefit. Error RTs are potentially informative but represent a different outcome and should not be folded into the primary correct-RT statistic without a justified analysis. The primary metric and any handling of implausible values must be specified before results are examined.

RT distributions are often asymmetric and affected by extreme observations. The mean is sensitive to extreme values; the median is less so, but is not universally superior and discards distributional detail. Ratcliff reviews the consequences and alternatives for dealing with RT outliers; it does not endorse one universal cutoff for every task [S6]. For a small educational MVP, a median can be an understandable descriptive summary, provided the trial count and exclusions are visible and no inferential or individual-difference claim is made.

## 3. Eriksen Flanker effect

### 3.1 Origin, phenomenon, and interpretation

The 1974 Eriksen and Eriksen study introduced noise letters around a target letter in a nonsearch identification task. Responses to the central target can be affected by whether nearby flankers activate a compatible or competing response [F1]. The task has since been used to investigate selective attention and response competition; the 1995 review describes the Flanker task as useful across multiple cognitive questions rather than as a measure of one isolated faculty [F3].

The core effect is an observable difference in response behavior across flanker configurations. It does not by itself prove that a participant failed to “filter” distractors, or isolate inhibition from perceptual selection, response competition, task set, and stimulus geometry. Eriksen and St. James's zoom-lens account illustrates that spatial attention and the distribution of processing across a display are relevant theoretical issues, not details that can be ignored [F2].

### 3.2 Stimulus families and conditions

The original paradigm used letters with target/flanker response compatibility. Arrow arrays are a common later variant, including in the Attention Network Test literature [F1, F4]. Arrows may be easier to teach in an MVP, but an arrow task is an adaptation, not a literal reproduction of the original letter task; conclusions and stimulus properties should be described for the variant actually used.

Congruent flankers indicate the same response as the target; incongruent flankers indicate a competing response. A neutral condition uses flankers not mapped to either response. The neutral symbols, their number, spacing, size, and visual energy affect the baseline. A dash may be a reasonable proposal, but it is not guaranteed to be perceptually equivalent to arrows or letters. Target direction should be balanced within each condition; the configuration should be visually centered and rendered consistently. Flanker distance, target visibility, font, display width, and spacing can alter how much surrounding material is processed [F1–F3].

For RT medians, the usual signed congruency contrast is **incongruent − congruent**; a positive value indicates slower correct RT on incongruent trials. With a neutral condition, incongruent − neutral can describe the additional cost relative to that chosen neutral display. Accuracy contrasts are differences in proportions and must be interpreted in the accuracy direction. These are descriptive contrasts, not a combined score or a direct measure of inhibitory capacity.

### 3.3 Design, response, and trial-count considerations

Flanker studies vary in target/flanker identity, layout, timing, practice, feedback, and number of trials. The 2002 Attention Network Test illustrates an arrow-based flanker component in a broader task, but its design is not automatically a template for a standalone educational Flanker experiment [F4]. A two-key left/right mapping is a pragmatic choice; hand, key position, keyboard layout, and response preparation remain possible influences. Balance left/right targets and conditions, and document the mapping. Whether to counterbalance mappings is an open design question, not a settled requirement for a guest-facing MVP.

Practice should demonstrate that the center target controls the response. Trial timing (including fixation, stimulus duration/deadline, and inter-trial interval), practice count, main-task feedback, and break policy vary by design; the ANT is an example of a defined task, not a universal schedule for a standalone Flanker task [F3, F4]. These parameters need task-specific review. A proposed 60 trials with 20 per condition can support a short demonstration and display of a within-session descriptive pattern, but it is not evidence of adequate power, stable individual scoring, or validation. After errors, timeouts, and invalid trials, condition estimates may be based on few trials. The reliability concern applies to Flanker as well as Stroop [S7].

### 3.4 Behavioral measures and limitations

Report RT, response accuracy, successful response rate, timeout rate, and invalid trials separately. Correct RT alone can hide a speed-accuracy shift; errors should be retained in accuracy calculations and not silently removed from the record [S5]. For transparent educational output, report the number of valid correct RT observations behind each median and show when a condition has insufficient observations under a product display rule.

Spatial configuration is central to this paradigm. A change in spacing, display scaling, font metrics, or viewport can change the target-flanker geometry; a five-character string is therefore not guaranteed to have the same geometry across all devices. Practice and repetition can also alter task familiarity and participant strategy. The effect can be robust in group experiments without yielding a dependable individual-difference score, as the test-retest results reviewed by Hedge et al. caution [S7].

## 4. Online and browser-based experiments

### 4.1 What empirical timing studies show

The empirical evidence does not support either “browsers cannot measure RT” or “a browser timestamp is laboratory-grade.” Results depend on the software, browser, operating system, device, stimulus, and measurement method:

- Reimers and Stewart compared Flash and HTML5/JavaScript across 19 computer systems, using external hardware to measure visual presentation and produce precisely timed responses. They reported generally small within-system variability and somewhat larger between-system variability, while noting concerns for some correlational and longitudinal uses. The results apply to the systems tested, not every present-day setup [W1].
- de Leeuw and Motz compared response times from JavaScript and Psychophysics Toolbox in a visual-search task. The study supports the possibility of detecting task effects in browser-collected RT data, but software-specific RT distributions and absolute timing are not interchangeable by assumption [W2].
- Bridges et al. compared multiple laboratory and online experiment generators with external timing equipment across operating systems and browsers. Their online systems were generally more variable than laboratory systems, although some combinations approached millisecond precision on some measures. Their response measurements used a high-performance button box, not an ordinary participant keyboard; the study also emphasizes validating the configuration being used [W3].
- Anwyl-Irvine et al. tested several web platforms, browsers, operating systems, display durations, and desktop/integrated laptop keyboards, using a photodiode and robot actuator; they also described technology reports from more than 200,000 participants. They found reasonable accuracy and precision in tested modern platforms, with no one platform best for every feature and condition [W4].
- Gao et al. physically measured browser display output for several web animation methods, browsers, operating systems, and stimuli. In their tested configurations, `requestAnimationFrame` performed well in many cases but poorly on their Linux setup; that result is configuration-specific and is not a universal guarantee for a browser or an MVP implementation [W5].
- Anwyl-Irvine et al. demonstrated a simplified Flanker effect across different participant groups, settings, equipment, and connection types using an online experiment platform. This supports the feasibility of online behavioral testing; it is not evidence that all hardware has identical timing or that a browser timestamp is a physical display-onset measurement [W6].

Together, these studies show that online RT work can be useful when the task and timing system are suitable, but absolute timing accuracy and between-device comparability should not be assumed. Internet delivery is particularly relevant to loading and deployment; after a stimulus is locally rendered, the response event still passes through the participant's input hardware, operating system, browser, and code. That chain is not measured by a single software timestamp.

### 4.2 Display refresh, rendering, and timestamps

`requestAnimationFrame` asks the browser to call a callback before a repaint. Its cadence generally follows the display refresh rate, and common browsers pause it in hidden/background tabs [P1]. A callback timestamp indicates a browser animation-frame time; it does not directly measure the moment photons from the intended stimulus reached the participant's eyes. Display refresh, compositor scheduling, and panel response can introduce differences. Physical onset/duration claims require external validation such as a photodiode, as used in timing studies [W3–W5].

`performance.now()` is a high-resolution timestamp tied to a monotonic time origin, unlike wall-clock time that can be adjusted [P2]. It is appropriate as a clock basis for elapsed time if stimulus and key event timestamps are taken in the same time domain. Its resolution and availability do not make display onset physically exact. A keydown timestamp records when the browser handled the event, not the exact physical instant at which a key switch closed; keyboard scan and event-delivery delays are device-dependent [W1, W3, W4].

For our protocols, this supports a consistent software definition—elapsed time from recorded stimulus-onset timestamp to first valid mapped keydown timestamp—while preserving the caveat that “recorded onset” is not a photodiode-confirmed onset. Pre-stimulus input, repeated events, later key events, timeouts, and focus/visibility interruptions need explicit treatment in the protocol and data record. A hidden tab should not continue a normal timing claim: browser documentation describes hidden-state events and throttling/pausing behavior, while the cited validation studies do not establish an empirical correction for hidden-tab trials [P1, P3, W1–W5].

### 4.3 Online variability, scope, and practical safeguards

Remote participants use different displays, refresh rates, browsers, operating systems, keyboards, and input conditions, and may be distracted or interrupted. Automated studies document timing variation by platform/device; the large technology sample in Anwyl-Irvine et al. describes how heterogeneous participant hardware is [W3, W4]. These differences can add noise or systematic differences. They do not mean online data are unusable, and they do mean that one setup's validation cannot certify another.

**Reasonable MVP safeguards to consider during implementation:**

1. Define and document a tested desktop browser/device scope; do not treat mobile touch or virtual-keyboard responses as equivalent to physical-key timing.
2. Preload required assets and render a simple, stable stimulus, then schedule onset from a frame callback where appropriate; do not describe the callback as verified photon onset.
3. Use one monotonic clock domain for recorded software onset and key events. Preserve the actual timestamps and trial validity reason rather than fabricating precision.
4. Detect loss of focus/visibility and mark affected trials invalid under a predeclared rule; do not recast interruption as a participant timeout or silently replay the trial.
5. Test across representative browsers, operating systems, refresh rates, and keyboards. If timing precision is a scientific claim, perform hardware validation on the actual build/configuration.
6. Clearly disclose browser/device limitations. An MVP can record browser-side timing and explain its limits; it cannot guarantee equal physical display onset, input latency, or participant testing conditions across all devices.

These are methodological implications, not implementation instructions or a claim that the current project has performed timing validation.

## 5. Evidence map

Confidence describes support for the general claim, not approval of any proposed HUMAN BENCHMARK protocol. “Strong” indicates direct, established evidence or multiple convergent sources; “moderate” indicates support with important design/context limits; “limited” indicates sparse, indirect, or product-specific evidence.

| Question | Evidence / finding | Sources | Implication for HUMAN BENCHMARK | Confidence |
|---|---|---|---|---|
| What does the Stroop task demonstrate? | Color-word conflict can change response time and errors when reading competes with the instructed color response. The task is a family, and interference is not proof of one isolated cognitive mechanism. | [S1–S3] | Describe the particular task and observed condition differences; avoid “inhibition ability” or diagnosis claims. | **Strong** for the behavioral effect; **moderate** for any single mechanism because theories differ. |
| Is there one canonical Stroop procedure? | The original serial spoken/card procedure differs from later task variants; stimuli, administration, and scoring vary across versions. | [S1, S2, S4] | Label our keyboard task as an adaptation and document its own version. | **Strong** |
| Which neutral Stroop stimuli are best? | A neutral word or other baseline is not psychologically empty. Visual complexity, reading, familiarity, semantic/color association, and the chosen comparison affect interpretation; no single candidate list is established here as validated. | [S2, S4] | Review candidate words for language, familiarity, length/width, repetition, and color associations before approval. | **Moderate**; list-specific validity needs direct stimulus review. |
| How does language familiarity matter? | The word-reading dimension requires readable, familiar words; language and reading experience can change the balance between word and color processing. Exact cross-language comparability is not established by this review. | [S1–S3] | State the intended language and audience; avoid treating translated stimuli as equivalent without evidence. | **Moderate** |
| Which Stroop contrasts mean interference or facilitation? | Incongruent − neutral is the neutral-relative interference contrast; neutral − congruent is the neutral-relative facilitation contrast; incongruent − congruent is the overall congruency contrast. Meaning depends on the actual neutral baseline. | [S2, S4] | Define signed RT and accuracy contrasts separately and identify the baseline. | **Strong** |
| Are 20 trials per condition sufficient? | There is no universal count or validated threshold established here. Estimate quality depends on usable trial count and purpose; robust task effects do not guarantee reliable individual differences. | [S2, S7] | Treat 20/condition as a short descriptive product choice, not powered, validated, or suitable for ranking people. Show counts and missingness. | **Limited** for any numeric adequacy claim; **strong** caution against inferring individual reliability from a group effect. |
| Is median RT preferable to mean RT? | RT distributions and outliers make summaries sensitive to analysis choices. A median is less sensitive to extreme values, but neither a median nor a universal cutoff is automatically right for every question. | [S6] | Median correct RT is defensible for an understandable descriptive display if the analysis is prespecified and observation counts are shown. | **Moderate** |
| How should errors and speed-accuracy be handled? | Response speed and accuracy can trade off; accuracy and RT should be inspected together. Correct-only RT answers a narrower question and does not erase errors. | [S4, S5] | Report RT, accuracy, successful responses, timeouts, and invalid trials separately; do not create a combined score. | **Strong** |
| Are individual Stroop/Flanker effects reliable scores? | Hedge et al. reported low test-retest reliability for many classic task effects despite their established experimental use. Group-effect replication and ranking individual participants are different properties. | [S7] | Do not present session differences as stable traits, norms, or a leaderboard. The 10-correct-trial display rule is pragmatic only. | **Strong** for the distinction; specific reliability depends on metric and design. |
| Should Flanker use arrows or letters? | The original Eriksen task used target/noise letters; arrow arrays are a later, common variant, including in the ANT. They are related but not identical stimulus tasks. | [F1, F4] | Arrows may be an accessible MVP choice, but identify them as an arrow-Flanker variant and review its specific design. | **Strong** |
| How important is Flanker geometry? | Flanker response effects are studied in spatial arrays; attention models and reviews make spatial extent/configuration central to interpretation. | [F1–F3] | Specify target position, flanker count, spacing, size, display scaling, and neutral symbols; test viewport effects. | **Moderate**; exact optimal parameters are task-dependent. |
| How should Flanker conditions be compared? | Incongruent − congruent describes the congruency cost; if a neutral baseline is used, incongruent − neutral describes a different comparison. | [F1, F3, F4] | Keep contrasts distinct and state signed interpretation; do not label them a single “inhibition score.” | **Strong** |
| Do browser experiments support RT work? | Multiple validation studies found browser-based methods can support behavioral RT tasks, with varying accuracy and precision by platform/system and with some task effects detectable online. | [W1–W6] | Browser measurement is plausible for an educational MVP, but must be scoped and caveated; do not claim lab-grade equivalence. | **Strong** that feasibility is conditional; **limited** for any untested configuration. |
| What does `requestAnimationFrame` guarantee? | It schedules work before a repaint and generally follows refresh cadence, but does not measure photon onset; empirical display tests show setup-specific variation. | [P1, W3, W5] | Use frame-aware scheduling cautiously and distinguish software timestamp from physical onset. | **Strong** for API behavior; **moderate** for measured performance on an untested setup. |
| What about background tabs and focus loss? | Browsers commonly pause or throttle animation callbacks in hidden tabs. The timing validation literature cited here does not provide a universal correction for hidden-tab trials. | [P1; limits of W1–W5] | Detect interruption and use an explicit invalid-trial rule; do not analyze affected timing as ordinary trials. | **Strong** for documented browser behavior; **limited** for task-specific correction. |
| How should reproducibility be handled? | Timing and trial realization depend on configuration; a seed alone is not enough if generator/configuration changes. This is a methodological reproducibility implication, not a directly compared experimental result. | [W1, W3, W4] | Record seed, schedule/configuration version, randomization method, and realized order; make the algorithm deterministic and reviewable. | **Moderate** |

## 6. Preliminary MVP recommendations

These recommendations are for evaluation during protocol-development tasks. They do not approve the Cycle 1 proposals or establish scientific validity.

### 6.1 Stroop

| Preliminary recommendation | Basis and type | Confidence | Unresolved before protocol approval |
|---|---|---|---|
| Keep congruent, incongruent, and an explicitly defined neutral condition if the product intends to discuss interference and facilitation separately. | Contrasts depend on the chosen baseline; a neutral comparison makes the proposed interpretations explicit [S2, S4]. **Scientific recommendation.** | Strong for distinct contrast meanings; neutral implementation is task-specific. | Which neutral stimulus class is most comparable to the chosen word stimuli? |
| Treat English as a declared MVP audience assumption only if the product chooses it; do not imply cross-language equivalence. | Reading and word familiarity are part of the task, not incidental demographics [S1–S3]. **Scientific recommendation / scope decision.** | Moderate. | Language, eligibility wording, proficiency/self-report, and later translation policy. |
| Do not approve the proposed five-word neutral list without a stimulus review. | Frequency/familiarity, word length/width, repetition, and color associations can compromise the baseline; no validation of the proposed list is claimed [S2, S4]. **Scientific recommendation.** | Moderate; the exact candidate words need direct review. | Candidate list and whether 20 trials can be balanced without excessive repetition. |
| Keep RT and accuracy distinct; use median correct RT only as a transparent descriptive choice, and show usable trial counts. | Speed-accuracy trade-off and RT distribution/outlier issues [S5, S6]. **Scientific recommendation.** | Strong for separate outcomes; moderate for a median as the preferred descriptive statistic. | Outlier/missingness policy, secondary distribution summaries, and minimum reporting rule. |
| Retain 60 main trials/20 per condition only as a short-MVP product compromise unless protocol review justifies another count. | No reviewed source establishes this count as powered or reliable; effects and individual differences have different reliability requirements [S7]. **Pragmatic product decision.** | Limited on numeric adequacy. | Whether the usable correct-trial count is adequate for the intended descriptive display after pilot testing. |
| Use a fixed keyboard map for a consistent guest experience only after checking key layout, hand demands, and accessibility; do not treat it as eliminating motor effects. | Response method and mapping are design variables; the original task was spoken [S1, S2]. **Pragmatic product decision.** | Moderate. | Whether mapping counterbalance or alternative participation mode is in scope. |

### 6.2 Flanker

| Preliminary recommendation | Basis and type | Confidence | Unresolved before protocol approval |
|---|---|---|---|
| If arrows are used, call the result an arrow-Flanker variant and retain balanced left/right target directions. | Original letters and later arrow-based tasks share response compatibility logic but are not the same stimulus family [F1, F4]. **Scientific recommendation.** | Strong. | Arrow direction, display geometry, target/flanker count, and whether letter stimuli are preferable. |
| Review the neutral symbols as carefully as congruent/incongruent arrays; do not assume dashes are perceptually neutral. | Flanker effects depend on spatial configuration and the comparison stimulus [F1–F3]. **Scientific recommendation.** | Moderate. | Symbol identity, spacing, visual energy, and neutral contrast interpretation. |
| Balance target direction within condition; constrain randomization while preserving and recording the realized sequence. | Reduces simple condition-direction imbalance and supports reproducibility; exact constraints need task testing. **Scientific recommendation plus implementation/reproducibility choice.** | Moderate. | Sequence constraints, sequential effects, random generator/version, and practical balance checks. |
| Keep RT and accuracy separate and define incongruent − congruent as the signed primary RT contrast if that is the protocol's question. | Standard congruency interpretation, with error rates and speed-accuracy trade-off kept visible [F1, F3, S5]. **Scientific recommendation.** | Strong for contrast direction; metric choices still require protocol review. | Neutral comparison, RT preprocessing, and what results to suppress for insufficient data. |
| Keep 60 trials/20 per condition as an explicitly pragmatic educational proposal, not a measure of a stable individual trait. | Group-level task effects do not imply reliable individual differences; trial-count adequacy is not established here [S7]. **Pragmatic product decision.** | Limited on numeric adequacy; strong caution on trait interpretation. | Usable observations, fatigue, and pilot evidence for the intended session length. |

### 6.3 Shared browser/data recommendations

- Record stimulus and response timestamps using the same monotonic clock, but label RT as browser-recorded rather than as a physically verified onset-to-key interval [W1–W5, P2].
- Keep `correct`, `incorrect`, `timeout`, and `technical/protocol-invalid` distinct; report denominators and exclude invalid trials transparently, following the shared conceptual conventions.
- Keep practice separate from main analysis. Identify complete, incomplete, and interrupted sessions rather than representing unpresented trials as timeouts.
- Store experiment/protocol version, configuration, seed, randomization method version, and realized order with the conceptual trial record; do not design a database or API in this task.
- Prefer a documented desktop keyboard scope for the initial timed tasks. Do not silently substitute touch input or accessibility accommodations that alter response timing; provide an understandable participation alternative and explain comparability limits.
- Before making timing claims, measure the actual release build and target devices with external equipment. If that is not feasible for the MVP, report the limitation plainly rather than claiming laboratory-grade timing.

## 7. Limitations and uncertainties

1. **Narrative scope:** This is a focused review, not an exhaustive or preregistered systematic search. It does not estimate pooled effect sizes, resolve theoretical disputes, or provide a power calculation.
2. **Different task families:** Classic Stroop, computer color-word trials, clinical card tests, letter Flankers, arrow Flankers, and the Flanker component of the ANT are related but not interchangeable.
3. **Stimulus-level evidence:** This review does not validate the proposed words (`BOOK`, `CHAIR`, `FLOWER`, `HOUSE`, `STAR`), colors, arrow/dash layout, font, or screen dimensions.
4. **Counts and individual reliability:** No claim that 60 trials, 20 per condition, or 10 correct trials is statistically adequate or scientifically validated. The 10-trial threshold remains a product display rule.
5. **Timing generalization:** Browser timing studies tested finite versions of operating systems, browsers, experiment software, input hardware, and display setups. They do not certify the current HUMAN BENCHMARK implementation or all future devices.
6. **Physical timing:** A JavaScript timestamp cannot by itself verify physical photon onset or exact mechanical key actuation. The review does not claim that `requestAnimationFrame` solves display timing or that a monotonic clock removes hardware delay.
7. **Interpretation:** A single guest session is descriptive behavior under a particular task and context. It should not be used to diagnose, rank intelligence, infer stable ability, or compare users as if the task were validated.

## 8. Questions for protocol development

### Task 2 — Stroop Scientific Protocol

- Which exact color words, ink colors, neutral stimuli, language, and participant-facing familiarity assumptions should be used?
- Is the proposed neutral word list suitable after balancing familiarity, length/width, color association, and repetition? Is a larger list feasible?
- Is an event-based, within-participant procedure with the proposed 12 practice and 60 main trials appropriate for a short descriptive product?
- What feedback, deadline, fixation, inter-trial interval, break, response mapping, and mapping counterbalance are justified?
- Which signed RT and accuracy contrasts should be displayed, and what wording avoids implying a unitary inhibition score?
- What RT preprocessing, outlier, incorrect-trial, timeout, invalidity, and minimum-observation rules are defensible?
- What accessibility and color-vision limitations should the task disclose?

### Task 3 — Flanker Scientific Protocol

- Should the MVP use letters or arrows, and what interpretation changes with that stimulus family?
- Are two flankers per side and the proposed dash neutral condition an appropriate matched baseline?
- What target/flanker spacing, visual size, font, contrast, and viewport constraints should be specified?
- Are response mapping, target-direction balance, trial counts, practice, deadline, feedback, and break rules justified for the educational objective?
- Which contrasts and RT/error rules answer the intended behavioral question without overclaiming?

### Task 4 — Scientific Harmonization & Approval

- Which shared rules for timing, interruption, session completeness, invalid trials, and minimum reportable condition data should be identical across tasks?
- Which randomization constraints and metadata are needed to reproduce a schedule and inspect serial imbalance?
- What device/browser scope should the MVP document, and which hardware timing tests are feasible and necessary before release?
- What participant-facing language, privacy notice, data export, accessibility alternative, and research-use boundary should be approved?
- Is any pilot planned? If so, what participant group, consent, oversight, and data handling are needed before recruitment or use as research?

## 9. References

### Stroop

**[S1]** Stroop, J. R. (1935). Studies of interference in serial verbal reactions. *Journal of Experimental Psychology, 18*(6), 643–662. Original experimental paper. [https://doi.org/10.1037/h0054651](https://doi.org/10.1037/h0054651)

**[S2]** MacLeod, C. M. (1991). Half a century of research on the Stroop effect: An integrative review. *Psychological Bulletin, 109*(2), 163–203. Integrative review. [https://doi.org/10.1037/0033-2909.109.2.163](https://doi.org/10.1037/0033-2909.109.2.163)

**[S3]** Cohen, J. D., Dunbar, K., & McClelland, J. L. (1990). On the control of automatic processes: A parallel distributed processing account of the Stroop effect. *Psychological Review, 97*(3), 332–361. Theoretical/modeling paper. [https://doi.org/10.1037/0033-295X.97.3.332](https://doi.org/10.1037/0033-295X.97.3.332)

**[S4]** Scarpina, F., & Tagini, S. (2017). The Stroop Color and Word Test. *Frontiers in Psychology, 8*, 557. Review of Stroop-test versions and scoring/normative approaches; this clinical-test review is not a protocol for the proposed keyboard task. Full text reviewed. [https://doi.org/10.3389/fpsyg.2017.00557](https://doi.org/10.3389/fpsyg.2017.00557)

### Behavioral measurement and reliability

**[S5]** Heitz, R. P. (2014). The speed-accuracy tradeoff: History, physiology, methodology, and behavior. *Frontiers in Neuroscience, 8*, 150. Review. Full text reviewed. [https://doi.org/10.3389/fnins.2014.00150](https://doi.org/10.3389/fnins.2014.00150)

**[S6]** Ratcliff, R. (1993). Methods for dealing with reaction time outliers. *Psychological Bulletin, 114*(3), 510–532. Methodological review. Bibliographic record and abstract-level metadata reviewed; no single cutoff is treated here as a universal recommendation. [https://doi.org/10.1037/0033-2909.114.3.510](https://doi.org/10.1037/0033-2909.114.3.510)

**[S7]** Hedge, C., Powell, G., & Sumner, P. (2018). The reliability paradox: Why robust cognitive tasks do not produce reliable individual differences. *Behavior Research Methods, 50*(3), 1166–1186. Empirical test-retest studies and methodological analysis including Stroop and Eriksen Flanker tasks. Full text reviewed. [https://doi.org/10.3758/s13428-017-0935-1](https://doi.org/10.3758/s13428-017-0935-1)

### Eriksen Flanker

**[F1]** Eriksen, B. A., & Eriksen, C. W. (1974). Effects of noise letters upon the identification of a target letter in a nonsearch task. *Perception & Psychophysics, 16*(1), 143–149. Original experimental paper. [https://doi.org/10.3758/BF03203267](https://doi.org/10.3758/BF03203267)

**[F2]** Eriksen, C. W., & St. James, J. D. (1986). Visual attention within and around the field of focal attention: A zoom lens model. *Perception & Psychophysics, 40*(4), 225–240. Theoretical/experimental attention paper. [https://doi.org/10.3758/BF03211502](https://doi.org/10.3758/BF03211502)

**[F3]** Eriksen, C. W. (1995). The flankers task and response competition: A useful tool for investigating a variety of cognitive problems. *Visual Cognition, 2*(2–3), 101–118. Review. Bibliographic details verified; interpretations here are deliberately limited to the task's broad response-competition use. [https://doi.org/10.1080/13506289508401726](https://doi.org/10.1080/13506289508401726)

**[F4]** Fan, J., McCandliss, B. D., Sommer, T., Raz, A., & Posner, M. I. (2002). Testing the efficiency and independence of attentional networks. *Journal of Cognitive Neuroscience, 14*(3), 340–347. Experimental ANT paper using an arrow-flanker component. [https://doi.org/10.1162/089892902317361886](https://doi.org/10.1162/089892902317361886)

### Browser timing and online experiments

**[W1]** Reimers, S., & Stewart, N. (2015). Presentation and response timing accuracy in Adobe Flash and HTML5/JavaScript Web experiments. *Behavior Research Methods, 47*(2), 309–327. Empirical validation across 19 computer systems using external timing hardware. Full text reviewed. [https://doi.org/10.3758/s13428-014-0471-1](https://doi.org/10.3758/s13428-014-0471-1)

**[W2]** de Leeuw, J. R., & Motz, B. A. (2016). Psychophysics in a Web browser? Comparing response times collected with JavaScript and Psychophysics Toolbox in a visual search task. *Behavior Research Methods, 48*(1), 1–12. Empirical task-based response-time comparison; the volume's print year is 2016 (published online 2015). [https://doi.org/10.3758/s13428-015-0567-2](https://doi.org/10.3758/s13428-015-0567-2)

**[W3]** Bridges, D., Pitiot, A., MacAskill, M. R., & Peirce, J. W. (2020). The timing mega-study: Comparing a range of experiment generators, both lab-based and online. *PeerJ, 8*, e9414. Empirical timing comparison across software, operating systems, and browsers, with external timing equipment. [https://doi.org/10.7717/peerj.9414](https://doi.org/10.7717/peerj.9414)

**[W4]** Anwyl-Irvine, A., Dalmaijer, E. S., Hodges, N., & Evershed, J. K. (2021). Realistic precision and accuracy of online experiment platforms, web browsers, and devices. *Behavior Research Methods, 53*(4), 1407–1425. Empirical display/response tests with a photodiode and robot actuator, plus technology reports from over 200,000 participants. Full text reviewed. [https://doi.org/10.3758/s13428-020-01501-5](https://doi.org/10.3758/s13428-020-01501-5)

**[W5]** Gao, Z., Chen, B., Sun, T., Chen, H., Wang, K., Xuan, P., & Liang, Z. (2020). Implementation of stimuli with millisecond timing accuracy in online experiments. *PLOS ONE, 15*(7), e0235249. Empirical browser display-timing study with photosensor measurements; findings are specific to its tested software/hardware configurations. Full article reviewed. [https://doi.org/10.1371/journal.pone.0235249](https://doi.org/10.1371/journal.pone.0235249)

**[W6]** Anwyl-Irvine, A. L., Massonnié, J., Flitton, A., Kirkham, N., & Evershed, J. K. (2020). Gorilla in our midst: An online behavioral experiment builder. *Behavior Research Methods, 52*(1), 388–407. Platform/method paper demonstrating a Flanker effect across participant groups, settings, equipment, and connection types; not a guarantee of equivalent timing for all devices. Full text reviewed. [https://doi.org/10.3758/s13428-019-01237-x](https://doi.org/10.3758/s13428-019-01237-x)

**[W7]** Garaizar, P., Vadillo, M. A., & López-de-Ipiña, D. (2014). Presentation accuracy of the Web revisited: Animation methods in the HTML5 era. *PLOS ONE, 9*(10), e109812. Empirical visual-presentation timing comparison. Full article reviewed. [https://doi.org/10.1371/journal.pone.0109812](https://doi.org/10.1371/journal.pone.0109812)

### Browser API documentation (technical, not empirical validation)

**[P1]** MDN Web Docs. `Window.requestAnimationFrame()`. Browser API behavior reference: callback before repaint, refresh-rate cadence, and common pause behavior in hidden tabs. Living documentation, accessed for this review. [https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

**[P2]** MDN Web Docs. `Performance.now()`. Browser API behavior reference: high-resolution timestamp relative to a monotonic time origin. Living documentation, accessed for this review. [https://developer.mozilla.org/en-US/docs/Web/API/Performance/now](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now)

**[P3]** MDN Web Docs. Page Visibility API. Browser API behavior reference: visible/hidden document state and `visibilitychange` events. Living documentation, accessed for this review. [https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
