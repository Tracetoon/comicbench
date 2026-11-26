# Round 14: brainstorm from random pitches, an optional meme, a fresh judge's pick

**Date:** 2026-11-26
**Review page:** `results/r14/review/index.html`. Each card has a Brainstorm section (pitches, all gags with scores, the pick, any meme).

## What changed

**Tracetoon (`comic-brainstorm`):**
- **Pitches:** the host draws 3 pitches at random from different gag families. A pitch is one of the research's 530 scenarios with its punchline removed (premises written by three subagents), plus the cast members who play it. Scenarios the lead plays are 3 times as likely.
- **Gags:** the author writes 2 gags per pitch about the PR. Only then may it attach a meme from the toolkit's 110 documented anime fantasy memes, where one fits.
- **The pick:** a fresh judge scores each gag 1–5 on about the PR, funny, veteran appeal and visual. The host picks the best weighted total; about the PR and funny count double. The author then scripts that gag.
- **Per-repo cooldowns:**
  - a scenario rests for 10 comics, on-page characters for 3, memes for 100;
  - the PR history now reads 100 PRs back;
  - in the bench, comics in flight count as the newest.

## Results

### Against r12-anime (80 of 80 pairs; win rate of r14)

| | Win rate |
| --- | --- |
| Funnier | 38% [26, 50] |
| About this PR | **17%** [9, 24] |
| Use of the medium | 43% [30, 57] |
| Visual | 51% [38, 63] |
| Veteran appeal | 43% [33, 53] |
| Overall | **20%** [11, 29] |

### The brainstorm worked as built

| Measure | Result |
| --- | --- |
| Pitches drawn | 115 pitches, 90 distinct scenarios |
| Gags written | 230 |
| Picked | 35 distinct scenarios in 19 families |
| Memes | attached to 25 of 230 gags (11%); 11 picks carry one; 0 repeats |
| Picks the lead plays | 25 of 39 |
| Run | 44 minutes, 0 errors |

### Problems found

- **The judge gave every pick top marks** for being about the PR: 4.97 of 5 on average (all gags: 25.0 of 30; picks: 28.5). It read each gag with the author's own `prLink` beside it, so it scored the stated intent, not what a reader could recover.
- **The comics turned into metaphors.** Arena reasons, case by case:
  - r12's pages showed the change itself: a "Code preview" label and its "e to expand" footer, a named Windows executable, a `level.py` callout.
  - r14's showed a fishing rig, a tent's paper blast, a household decree. Reviewers had to infer the change, and mostly couldn't.
- **Other measures fell:**
  - office-like settings rose to 28% (r12: 10%);
  - "the image carries the joke" fell to 75% (r12: 88%);
  - the assigned lead was the main character in 10 of 40 comics;
  - a meme was recognised on the page in 4 of 40.

## Against the plan's intent

| Goal | Result | |
| --- | --- | --- |
| Variety without ranking | 90 distinct scenarios drawn, 35 picked; 0 meme repeats | ✓ |
| Memes only where they fit | 11% of gags, 28% of picks | ✓ |
| The judge picks a better gag | ceiling scores; no discrimination | ✗ |
| Comics as good as r12 | overall 20%, about the PR 17% | ✗ |

## What we learned

1. **Starting from a random situation pushes the PR into metaphor.** Round 12's author started from the PR and built the scene around it, so the change appeared on the page. Here the author starts from an unrelated scenario and maps the PR onto it, and the mapping lives in `prLink`, not in the picture.
2. **A judge that reads the author's explanation can't measure clarity.** Judging must be blind: without `prLink`, can the judge say which change this gag is about?
3. **Variety and cooldowns are solved.** No repeats, wide spread, rare and fitting memes. The problem is the PR link.

## Next

- **Judge blind:** show the judge the gag without `prLink`, ask what PR change it depicts, and score about the PR on whether the answer matches. Rank the 6 gags against each other instead of scoring each independently.
- **PR first, then the pitch:** the author first names the one concrete thing from the PR that must be visible (a label, a file, a message), then brainstorms how each pitch shows it. The check can require it lettered on the page.
- **Keep:** the random pitches, the cooldowns and the optional memes.
