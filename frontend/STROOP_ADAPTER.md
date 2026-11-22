# HUMAN BENCHMARK — Stroop Experiment Adapter

## Scope

This adapter defines the approved Stroop experiment for the reusable engine.
It does not present stimuli, capture keyboard input, execute trials, or render
experiment UI.

## Protocol identity

- Protocol: `HB-STROOP-1.0`
- Configuration: `HB-STROOP-1.0`
- Protocol/configuration version: `1.0`
- Randomization: `HB-STROOP-shuffle-v1`

These identifiers follow the approved scientific protocol. Neutral words and
the selected 60-trial schedule remain pragmatic, unvalidated choices.

## Configuration

- Conditions: congruent, incongruent, neutral
- Practice: 12 trials, 4 per condition
- Main: 60 trials, 20 per condition
- Fixation: 500 ms
- Main response deadline: 2000 ms
- Inter-trial interval: 500 ms
- Feedback: practice enabled; main disabled
- Break: offered after main trial 30
- Minimum RT display count: 10 correct responses

The response deadline and break boundary are configuration values, not adapter
timing implementations.

## Stimulus generation

Congruent trials pair each color word with its matching ink:

- RED/red
- BLUE/blue
- GREEN/green
- YELLOW/yellow

Incongruent trials pair a color word with a different approved ink color.

Neutral trials use `BOOK`, `CHAIR`, `HOUSE`, `TABLE`, or `MUSIC` with an
approved ink color. This neutral set is pragmatic and unvalidated.

Every stimulus includes word, ink color, and the approved presentation constants:
48 px type, weight 700, and `#111827` background.

## Practice schedule

Practice uses a separate Mulberry32 stream initialized from
`seed XOR 0x9E3779B9`.

- 4 congruent trials, one for each color
- 4 incongruent trials from a seed-selected derangement
- 4 neutral trials using 4 distinct neutral words and 4 ink colors
- The practice pool is shuffled once and has no additional adjacency constraint

## Main schedule

The main pool contains:

- 20 congruent trials
- 20 incongruent trials
- 20 neutral trials

Incongruent generation enumerates the nine lexicographic derangements of red,
blue, green, and yellow in that color order. The seed selects one derangement.
Those four ordered pairs occur once; all eight remaining nonmatching ordered
pairs occur twice.

The complete pool is shuffled using Fisher–Yates with Mulberry32. A candidate is
accepted only if:

- No condition run exceeds 3
- No adjacent trials contain the identical word/ink stimulus
- At most 10,000 candidates are attempted

If no candidate is accepted, schedule creation throws an explicit generation
error rather than relaxing constraints or silently substituting an order.

## Pseudorandom number generator

All randomization uses Mulberry32 exactly as specified in HB-STROOP-1.0 §8
(`createMulberry32` in `stroopSchedule.ts`):

```text
t = state = (state + 0x6D2B79F5) mod 2^32
t = imul(t XOR (t >>> 15), t OR 1) mod 2^32
t = t XOR ((t + imul(t XOR (t >>> 7), t OR 61)) mod 2^32)
return unsigned (t XOR (t >>> 14)) / 2^32
```

The main stream is seeded with the session seed; the practice stream with
`seed XOR 0x9E3779B9`. Derangements are selected with `floor(random() * 9)`
and shuffles use Fisher–Yates, both consuming the continuing stream.

Tests check the generator against reference vectors for seeds 0, 1, 1234,
`0xFFFFFFFF`, and the seed-1234 practice stream. The vectors were computed
independently from the protocol text with Python integer arithmetic and agree
with the canonical published JavaScript Mulberry32.

### Correction notice (Cycle 5, Task 1 correction)

Before this correction, the implementation omitted the `t +` term in the third
step (`t ^= imul(...)`). That variant was deterministic and produced balanced,
constraint-satisfying schedules, but it was **not** the protocol algorithm, so
its schedules could not be reproduced from the published specification. It was
nevertheless labeled `HB-STROOP-shuffle-v1`.

The same seed now produces a different schedule than it did before the
correction. Any schedule generated before the correction cannot be reproduced
from its seed with the corrected algorithm, and should be identified by its
realized order, not its seed. The project has no persistence, so no participant
sessions were stored with the earlier variant. The protocol, identifier
`HB-STROOP-shuffle-v1`, pool construction, constraints, and candidate limit are
unchanged.

## Reproducibility

A valid unsigned 32-bit seed produces reproducible practice and main arrays.
The schedule metadata includes:

- Main seed
- Practice stream seed
- PRNG/schedule identifier
- Randomization configuration version
- Selected derangement
- Realized practice and main arrays
- Schedule generation status

The realized arrays and trial IDs are part of the schedule. A seed alone is not
considered sufficient to reconstruct a session.

## Response mapping

- D — red
- F — blue
- J — green
- K — yellow

Logical `event.key` values are the adapter contract. Correctness is derived
from the stimulus ink color, not the word meaning.

The fixed mapping is an MVP choice, not an experimentally optimized or
counterbalanced design.
