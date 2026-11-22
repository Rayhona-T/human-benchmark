# HUMAN BENCHMARK — Trial Data Export Dictionary (Cycle 7)

The results page offers **Download trial data (CSV)**.

## Privacy

- **Participant-initiated:** nothing is downloaded until the participant
  presses the button.
- **Local only:** the file is built in the browser from the session's own
  engine records. Nothing is uploaded, stored, or sent anywhere.
- **No identifiers:** the session identifier and device details are not
  exported. The seed only reproduces the trial order; it is not personal data.

## File format

- **File name:** `human-benchmark-<experiment>-<status>-trials.csv`.
- **Encoding:** UTF-8 with a byte-order mark, so spreadsheet programs show
  arrows and dashes correctly.
- **Structure:** comma-separated values (RFC 4180, CRLF line endings), with a
  header row and one row per **recorded** trial, practice first. Trials that
  were never presented have no row.
- **Missing values:** `NA` means the value does not apply or was not recorded.
  It is never written as 0.
- **Times:** all times are in milliseconds, rounded to 0.001 ms.
- **Timestamps:** these are browser values relative to page load
  (`performance.now()`), not clock times. They are device-dependent and not
  laboratory-grade.

## Columns shared by both experiments

| Column                  | Meaning                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `experiment`            | `stroop` or `flanker`.                                                                                                                                                                                                                                                                                                                                          |
| `protocol_id`           | Approved protocol version (`HB-STROOP-1.0` or `HB-FLANKER-1.0`).                                                                                                                                                                                                                                                                                                |
| `analysis_version`      | Analysis definitions version (`HB-ANALYSIS-1.1`).                                                                                                                                                                                                                                                                                                               |
| `session_status`        | `complete`, `incomplete`, `interrupted`, or `technical_error`.                                                                                                                                                                                                                                                                                                  |
| `seed`                  | Random seed that generated the trial order.                                                                                                                                                                                                                                                                                                                     |
| `prng_id`               | Identifier of the trial-order algorithm.                                                                                                                                                                                                                                                                                                                        |
| `phase`                 | `practice` or `main`. Practice trials are never used in results.                                                                                                                                                                                                                                                                                                |
| `trial_index`           | Trial number within its phase, starting at 1.                                                                                                                                                                                                                                                                                                                   |
| `condition`             | `congruent`, `incongruent`, or `neutral`.                                                                                                                                                                                                                                                                                                                       |
| `correct_key`           | Key that matched the stimulus (lowercase).                                                                                                                                                                                                                                                                                                                      |
| `response_key`          | First valid mapped key pressed; `NA` if none.                                                                                                                                                                                                                                                                                                                   |
| `outcome`               | `correct`, `incorrect`, `timeout` (no key within 2,000 ms), or `invalid` (page hidden or lost focus, or a technical problem).                                                                                                                                                                                                                                   |
| `correct`               | `1` if correct, `0` if incorrect, `NA` for timeouts and invalid trials.                                                                                                                                                                                                                                                                                         |
| `invalid_reason`        | Reason for an invalid trial; `NA` otherwise.                                                                                                                                                                                                                                                                                                                    |
| `rt_ms`                 | Response time: key press minus recorded stimulus onset, for correct and incorrect responses. `NA` for timeouts, invalid trials, and unusable values.                                                                                                                                                                                                            |
| `fixation_onset_ms`     | When the fixation cross appeared.                                                                                                                                                                                                                                                                                                                               |
| `stimulus_onset_ms`     | Animation-frame time of the frame that first showed the stimulus.                                                                                                                                                                                                                                                                                               |
| `response_timestamp_ms` | Time of the key press; `NA` if none.                                                                                                                                                                                                                                                                                                                            |
| `deadline_ms`           | Stimulus onset + 2,000 ms.                                                                                                                                                                                                                                                                                                                                      |
| `stimulus_offset_ms`    | Animation-frame time of the frame that removed the stimulus; `NA` if the trial was interrupted or the session ended first. Frame times mark the _start_ of a frame, so this can be up to one frame (about 17 ms at 60 Hz) earlier than `response_timestamp_ms` when the key press was handled during that frame. Values are recorded as observed, not adjusted. |
| `iti_end_ms`            | When the 500 ms interval after the trial ended; `NA` if it did not complete.                                                                                                                                                                                                                                                                                    |

## Experiment-specific columns

They sit between `condition` and `correct_key`.

| Experiment | Column              | Meaning                                                                        |
| ---------- | ------------------- | ------------------------------------------------------------------------------ |
| Stroop     | `stimulus_word`     | Word shown (a color word or a neutral word).                                   |
| Stroop     | `stimulus_ink`      | Ink color: what the response should match.                                     |
| Flanker    | `stimulus_symbols`  | The five symbols shown; the center one is the target.                          |
| Flanker    | `target_direction`  | Direction of the center arrow.                                                 |
| Flanker    | `flanker_direction` | What the surrounding symbols indicate: `left`, `right`, or `neutral` (dashes). |

## Using the file responsibly

The file describes one session. Recomputing the on-screen results requires
the definitions in `ANALYSIS_METHODOLOGY.md`:

- main trials only;
- invalid trials excluded from every denominator;
- timeouts excluded from response accuracy;
- medians of correct responses only.

The data cannot support conclusions about a person's stable abilities,
diagnosis, or comparison with others.
