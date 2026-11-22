# HUMAN BENCHMARK — Stroop Participant UI

## Participant flow

1. Introduction with task purpose and timing limitations.
2. Instructions and key-demonstration check.
3. 12 practice trials with feedback.
4. Explicit practice-to-main transition.
5. 60 main trials with fixation, stimulus, deadline, and ITI.
6. Optional break after main trial 30.
7. Completion or incomplete aborted status.

## Engine integration

The React page creates a seeded `ExperimentLifecycle` and `ExperimentSchedule`
from `stroopAdapter`. Trial presentation uses `TrialRuntime`; it does not
duplicate schedule, response, deadline, or outcome logic.

The browser implementation supplies:

- `BrowserMonotonicClock`
- `BrowserDeadlineScheduler`
- `BrowserKeyboardInputSource`
- `BrowserInterruptionEventSource`

Stimulus onset is recorded from the `requestAnimationFrame` callback timestamp
and passed into the runtime. Browser timing is not a physical photodiode or
laboratory-timing guarantee.

## Practice and main presentation

Practice trials are labeled and use the approved 500 ms fixation, 2000 ms
deadline, 500 ms ITI, and correctness feedback. Main trials use the approved
2000 ms deadline and 500 ms ITI with no correctness feedback.

The key legend is displayed in the introduction and practice phase. The
main stimulus phase intentionally omits the legend as specified by the protocol.

## Break and pause behavior

The break appears after the 30th completed main trial and ITI. Continue records
elapsed break duration; Skip break records no break duration.

Pause is available outside the stimulus and during break. Browser
visibility/focus interruption invalidates the active trial rather than replaying
it as valid. Resume continues to the next phase/trial. The interrupted trial
record remains visible only through session data, not as a score.

## Exit behavior

Exit uses an accessible confirmation dialog. Abort marks the session incomplete
and leaves unpresented trials uncreated. Timers, animation frames, and runtime
listeners are cleaned.

## Accessibility limitations

The UI supports keyboard navigation, semantic headings, visible focus, labeled
controls, and reduced-motion preferences. The Stroop stimulus deliberately
depends on color-word presentation and a four-key response, so color-vision,
motor, keyboard-layout, and reading-language differences may prevent or
reduce comparable participation.

The implementation has not undergone a formal WCAG 2.2 or cross-browser
certification audit.
