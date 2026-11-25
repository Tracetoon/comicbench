# Round 11: a main character in every comic, a misread review, a faster campaign

**Date:** 2026-11-25
**Review page:** `results/r11/review/index.html`, with r10 and r11 in both genres, grouped by arm. Each card now shows the exact image prompt and the misread review.

## What changed

**Tracetoon (`comic-leads`, stacked on `comic-genre-cast`):**
- **Lead archetypes:** about 55 per genre, modelled on real series' protagonists. Each is diverse on at most one axis, or is the genre's own stereotype lead. Sources are in `docs/research/*-leads.md`.
- **Every comic gets one lead:**
  - diverse leads take 60% of picks;
  - recent leads are skipped;
  - the lead replaces the offered hero (anime fantasy) or comes as the option's lead (space opera).
- **The check:** the script names `lead`, and `comic check` requires it and warns when the lead is in fewer than half the panels.
- **The misread review:** every new image is reviewed for sexual or genital shapes, rude gestures and hate symbols.
  - A "likely" reading sends the comic back for up to two redraws, with things to avoid written into the negative prompt.
  - The standing negative prompt steers controls away from knobbed rods near a character's lap, and hands away from one raised finger.

**Calibration (`scripts/misread-calibrate.ts`, on round 10's 80 pages):**
- The first prompt raised 23 concerns, including blood-coloured paint, a fart joke and drawing mistakes.
- The narrowed prompt flags the owner's "finger presser" page (`r10-space · aifirstwebsite-macos-workaround#1`) and one middle-finger hand, with 57 "possible" readings recorded but not acted on. Most of those are knobbed levers gripped at lap height.

**Comicbench:**
- the snapshot builds each genre option itself;
- the misread review runs with redraws, and a comic still flagged is gated;
- an add-on checklist pass: is there a clear main character, and is the assigned lead (and the required archetype) on the page;
- campaign speed: renders on their own lane, 12 text slots reserved for judging, the two orders and the second judge in parallel, a canary at 3 comics, and a 15-minute limit on a single render.

## Results

### Head to head against round 10 (win rate of r11; ties count half)

| | Anime fantasy | Space opera |
| --- | --- | --- |
| Funnier | 43% [31, 55] | 38% [27, 49] |
| About this PR | 48% | 54% |
| Use of the medium | 56% | 57% |
| Visual | **34%** [24, 43] | **36%** [24, 48] |
| Veteran appeal | 54% | 52% |
| Overall | **46%** [34, 59] | **44%** [34, 55] |

Respect forfeits are zero. Second-judge kappa for visual: 0.25 (anime) and 0.00 (space).

### Main character, misread review, casting

| | r10-anime | r11-anime | r10-space | r11-space |
| --- | --- | --- | --- | --- |
| A clear protagonist on the page | 27/40 | **34/40** | 32/40 | **38/40** |
| The assigned lead is that protagonist | — | 29/40 | — | 29/40 |
| Lead in at least half the panels (script) | — | 40/40 | — | 40/40 |
| Lead axis | — | gender 15, race 11, orientation 1, stereotype 13 | — | gender 11, orientation 7, race 6, stereotype 16 |
| Misread: concerns, redraws, gated | — | 0, 0, 0 | — | 0, 0, 0 |
| Required supporting archetype on the page | 9/10 | 13/13 | 4/4 | 10/10 |
| Memes scripted / on the page | 12 / 18 | 10 / 16 | 10 / 11 | **2 / 5** |
| Medium index | 4.47 | 4.42 | 4.60 | 4.72 |

**Diverse leads overall:** 51 of 80 (64%).

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| A clear main character in at least 85% of comics | 34/40 (85%) and 38/40 (95%) | ✓ |
| The script lead in at least half the panels | 80/80 | ✓ |
| Diverse leads 50–70% | 68% and 60% | ✓ |
| No misread concern among published comics | 0 of 80 | ✓ |
| Overall and funnier tie or beat round 10 (at least 45%) | overall 46% and 44%; funnier 43% and 38% | ✗ (slightly behind) |
| Supporting archetype on the page at least 80% | 23/23 | ✓ |
| Zero respect failures | 0 | ✓ |
| Run under 1 hour | 52 minutes for 77 comics with all judging; 3 renders hung when the Codex quota ran out | ✓ (apart from the quota) |

## What we learned

1. **The main character works.** A clear protagonist rose from 27 to 34 (anime) and from 32 to 38 (space). The lead carries every script, and the 60/40 diverse/stereotype split held. The anime list's orientation leads came up only once, so that axis needs more entries or its own weight.
2. **The misread review never had to fire.** Calibration showed the image model's habit of knobbed levers at lap height, and the drawing instructions that now prevent it left nothing to redraw in 80 new comics. The reviewer still catches the flagged page in calibration.
3. **Quality slipped slightly.** Overall is just inside the tie band, and funnier and visual are behind. Judges prefer round 10's "clear silhouettes, uncluttered final balloon" over round 11's "busy machinery" and "denser lettering". A lead brief, a required archetype, memes and longer drawing instructions now compete for the same page. Visual is the noisiest verdict (kappa 0 to 0.25).
4. **Memes collapsed in space opera** (2 of 40 scripts, from 10). With a lead to build the episode around, authors drop the optional meme.
5. **Speed:** the campaign did 77 comics with all their judging in 52 minutes, against 3½ hours for round 10, and judging kept pace throughout. Three renders hung when the Codex quota ran out; the new render time limit turns that into a recorded error. Finishing the last three after the reset took 14 minutes, plus 2 more after two Codex calls failed with exit 66 (likely the detached resume, see the run notes).
6. **API fallback:** Codex refuses this organisation's API key while the monthly API Credits benefit is enabled, so a benchmark can't fall back to API tokens.

## Next

- **Trim the per-comic brief:** a one-sentence lead, the required archetype only when assigned, at most one other extra. Then check whether visual and humor recover.
- **Leads:** give the orientation axis its own weight.
- **Memes:** ask for a meme when one fits the lead's story.
