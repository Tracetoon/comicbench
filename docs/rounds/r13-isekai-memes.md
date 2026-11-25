# Round 13: a required gag scene from the research meme pool, matched to each isekai cast

**Date:** 2026-11-25
**Review page:** `results/r13/review/index.html`, with r12-anime and r13-anime and their head-to-head.

## What changed

**Tracetoon (`comic-isekai-memes`, stacked on `comic-isekai`):**
- **The pool:** the owner's research agent wrote 530 anime gag scenes, five per isekai archetype. Each has cast slots, conditions and an evidence-based priority (`docs/research/` in Downloads; shipped as `src/comic/isekai/memes.json`).
- **The matcher:** the agent's `match_memes.py` is ported to TypeScript. It matches the original's suggestions, scores and slot assignments on 600 parity cases.
- **The offer:** at the packet step each isekai comic gets three scenes its cast can perform, matched to the PR text:
  - only scenes that fit the page;
  - scenes the lead plays first;
  - distinct gag families;
  - no recent repeats;
  - topped up by priority when fewer than three match.
- **Required:** `comic check` fails a comic without one of its offered scenes, or without the scene's players on the page.
- **Fixes:** the Format and Layout lines end with exactly one period.

**Comicbench (`round-13`):**
- The packet carries the scene offer.
- The checklist reports scene use, lead scenes, families and tiers.
- Arena calls stop at 10 minutes and get one retry.
- The canary accepts scene ids. Its first version read them as memes outside the offer and stopped the run.

## Results

### Against r12-anime (80 of 80 pairs; win rate of r13)

| | Win rate |
| --- | --- |
| Funnier | 41% [29, 52] |
| About this PR | **33%** [20, 46] |
| Use of the medium | 33% [23, 44] |
| Visual | 49% [37, 61] |
| Veteran appeal | 52% [37, 66] |
| Overall | **29%** [18, 41] |

Respect forfeits are zero. No arena call failed.

### The scenes

- **Used:** 40 of 40 comics, all from the offer; 35 played by the lead; 33 distinct scenes in 19 families. Seven comics repeated a scene, because comics drawn in parallel don't see each other's picks.
- **Tiers:**
  - offered: 18 tier 1, 7 tier 2, 94 tier 3;
  - used: 8 tier 1, 1 tier 2, 31 tier 3.
- **A recognisable meme on the page:** **7 of 40** (r12, with no memes offered: 5 of 40).

### The cast and the page

| Measure | r12 | r13 |
| --- | --- | --- |
| Archetypes recognised | 92% | **75%** |
| Distinct silhouettes | 40/40 | 34/34 |
| The place on the page | 38/40 | 40/40 |
| A clear main character | 34/40 | 34/40 |
| The assigned lead is that main character | 21/40 | 15/40 |
| Medium index | 4.47 | **3.88** |
| Office-like | 10% | 23% |
| Prompt lint hits | 0 | 0 |
| Misread | 2 redrawn | 1 redrawn; 0 gated |

The medium fell on action: action or motion in 20% of comics (r12: 60%).

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| A meme scripted in 40/40 | 40/40 | ✓ |
| A recognisable meme on the page in at least 70% | 18% | ✗ |
| Veteran appeal at least 55% | 52% | ✗ (tie) |
| Funnier and overall at least 50% | 41% and 29% | ✗ |
| Visual at least 45% | 49% | ✓ |
| Archetype reads at least 85% | 75% | ✗ |
| At least 30 distinct scenes and 20 families | 33; 19 | ~ |
| Lead scenes in at least 60% | 35/40 | ✓ |
| Zero prompt-lint hits, misread concerns, respect failures | 0; 0; 0 | ✓ |
| Run under 1 hour | 54 min, including a 27-minute canary stop | ✓ |

## What we learned

1. **A required scene pulls the comic away from the PR.** About this PR fell from 61% (r12 against r11) to 33% against r12. Authors bent the PR's story to fit a pre-written scene.
2. **The scenes are not memes viewers recognise.** The research says so itself: they are "original scene adaptations, not a collection of already-viral posts". 78% of the scenes used are tier 3 (canon-anchored, no online evidence), and a recognisable meme is on the page in 7 of 40 comics. Veteran appeal only reached a tie.
3. **Scenes flatten the page.** Action fell from 60% to 20%, office-like settings rose from 10% to 23%, and archetype reads fell to 75%. Many scenes are paperwork, logistics or household gags.
4. **The machinery works.** Matcher parity, the offer, the check, no prompt-lint hits, and the arena with zero failed calls.

## Next

- Make the scene optional again: offer it as inspiration, used when its cause and payoff fit the PR.
- Offer only tier 1 and tier 2 scenes (documented meme families), or weight them far above tier 3.
- Share recent picks across comics drawn at the same time, so parallel comics don't repeat a scene.
