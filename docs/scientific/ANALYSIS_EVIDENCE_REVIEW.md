# Analysis Evidence Review — Cycle 7, Task 1+2

**Status:** Proposed for human review. This review informs the shared analysis
methodology ([ANALYSIS_METHODOLOGY.md](../../frontend/ANALYSIS_METHODOLOGY.md)).
It does not validate any HUMAN BENCHMARK measure.

## 1. Scope and verification

The question: how should a single, short, browser-based Stroop or Flanker
session (12 practice and 60 main trials, at most 20 per condition) be
summarized and explained, without overstating it?

Sources already verified in Cycle 2 and Cycle 6 are reused:
- Ratcliff (1993) [S6] on RT outliers;
- Heitz (2014) [S5] on the speed–accuracy tradeoff;
- Hedge et al. (2018) [S7] on reliability;
- browser timing [W1–W7].

New sources were located by web search on 22 November 2026. The table states
exactly what was confirmed. **Full texts were not read**; claims are limited
to what the publisher records, abstracts, and consistent secondary summaries
support.

| Ref | Source | Verification |
|---|---|---|
| A1 | Miller, J. (1988). A warning about median reaction time. *Journal of Experimental Psychology: Human Perception and Performance, 14*(3), 539–543. [https://doi.org/10.1037/0096-1523.14.3.539](https://doi.org/10.1037/0096-1523.14.3.539) | Record and DOI confirmed; finding confirmed via abstract-level summaries and later papers |
| A2 | Rousselet, G. A., & Wilcox, R. R. (2020). Reaction times and other skewed distributions: Problems with the mean and the median. *Meta-Psychology, 4*. [https://doi.org/10.15626/MP.2019.1630](https://doi.org/10.15626/MP.2019.1630) | Record, DOI, and abstract confirmed. A reply by Miller ("Another warning about median reaction time", *Meta-Psychology*) was located but not read |
| A3 | Whelan, R. (2008). Effective analysis of reaction time data. *The Psychological Record, 58*, 475–482. [https://doi.org/10.1007/BF03395630](https://doi.org/10.1007/BF03395630) | Record, DOI, and abstract confirmed |
| A4 | Bruyer, R., & Brysbaert, M. (2011). Combining speed and accuracy in cognitive psychology: Is the inverse efficiency score (IES) a better dependent variable than the mean reaction time (RT) and the percentage of errors (PE)? *Psychologica Belgica, 51*(1), 5–13. [https://doi.org/10.5334/pb-51-1-5](https://doi.org/10.5334/pb-51-1-5) | Record, DOI, and abstract confirmed |
| A5 | Hyndman, R. J., & Fan, Y. (1996). Sample quantiles in statistical packages. *The American Statistician, 50*(4), 361–365. [https://doi.org/10.1080/00031305.1996.10473566](https://doi.org/10.1080/00031305.1996.10473566) | Record and DOI confirmed |
| A6 | Weissgerber, T. L., Milic, N. M., Winham, S. J., & Garovic, V. D. (2015). Beyond bar and line graphs: Time for a new data presentation paradigm. *PLoS Biology, 13*(4), e1002128. [https://doi.org/10.1371/journal.pbio.1002128](https://doi.org/10.1371/journal.pbio.1002128) | Record, DOI, and abstract confirmed |
| A7 | Rouder, J. N., & Haaf, J. M. (2019). A psychometrics of individual differences in experimental tasks. *Psychonomic Bulletin & Review, 26*(2), 452–467. [https://doi.org/10.3758/s13423-018-1558-y](https://doi.org/10.3758/s13423-018-1558-y) | Record and DOI confirmed; abstract-level content only |

## 2. Findings and what they mean for HUMAN BENCHMARK

| Topic | What the sources support | Implication | Classification |
|---|---|---|---|
| RT skew | RT distributions are positively skewed, and outliers distort central-tendency estimates [A3, S6] | Keep the median as the summary; never use the mean alone | Established convention |
| Median with small, unequal samples | Sample medians of skewed data overestimate the population median, more so for smaller samples; Miller warned against comparing conditions with unequal trial counts [A1]. Rousselet & Wilcox argue the median is median-unbiased, the bias is correctable, and quantile comparisons are informative [A2]. The debate continues. | Our RT contrasts compare medians whose correct counts can differ (for example 18 vs 14). Keep the approved median, keep showing counts, and **disclose** that small, unequal counts can shift a median difference. No bias correction (it needs bootstrapping that participants could not interpret, and Miller's critique is unresolved). | Evidence-supported disclosure; keeping the median is the approved pragmatic choice |
| Outliers | No single cutoff is universal [S6]; outlier handling affects estimates [A3] | Keep the approved "no post-hoc trimming" rule. Make extremes visible instead (distribution summary). The 2,000 ms deadline already bounds slow responses. | Approved protocol rule; visibility is pragmatic |
| Distribution description | Whole-distribution approaches are more informative than a single central value [A3, A2]; quantiles need a stated definition [A5] | Offer min, quartiles, and max of correct RTs (type 7 quantiles) under the same 10-correct rule | Pragmatic; method choice documented |
| Visualizing small samples | Show individual data points rather than bar charts for small samples [A6] | If RT data are visualized in Task 3, plot individual trials (strip/dot plot), not bars of medians | Evidence-supported recommendation |
| Combined speed–accuracy scores | Combined scores such as IES should not replace inspecting RT and errors separately [A4]; speed and accuracy can trade off [S5] | Keep the existing "no combined score" rule. Describe when speed and accuracy moved in opposite directions. | Evidence-supported |
| Inferential statistics and uncertainty | Trial noise in conflict tasks is large relative to individual differences [A7]; single-person estimates are unreliable [S7] | Do not add significance tests, confidence intervals, or effect sizes to single-session results. With at most 20 trials per condition they would add apparent precision without reliable meaning for participants. | Evidence-informed pragmatic decision |
| Individual versus group interpretation | Robust group effects do not imply reliable individual scores [S7, A7] | Describe "this session" only; no norms, ranks, or traits | Evidence-supported (already approved) |

## 3. Unchanged by this review

The approved denominators, the median-of-correct-RT definition, the
10-correct display rule, the nine contrast formulas and their signs,
practice/main separation, invalid and timeout treatment, and
incomplete-session rules all remain as approved. No evidence reviewed
contradicts them.
