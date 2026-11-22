# HUMAN BENCHMARK — Experiment Engine Architecture

## Scope

Cycle 4 Task 1 establishes contracts only. It does not execute a trial,
present stimuli, capture responses, generate schedules, calculate results, or
persist data.

## Module boundaries

- `src/engine/contracts.ts` — experiment identity, configuration, session,
  trial, response, timing, randomization, and record types.
- `src/engine/interfaces.ts` — experiment adapters, schedule contracts,
  monotonic-clock abstraction, and engine observation hooks.
- `src/engine/sessionState.ts` — pure session lifecycle state-transition rules.
- `src/engine/index.ts` — stable import surface.

React UI code owns presentation and user interaction. The engine core owns
protocol-neutral state contracts and future lifecycle decisions. Experiment
adapters own approved Stroop or Flanker definitions and must supply schedules,
stimuli, response mappings, and correctness rules.

## Session state model

The session lifecycle uses:

| State             | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `idle`            | Session has been defined but has not started.                |
| `instructions`    | Participant-facing setup and consent/data notice are active. |
| `practice`        | Practice trials are active.                                  |
| `ready`           | Practice completed and main-trial start is next.             |
| `main`            | Main trials are active.                                      |
| `break`           | The protocol-offered break is active.                        |
| `paused`          | Visibility/focus interruption is active.                     |
| `completed`       | Planned sequence reached its end.                            |
| `aborted`         | Participant departure or explicit abort ended the session.   |
| `technical_error` | Setup or schedule generation failed.                         |

Session phase is separately represented because phase data and lifecycle state
answer different questions. Trial records identify `practice` or `main`.

## Allowed transitions

| From                                | Allowed transitions                                       | Result                               |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| idle                                | open instructions; schedule error                         | instructions or technical_error      |
| instructions                        | begin practice; abort                                     | practice or aborted                  |
| practice                            | practice complete; focus lost; interrupt                  | ready, paused, or aborted            |
| ready                               | begin main; abort                                         | main or aborted                      |
| main                                | offer break; focus lost; complete; abort                  | break, paused, completed, or aborted |
| break                               | continue/skip; interrupt                                  | main or aborted                      |
| paused                              | restore focus with practice/main resume target; interrupt | prior phase or aborted               |
| completed, aborted, technical_error | none                                                      | terminal                             |

Invalid transitions return a typed rejection rather than changing state.

`aborted` must later be mapped to the session-record status
`incomplete` for participant departure or `interrupted` for page closure or
unrecoverable runtime termination. Those status distinctions remain explicit.

## Experiment extensibility

An experiment adapter supplies:

- Experiment and configuration identity
- Practice/main timing and trial counts
- Stimulus and condition definitions
- Response mappings
- Schedule creation
- Correct-response lookup
- Protocol-specific response classification
- Stimulus presentation data

The engine supplies the React-independent state/record abstractions and future
lifecycle orchestration. Stroop and Flanker must not duplicate shared session,
trial, outcome, or timing state handling.

## Data and scientific integrity

The contracts preserve separate:

- Correct, incorrect, timeout, and invalid outcomes
- Invalid reasons
- Accepted and rejected responses
- Practice and main phases
- Complete, incomplete, interrupted, and technical-error session status
- Monotonic timing fields and browser-timestamp limitations
- Protocol/configuration versions
- Seed, PRNG/schedule version, generation status, and realized orders

The contracts do not store a combined score, intelligence rank, diagnosis,
clinical result, or personality inference.

## Timing abstraction

`MonotonicClock.now()` supplies a high-resolution monotonic timestamp. It is
designed for future injection by browser and test implementations. Stimulus
onset, keydown handler, deadline, trial end, ITI end, and derived RT remain
separate timestamp fields.

The browser timestamp is explicitly not a physical onset or laboratory timing
guarantee. A future implementation must follow the approved shared timing
convention and must not use hardcoded global browser timing logic.

## Open decisions

- Exact trial/export field names remain in the data-dictionary cycle.
- Browser/device metadata collection remains a later justified privacy decision.
- The engine API for React integration will be chosen in Task 2.
- The pure state transition model may expand if Task 2 identifies a missing
  phase or terminal cause.

## Task 2 lifecycle implementation

`src/engine/lifecycle.ts` provides a reusable `ExperimentLifecycle` controller.
It initializes sessions, validates practice/main schedule counts, progresses
trials through activation and completion, and appends immutable trial records.
The controller records correct, incorrect, timeout, and invalid outcomes without
capturing browser input or presenting stimuli.

Configured main-task breaks are offered only at the exact protocol boundary.
An absent break boundary or an invalid boundary produces a typed lifecycle
error. Break skips and continues return to the main phase without changing trial
indexes.

Pause preserves the current practice/main phase and active trial context.
Resume restores that context without re-activating or duplicating the trial.
Explicit abort produces an incomplete session. Runtime interruption produces an
interrupted session. Unpresented trials are not inferred or fabricated.

Completion requires every configured practice and main trial to be represented
in the lifecycle progression. An active trial or an incomplete index list rejects
completion.

## Task 3 timing, input, and validity

Cycle 4 Task 3 adds no experiment-specific stimuli or mappings. It adds:

- `timing.ts`: browser and fake monotonic clocks, browser/fake deadline
  schedulers, elapsed-time calculation, and reaction-time calculation.
- `input.ts`: injectable keyboard event sources, logical-key mapping,
  duplicate/repeat/unmapped/deadline rejection, and accepted response records.
- `interruption.ts`: injectable visibility/focus event sources and listener
  cleanup.
- `validity.ts`: protocol-neutral correct, incorrect, timeout, and invalid
  outcome helpers.
- `trialRuntime.ts`: a thin controller that records accepted responses,
  timeouts, and invalid active-trial interruptions through the lifecycle.

The browser clock uses `performance.now()`. It is browser-rendered monotonic
elapsed time, not physical stimulus onset or laboratory-grade timing. No
wall-clock timestamp is used for elapsed reaction time.

Deadline response acceptance is strictly before the deadline. A response at or
after the deadline becomes a timeout and can never retroactively change a
settled trial. Timeout and response settlement are mutually exclusive, and
listeners/timers are cleaned on completion or cancellation.

Input before activation, after completion, timeout, or interruption is rejected
with a structured reason. Repeated events, unmapped keys, duplicate responses,
and unavailable timing do not become incorrect or valid outcomes.

Active visibility/focus interruption records an invalid trial and does not replay
it. Completed trial records are preserved. Break and lifecycle interruption
handling remain explicit; browser events do not prove participant misconduct.

## Task 4 integration audit

Cycle 4 Task 4 verifies module interactions through deterministic integration
tests rather than UI or real timers. The audit found and corrected:

- Timeout settlement now changes input state to timed-out, preventing later
  keyboard events from being classified by a completed-trial branch.
- Accepted response timing uses the response timestamp as trial end; timeout
  uses the deadline timestamp.
- Trial runtime verifies that the lifecycle activated the same trial identity
  and index before starting.
- Pause/resume supports practice, main, and break contexts.
- Technical timing failure produces a technical-error session and preserves an
  invalid timing-failure trial record rather than a normal completion.
- Settlement cancels the remaining deadline and listener resources exactly once.

Integration scenarios cover practice-to-main completion, incorrect response,
timeout and late input, pause/resume, active interruption, break pause/resume,
abort, technical timing failure, and race-safe one-time settlement.

Remaining future integration risks are UI routing of lifecycle actions,
browser keyboard event timestamp fidelity, and external timing validation.
Those risks do not block the engine contract foundation.

## Cycle 5 Task 4 additions

Minimal, backward-compatible contract changes made during the Stroop audit:

- `TimingMetadata.stimulusOffsetMs` (frame that removed the stimulus) joins
  `itiEndMs`. Both start `null` in every record.
- Lifecycle action `RECORD_TRIAL_TIMING { trialId, stimulusOffsetMs?, itiEndMs? }`
  fills those two fields after settlement. It accepts only the latest record,
  only in `practice`, `main`, or `ready`, never overwrites a value, and
  rejects non-finite, negative, or out-of-order values (`invalid_timing_record`).
- `RandomizationMetadata.allocationDetails` (optional) carries
  experiment-specific allocation data needed to reproduce a schedule.
- Snapshots and session records copy each record's `timing` object, so callers
  cannot mutate engine records through them.

The engine remains React-independent; Cycle 4 tests are unchanged and pass.
