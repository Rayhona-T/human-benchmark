# HUMAN BENCHMARK — Manual Verification Checklist

Status (Cycle 10, Task 10.5): **prepared, not yet performed.** No item below
has been carried out by a human tester. Automated checks (TESTING.md) do not
replace these; this checklist is not an accessibility certification.

Run it against the production build (`npm run build`, then
`npm run preview` in `frontend/`), or against the deployed site once a host
exists (then also run docs/HOSTING.md §5). For every check, record the date,
tester, browser and version, operating system, assistive technology and
version, result (Pass / Fail / Not run), and notes. A failure is a defect
report: describe what happened, what was expected, and the steps.

## What automated tests already cover

Chromium, Firefox, and WebKit run on every push (TESTING.md):

- axe-core (WCAG 2.0–2.2 A/AA and best practice) on every session state,
  except two scans skipped in Firefox (TESTING.md, "Known browser and tool
  limitations").
- The whole journey by keyboard: visible focus, focus moved to new screens,
  dialogs keep focus inside and start on the safe choice, Escape cancels.
- Pausing on emulated page hiding and on real window focus loss (Chromium).
- Layout at 1440, 1280, 768, 390, and 320 px wide.

They cannot judge what a screen reader announces, how the pages behave at
browser zoom, or what happens on a real tab switch.

## A. Screen reader walkthrough

**Suggested combinations:** NVDA (current) with Firefox or Chrome on
Windows; VoiceOver with Safari on macOS. Use one at minimum before release;
both if possible.

Run one Stroop and one Flanker session. Use the screen reader's normal
reading and navigation keys between trials; during timed trials only the
response keys should be pressed (see note below).

| # | State | Expected |
|---|---|---|
| A1 | Experiment page (briefing) | Page title and heading announced; the list of what is recorded, stopping, keyboard use, and staying on the page is readable; "Start" button named |
| A2 | Key check (instructions) | Heading moved into focus and announced; the prompt says which key to press; progress is announced (Stroop: each key confirmed; Flanker: a wrong key shows the correct mapping); "Begin 12 practice trials" is announced as unavailable until the check is complete |
| A3 | Practice trial | The trial area is identified ("Active … trial"); a hidden page heading names the phase. The stimulus itself is visual (not announced): expected, the task is visual |
| A4 | Practice feedback | "Correct", "Incorrect", or "No response in time" and the correct response are announced without moving focus |
| A5 | Pause (Pause button) | "Experiment paused" heading receives focus; the explanation is read; Resume and Exit named |
| A6 | Ready for main task | Heading receives focus; the main-task instructions are read |
| A7 | Main trial | No correctness feedback is announced |
| A8 | Optional break (after trial 30) | Heading receives focus; Continue and Skip break named |
| A9 | Exit confirmation | Announced as an alert dialog with its title and description; focus starts on "Continue"; Tab stays in the dialog; Escape cancels |
| A10 | Leave confirmation (click a header link during a session) | As A9, with "Stay" first |
| A11 | Completed results | Heading receives focus; results sections have headings; numbers have labels; the response-time chart has a text alternative or equivalent table |
| A12 | Incomplete results (after Exit) | "Session ended" announced; the incomplete status is clear in words, not only by color |
| A13 | CSV download | Button named "Download trial data (CSV)"; the download is reported by the browser |
| A14 | Clear confirmation | Button description read; dialog as A9 with "Cancel" first; after clearing, focus is on the start heading |
| A15 | Methodology page | Headings in order; references readable; each DOI link named by its address |

Also check throughout: nothing is conveyed by color alone (practice/main
badges, result statuses, feedback); no unexpected announcements during
trials.

**Note.** Screen-reader shortcut keys pressed during a timed trial can
reach the page. Unmapped keys are ignored, but keys that move focus out of
the page pause the session (as intended). Record any such pause.

## B. Browser zoom

In Chrome, Firefox, and Safari at **200%** (WCAG 1.4.4) and, where the
window allows, **400%** at a 1280 px wide window (≈ 320 CSS px, WCAG 1.4.10):

| # | Page or state | Expected |
|---|---|---|
| B1 | Home, Experiments, Methodology | All text and controls available; no horizontal scrolling of the page; the menu works |
| B2 | Briefing and key check | Readable; buttons reachable |
| B3 | Pause, break, dialogs | Dialog fits or scrolls; both buttons reachable by keyboard and pointer |
| B4 | Results and CSV download, Clear | All sections reachable; the results table may scroll inside its own frame |
| B5 | Trials (record only) | Stimuli are shown at their fixed protocol size, so at high zoom they are larger and may not fit. Flanker pauses with "Window too narrow" when the 272 px row does not fit. Record whether the Stroop word and the Flanker row are fully visible without scrolling; clipping here is the open D4 decision, not a zoom defect |

Distinguish the site (must reflow) from the trial presentation (fixed
geometry by protocol; it does not reflow by design).

## C. Real tab switching

Automated tests emulate hidden pages; real tab switching was not reproduced
under automation. In each browser (Chrome, Firefox, Safari), for each state:

| # | When | Action | Expected |
|---|---|---|---|
| C1 | Practice, stimulus on screen | Switch to another tab, wait 3 s, return | Session paused; the pause message says the page was hidden or lost focus; after Resume the next trial starts; the CSV row for that practice trial is invalid |
| C2 | Main trial, stimulus on screen | As C1 | As C1 for the main trial; no correctness feedback |
| C3 | Between trials (fixation or interval) | As C1 | Paused; "No trial was on screen"; no trial is invalid |
| C4 | Optional break | As C1 | "Your break is paused"; Resume returns to the break |
| C5 | Already paused | As C1 | Still paused; nothing recorded |
| C6 | Practice | Press Tab repeatedly until focus leaves the page | Session pauses as in C1 or C3 |

For C1 and C2, record the CSV `invalid_reason`. Depending on which browser
event arrives first it is `visibility_lost` (page hidden), `interrupt`
(window lost focus), or `focus_lost`. Record the value per browser; any of
them satisfies the protocol (trial invalid, not a timeout, not repeated).

## Record

| Section | Browser / OS / AT | Date | Tester | Result | Notes and defects |
|---|---|---|---|---|---|
| A | | | | Not run | |
| B | | | | Not run | |
| C | | | | Not run | |
