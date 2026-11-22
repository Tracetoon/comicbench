# Round 1: draw-cartoon on main vs Tracetoon #201

**Date:** 2026-11-22
**Question:** do #201's two instructions improve the comics?
- Anchor visuals must be lettered.
- A half-width panel holds about 40 characters on a phone.

## Setup

| | |
| --- | --- |
| Cases | `comic-cases@1.0.0`, dev split, 20 cases × 2 samples = 40 comics per arm |
| Genre | `genres/space-opera.md` |
| Arms | the `tracetoon-draw-cartoon` skill on Tracetoon `main` (4b3bb6b) vs the same skill with #201's SKILL.md; references identical |
| Model | Codex `gpt-6.2-sol`, medium reasoning, for the author, the image route and every judge |
| Author | brief-only input (no diff), Codex read-only sandbox, up to 3 tries with `comic check --file` feedback |
| Rubric | v1 |
| Bias | the author's check used the brief alone as evidence in this round, not the diff. A term found only in the diff drew a warning in both arms. Fixed since |

## Results

| | main | #201 |
| --- | --- | --- |
| Comics judged | 40 | 40 |
| Comic score (95% CI, case-clustered) | 81.8 [76.6, 85.7] | 78.2 [70.8, 84.5] |
| Set (variety) score | 42.5 | 42.5 |
| Headline | 74.0 | 71.0 |
| First draft passed `comic check` with no warnings | **1 / 40** | **31 / 40** |
| Author tries per comic | 2.67 | 1.23 |
| Gate failures | factual 1 | factual 1, phone 1, punch-up 1 |
| Humor (mean, 1-5) | 3.73 | 3.75 |
| Relevance | 4.80 | 4.92 |
| Fidelity | 4.42 | 4.35 |
| Art style | 4.97 | 5.00 |

**Paired over the 20 cases, #201 minus main:** −3.7 points [−11.8, 4.2]. #201 was higher on 8 cases, lower on 9, tied on 3.

## What it shows

1. **#201's instructions change the author's behavior strongly.** First drafts that pass the check rose from 1 in 40 to 31 in 40, and tries fell by half. Fewer feedback rounds mean less time and quota per comic.
2. **They do not change the finished comics measurably.** With the check's feedback loop, the old instructions reach the same place. The −3.7 difference is inside the noise; #201's three gated comics (scored 0) account for most of it.
3. **Variety is the weakest dimension in both arms (42.5).**
   - **Samples converge.** Most same-case sample pairs tell the same gag, so the set judge clustered them together.
   - **The cast repeats across PRs.** "Captain Venn", "Pell" and "Pip" recur in different cases. In production, `recentComics` would steer away from repeats; benchmark comics are written independently.
   - **Every layout is vertical.** 39 of 40 (main) and 40 of 40 (#201) comics use the vertical family. The check's phone-fit warning recommends "use the vertical family", and #201's phone rule says the same, so layouts collapse to one shape.
4. **The judges need calibration.**
   - **Ceilings:** art style sits at 4.97–5.00 and relevance near 4.9, so they barely discriminate. Humor (about 3.7) is where comics differ.
   - **Missing pieces:** anchor comics, judge controls and a second judge family are still to build (plan: "Keeping points comparable").

## Follow-ups

- **Instructions:**
  - Ask for layouts other than vertical that still fit a phone (tiered, with full-width text panels), so the phone rule doesn't collapse layouts to one shape.
  - Ask for character names nobody has used before.
- **Benchmark:**
  - Give each comic the round's earlier comics as `recentComics` (as production does), or score variety per case pair and across cases separately.
  - Calibrate the judges with anchor comics before comparing rounds on small effects.

Raw rounds: `results/r1-main`, `results/r1-pr201` (local, not committed).
