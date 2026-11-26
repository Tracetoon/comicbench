# Round 16: tiled grid layouts, and a 20-idea brainstorm, in two arms

**Date:** 2026-11-26
**Review page:** `results/r16/review/index.html`. Each card shows the assigned structures, and for arm B the anchor, all 20 ideas with the blind judge's reading, the shortlist and the pick.
**Layout preview:** `docs/rounds/r16/grid-signatures.png` (all 31 signatures, still and with action).

## What changed

**Both arms:**
- **Tiled grid layouts:** a generator cuts a signature (e.g. `rows:1-2`, `cols:1-3`) into panels that fill the page.
  - No voids, overlaps or insets, straight outer edges, no slivers.
  - Gutters slant beside move or impact panels.
  - The host assigns one signature per panel count, never one of the last 3 comics'. `rows:1-2-1` is weighted down.
  - The round-15 families are removed.
- **Audited bodies:** non-human characters are drawn from their verified presentations.

**Arm A (`r16-plain`):** round 12's single author (`brainstorm: off`).

**Arm B (`r16-brainstorm`):**
1. The author names the PR anchor, then writes 20 ideas from the PR, with pitches and memes as optional sparks.
2. A blind judge reads all 20 and shortlists 5.
3. The best shortlisted idea it read correctly is picked.
4. The author develops it with round 12's three-concept step.

## Results against r12-anime (80 of 80 pairs per arm; win rate)

| | A: plain | B: brainstorm |
| --- | --- | --- |
| Funnier | **54%** [41, 67] | 34% [23, 46] |
| About this PR | 44% [31, 58] | 37% [23, 52] |
| Use of the medium | **71%** [60, 81] | **83%** [75, 90] |
| Visual | 33% [21, 46] | 21% [13, 31] |
| Veteran appeal | 37% [25, 50] | 24% [14, 34] |
| Overall | **47%** [38, 56] | 29% [17, 42] |

Medium index: A 5.13, B 5.42 (r12 4.47).
- Sound effects: A 90%, B 100%.
- Special balloons: A 63%, B 83%.
- Action or motion: A 65%, B 63%.
- Dynamic panels: 100% in both arms.

## Against the bar

| Bar | A: plain | B: brainstorm | |
| --- | --- | --- | --- |
| No empty areas or overlaps (pageFilled) ≥ 95% | 38/40 | 37/40 | A ✓, B ~ |
| ≥ 8 distinct signatures | 18 | 21 | ✓ |
| `rows:1-2-1` ≤ 15% | 1/40 | 3/40 | ✓ |
| Slants drawn in ≥ 70% of action pages | 40/40 | 40/40 | ✓ |
| Page follows its layout | 34/40 | 33/40 | |
| Bodies drawn as presented ≥ 90% | 21/23 (91%) | 17/20 (85%) | A ✓, B ✗ |
| A: overall ≥ 50%, medium ≥ 50% | 47%, 71% | | ~, ✓ |
| B: overall ≥ 45%, about the PR ≥ 50% | | 29%, 37% | ✗ |
| B: picks recovered by the blind judge ≥ 85% | | 27/40 (68%) | ✗ |
| B: medium index within 0.5 of r12 | | 5.42 (above) | ✓ |
| Prompt lint 0 | 40/40 hits | 40/40 hits | ✗ (my wording; fixed) |
| Misread, respect | 0 gated, 0 | 0 gated, 0 | ✓ |

**Prompt lint:** every prompt was flagged for "no overlapping **or** inset panels" in the new layout sentence. The wording is fixed in Tracetoon `57842c8`, with a test that a grid prompt lints clean.

## Brainstorm (arm B)

- **Ideas:** 800 written (20 × 40). The blind judge recovered the PR from only **286 (36%)**.
- **Picks:** 36 of 40 were shortlisted; 27 of 40 were read correctly; 13 fell back to the shortlist's top idea, unrecovered.
- **Sparks and memes:** 4 picks used a pitch spark and 3 a meme. Authors mostly ignored the sparks, as intended.

## What we learned

1. **The new layouts work on the page.**
   - Panels filled the page in 95% (A) and 92% (B) of comics.
   - Slanted gutters were drawn wherever the script asked.
   - Structures varied (18 and 21 signatures); the old 4-panel default appeared on 1 and 3 pages.
   - Use of the medium beat round 12 by a wide margin (71% and 83%).
2. **The plain arm reaches parity overall** (47%, with 37 of 80 pairs tied) and is funnier (54%). This is the best result against r12 since round 12.
3. **Visual and veteran appeal fell in both arms.**
   - The loss spans every structure and action level.
   - The plain arm did worst on rows with three panels across (22% visual) and best on columns (42%).
   - Judges favoured r12's "compact landscape layout" and roomier panels at PR width. The new pages are busier: dynamic panels in 100% of comics, and about half of all panels marked as action.
4. **Brainstorming still loses** (29% overall, the third round in a row). Even with 20 ideas written from the PR, a blind reader recovers the PR from only 36% of them. Writing many ideas fast seems to produce weaker, less specific ones, and the extra steps cost visual and veteran appeal.

## Next

- **Adopt arm A's flow:** round 12's single author, plus grid layouts and bodies. Shelve the brainstorm; keep the cooldowns and the meme list.
- **Calm the pages:**
  - mark at most one or two action beats per comic;
  - weight signatures toward 2 panels across;
  - cap 5-panel pages.

  Then re-measure visual.
- **Queued:** correct the `core` text and `variants` from the audit, and keep species labels out of the author's packet.
