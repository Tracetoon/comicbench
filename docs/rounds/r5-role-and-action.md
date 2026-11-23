# Round 5 — Make the action, cast, and page serve the joke

## Question

Does a shorter, story-led rewrite help Tracetoon draw space-opera comics with
clearer genre roles, stronger visual beats, and conflict that belongs to the
change? In Round 4, Broad produced more space exteriors and more motion, yet
ships often served as scenery. Every Broad script that specified dynamic
frame geometry got it on the page. That points to concept selection as the
first place to intervene. Character descriptions also repeated a recognizable
look, and the authored identity details rarely reached the page.

The rewrite starts from what the software makes visibly happen. It asks
authors to explore a battle when opposing craft can make that behavior clear,
build recognizable roles through action and design, and choose framing and
effects for the payoff. The same genre file is used in both arms. The
benchmark keeps observations about these choices out of the author packet.

## Setup

| | |
| --- | --- |
| Cases | `comic-cases@1.0.0` dev split, twenty cases with two samples per arm |
| Broad | Exact Round 4 Broad author skill and space-opera genre |
| Rewrite | Revised draw-cartoon skill and references, with the same genre as Broad |
| Runtime and image route | Round 4's shared Tracetoon checkout, Codex page lettering with `gpt-6.2-sol` at medium effort |
| Author | `gpt-6.2-sol` at medium effort, tool-free inline packets, the same seeded order and six workers per arm |
| Judges | `gpt-6.2-sol`, plus `gpt-6.2-astra` on the existing 30% arena sample |
| Rubric | v5, arena v2, checklist v3 |

The Broad skill, genre, and shared runtime hashes matched the Round 4
manifest before the rewrite. The new checklist traces proposed, scripted,
and drawn space conflict, compares resolved frame geometry to the image,
and records evidence for role readability and story-serving effects.
Representation and cast-design observations are descriptive.

## Calibration

The primary judge matched the checks on the drawn duel, backdrop-and-title
control, visible-command control, and two archived Broad pages. It
distinguished the scripted fleet engagement from the fleet that was merely
visible in the image, and it distinguished a tilted horizon from angled
frame edges.

Both arms completed an end-to-end smoke on the JavaFX launch case. Both
scripts passed the checker, both pages rendered, and their evidence and
arena comparison loaded in the offline review. The smoke exposed a bug
in quoted evidence matching. The matcher now accepts quotation marks
around a literal script excerpt, and the smoke report was recovered from
the original judge reply.

## Results

All 80 comics rendered and were judged. The arena completed the 80 same-PR
pairs and the 24 second-judge pairs. The win rates are for Rewrite, with
ties counting half and 95% intervals resampled by case.

| Criterion | Rewrite win rate | 95% interval |
| --- | ---: | ---: |
| Overall | 37.5% | 27.5–47.5% |
| Humor | 46.9% | 34.4–58.1% |
| About this PR | 45.0% | 31.9–58.8% |
| Use of the comic medium | 11.3% | 4.4–20.6% |
| Visual | 72.5% | 63.8–80.6% |

The primary judge preferred Broad overall. Humor and PR relevance remain
inconclusive. The second judge also favored Rewrite on visuals and Broad on
use of the medium on the paired sample. The two judges had near-zero visual
agreement on individual verdicts (κ −0.02), even with the same direction in
aggregate. On that sample, Rewrite's second-judge win rates were 77.1% for
visuals, 6.3% for use of the medium, and 47.9% overall.

Both arms had zero respect failures. One Broad comic failed the factual
gate because its payoff implied a keystroke took effect in the broken macOS
flow. The result remains in the diagnostics, and all arena pairs were assessed.

### The drawings got clearer and the scripts got quieter

| Evidence, out of 40 comics per arm | Broad | Rewrite |
| --- | ---: | ---: |
| Scripts with sound effects | 36 | 7 |
| Scripts with panel effects | 40 | 23 |
| Scripts with dynamic frame geometry | 4 | 0 |
| Pages with sound effects | 36 | 7 |
| Pages with special balloons | 31 | 17 |
| Pages with dynamic frame geometry | 5 | 2 |
| Pages with story-relevant motion | 37 | 20 |
| Mean use-of-the-medium checklist, out of 6 | 4.73 | 2.58 |

On the learner replay case, both presentation orders praised Rewrite's
clear silhouettes, larger lettering, and the readable path of the unfolding
code ribbon. Both preferred Broad's keypress close-up, oversized “FWIP,”
and exterior reveal for how the page carried the same action. The graphics
worked differently for each criterion within the very same pair.

Broad's four scripted dynamic pages all rendered a dynamic frame. Rewrite
specified none. The loss of sound effects also tracks their absence in the
scripts. This puts the observed craft loss before rendering. A plausible
explanation is that moving the concrete craft vocabulary out of the main
skill reduced how often authors reached for it. The combined comparison
cannot isolate that edit from the other changes. The evidence supports
testing Rewrite's visual clarity alongside Broad's explicit craft guidance.

### Space conflict

Rewrite's concepts, scripts, and pages had zero observed spacecraft
engagements. Broad had one across all three stages, on `pr11#2`, where a
living flagship responds to a shuttle's surrender sign and deflates. Neither
arm produced a fleet engagement or fighter duel. Rewrite's gap is already
visible in the concept notes, before premise selection or rendering.

### Cast and role evidence

| Evidence | Broad | Rewrite |
| --- | ---: | ---: |
| Scripts with an explicit background and a verified excerpt | 16/40 | 6/40 |
| Background labels in those scripts | Black 16 | Black 5, South Asian 1 |
| Visible variation in skin tones or features | 21/40 | 33/40 |
| Dark skin with silver or white hair on the finished page | 10/40 | 19/38 |
| Evidence for the intended central genre role | 40/40 | 40/40 |
| Reader-visible LGBTQ+ cues | 0/40 | 0/40 |

The rewrite increased variation in the cast's appearance and also increased
the specific repeated design raised during review. Two Rewrite pages were
unassessed for that design observation. Identity labels in the table come
from the scripts. The appearance rows describe the images.

The role and story-beat checks reached the ceiling in both arms. The judge
could find a supporting cue for each intended role and for each craft
category on every page. These checks provide useful examples, with little
ability to distinguish how readable the roles or how strong the effects are.
The ten-page view found no reader-visible LGBTQ+ cues in any block in either
arm.

Open `results/r5/review/index.html` directly from disk for the comics and
their stage-by-stage evidence. Raw outputs are under `results/r5-broad`,
`results/r5-rewrite`, and `results/r5`.
