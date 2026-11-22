# Flanker Evidence Review — Cycle 6, Task 1+2

**Status:** Reviewed. The audited draft was approved, unchanged, as
`HB-FLANKER-1.0` ([FLANKER_PROTOCOL.md](../experiments/FLANKER_PROTOCOL.md) §14).
This review informs that decision; it does not validate the protocol.

## 1. Scope and method

The Cycle 2 review ([LITERATURE_REVIEW.md](LITERATURE_REVIEW.md), §3) already
verified the core Flanker sources [F1–F4], reliability [S7], speed–accuracy
[S5], and browser timing [W1–W7]. This review adds sources only where a protocol
decision depended on evidence that review did not cover: sequential effects,
target–flanker spacing, online replication, the neutral flanker used in the
Attention Network Test, and age/broad-population use.

Each new reference was located through a web search on 22 November 2026. The
"Verification" column states exactly what was confirmed. Full texts were **not**
read unless stated; claims below are limited to what the verified record or
widely-cited summaries support, and are worded accordingly.

| Ref | Source | Verification |
|---|---|---|
| F5 | Gratton, G., Coles, M. G. H., & Donchin, E. (1992). Optimizing the use of information: Strategic control of activation of responses. *Journal of Experimental Psychology: General, 121*(4), 480–506. | Author/title/year confirmed in the University of South Florida repository record ([digitalcommons.usf.edu/psy_facpub/316](https://digitalcommons.usf.edu/psy_facpub/316)). Journal, pages, and DOI (`10.1037/0096-3445.121.4.480`) **not independently confirmed** in this review. |
| F6 | Miller, J. (1991). The flanker compatibility effect as a function of visual angle, attentional focus, visual transients, and perceptual load: A search for boundary conditions. *Perception & Psychophysics, 49*(3), 270–288. | Bibliographic record and DOI confirmed via an index record. [https://doi.org/10.3758/BF03214311](https://doi.org/10.3758/BF03214311) |
| F7 | Mayr, U., Awh, E., & Laurey, P. (2003). Conflict adaptation effects in the absence of executive control. *Nature Neuroscience, 6*(5), 450–452. | Bibliographic record and DOI confirmed (publisher page). [https://doi.org/10.1038/nn1051](https://doi.org/10.1038/nn1051) |
| F8 | Crump, M. J. C., McDonnell, J. V., & Gureckis, T. M. (2013). Evaluating Amazon's Mechanical Turk as a tool for experimental behavioral research. *PLoS ONE, 8*(3), e57410. | Record and DOI confirmed; the abstract lists a Flanker task among the replicated tasks. [https://doi.org/10.1371/journal.pone.0057410](https://doi.org/10.1371/journal.pone.0057410) |
| F9 | Weintraub, S., et al. (2013). Cognition assessment using the NIH Toolbox. *Neurology*. | PubMed record located (PMID 23479546); a related overview states the battery includes a Flanker Inhibitory Control and Attention Test. Volume/pages/DOI not confirmed here. [https://pubmed.ncbi.nlm.nih.gov/23479546/](https://pubmed.ncbi.nlm.nih.gov/23479546/) |

Checked and **not used**: Davidson et al. (2006, *Neuropsychologia*) — confirmed
to exist, but its battery is not a Flanker task. Schmidt & De Houwer (2011,
*Acta Psychologica*) — relevant to sequential effects, but its DOI was not
confirmed and a later replication disputes its conclusion; F7 is used instead.

## 2. Findings relevant to the protocol

### 2.1 Arrow variant and conditions

The arrow-Flanker is an established adaptation of the original letter task
[F1]; it is used in the Attention Network Test [F4] and replicated in
browser-based online studies [F8, W6]. Congruent/incongruent definitions follow
the response-compatibility logic of the original paradigm [F1, F3].

### 2.2 Neutral flankers

Search results describing the ANT [F4] report that its neutral condition used
non-directional straight lines (some later variants show the arrow alone), and
that the ANT's executive/conflict score is incongruent − congruent, without the
neutral condition. The protocol's em-dash neutral therefore follows an
established convention. It remains a chosen baseline, not a perceptually
matched one (protocol §4); interference and facilitation contrasts depend on it.
**This was confirmed from search-result summaries of the ANT paper, not from its
full methods section.**

### 2.3 Spacing and geometry

Target–flanker separation and display factors change the size of the
compatibility effect [F1, F6]. The protocol fixes CSS geometry (56 px between
symbol centers) but cannot control visual angle, display scaling, or viewing
distance. Effect sizes are therefore not comparable across devices, and the
geometry is a layout rule, not a calibrated stimulus.

### 2.4 Sequential effects

Flanker effects depend on the previous trial (congruency sequence or "Gratton"
effect) [F5], and part of that pattern can come from exact stimulus repetition
priming rather than control adjustments [F7]. Relevant protocol choices:

- **No identical stimulus on adjacent trials** removes exact repetitions, which
  is consistent with the repetition-priming finding [F7].
- **Run limits and concealed six-item sets** keep conditions and directions
  interleaved.
- **Not controlled:** the frequency of each condition-to-condition transition.
  Session means may therefore include some sequence-dependent variation. For a
  descriptive single session this is acceptable but should be disclosed.

### 2.5 Online feasibility and population

Online and browser studies have reproduced a Flanker effect [F8, W6], which
supports feasibility, not timing equivalence [W1–W5]. Flanker tasks appear in
standardized batteries developed with pediatric and adult data [F9]; that does
not make this protocol a standardized or normed instrument, and no age norms
apply. Keyboard, motor, visual, and layout differences remain participant-care
issues (protocol §5).

### 2.6 Reliability

Robust group-level Flanker effects coexist with poor individual-level
reliability [S7]. With 20 trials per condition, results are descriptive for one
session only.

## 3. Evidence classification of every protocol decision

Labels: **Evidence-supported** (empirical findings support the choice),
**Convention** (established methodological practice), **Pragmatic** (product or
platform choice), **Unvalidated** (no evidence that it is optimal or
equivalent).

| Decision (protocol §) | Value | Classification | Basis |
|---|---|---|---|
| Stimulus family (§1, §4) | Arrow-Flanker variant | Convention | F1, F4, F8, W6 |
| Congruent / incongruent definitions (§4) | Same / opposite flanker direction | Evidence-supported | F1, F3 |
| Neutral condition (§4) | Em-dash flankers | Convention; baseline **Unvalidated** | F4 (lines as neutral); §2.2 caveat |
| Array (§4) | Five cells, target in centre, two flankers per side | Convention | F4 |
| Geometry and colors (§4) | 48 px cells, 8 px gaps, 40 px bold glyphs, `#F9FAFB` on `#111827` | Pragmatic; **Unvalidated** | F1, F6 (spacing matters) |
| Response mapping (§5) | F = Left, J = Right, logical keys, no counterbalancing | Pragmatic | — |
| Mapping check (§5) | F for left arrow, then J for right; repeat after wrong key | Pragmatic | — |
| Counts (§6) | 12 practice; 60 main (20/condition, 10/direction) | Pragmatic | S7 (reliability caution) |
| Timing (§7) | 500 ms fixation, 2,000 ms deadline, 500 ms ITI | Pragmatic (harmonized with Stroop) | — |
| Feedback (§6) | Practice only | Convention | — |
| Break (§6) | Optional after main trial 30 | Pragmatic | — |
| Randomization (§8) | Ten concealed six-item sets; run ≤ 3; no adjacent identical stimulus | Pragmatic; adjacency rule evidence-informed | F5, F7 |
| Outcomes and denominators (§9–§10) | Shared Stroop/Flanker conventions | Convention (project-harmonized) | S5 |
| RT summary (§10) | Median correct RT, shown with ≥ 10 correct | Pragmatic; **Unvalidated** threshold | — |
| Contrasts (§10) | Interference, facilitation, overall congruency | Convention for incongruent − congruent; neutral-based contrasts depend on the dash baseline | F3, F4 |
| Timing measurement (§7) | rAF onset, `performance.now()` keydown | Convention; no lab-grade claim | W1–W7, P1–P3 |

## 4. Conclusion

The evidence reviewed does not support changing any protocol parameter. It
supports keeping the draft's choices with the caveats it already states, adding
the sequential-effect disclosure in §2.4, and resolving the open decisions
listed in [FLANKER_PROTOCOL.md §14](../experiments/FLANKER_PROTOCOL.md),
all of which were subsequently approved.
