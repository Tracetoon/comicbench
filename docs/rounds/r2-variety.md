# Round 2: draw-cartoon on main vs the variety candidate

**Date:** 2026-11-22
**Question:** do the variety instructions (Tracetoon #203, stacked on #201) give more varied comics without making them worse?
- Phone-safe layouts other than vertical.
- Fresh character names, checked against `castNames` in recent comics.
- Prefer the less obvious premise when two concepts are equally clear.

**Review page:** [Comicbench Round Review](https://claude.ai/artifact/CTspMFtdk9u3W1ek2jYA1D) (private). It shows every comic with each judge's score and reason, the gates, what the phone reader could read, and the author's check runs.

## What changed in the benchmark since round 1

| | Round 1 | Round 2 |
| --- | --- | --- |
| Author | Codex read-only, files inlined, the runner ran the check | Codex `workspace-write` sandbox in the packet folder; the author read the files and ran the check itself (a bundled copy of the checker in the packet) |
| Recent comics | none | each comic saw the arm's five latest comics as `recentComics`, with the round's genre pinned |
| Rubric | v1 | v2: a competent comic is a 3, a 4 or 5 must name its strength, art style is judged against the requested style, relevance runs the swap test |
| Judges | one model | plus calibration controls, a second model (`gpt-6.2-astra`) on 30%, the same model again on 10%, and frozen anchors |

Rubric v2 scores are not comparable with round 1's.

## Setup

| | |
| --- | --- |
| Cases | `comic-cases@1.0.0`, dev split, 20 cases × 2 samples = 40 comics per arm |
| Genre | `genres/space-opera.md` |
| Arms | `main`: the draw-cartoon skill and checker on Tracetoon main (4b3bb6b plus `comic check --file`). `variety`: #203 on #201, with its checker (new `phoneLayout` order, name warning) |
| Model | Codex `gpt-6.2-sol`, medium reasoning, for the author, the image route and every primary judge |

## Results

| | main | variety |
| --- | --- | --- |
| Comic score (95% CI, case-clustered) | 70.3 [62.0, 77.4] | 69.2 [59.2, 77.2] |
| Set (variety) score | 42.5 | **65.0** |
| Headline | 64.7 | **68.3** |
| Cast variety (set judge, 1-5) | 2 | **5** |
| Premise variety / format variety | 3 / 3 | 3 / 3 |
| Names used in more than one PR | "Pell" 9, "Captain Venn" 7, "Pip" 7 and 7 more | "Relay" 2 |
| Layouts | vertical 13, custom 11, asymmetric 10, tiered 6 | vertical 19, asymmetric 14, tiered 7 |
| PRs whose two samples tell the same joke | 14 of 20 | 13 of 20 |
| First draft passed the check with no warnings | 4 / 40 | **25 / 40** |
| Check runs per comic | 2.30 | 1.43 |
| Gate failures | factual 1, phone 2, punch-up 2 | factual 1, phone 4 |

**Paired over the 20 cases, variety minus main:** −1.1 points [−14.8, 11.4]. Variety was higher on 7 cases, lower on 12, tied on 1.

## What it shows

1. **Fresh names work.** The `castNames` warning and the skill text removed the recurring cast: one name repeats across PRs, against ten in main. The set judge's cast score went from 2 to 5. That is most of the headline gain.
2. **Recent comics alone fixed the vertical collapse.** In round 1, 79 of 80 comics were vertical. With `recentComics`, main's existing repeat warning spread layouts across four families. The candidate's own layout changes didn't add variety beyond that: it drew more vertical comics (19 against 13).
3. **The comics themselves did not change measurably.** The −1.1 difference is well inside the noise.
4. **The candidate's layouts cost phone legibility.** All six phone failures across both arms are a small sign lettered with a PR term (`code.cmd`, `graphBrief`, `review run --all`, a file name) in a narrow panel. The candidate puts more comics in tiered and asymmetric shapes and failed twice as often (4 against 2). **Follow-up for #203:** in those layouts, a sign that carries a PR term goes in the wide panel.
5. **Samples still converge.** "Prefer the less obvious premise" did not change how often both samples of a PR tell the same joke (13 against 14 of 20).
6. **The author now works as designed.** In the sandbox it reads the files, writes both files and runs the check itself. The candidate's first drafts pass the check far more often (25/40 against 4/40), as #201's did in round 1.

## How far to trust the judges

**Calibration controls: all pass.** For 5 of main's comics, the judges saw a broken copy of each and had to rank the original higher.

| Control | What breaks | Noticed |
| --- | --- | --- |
| flat | the punchline stated plainly | 5 / 5 (humor drops) |
| swap | the joke rewritten about another PR | 5 / 5 (relevance drops) |
| wrongFact | one fact contradicts the brief | 5 / 5 (factual gate or fidelity) |
| tiny | the page shrunk to a third, so lettering is a third of its size | 5 / 5 (phone gate fails) |
| offStyle | a photo-real render | 5 / 5 (art style drops) |

The first `tiny` control asked the image model for a one-row strip on a 3:1 page. The model redrew it as an ordinary readable page, so it caught 1 of 5. It is now built mechanically from the original page.

**Agreement between models is low on the criteria that decide rankings.**

| Criterion | α main | α variety | Mean gap, astra minus sol |
| --- | --- | --- | --- |
| Humor | 0.52 | 0.00 | +0.1 to +0.2 |
| Relevance | 0.15 | 0.19 | +0.25 |
| Fidelity | 0.09 | −0.45 | **+0.6 to +0.75** |
| Audience | 0.67 | 0.51 | 0 to +0.2 |
| Clarity | 0.61 | 0.78 | −0.1 to +0.25 |
| Genre | 0.65 | 0.66 | 0 to +0.25 |
| Art style | 0.67 | 0.57 | +0.15 |

12 comics per arm were re-judged by `gpt-6.2-astra`, and 4 per arm by the same model again. Gate verdicts agreed on all 24. The low α values come mostly from range restriction, not disagreement:
- Nearly every comic scores 4 on humor, relevance and fidelity.
- The models differ by under half a point on average.
- So there is little spread for agreement to show.

Rubric v2 moved art style off 5.0 but did not spread the scores. Genre (4.65-4.75) and art style (4.58-4.65) still sit near the ceiling. Astra is consistently more lenient on fidelity.

**What this means:** the judges reliably detect a broken comic, but they don't yet rank good comics against each other. A difference between arms under about 10 points shouldn't be read from these scores.

**Anchors:** six of main's comics are frozen locally under `anchors/` (two low, two middle, two high), with reference scores from three judge runs. They show the ceiling too:
- Across three runs, the lowest anchor averages 3.3 on humor and clarity; the other five average 4.0 on humor.
- Genre and art style are 4 to 5 on every anchor.

Later rounds re-judge them with `comicbench anchors check` and flag a criterion whose mean moves more than 0.3.

## Follow-ups

- **#203:** in tiered and asymmetric layouts, put PR-term signs in the wide panel; then rerun the candidate arm.
- **Judges:** spread the top of the scale for humor, relevance and fidelity. Options: comparative judging (pairs of comics for the same PR) instead of absolute scores, or anchor examples of a 3, 4 and 5 drawn from the anchors.
- **Samples:** sample-level divergence needs more than an instruction, for example giving the second sample its first sample's premise to avoid.

Raw rounds: `results/r2-main`, `results/r2-variety` (local, not committed).
