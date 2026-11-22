# Round 3: desktop comics, the comic medium, and scenes

**Date:** 2026-11-22
**Question:** do comics get better when authors drop the phone limit and get the comic medium (Tracetoon #204), and better again with scripted genre scenes and trope parody (#205)?

**Review page:** `results/r3/review/index.html` (local; opens straight from disk in Chrome or Firefox). It shows:
- every pair head to head, with both orders' verdicts and reasons;
- the craft checklist per comic;
- each judge's reasons.

## The benchmark changed (v3)

Round 2's 1–5 scores couldn't rank comics:
- Humor was a 4 for 69 of 80 comics.
- 97% of the score variance came from 10 gated comics.
- For audience and relevance, the PR explained more of the score than the comic did.

Round 3 is judged with three new tools:
- **Arena (the headline):** two comics for the same PR side by side, judged in both orders. A criterion goes to one comic only when both orders agree. Win rates are case-clustered.
- **Craft checklist:** yes/no facts from the image, each with evidence: setting, punchline shape, and six "use of the medium" items.
- **Reference arm:** round 2's `main` comics, so later rounds stay comparable.

Validation on round 1 and round 2 comics showed the arena separates arms the old scores couldn't. Round 2's variety arm won visual 74% [61, 84] and lost "about this PR" 36% [26, 46].

## Setup

| | |
| --- | --- |
| Cases | `comic-cases@1.0.0`, dev split, 20 cases × 2 samples |
| Genre | `genres/space-opera.md` |
| Reference | `r2-main`: round 2's comics from Tracetoon main |
| `medium` | #204: no phone limit, effects vocabulary, new layouts, joke shapes beyond deadpan |
| `medium+scenes` | #204 + #205: 50 space-opera scenes offered 4 at a time, trope parody allowed |
| Model | Codex `gpt-6.2-sol` for authors, images and judges; `gpt-6.2-astra` re-judged 30% of reference pairs |

## Results

**Against the round 2 reference** (80 pairs each; win rate of the round 3 arm, ties count half):

| Criterion | `medium` | `medium+scenes` |
| --- | --- | --- |
| Overall | **82%** [77, 87] | **69%** [59, 80] |
| Use of the medium | **94%** [89, 99] | **96%** [93, 99] |
| Visual | **79%** [69, 88] | **83%** [74, 89] |
| About this PR | **74%** [64, 83] | **61%** [51, 71] |
| Funnier | 57% [48, 66] | 39% [26, 53] |

**`medium+scenes` against `medium`:**

| Criterion | Result |
| --- | --- |
| Overall | 39% [29, 49] |
| Funnier | **31%** [20, 43] |
| About this PR | 41% [29, 53] |
| Use of the medium | 62% [48, 75] |
| Visual | 56% [43, 68] |

**Craft checklist:**

| | r2-main | `medium` | `medium+scenes` |
| --- | --- | --- | --- |
| Office-like interior | 80% | 33% | **13%** |
| Medium use index (of 6) | 1.60 | **4.70** | **4.70** |
| Sound effects drawn | 10% | 93% | 98% |
| Shout, burst, whisper or radio balloon | 5% | 83% | 73% |
| Speed, impact or focus lines | 65% | 100% | 100% |
| Slanted, inset, borderless or breakout panel | 0% | 28% | 25% |
| Action or motion | 30% | 75% | 83% |
| Deadpan punchline | 20% | 8% | 13% |
| The picture carries the joke | 65% | 83% | 75% |
| Setting variety (entropy, bits) | 0.88 | 1.43 | **2.01** |
| Set (variety) score | 42.5 | 65.0 | 72.5 |

## What it shows

1. **Dropping the phone limit and adding the medium transformed the comics.** `medium` beats round 2 overall 82% of the time and on use of the medium 94%. The checklist shows why:
   - sound effects, shaped balloons and motion lines appear in nearly every comic;
   - office-like rooms fell from 80% to 33%;
   - deadpan punchlines from 20% to 8%.
2. **It made comics more clearly about their PR, not less** (74%). Bigger jokes still came from the PR's own mechanism: a window seat for a JavaFX window, a pen chained to a pillar marked "SignPath approval pending".
3. **Scenes delivered variety but cost humor.** `medium+scenes` has the most varied settings (13% office-like, 2.01 bits of setting entropy, 10 crowd scenes) and the best variety score. But it loses to `medium` on humor (31%) and overall (39%). The judges' reasons point to the cause: a scene comic fits the PR into a ready-made setting (a ribbon-cutting, a cantina, a medal ceremony), so the joke belongs to the scene, not the change.
4. **Two scenes dominated.** The cantina and the medal ceremony were each used 5 times. The benchmark gave each comic only the arm's last 5 comics as history, so the 10-comic scene rotation couldn't see further back, and authors favored the same crowd-pleasers among their 4 options.

## How far to trust the judges

- **Position bias:** "overall" and "funnier" verdicts flip with order more often (25–35 of 80 pairs) than "medium" (5–17). The arena counts a flip as a tie, so the reported win rates are conservative.
- **Second judge:**
  - Agreement on "overall" was moderate (κ 0.57 for `medium`, 0.32 for `medium+scenes`).
  - On "medium" it was low (0.14–0.27), even though the win rates are near-unanimous. When one arm wins almost every pair, κ is unstable.
- **Calibration:** pairwise controls put each broken copy against its original, on 5 of the reference's comics.

| Control | Target criterion | Original won |
| --- | --- | --- |
| `flat` (punchline stated plainly) | funnier | 5/5 |
| `swap` (joke about another PR) | about this PR | 5/5 |
| `wrongFact` | about this PR | 5/5 |
| `bland` (same joke, one plain room, no effects) | use of the medium | 5/5 |
| `offStyle` (photo-real render) | visual | 4/5 |

One photo-real render won "visual". That criterion should say it means comic art, not just a striking image.

## Follow-ups

- **#205: joke first, then scene.** The skill currently picks the scene before finding the joke. Reverse it: find the joke in the PR, then choose the scene that serves it, or none. Keep the scene library as inspiration, not a required stage. Rerun `medium+scenes` after the change.
- **Benchmark:**
  - Give rounds the arm's last 10 comics as history, so the scene rotation works as in production.
  - Reword the arena's "visual" criterion to judge comic art.
- **Merge order:** #204 stands on its own and is the clear win; land it first.

Raw rounds and arenas: `results/r3-medium`, `results/r3-scenes`, `results/arena-*` (local, not committed).
