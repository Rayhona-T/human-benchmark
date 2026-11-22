# HUMAN BENCHMARK — Flanker Participant Experience (Cycle 6, Tasks 3+4)

Implements `HB-FLANKER-1.0` ([FLANKER_PROTOCOL.md](../docs/experiments/FLANKER_PROTOCOL.md))
at `/experiments/flanker`, on the shared session architecture
([EXPERIMENT_SESSION_ARCHITECTURE.md](EXPERIMENT_SESSION_ARCHITECTURE.md)).

## Participant flow

1. **Introduction.** The protocol §3 text (center arrow only, F = Left /
   J = Right, 12 practice trials with feedback, 60 main trials without
   feedback, the 2 s limit, the break after trial 30, session-only results,
   not a diagnosis, IQ estimate, or validated measure), plus:
   - one example of each condition,
   - what is recorded (nothing saved or sent),
   - that the participant can stop at any time,
   - keyboard-only operation,
   - suitability notes, including the 272 px width requirement.
2. **Mapping check** (protocol §5). A central left arrow requires F, then a
   central right arrow requires J. A wrong mapped key shows "That key means …
   press …" and repeats the prompt. Unmapped and auto-repeated keys are
   ignored. "Begin 12 practice trials" stays disabled until both steps pass.
   The status is a `role="status"` region; the arrow has a visually hidden
   text label.
3. **Practice.** 12 trials with feedback ("Correct", "Incorrect", or "No
   response in time", plus "Correct response: Left (F)") during the 500 ms
   interval.
4. **Ready** screen, then **60 main trials** with no feedback or condition
   cues; the progress shows only the trial count.
5. **Optional break** after main trial 30 (Continue / Skip break).
6. **Completion or exit,** followed by results computed from the session's
   own records.

Pause, Exit (with a confirmation dialog that pauses trials), visibility/focus
interruption, and focus and scroll management come from the shared shell, and
behave exactly as for Stroop.

## Stimulus presentation (protocol §4)

- Five cells, each 48 × 48 px with 8 px gaps (272 px row); glyphs are 40 px
  bold Arial with 48 px line height; `#F9FAFB` symbols on a `#111827` stage.
  Geometry is applied inline from `FLANKER_PRESENTATION` and never scaled.
- The six arrays are exactly the protocol table: ←←←←← / →→→→→ / →→←→→ /
  ←←→←← / ——←—— / ——→——.
- The trial stage has no horizontal padding and centers the array. No
  condition label or color cue appears during trials.
- **Practice key reminder:** during practice stimuli a text-only reminder
  ("F Left / J Right") appears below the array. It deliberately contains no
  arrow glyphs, so that no extra directional symbols appear near the
  target. The main task shows no reminder. The protocol does not require a
  reminder; this is a pragmatic presentation choice, consistent with the
  approved Stroop practice legend.

## Narrow-viewport protection (protocol §4, approved decision 7)

Before every fixation, and again in the onset frame, `canPresentStimulus`
checks that the whole 272 px array, centered in the trial area, lies inside the
visible window (`flankerArrayFitsViewport`).

When the check fails:

- no fixation or stimulus starts, and no record is created;
- the session pauses with reason `presentation_unavailable`;
- the paused screen explains why, with Resume disabled;
- the intro shows the same warning in advance.

Resize and scroll events update Resume. Resuming re-checks before the
next fixation, and a never-presented trial restarts with a new fixation.

The check uses the **visible** window, not the layout width: below about
339 px the site layout stops shrinking and overflows sideways. In a real
browser, trials are blocked at 240–280 px and allowed at 300 px and wider,
where the array is fully visible.

## Timing and records

Identical to Stroop and handled by the shared hook. The fixation, rAF onset,
2,000 ms deadline, offset frame, 500 ms ITI, `stimulusOffsetMs` / `itiEndMs`
recording, null timestamps for events that did not occur, invalidation of
interrupted trials (never replayed), break handling, and abort all follow
`STROOP_PARTICIPANT_UI.md` ("Recorded timestamps"). Flanker records add
`stimulus.text`, `stimulus.cells`, `stimulus.targetDirection`, and
`stimulus.flankerType`.

## Results

These use the shared analysis and presentation, with the Flanker protocol §10
contrast table:

| Contrast             | RT (positive ⇒ first slower) | Accuracy and success rate (positive ⇒ first higher) |
| -------------------- | ---------------------------- | --------------------------------------------------- |
| Flanker interference | incongruent − neutral        | neutral − incongruent                               |
| Facilitation         | neutral − congruent          | congruent − neutral                                 |
| Overall congruency   | incongruent − congruent      | congruent − incongruent                             |

Each row shows its own formula. RT medians and RT contrasts need 10 correct
responses per condition. Incomplete sessions show only counts.

The limitations text adds two Flanker points:

- visual size depends on the screen and viewing distance;
- condition transitions are uncontrolled, so previous-trial effects can
  contribute (approved decision 4).

## Accessibility

- Keyboard-only operation throughout, verified in a real browser with Tab
  and Enter.
- Heading focus on each non-trial screen, and scroll reset on every screen
  change.
- The exit dialog is `alertdialog`, with the background `inert`, Escape to
  continue, and focus restored.
- No live announcement on each trial.
- No prohibited ARIA attributes.

The task is visual and keyboard-based. It may not be usable or comparable for
some participants, and the intro says so. No formal WCAG audit has been done.

## Verification (Cycle 6 Task 4)

**Automated tests:** session hook, analysis against hand-calculated values,
page flow and mapping check, geometry, the narrow-viewport block and recovery,
the exit dialog, and a full 72-trial session compared with an independent
tally.

**Real-browser checks** (scripted headless Edge, not a human):

- **Keyboard-only session:** a full 72-trial session operated with Tab and
  Enter.
- **Geometry, measured from the rendered page:** a 272 px row, 48 px cells,
  8 px gaps, 0 px off-center, at 1280 px and 390 px.
- **Timing:** fixation to stimulus 503–522 ms. Stimulus off to next fixation
  had a median of 510 ms; the one shorter interval was the interrupted trial,
  which has no ITI by design.
- **Results:** matched the script's responses exactly.
- **Narrow window:** blocking and recovery confirmed at 240–280 px.
- **Overflow:** none at 390 px.
- **Stroop regression:** the Stroop keyboard session was re-run in the same
  way, with no regression.

## Defects found and fixed during the Task 4 audit

1. **Contrast title.** "Overall congruency effect" was corrected to the
   protocol's "Overall congruency".
2. **Practice reminder.** It showed arrow glyphs near the stimulus, adding
   directional distractors. It is now text only.
3. **Narrow-viewport guard.** It measured the layout width, so with a window
   below about 339 px it let trials start with part of the array off-screen.
   It now requires the array to be inside the visible window.

## Known limitations

- **Site header overflow** (pre-existing, Cycle 3). The site header makes
  every page at least about 339 px wide, so there is sideways scrolling at
  320 px and below. This affects all pages, and is out of this cycle's
  scope.
- **No stimulus-width check during a trial.** The narrow-viewport check runs
  before onset only. Narrowing the window during an active 2 s stimulus is
  not treated as invalidating; the protocol does not define that case.
- **Timing and geometry limits.** Timing is browser-recorded and
  device-dependent, and visual angle is uncontrolled.
- **No persistence or export.**
- **Not a human test.** The browser evidence is scripted; no human
  participant has tested the flow yet.
