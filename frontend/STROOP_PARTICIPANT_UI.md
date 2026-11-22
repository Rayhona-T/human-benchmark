# HUMAN BENCHMARK — Stroop Participant UI

Since Cycle 6 the session flow and page chrome described here are shared with
Flanker (`EXPERIMENT_SESSION_ARCHITECTURE.md`). Stroop behavior is unchanged.

## Participant flow

1. Introduction using the protocol §3 participant text: purpose, key
   mapping, 2 s response limit, practice/main feedback rules, optional break,
   what is recorded (and that nothing is saved or sent), the ability to stop
   at any time, and an invitation to stop for participants unfamiliar with
   the English color words, unable to tell the ink colors apart, or whose
   keyboard does not type D, F, J, and K.
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
and passed into the runtime. The stimulus DOM is committed synchronously
(`flushSync`) immediately before that frame is requested, so the recorded frame
is the first one that can paint the stimulus. Fixation onset is recorded with
`performance.now()` when the fixation cross is committed (not frame-aligned).
The response deadline is `onset + 2000 ms`; a keydown handled at or after that
time is a timeout even if the timer callback runs late.

After a response or timeout, the stimulus is removed on the next animation
frame and the 500 ms interval starts from that offset callback. Browser timing
is not a physical photodiode or laboratory-timing guarantee.

## Practice and main presentation

Practice trials are labeled and use the approved 500 ms fixation, 2000 ms
deadline, 500 ms ITI, and correctness feedback. Main trials use the approved
500 ms fixation, 2000 ms deadline, and 500 ms ITI with no correctness feedback.
Each phase reads its own timing values from `STROOP_CONFIGURATION`.

Trials are shown on the protocol background `#111827` (applied from the
configured stimulus definition). The stimulus is 48 px bold at every viewport
width. The fixation-cross color (`#f9fafb`) is a pragmatic choice; the protocol
does not specify it.

The key legend is displayed in the introduction and practice phase. The
main stimulus phase intentionally omits the legend as specified by the protocol.

## Break and pause behavior

The break is offered once, after the 30th main trial and its ITI. The decision
is made when the next main trial would start, so it also applies if the session
was paused during that interval or trial 30 was invalidated by an interruption.
Continue records `breakTaken: true` and the elapsed time since the offer
(including any time paused during the break); Skip break records
`breakTaken: false` and a duration of 0 (engine convention).

Pause and Exit are available during fixation, feedback/ITI, and the break, and
are disabled while a timed stimulus is on screen (at most 2 s), so a presented
trial can only end by response, deadline, or interruption. Opening the Exit
dialog pauses the session; Continue resumes it.

Before each stimulus the page must be visible and focused
(`document.hidden`, `document.hasFocus()`). If not, or if visibility/focus is
lost during fixation, the session pauses before onset without creating a
record, and after resume the same (never-presented) trial starts with a new
fixation. Visibility/focus loss during an active stimulus records that trial as
`invalid` (reason `visibility_lost`, `interrupt` for window blur, or
`focus_lost`), pauses, and after resume continues with the next trial. Invalid
trials are never replayed and show no practice correctness feedback.

## Exit behavior

Exit uses an accessible confirmation dialog (focus moves to Continue, Escape
continues, the page behind it is `inert`, and focus returns to the opener). Abort marks the session incomplete
and leaves unpresented trials uncreated. Timers, animation frames, and runtime
listeners are cleaned.

## Accessibility limitations

The UI supports keyboard navigation, semantic headings, visible focus, labeled
controls, and reduced-motion preferences. Focus moves to the heading of each
non-trial screen (instructions, ready, break, paused, completed, ended,
technical error). The trial counter is not a live region, so screen readers are
not interrupted on every trial. The key check echoes each recognized key and
its color (for example, "D = Red: recognized"). Each screen change resets
the page scroll to the top, so the session bar (progress, Pause, Exit) is
never left under the sticky site header; heading focus uses
`preventScroll`. The stimulus element carries no `aria-label` (prohibited
on a generic element); its text content is the word. The Stroop stimulus deliberately
depends on color-word presentation and a four-key response, so color-vision,
motor, keyboard-layout, and reading-language differences may prevent or
reduce comparable participation.

The implementation has not undergone a formal WCAG 2.2 or cross-browser
certification audit.

## Recorded timestamps

All values use the `performance.now()` time origin. Frame timestamps are
`requestAnimationFrame` callback times, not measured display/photon times.

| Field                 | Recorded when                                                                | Source                 |
| --------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| `fixationOnsetMs`     | Fixation cross committed to the DOM                                          | `performance.now()`    |
| `stimulusOnsetMs`     | First frame that can paint the stimulus                                      | rAF callback timestamp |
| `responseTimestampMs` | First valid mapped keydown handler                                           | `performance.now()`    |
| `deadlineMs`          | `stimulusOnsetMs + 2000`                                                     | derived                |
| `trialEndMs`          | Engine settle: response timestamp, or the deadline                           | engine                 |
| `stimulusOffsetMs`    | Frame that removed the stimulus (protocol §7.6 / conventions §3 "trial end") | rAF callback timestamp |
| `itiEndMs`            | 500 ms interval timer completed, before the next fixation/break/completion   | `performance.now()`    |

`stimulusOffsetMs` and `itiEndMs` are added after the trial settles through the
lifecycle action `RECORD_TRIAL_TIMING`, which only fills empty fields on the
latest record and enforces `onset ≤ offset ≤ itiEnd`.

They stay `null`, deliberately, when the event did not happen:

- **Invalid (interrupted) trial:** the session pauses and the stimulus is
  removed without an offset frame or interval, so both are `null`.
- **Pause or exit during the interval:** the interval never completed, so
  `itiEndMs` is `null` (the offset is kept).
- **Abort before the offset frame:** both `null`.
- **Unpresented trials:** no record exists.

A frame callback timestamp is the frame's start time, so in a real browser
`stimulusOffsetMs` can be marginally earlier than the response handler
timestamp of the same frame; values are recorded as observed, not adjusted.
`trialEndMs` keeps its Cycle 4 meaning; the protocol's "trial end" frame is
`stimulusOffsetMs`.

The session's randomization metadata also carries `allocationDetails`
(`selectedDerangement`, `practiceSeedUnsigned32`), as protocol §8.7 requires.
