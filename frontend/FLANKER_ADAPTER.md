# HUMAN BENCHMARK — Flanker Adapter (Cycle 6)

Implements the approved protocol `HB-FLANKER-1.0`
([FLANKER_PROTOCOL.md](../docs/experiments/FLANKER_PROTOCOL.md); decisions in
§14) against the shared experiment engine. This adapter contains no UI; the
participant experience is documented in `FLANKER_PARTICIPANT_UI.md`.

## Files

| File                                         | Responsibility                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/experiments/flanker/flanker.ts`         | Protocol constants: identity, conditions, stimuli, geometry, mapping, mapping check, configuration |
| `src/experiments/flanker/flankerSchedule.ts` | `HB-FLANKER-shuffle-v1` schedule generation and constraint checking                                |
| `src/experiments/flanker/flankerAdapter.ts`  | `ExperimentAdapter` implementation and session randomization metadata                              |
| `src/experiments/shared/seededRandom.ts`     | Shared Mulberry32, Fisher–Yates, production seed (also used by Stroop)                             |

## Architecture decisions

1. **No engine contract changes.** The generic `EngineTrial`, `ExperimentConfiguration`, `ExperimentAdapter`, `ExperimentLifecycle`, and `TrialRuntime` fit Flanker as they are. Timestamps (including `stimulusOffsetMs`/`itiEndMs` from Cycle 5 Task 4) and `RandomizationMetadata.allocationDetails` are reused.
2. **One PRNG implementation.** Mulberry32 and Fisher–Yates moved from `stroopSchedule.ts` to `shared/seededRandom.ts`. Stroop re-exports them with an unchanged API and its own seed-validation message; Stroop's reference vectors, pinned seed-1234 schedule, and 300-seed tests pass unchanged.
3. **Protocol data separate from presentation.** Geometry and colors are exported as data (`FLANKER_PRESENTATION`); no CSS or components exist yet.

## Protocol-to-engine mapping

| Protocol requirement                                                  | Where it lives                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Counts, timing, feedback, break (§2, §6, §7)                          | `FLANKER_CONFIGURATION` (consumed by the lifecycle and by the Task 3 UI)             |
| Six stimuli and condition rules (§4)                                  | `createFlankerStimulus`, `flankerTypeFor`, `FLANKER_SYMBOLS` (←, →, em dash)         |
| Geometry, font, colors (§4)                                           | `FLANKER_PRESENTATION`; `canDisplayFlankerArray(width)` for the 272 px rule          |
| Logical F/J mapping (§5)                                              | `FLANKER_RESPONSE_MAPPING` (engine input is already case-insensitive on `event.key`) |
| Mapping check (§5)                                                    | `FLANKER_MAPPING_CHECK`, `evaluateMappingCheckKey`                                   |
| Response classification (§9)                                          | `flankerAdapter.classifyResponse` (center arrow only)                                |
| First valid key, repeats, unmapped keys, deadline, interruptions (§7) | Shared `TrialRuntime` / `ResponseInputController` (unchanged)                        |
| Outcomes, session status, unpresented trials (§7, §9)                 | Shared `ExperimentLifecycle` (unchanged)                                             |
| Randomization (§8)                                                    | `createFlankerSchedule`                                                              |
| Session reproducibility metadata (§8.6, §9)                           | `flankerRandomizationMetadata(schedule)`                                             |

## Trial generation (`HB-FLANKER-shuffle-v1`)

- **Items:** six condition × direction items in the base order
  `congruent-left, congruent-right, incongruent-left, incongruent-right, neutral-left, neutral-right`
  (ratified, protocol §14 decision 5).
- **Main:** `mulberry32(seed)`; ten balancing sets.
- **Practice:** `mulberry32((seed XOR 0x9E3779B9) >>> 0)`; two balancing sets.
- **Each set:** a Fisher–Yates shuffle of the base order. A candidate is accepted when it, together with up to the last three accepted trials, has no run longer than 3 of one condition or one direction, and no two adjacent identical stimuli. Otherwise the set is reshuffled from the base order with the continuing stream, up to 10,000 candidates, after which `FlankerScheduleGenerationError` is thrown.
- **Trials:** one-based `index`, `trialId` = `${seed}-${phase}-${index}`, `correctResponse` from the target direction (`f` = left, `j` = right).

A single six-item set can never violate the constraints by itself (each item
once, three of each direction, two of each condition), so rejections occur only
at set boundaries. Across 5,000 seeds the maximum was 13 candidates for a set.

## Randomization and reproducibility

- The production seed comes from `createProductionSeed()` (Web Crypto). It returns `null` when no secure source exists; the session must then stop with a technical error. No fallback seed exists.
- `createFlankerSchedule(seed)` is a pure function of the seed. Schedule metadata records the seed, `HB-FLANKER-shuffle-v1`, randomization version `1`, the practice-stream seed, the base item order, candidates per set, and the realized practice/main orders.
- `flankerRandomizationMetadata(schedule)` passes these to `ExperimentLifecycle`, so every trial record and the session record carry them.

## Trial and session data (protocol §9)

Records come from the shared engine:

| Protocol field                                                    | Record field                                                                                        |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Version, session, phase, one-based index                          | `experiment.*`, `sessionId`, `phase`, `trialIndex`                                                  |
| Condition, target direction, five-symbol string, flanker identity | `condition`, `stimulus.targetDirection`, `stimulus.text` / `stimulus.cells`, `stimulus.flankerType` |
| Correct logical key                                               | `correctResponse`                                                                                   |
| First valid response or none; outcome and reason                  | `response`, `outcome`                                                                               |
| Timestamps and RT                                                 | `timing` (same definitions as Stroop; see `STROOP_PARTICIPANT_UI.md` "Recorded timestamps")         |
| Seed, PRNG id, version, realized orders                           | `randomization`                                                                                     |
| Break, status                                                     | Session record `breakTaken`, `breakDurationMs`, `status`                                            |

The same `timing` definitions apply. `stimulusOffsetMs` and `itiEndMs` must be
recorded by the Task 3 session flow exactly as the Stroop hook does, through
`RECORD_TRIAL_TIMING`.

## Testing evidence

| Test file                         | What it verifies                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/seededRandom.test.ts`     | Mulberry32 reference vectors (Python and canonical JS); hand-computed Fisher–Yates; production seed with fake, absent, and real sources                                                                                                                                                                                                                |
| `flanker/flankerSchedule.test.ts` | Practice and main orders and candidate counts for seeds 0, 1, 1234, and `0xFFFFFFFF`, matching an **independent Python implementation written from the protocol text**; the protocol's witness order; explicit constraint violations; boundary-crossing checks; the explicit failure path; seed validation; balance and constraints across 2,000 seeds |
| `flanker/flanker.test.ts`         | Configuration values; the six stimulus strings against literal protocol strings; geometry arithmetic; viewport rule; mapping; mapping check; adapter classification; metadata                                                                                                                                                                          |
| `flanker/flankerEngine.test.ts`   | Real schedule → real lifecycle → real `TrialRuntime`: correct, incorrect (flanker key), timeout, interrupted (invalid), ignored keys, break at 30, completion only after 60, abort with no unpresented records, and timestamp recording                                                                                                                |

## Participant UI (Tasks 3+4)

The participant experience is implemented and documented in
`FLANKER_PARTICIPANT_UI.md`. It uses the shared session hook, analysis, results,
and shell described in `EXPERIMENT_SESSION_ARCHITECTURE.md`. The approved base
item order (§14.5) and mapping-check handling (§14.6) are implemented as
documented above. Narrow-viewport protection (§14.7) uses
`flankerArrayFitsViewport`.
