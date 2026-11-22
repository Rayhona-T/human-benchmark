# HUMAN BENCHMARK — Unified Analysis Methodology (Cycle 7, Task 1+2)

**Analysis version:** `HB-ANALYSIS-1.1` (`ANALYSIS_VERSION` in every result).

This applies to both `HB-STROOP-1.0` and `HB-FLANKER-1.0`, whose §9–§10
analysis plans are identical in structure. The evidence is in
[ANALYSIS_EVIDENCE_REVIEW.md](../docs/scientific/ANALYSIS_EVIDENCE_REVIEW.md).
Nothing here is a validated psychological measure.

## 1. Layers

| Layer                  | Where                                                               | Rule                                                                                           |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Raw records            | Engine `TrialRecord`s from the session                              | Never modified, inferred, or completed by analysis                                             |
| Calculations           | `shared/sessionAnalysis.ts` (`computeSessionResults`)               | Pure, deterministic, no React, no wording                                                      |
| Experiment definitions | `stroopAnalysis.ts`, `flankerAnalysis.ts`                           | Conditions, the protocol §10 contrast table, counts, and the RT rule, taken from each protocol |
| Interpretation         | `shared/resultsFormat.ts` (sentences), `speedAccuracyPattern`       | Describes "this session" only                                                                  |
| Presentation           | `shared/SessionResults.tsx` with experiment wording (`ResultsCopy`) | Shows only what calculations return                                                            |

## 2. Metric definitions (main trials only; practice is counted, never analysed)

Let C = correct, I = incorrect, T = timeout, V = invalid (per condition or
overall).

| Metric                                    | Definition                                                                                   | Denominator                         | If the denominator is 0 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------- |
| Scheduled main trials                     | Protocol count (60)                                                                          | —                                   | —                       |
| Presented (recorded)                      | Records for main trials                                                                      | —                                   | —                       |
| Not presented                             | Scheduled − presented (including presented records that cannot be attributed to a condition) | —                                   | —                       |
| Analysable                                | C + I + T                                                                                    | —                                   | —                       |
| Valid responses                           | C + I (a first valid mapped key)                                                             | —                                   | —                       |
| Response accuracy                         | C ÷ (C + I)                                                                                  | Valid responses                     | "Unavailable"           |
| Successful response rate                  | C ÷ (C + I + T)                                                                              | Analysable                          | "Unavailable"           |
| Timeout rate                              | T ÷ (C + I + T)                                                                              | Analysable                          | "Unavailable"           |
| Invalid trials                            | V, with reasons                                                                              | — (excluded from every denominator) | —                       |
| Median correct RT                         | Median of usable RTs of correct responses, per condition only                                | Correct responses with a usable RT  | See §4                  |
| RT distribution (new in 1.1)              | Min, Q1, median, Q3, max of the same RTs (type 7 quantiles)                                  | As for the median                   | See §4                  |
| Correct responses missing RT (new in 1.1) | Correct responses without a finite, non-negative RT                                          | —                                   | Disclosed               |

There is no overall RT: both protocols define RT per condition. No
combined score exists.

## 3. Contrasts (unchanged; protocol §10 of both experiments)

| Contrast           | RT (positive ⇒ first condition slower) | Accuracy and success rate (positive ⇒ first condition higher) |
| ------------------ | -------------------------------------- | ------------------------------------------------------------- |
| Interference       | incongruent − neutral                  | neutral − incongruent                                         |
| Facilitation       | neutral − congruent                    | congruent − neutral                                           |
| Overall congruency | incongruent − congruent                | congruent − incongruent                                       |

Display rules:

- **Zero:** a value that rounds to zero (1 ms, or 0.1 percentage points) is
  described as "the same".
- **RT contrasts:** need both conditions to meet the RT display rule.
- **Rate contrasts:** need both denominators to be nonzero.
- **Wording:** every sentence uses the operands of its own row; this is
  enforced by tests.

## 4. Eligibility and missing-data rules

| Situation                                                     | Rule                                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Incomplete, interrupted, or technical-error session           | Counts and status only. No rates, medians, distributions, contrasts, or trial series.                                                          |
| Invalid trial (focus/visibility or technical)                 | Excluded from every denominator and RT; counted with its reason                                                                                |
| Timeout                                                       | Counts toward success and timeout rates; not toward accuracy; has no RT                                                                        |
| Incorrect response                                            | Counts toward accuracy and success rates; its RT is kept in the trial series but not in correct-RT summaries                                   |
| Fewer than 10 correct responses with usable RT in a condition | Median and distribution "not shown", with the count; RT contrasts involving that condition "not shown" (a pragmatic, unvalidated product rule) |
| Correct response without usable RT                            | Still correct in every rate; excluded from RT summaries; disclosed (count and on-screen note)                                                  |
| Unpresented trials                                            | Never outcomes, timeouts, or invalid trials; reported as "not presented"                                                                       |
| Records that cannot be attributed                             | Counted and disclosed; never silently merged                                                                                                   |
| Missing offset or ITI timestamps                              | No metric depends on them; they stay null                                                                                                      |
| Empty data                                                    | Every rate is "unavailable"; nothing is estimated                                                                                              |

## 5. Reaction-time analysis and outlier policy

- **Summary measure:** the median of correct RTs, because RT distributions are
  skewed [A3, S6].
- **No trimming:** no post-hoc removal of fast or slow responses (approved
  protocol rule). The 2,000 ms deadline bounds slow responses; anticipatory
  responses are not excluded. The distribution summary makes extremes
  visible instead of hidden.
- **Disclosure:** medians from small or unequal numbers of correct responses
  can be shifted by chance [A1, A2]. Counts are always shown next to medians,
  and Task 3 should add a sentence about this.
- **Not adopted:** confidence intervals, significance tests, effect sizes,
  bootstrap bias correction, and combined speed–accuracy scores [A4, A7, S7].
  These require approval if ever reconsidered.

## 6. Interpretation principles

**Results do:**

- say what the task measures (responses to the relevant feature while
  another feature agrees or conflicts);
- describe what happened in this session, with counts;
- separate an observed difference from an established psychological effect;
- mention when speed and accuracy moved in opposite directions
  (`speedAccuracyPattern`).

**Results never:**

- claim a stable trait, ability, IQ, diagnosis, or personality;
- compare against norms or other people;
- rank participants;
- call faster "better" without accuracy;
- treat a small difference as meaningful.

**Sentence pattern:** "In this session, [measure] on [first] trials was
[amount] [direction] than on [second] trials."

## 7. Testing

**`shared/sessionAnalysis.test.ts`:**

- quantiles against hand-calculated, spreadsheet-equivalent values;
- the distribution summary and its eligibility;
- missing-RT disclosure;
- the "not presented" correction (the test fails with the old formula);
- the trial series and when it is withheld;
- every speed–accuracy pattern branch;
- empty data;
- Stroop and Flanker producing identical results for identical records.

**`shared/SessionResults.test.tsx`:** the missing-RT note.

**Existing Stroop and Flanker suites:** unchanged and passing. They cover
every metric, denominator, contrast, sign, and label.

## 8. Approved decisions (implemented in Task 3+4)

1. **RT distribution summary:** shown as secondary information (collapsible
   table).
2. **Quantile method:** type 7 (spreadsheet `QUARTILE.INC`).
3. **Speed–accuracy pattern sentence:** shown on contrast cards, with a
   single-session caveat.
4. **Median-skew and median-bias limitation:** added to the results.
5. **No inferential statistics:** none are added.
6. **Export:** participant-initiated local CSV with a data dictionary
   (`EXPORT_DATA_DICTIONARY.md`).

**Additional presentation choice:** conditions below the 10-correct display
rule still show their individual dots in the plot (real observations), but
no median.

## 9. Task 3+4 scope (implemented; see `RESULTS_EXPERIENCE.md`)

Priority order:

1. scientific usefulness,
2. understanding and interpretability,
3. data availability,
4. honesty,
5. complexity,
6. privacy,
7. performance.

| Priority     | Feature                                                                                                                                                      | Why                                                                                                         | Notes                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Do**       | Session summary header (status, counts, break)                                                                                                               | Already exists; restructure only                                                                            | No new data                                                    |
| **Do**       | Condition comparison: per-condition **dot plot of individual correct RTs** with the median marked, errors shown distinctly, timeouts counted beside the plot | Individual points suit about 20 values per condition [A6]; makes skew and outliers visible without trimming | Complete sessions only; uses `trialSeries`; no bars of medians |
| **Do**       | Accuracy display as counts ("17 of 18") with a simple proportion bar                                                                                         | Proportions are easily misread without counts                                                               | Count labels mandatory                                         |
| **Do**       | Contrast cards with the formula, value, sentence, and speed–accuracy note                                                                                    | Makes the operand order and tradeoffs explicit                                                              | Uses `speedAccuracyPattern`                                    |
| **Do**       | Limitations panel, including median-bias and single-session cautions                                                                                         | Required honesty                                                                                            | Wording to be reviewed                                         |
| **Consider** | Distribution summary table (min, Q1, median, Q3, max)                                                                                                        | Some value; duplicates the dot plot                                                                         | Optional, collapsible                                          |
| **Consider** | Participant-initiated CSV/JSON export                                                                                                                        | Transparency, and the MVP export requirement                                                                | Needs a data dictionary; local file only, nothing sent         |
| **Defer**    | Trial-by-trial timeline or interactive exploration                                                                                                           | Sequential effects are not interpretable at this n                                                          | Not recommended now                                            |
| **Do not**   | Norms, percentiles, scores, confidence intervals, significance, effect sizes, cross-session comparison                                                       | Unsupported or misleading                                                                                   | Out of scope by principle                                      |

Accessibility requirement for any chart: a text or table equivalent, no
information conveyed by color alone, and no layout shift.
