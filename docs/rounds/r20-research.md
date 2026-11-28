# Round 20: research results

**Date:** 2026-11-28
**Follows:** `docs/rounds/r19-evaluation.md` (the seven research paths)
**Scored with:** measures v2, now with three anchor families: developer (xkcd, Geek&Poke), fantasy (Pepper&Carrot, Mini Fantasy Theater) and classic (1916–1924 newspaper strips). It also has PR-context games for "about this PR" and veteran appeal.
**Judges:** the scores come from Codex games; Claude re-judged a seeded sample, which agrees on 79–90% of comparisons (see "Second judge family").

## What ran

| Path | What | Size |
| --- | --- | --- |
| 7 | Quick fixes: BOM tolerance, `leadLook` limit documented, `tropeOffer` named, hate symbols force a redraw, lettering check, check-run counter, misread on the judge lane | code |
| 6 | Script judge validated on r12–r19 | 600 games |
| 6 | 20 new anchors (10 developer, 10 fantasy) | 38 anchors |
| 2 | Picker accuracy on r12–r19 draft pairs | 120 pairs |
| 1, 3, 4, 5 | Six script-only arms (A control, J joke rules, M material step, P PR carrier, S setting choice, T no staples) | 240 scripts, 1,168 script games |
| 20 | Drawn: A, J, P, both samples | 120 comics |

## Results

### Script stage (scripts only; the script judge)

| Arm | Funnier | About this PR | Overall |
| --- | --- | --- | --- |
| A, control | **+2.60** | −1.72 | −0.58 |
| J, joke rules | −0.26 | +0.14 | **+0.73** |
| M, J + material step | +0.27 | −1.22 | −0.23 |
| P, J + PR carrier | −1.52 | **+2.33** | +0.61 |
| S, P + setting choice | −1.36 | +1.99 | +0.60 |
| T, J + no staples | +0.27 | −1.52 | −1.12 |

**Dropped at the script stage:**
- **M:** the material step was worse than J alone.
- **T:** removing staples was worst overall, so staples stay.
- **S:** setting choice equalled P without beating it.

### Drawn (measures v2, 95% case-bootstrap CI; 0 = the average real anchor)

| | r12 | r18 | r19 | A | J | P |
| --- | --- | --- | --- | --- | --- | --- |
| Funnier | −3.63 | −2.85 | −3.47 | −3.93 [−4.74, −3.11] | −4.60 [−5.43, −3.84] | −5.51 [−6.38, −4.61] |
| Overall | −2.96 | −2.89 | −3.28 | −3.80 | −4.48 | −5.60 [−6.26, −4.96] |
| Medium | 2.30 | 3.60 | 4.79 | 3.97 | 2.51 | 3.15 |
| Craft | 1.69 | 1.70 | 1.41 | 1.06 | 0.70 | 0.06 |
| About this PR (relative) | 1.05 | −0.05 | −1.05 | −1.07 [−1.63, −0.54] | −0.75 | **+1.36 [0.78, 1.85]** |
| Veteran appeal (relative) | 0.44 | 0.21 | 0.45 | −0.09 | −0.29 | 0.06 |

**Humor by anchor family** (chance of beating an average comic of that family):

| | Developer | Fantasy | Classic |
| --- | --- | --- | --- |
| r18 | 0.1% | **55%** | 29% |
| r19 | 0.1% | 40% | 18% |
| A | 0% | 29% | 12% |
| J | 0% | 17% | 7% |
| P | 0% | 8% | 3% |

**Craft by family:** our comics beat developer and classic strips 99%+ of the time and lose to the painted fantasy strips (0.1–0.5%).

### Picking the better of two drafts

| Picker | r12–r19 (120 pairs): share of best-possible gain | r20 (60 pairs) |
| --- | --- | --- |
| Page, funnier | **75%** (+1.07 logit) | **69%** (+0.84) |
| Script, funnier | 63% | 34% |
| Page, about this PR | 85% (inflated: same judge as the reference) | 44% (independent reference) |
| Page, overall | 42% | 29% |

## What we learned

1. **Writing joke rules does not make jokes funnier.**
   - The r19 study found that the funniest comics end on a line that reinterprets the PR's mechanism. That was correlation.
   - As a rule (J), it made no detectable difference on the page: −4.60 [−5.43, −3.84] against the control's −3.93 [−4.74, −3.11], with overlapping CIs. Claude, on its sample, even slightly preferred J on humor (9/34 vs 4/44 wins against real comics).
   - At the script stage J lost clearly (−2.9 logits), but that came from the script judge rewarding quirk endings, not from the page.
   - Like the last-panel anchor rule, a craft rule gets compliance, not wit.
   - *(Corrected after the Claude check: an earlier draft said the rules lowered humor on the page too.)*
2. **Stating the PR plainly makes comics clearly about the PR and much less funny.**
   - P is the most recognizable round yet (+1.36 vs −1.07 for the control, CIs apart).
   - It is the least funny and the lowest overall.
   - The trade-off seen in r19 (humor vs about this PR, r = −0.17) is causal, not incidental.
3. **Picking works, and works best on the finished page.**
   - A page judge choosing the better of two drawn comics captures about 70% of the best-possible humor gain on both datasets (+0.8 to +1.1 logit). That's the largest reliable gain found in this research.
   - Picking at the script stage is weaker and less stable (63% → 34%). Script-level humor rewards character-quirk endings that lose on the page.
4. **The fantasy family is the fair humor reference.**
   - Against developer gag strips our comics almost never win.
   - Against fantasy gag strips, r18 is at 55% and r20's control at 29%.
   - Rounds 19 and 20 fell on this measure, so humor has slipped since r18.
5. **The control fell slightly short of r19** (within noise on humor and craft, nearly significant on medium). Candidates:
   - the payoff rule becoming a warning;
   - the script-stage reruns under load;
   - plain sampling noise.

## Recommendations

1. **Production: draw two pages and let a page judge pick.**
   - Expected gain is about +0.8 logit on humor, at the cost of a second image and one judge call.
   - Script-level picking is the cheaper fallback, at about half the gain.
2. **Do not ship the joke rules (J) or the plain-statement rule (P) as written.**
   - Test P's parts separately: "the command named among the anchor terms" and "fantasy documents allowed" are cheap and may keep most of the recognizability, while "state the change plainly in one line" is the likely humor cost.
3. **Humor needs selection, not instruction.**
   - Generate several premises or punchlines per PR.
   - Have a humor judge choose; Codex and Claude agree with human caption rankings 76% of the time.
   - Draw only the winner, then pick between two drawn pages.
4. **Measure against the fantasy family for humor and our own rounds for craft;** keep the developer family as a ceiling.
5. **Find out why r19 and r20 lost humor against r18** (fantasy family 55% → 40% → 29%). Compare r18 with r19 on the same PRs: the adventure settings and the staple changes are the suspects.

## Second judge family (Claude)

A seeded 10% sample of round 20's anchor games (126 games), plus the existing 318 Claude games on rounds 12–19:

| Criterion | Round 20 agreement (kappa) | Rounds 12–19 agreement (kappa) |
| --- | --- | --- |
| Funnier | 83% (0.65) | 82% (0.64) |
| Craft | 90% (0.81) | 81% (0.62) |
| Medium | 79% (0.59) | 80% (0.59) |
| Overall | 87% (0.75) | 79% (0.57) |

- Both families agree about four comparisons in five, round after round.
- **On the arm results:**
  - Claude confirms P as the weakest on overall (0/48 wins against real comics) and humor (1/48).
  - It does not support J being below the control (see finding 1).
- **Not yet covered by Claude:** the PR-context games (about this PR, veteran appeal).

## Caveats

- **Second family:** Claude covers a 10% sample of round 20 and has no PR-context games yet.
- **Anchor style:** each new family comes from one artist, so the judge may partly track house style.
- **Sample size:** 20 dev cases; the sealed split is untouched.
- **About this PR and veteran appeal** are relative scales, with no real-comic anchor.
