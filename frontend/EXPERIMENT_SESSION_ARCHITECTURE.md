# HUMAN BENCHMARK — Shared Experiment Session Architecture (Cycle 6)

In Cycle 6 the experiment-agnostic parts of the approved Cycle 5 Stroop
implementation were extracted so that Stroop and Flanker share one session
flow, one analysis, and one results presentation. The engine (`src/engine/`)
was not changed in Cycle 6.

## Shared modules (`src/experiments/shared/`)

| Module                                                 | Responsibility                                                                                                                                         | Extracted from                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `seededRandom.ts`                                      | Mulberry32, Fisher–Yates, production seed                                                                                                              | `stroopSchedule.ts` (Cycle 6 Task 1+2)              |
| `useExperimentSession.ts`                              | Participant session flow: fixation, rAF onset, offset frame, ITI, `RECORD_TRIAL_TIMING`, pause, focus/visibility interruption, break, exit, completion | `useStroopSession.ts`                               |
| `sessionAnalysis.ts`                                   | Counts, the three rates, median correct RT, display rule, contrasts, incomplete-session handling                                                       | `stroopAnalysis.ts`                                 |
| `resultsFormat.ts`                                     | Number formatting and plain-language contrast sentences                                                                                                | `stroopResultsFormat.ts`                            |
| `SessionResults.tsx` / `.css`                          | Results presentation                                                                                                                                   | `StroopResults.tsx` / `.css`                        |
| `ExperimentSessionShell.tsx` / `ExperimentSession.css` | Session bar, trial stage, ready/break/paused/end screens, exit dialog, focus and scroll management                                                     | `StroopExperimentPage.tsx` / `StroopExperiment.css` |

The extraction was **mechanical**: experiment-specific constants became
parameters, and every timing, lifecycle, interruption, and break statement is
unchanged (verified by diffing against the approved Cycle 5 hook). Generic
modules contain no experiment names, conditions, or branches.

## What each experiment supplies

| Experiment input                                                                  | Stroop                      | Flanker                                           |
| --------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------- |
| Session definition (configuration, schedule factory, randomization metadata)      | `STROOP_SESSION_DEFINITION` | `FLANKER_SESSION_DEFINITION`                      |
| Analysis definition (conditions, protocol §10 contrast table, counts, RT minimum) | `STROOP_ANALYSIS`           | `FLANKER_ANALYSIS`                                |
| Results wording (`ResultsCopy`)                                                   | `STROOP_RESULTS_COPY`       | `FLANKER_RESULTS_COPY`                            |
| Intro, instructions/mapping check, stimulus, practice aid, feedback wording       | `StroopExperimentPage.tsx`  | `FlankerExperimentPage.tsx`                       |
| Presentation precondition                                                         | none                        | `canPresentStimulus` (272 px array fully visible) |

## The one new generic capability

`ExperimentSessionOptions.canPresentStimulus` is an optional precondition,
checked with page visibility/focus before every fixation and again in the onset
frame. When it fails, no timed trial starts and no record is created. The
session pauses with reason `presentation_unavailable`, and the shell shows the
experiment's message, with Resume disabled until the experiment reports that
presentation is possible again. Stroop does not use it.

## Leaving an active session (Cycle 10 Task 10.4)

Owner-approved. A session is active from the first practice trial until it
ends (practice, ready, main, break, and paused screens). While it is active:

- **Reload, close, or another address:** the browser's own `beforeunload`
  confirmation. Its text is the browser's; browsers may skip it when the page
  has had no interaction.
- **Links, Back, and Forward within the app:** React Router's blocker opens
  **Leave this session?** ("It will end as incomplete and its data will be
  discarded.") with **Leave** and **Stay**. The session pauses first, so no
  trial runs behind the dialog. A stimulus already on screen cannot be paused
  (protocol §7): it ends by response or deadline, and the pause follows.
  Stay resumes only a session that this dialog paused; Escape is Stay.
  A Back that leaves the app's own history (for example after opening the
  experiment by a direct link) is a browser-level navigation and gets the
  `beforeunload` confirmation instead.

Nothing is saved or restored: leaving discards the session. The intro,
instructions, and ended sessions never ask. The experiment pages therefore
need a data router (`createBrowserRouter`; tests use `src/test/TestRouter`).

All three session dialogs (Exit, Leave, Clear) share one component: focus
starts on the safe choice, Tab and Shift+Tab stay inside the dialog, Escape
cancels, and the page behind is inert.

## Analysis

Definitions, denominators, eligibility, missing-data rules, and the
`HB-ANALYSIS-1.1` additions are specified in `ANALYSIS_METHODOLOGY.md`.

## Compatibility

`useStroopSession`, `computeStroopResults`, `StroopResults`, and the Stroop
format helpers keep their names and signatures as thin wrappers. All Cycle 5
Stroop tests pass unchanged, and a real-browser Stroop keyboard session was
re-run after the extraction (see `FLANKER_PARTICIPANT_UI.md`, Verification).
