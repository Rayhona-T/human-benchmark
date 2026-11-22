# HUMAN BENCHMARK — Participant Results Experience (Cycle 7, Task 3+4)

A shared results page for Stroop and Flanker, built on `HB-ANALYSIS-1.1`
([ANALYSIS_METHODOLOGY.md](ANALYSIS_METHODOLOGY.md)). Every value shown
comes from `computeSessionResults`; the UI recomputes nothing.

## Information hierarchy

1. **Session overview**
   - Status (complete, incomplete, or technical error).
   - For complete sessions, two headline rates, each with its denominator in
     words, for example "43 of 54 key presses were correct". A rate with no
     denominator shows "Unavailable" and the reason, never 0%.
   - Counts of presented trials, correct, incorrect, timeouts, invalid, not
     presented, practice, and the break, plus any invalid-reason and
     missing-data notes.
2. **Response times** (complete sessions only)
   - The per-condition dot plot.
   - A collapsible distribution table (fastest, quartiles, median, slowest).
3. **Results by condition:** the overall rates sentence and the condition
   table, with counts beside every percentage.
4. **Condition comparisons:** the three contrast cards (RT, accuracy, and
   success-rate rows, each with its own formula), plus a "Speed and accuracy
   together" note when eligible.
5. **Your data:** the local CSV download and an on-screen data dictionary.
6. **How to read these results:**
   - four key points, visible;
   - the conditions and response-time explainers, visible;
   - "More about these numbers and their limits", collapsible: the three
     rates, why the median (skew), few trials and noise, and measurement
     limits.

## Response-time dot plot (`shared/RtDotPlot.tsx`)

**Data and marks**

- **Data:** `buildRtPlotData` (pure, in `rtPlotData.ts`) reads `trialSeries`
  and condition summaries. Practice, timeouts, and invalid trials are never
  plotted; their counts appear in each row header.
- **Marks:** each correct response is a filled 10 px dot; each incorrect
  response is a ring (shape plus a second color). The median, only when
  eligible (10 correct or more), is a 2 px vertical line, with its value
  written in the row header. Conditions below the rule still show their dots
  (real observations), with "median not shown (needs 10 correct)".
- **Overlap:** a deterministic dodge stacks dots that would collide into
  lanes above and below the row center. No dot is hidden or jittered
  randomly.

**Axis and colors**

- **Axis:** one shared axis from 0 ms to the protocol's 2,000 ms window, with
  ticks every 500 ms and an axis title naming the unit and stimulus. It
  extends only if a value exceeded the window, so nothing is hidden. There is
  no zoom or truncated axis.
- **Colors:** correct `#2563eb` and incorrect `#eb6834`. These were validated
  with the data-viz palette checks (lightness, chroma, color-vision
  separation ΔE 29.9, normal-vision ΔE 38.5, and at least 3:1 contrast). A
  forced-colors fallback uses system colors.

**Accessibility and layout**

- **Accessibility:**
  - the SVG is `role="img"`, with a title and a text description summarizing
    each condition (count, range, median or why not, incorrect, timeouts,
    invalid);
  - an HTML legend explains the marks;
  - each dot has a hover title;
  - the distribution and condition tables hold the same numbers in text.
- **Responsive:** the plot measures its container (`ResizeObserver`) and
  re-lays out. Row headers wrap to the width, because SVG text cannot wrap.

## Speed–accuracy note

Uses `speedAccuracyDetail` (the same calculation as `speedAccuracyPattern`)
and `describeSpeedAccuracyWith`. It is written from the RT-first condition's
point of view, so it is correct for the protocols' reversed rate operands.

It is always followed by: "This describes a small number of trials from one
session. It is not a stable characteristic, an ability measure, or an
assessment." It is omitted when the RT or accuracy contrast is unavailable.

## Export

See [EXPORT_DATA_DICTIONARY.md](EXPORT_DATA_DICTIONARY.md). In short:

- it is participant-initiated and built locally (`Blob` and an object URL);
- nothing is transmitted;
- there is no session identifier;
- missing values are `NA`.

It is available for complete and incomplete sessions, because it is the
participant's own raw data, labelled with its status.

## Architecture

| Layer                          | Files                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Calculations (pure)            | `sessionAnalysis.ts`                                            |
| Visualization data (pure)      | `rtPlotData.ts` (`buildRtPlotData`, `dodgeLanes`, `wrapTokens`) |
| Export (pure)                  | `exportTrials.ts`                                               |
| Interpretation                 | `resultsFormat.ts`                                              |
| Presentation                   | `SessionResults.tsx`, `RtDotPlot.tsx`, and CSS                  |
| Experiment wording and columns | `stroopResultsFormat.ts`, `flankerResultsCopy.ts`               |

Both experiments render the same component.

## Not included (by approved scope)

- significance tests, p-values, and confidence intervals;
- effect sizes;
- norms, percentiles, and rankings;
- combined scores;
- trial timelines and interactive exploration;
- cross-session comparison.
