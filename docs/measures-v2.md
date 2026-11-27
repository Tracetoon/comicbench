# Measures v2: calibrated judges, one scale anchored to real comics

**Date:** 2026-11-27
**Code:** `scripts/score-v2.ts`, `src/measures-v2.ts`, `src/judge-family.ts`, `scripts/calibrate-humor.ts`, `scripts/fetch-nycc.ts`, `scripts/anchors-prep.py`
**Results:** `results/measures-v2/baseline.json` (local)

## Why

The old measures could no longer guide tuning:
- **Per-comic humor** scored exactly 4 (of 5) for 37–40 of every 40 comics in r12–r18.
- **The arena** tied 30–46% of pairs. Almost every tie was an order flip: in r17 vs r18 the judge picked the *second* image in both orders 32 of 80 times. Win rates sat near 50% with CIs of about ±10 points.
- **Calibration** only checked that judges catch deliberately broken copies; nothing tested ranking good comics, and nothing referred to human judgment or real comics.

## Rule change

AGENTS.md: our comics are still scored only by AI judges, and the owner's notes never become scores. Published human-rated datasets and openly licensed real comics may now calibrate and validate the judges (kept under `.comicbench-cache/calib/`, never committed).

## Calibration

### 1. Humor against human judgment

- **Data:** the New Yorker Caption Contest "ranking from pixels" test pairs (Hessel et al. 2023, CC BY 4.0): a cartoon and two captions, one the contest winner or the crowd's clear favourite. 100 pairs.
- **Formats:**
  - **pair:** both captions, both orders;
  - **score:** each caption rated 0–100 alone.

| Judge | Format | Agrees with humans | Same slot in both orders |
| --- | --- | --- | --- |
| Codex | pair | **76.5%** | 5 of 100 |
| Codex | score | **76.5%** | (no order) |
| Claude (Opus 5.5) | pair | **75.5%** | 11 of 100 |
| Claude (Opus 5.5) | score | **76.0%** | (no order) |

**Reading:**
- Both families pick the funnier caption about three times in four (chance: 50%).
- On captions, position bias is small.
- So the order bias in the old arena comes from comparing two near-identical comic pages, not from judging humor itself.

### 2. Real comics as anchors

- **The set:** 18 openly licensed, human-made gag comics, kept local, each checked against its licence page:
  - 6 Pepper&Carrot pages (CC BY 4.0);
  - 6 classic xkcd strips (CC BY-NC 2.5; internal, non-commercial evaluation);
  - 6 public-domain newspaper strips from 1916–1924 (Mutt and Jeff, Krazy Kat, Bringing Up Father, The Katzenjammer Kids).
- **Preparation:** each is trimmed to its inked area and resized to 760 px wide, the width our comics are judged at.

### 3. Ladder controls (on the real comics)

Each anchor was judged against two degraded copies of itself, both orders, by both families:
- **no payoff:** the last panel whited out;
- **flat:** grey, blurred and washed out.

| Control | Codex | Claude |
| --- | --- | --- |
| No-payoff copy loses on humor | 36/36 | 36/36 |
| No-payoff copy loses overall | 36/36 | 36/36 |
| Flat copy loses on craft | 36/36 | 36/36 |

This is a floor: the judges track real quality on real comics when the difference is large. The caption result above is the fine-grained evidence.

## The scale

- **The fit:** a Bradley-Terry fit with a **position term per source**, so the judge's lean toward one slot is estimated and removed, not turned into ties. Ties are not allowed in new games.
- **The zero point:** 0 is the average real anchor comic; a score converts to "chance of beating an average real comic".
- **The data:**
  - **Anchor games:** every comic against 3 seeded anchors, both orders, Codex. Claude re-judges a seeded 20% for agreement.
  - **Within-PR games:** the existing arena verdicts between the scored rounds, reused (both orders).
  - **Relative-only criteria:** about this PR and veteran appeal come only from within-PR games, so their scale is relative (0 = the average comic scored).

### Does it spread?

| Criterion | Spread (SD, logits) | Codex–Claude kappa | Position lean: anchor games | Position lean: old arena |
| --- | --- | --- | --- | --- |
| Funnier | **2.81** | 0.59 | +0.20 | −1.29 |
| Craft | 2.05 | 0.56 | +0.24 | −0.81 |
| Medium | 2.76 | 0.63 | −0.52 | −1.35 |
| Overall | 2.09 | 0.52 | −0.12 | −1.53 |
| About this PR | 2.90 | (arena only) | — | −0.25 |
| Veteran appeal | 2.46 | (arena only) | — | −1.28 |

- **Spread:** humor now spreads across about 3 logits. Under the old rubric it was a constant 4.
- **Position bias:** the old arena leaned hard toward the second image (−1.3 logits, about a 79/21 split on a close call). In anchor games the lean is small, and in both cases the fit removes it.
- **Agreement:** the two families agree moderately (kappa 0.52–0.63).

## Past rounds, re-scored (no new images)

Mean score per round with a 95% case-bootstrap CI, and the chance its average comic beats an average real comic:

| Round | Funnier | Overall | Medium | Craft |
| --- | --- | --- | --- | --- |
| r12-anime | −1.63 [−2.49, −0.81] · 16% | −2.01 · 12% | 0.11 · 53% | 2.14 · 90% |
| r13-anime | −2.30 [−3.09, −1.50] · 9% | −3.63 · 3% | −1.26 · 22% | 2.13 · 89% |
| r16-plain | −1.07 [−2.19, 0.03] · 26% | −2.52 · 8% | 1.69 · 85% | 1.04 · 74% |
| r17-plain | −0.84 [−1.82, 0.15] · 30% | −1.99 · 12% | 1.51 · 82% | 1.51 · 82% |
| r18-plain | −1.02 [−1.72, −0.33] · 26% | −2.07 · 11% | 1.32 · 79% | 2.24 · 90% |

Relative only (within-PR games):

| Round | About this PR | Veteran appeal |
| --- | --- | --- |
| r12-anime | **0.83** [0.15, 1.47] | 0.54 |
| r13-anime | −0.78 | 0.62 |
| r16-plain | −0.03 | −0.74 |
| r17-plain | 0.33 | −0.58 |
| r18-plain | −0.35 [−1.17, 0.52] | 0.15 |

## What it tells us

1. **The headroom is humor and the whole comic, not the art.**
   - Our comics beat an average real comic on craft about 90% of the time. That partly reflects the anchors: century-old strips and xkcd's stick figures, against polished AI art.
   - On humor they win only 16–30%, and overall 3–12%.
   - The gap to real gag comics is the joke, not the rendering.
2. **Rounds 16–18 are about equal.** Their humor and overall CIs overlap almost entirely. r13 is clearly worst. The old arena's "r18 funnier than r12 (60%)" holds in direction (−1.02 vs −1.63), but the CIs overlap.
3. **Use of the medium improved and held** from r16 on (85/82/79% vs r12's 53%): the layout work paid off.
4. **About this PR has slid since r12.** r12 is the best round, and r18 sits below it. This is the case for round 19's payoff-panel anchor.
5. **Veteran appeal dipped in r16–r17 and recovered in r18** (the staples).

## Caveats

- **Craft:** "beats real comics" on craft says little, because the anchors differ in era and medium. Read craft only between our own rounds.
- **About this PR and veteran appeal** come only from the old arena games, relative to each other, with Codex alone.
- **Ladder controls** test large breaks only; ranking among good comics rests on the caption calibration (about 76%) and the families' agreement (kappa about 0.55).
- **Sample:** 20 dev cases × 2 samples per round; the sealed split stays sealed.

## Layout fidelity (round 18 study)

- **The finding:** the add-on graded layout against the panels' motion ("action beats in angled, borderless or breakout frames"), not against the prompt, which since round 18 slants at most one gutter and none on calm pages.
- **The fix:** add-on v7 reads the prompt's own slant clause.
- **Round 18 re-graded:**
  - layout followed **38/40** (was 23/40);
  - the asked slant drawn on **29/29** pages, the other 11 asked for none.
- **The real misses:** row heights drift a few points, and breakouts are drawn that our impact wording implied. The round-19 layout sentence addresses both.
