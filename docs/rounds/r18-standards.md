# Round 18: comic-standard layouts, balloon order, and isekai staples

**Date:** 2026-11-27
**Review page:** `results/r18/review/index.html`
**Layout preview:** `docs/rounds/r18/grid-signatures.png`

## What changed (against round 17)

**Layouts follow sourced comic conventions** (MediBang, Clip Studio EN/JP, GlobalComix, Abel & Madden, Cohn 2013, Shanower, Jim Shooter's memo):
- column layouts open with the tall panel on the left (tall-right structures removed);
- stacked bands stagger their gutters (no four-way crossings);
- only vertical gutters slant, at most one per page, beside the peak action beat;
- tier gutters are 1.5× column gutters;
- the prompt states every border outright.

**Balloon order:** each panel's first speaker stands left of later speakers (checked).

**Isekai staples:** 34 staples (summoning, the aptitude crystal, the status window, absurd stats…), each confirmed in 3+ series.
- Each comic is offered 3 tropes (2+ staples, then a meme), optionally.
- Staples rest 10 comics, memes 100.

**Leads** rest 10 comics, up from 3.

## Results (80 of 80 pairs per head-to-head; win rate of r18)

| | vs r12-anime | vs r17-plain |
| --- | --- | --- |
| Funnier | **60%** [46, 73] | 43% |
| About this PR | 39% [28, 51] (r17: 44%) | 45% |
| Use of the medium | **63%** [48, 78] | 48% |
| Visual | 50% [36, 64] (r17: 47%) | **59%** [44, 74] |
| Veteran appeal | **51%** [38, 64] (r17: 36%) | **56%** [44, 68] |
| Overall | 49% [38, 59] (36 of 80 tied) | 47% [35, 58] |

**Medium index:** 4.85 (r17 5.13; r12 4.47).

## Page checks

| Measure | Result |
| --- | --- |
| Pages filled (outer margin ignored) | **40/40** |
| Balloon order clear and right | **40/40** |
| Slants per page | 0 on 11 pages, 1 on 29, never 2 |
| Horizontal slants | 0 (by construction) |
| Tall-right column layouts | 0 |
| Slant drawn where asked | 27/40 |
| Page follows its layout | 23/40 (r17: 31/40) |
| Distinct structures | 12; top `rows:2-2` (staggered) at 15% |
| Panel motion | 103 still, 21 move, 22 impact |
| Bodies drawn as presented | 23/25 |
| Archetypes recognised | 50/56 (89%) |
| Prompt lint, misread | 0, 0 redrawn |

## Tropes

- **Offers:** every comic was offered 3 tropes, 33 distinct staples in all.
- **Used:** 5 of 40 comics built on one. Four were staples, each used once: the summoning ceremony, the aptitude crystal, the appraisal skill and the system voice. One was a meme.
- **Recognition:** a recognisable genre meme or staple was on the page in 7 of 40 comics.

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| Visual ≥ 55% vs r17 | 59% | ✓ |
| Overall ≥ 50% vs r17 | 47% | ✗ (tie range) |
| Overall ≥ 50% vs r12 | 49% | ~ |
| Veteran appeal ≥ 45% vs r12 | **51%** | ✓ |
| 0 horizontal slants; ≤ 1 slant on 90% of pages; 0 tall-right | 0; 100%; 0 | ✓ |
| Balloon order clear ≥ 90% | 40/40 | ✓ |
| Staples used 30–60% | 12.5% (5/40) | ✗ (low) |
| No staple more than 3 times | max 1 | ✓ |
| Bodies ≥ 90%, misread 0, lint 0 | 92%, 0, 0 | ✓ |

## What we learned

1. **The researched layout rules work.**
   - Every page was filled, balloon order was right on every page, and no page had more than one slant.
   - Visual beat round 17 (59%), and visual against r12 reached level (50%).
2. **Veteran appeal recovered** from 36% to 51% against r12 and 56% against r17, even though only 5 comics used an offered trope. Offering staples seems to steer authors toward genre-literate jokes more broadly.
3. **Staple use is low (12.5%).** The offer is optional, and the author rarely builds on one. The four used were exactly the tropes you flagged as missing: summoning, the aptitude crystal, appraisal and the system voice.
4. **About this PR slipped** to 39% against r12. Genre texture may be crowding out the PR's specifics.
5. **Layout fidelity fell to 23/40.** With more precise border instructions, the image model follows the exact grid less often, and drew the asked-for slant on 27 of 29 pages that had one. Worth watching.

## Next

- Make round 18 the new baseline.
- **Staple use:** offer staples matched to the PR's change (e.g. a stats or appraisal staple for a benchmark or scoring PR), not only to the cast.
- **About this PR:** strengthen the anchor (the PR's own words lettered on the page) in the plain flow.
- **Layout fidelity:** compare the drawn pages with the frames on 10 comics to see where the image model departs.
