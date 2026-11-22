# HUMAN BENCHMARK — Stroop Session Results

Cycle 5, Task 3. Implements the participant-facing results for HB-STROOP-1.0
according to protocol §9 (outcome categories), §10 (analysis plan), §7 and §11
(incomplete sessions and validity), and `EXPERIMENT_DATA_CONVENTIONS.md`.

## Source of the data

Results are computed only from the engine's recorded trial records, read from
the lifecycle snapshot after the session ends (completed, exited, or technical
error). No trial is added, inferred, edited, or replayed. Nothing is stored or
sent anywhere; the results exist only in the open page.

Fields used: `phase`, `condition`, `outcome` (category and invalid reason),
`timing.reactionTimeMs`, plus session `status`, `breakTaken`, and
`breakDurationMs`. No result depends on `stimulusOffsetMs` or `itiEndMs`
(recorded since Cycle 5 Task 4; see `STROOP_PARTICIPANT_UI.md`).

## Code layout

- `stroopAnalysis.ts` — pure calculations (`computeStroopResults`), no React.
- `stroopResultsFormat.ts` — number formatting and plain-language sentences.
- `StroopResults.tsx` / `StroopResults.css` — presentation.
- `StroopExperimentPage.tsx` — renders results under the end-of-session card.

## Calculations (main trials only; practice is counted but never analysed)

| Measure                  | Definition                                       | Unavailable when                  |
| ------------------------ | ------------------------------------------------ | --------------------------------- |
| Response accuracy        | correct ÷ (correct + incorrect)                  | no correct or incorrect responses |
| Successful response rate | correct ÷ (correct + incorrect + timeout)        | no analysable trials              |
| Timeout rate             | timeout ÷ (correct + incorrect + timeout)        | no analysable trials              |
| Median correct RT        | median of `reactionTimeMs` for correct responses | fewer than 10 correct responses   |

- Rates are reported overall and per condition, always with numerator and
  denominator. A zero denominator is shown as "unavailable", never as 0%.
- Invalid trials (predefined technical reasons only) are excluded from every
  denominator and reported separately with their reasons.
- Timeouts are never counted as incorrect responses, and are excluded from
  response accuracy only.
- RT uses correct responses only. Incorrect-response RTs stay in the records
  but are not pooled. No fast/slow responses are removed.
- Median: the middle sorted value; for an even count, the mean of the two
  middle values.
- There is no overall RT, because the protocol defines RT per condition.

## Contrasts (protocol §10 table, complete sessions only)

| Contrast           | RT (positive ⇒ first slower) | Rate contrasts (positive ⇒ first higher) |
| ------------------ | ---------------------------- | ---------------------------------------- |
| Interference       | incongruent − neutral        | neutral − incongruent                    |
| Facilitation       | neutral − congruent          | congruent − neutral                      |
| Overall congruency | incongruent − congruent      | congruent − incongruent                  |

Rate contrasts are computed for both response accuracy and successful response
rate, as differences in proportions shown in percentage points. The protocol
orders the rate operands in reverse relative to RT, so that a positive rate
contrast means the less-conflicting condition had the higher rate; the UI shows
each formula explicitly. There is no combined score.

Eligibility:

- An RT contrast requires both conditions to have at least 10 correct
  responses. Otherwise it is "not shown", with the reason.
- A rate contrast requires both condition denominators to be nonzero.

## Incomplete sessions

For `incomplete`, `interrupted`, and `technical_error` sessions, only status
and clearly labelled trial counts are shown (protocol §6–§7): presented,
correct, incorrect, timeouts, invalid (with reasons), not presented, practice,
and break. No rates, medians, or contrasts are calculated. Unpresented trials
are reported as "not presented", never as timeouts or errors. A complete
session that contains invalid trials remains complete.

## Presentation choices (pragmatic, not protocol decisions)

- Percentages use one decimal place; RTs and RT contrasts are rounded to whole
  milliseconds; contrasts are computed before rounding.
- Signs use "+" and a true minus sign; zero has no sign.
- No chart is included: with at most 20 trials per condition, a table with
  explicit counts is clearer and harder to misread than bars.
- The break is shown as "Taken (about N s)", "Skipped", or "Not reached",
  using the engine convention that a skipped break records duration 0.
- The neutral condition is described as a practical, unvalidated baseline.

## Accessibility

Semantic section headings; a real `<table>` with a caption and row/column
headers inside a keyboard-focusable, labelled scroll region on narrow screens;
text (never color alone) for status and unavailability; focus moves to the
end-of-session heading.

## Known limitations

- Results disappear when the page is left or reloaded (no persistence, by
  design). Export is not implemented.
- Browser-recorded times are device-dependent and not laboratory-grade.
- With 20 trials per condition, rates change in coarse steps and contrasts can
  reflect ordinary trial-to-trial variation; no significance testing is done.
