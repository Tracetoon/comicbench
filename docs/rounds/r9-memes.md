# Round 9: genre memes for veteran fans, panel-focus backgrounds, an assigned style mix

**Date:** 2026-11-24
**Question:** do comics improve, and do judges credit genre jokes, when:
- each comic is offered three famous genre memes;
- backgrounds follow each panel's focus;
- the host assigns the style?

**Review page:** `results/r9/review/index.html`, with r7-c, r8-anime, r9-anime and r9-space and three arenas.

## What changed

**Tracetoon (`comic-memes`, stacked on `comic-anime-fantasy`):**
- **Meme pools:** 256 anime-fantasy memes and 313 space-opera memes, compiled for this round.
  - Each meme is written as an allusion with no names (`FRANCHISE_NAMES` passes them all), with no near-duplicates.
  - Tiers: about 25% iconic, 45% well known, 30% deep cuts.
- **Meme offers:** each comic gets three. Tier 1 is three times as likely as tier 3; memes that fit the cast offer's roles are preferred; a meme a recent comic used is never offered.
  - Using one is optional. The script records `meme`, and `comic check` rejects a meme that wasn't offered.
- **Backgrounds:** one line in the skill and in the image prompt: blurred or speed-line backgrounds behind dialogue and reactions, full detail for establishing shots.
- **Style mix:** anime fantasy assigns `anime-fantasy` 7, `chibi-anime` 2, `webtoon` 1 and `shonen-action` 2. `comic check` enforces the assigned style.

**Comicbench:**
- **Arena v3:**
  - a new `veteranAppeal` criterion;
  - `funnier` treats a fitting genre meme as "a strength, not a stale joke";
  - `overall` counts a well-placed meme "strongly in its favor".
- **Checklist v6:**
  - `genreMeme`: a meme on the page, named;
  - `backgroundFocus`.
- Arena v3 and checklist v6 were rerun on the reference rounds so all rounds are judged the same way.
- **Machine note:** the run lost about 6 hours to the computer sleeping (Windows logged a wake at 7:54). It resumed with no failures.

## Results

### Head to head (win rate of the round-9 arm; ties count half)

| | r9-anime vs r8-anime | r9-anime vs r7-c | r9-space vs r7-c |
| --- | --- | --- | --- |
| Funnier | 47% [36, 58] | **34%** [24, 43] | 42% [30, 54] |
| About this PR | 57% | 57% | 53% |
| Use of the medium | 56% | 56% | 48% |
| Visual | 46% | **21%** [11, 33] | 39% |
| Veteran appeal | 55% [46, 65] | **66%** [56, 77] | 48% [36, 60] |
| Overall | **56%** [46, 66] | **49%** [38, 62] | 50% [39, 61] |

- **Context:** anime overall against r7-c was 36% in round 8; it is 49% here.
- **Judge agreement (kappa):** veteran appeal 0.72 / 0.33 / 0.57. Visual 0.03 / 0.30 / −0.03, meaning the visual verdicts are close to noise.

### Checklist v6

| | r7-c | r8-anime | r9-anime | r9-space |
| --- | --- | --- | --- | --- |
| Medium index | 4.60 | 4.46 | **4.62** | **4.63** |
| Backgrounds by panel focus | 32/40 | 34/39 | **39/39** | **35/40** |
| Meme scripted / on the page | — / 1 | — / 6 | 7 / **11** of 39 | 9 / **9** of 40 |
| Places: distinct / largest | 29 / 10% | 29 / 10% | 22 / 15% | 21 / **25%** |
| Office-like setting | 20% | 15% | **3%** | 20% |
| Render look | colour comic 32 | anime 39 | anime 39 | colour comic 36 |

Respect forfeits are zero in all rounds. r9-anime had one failed comic and one comic gated on factual integrity.

**Memes the checklist found on the page:**
- **Anime:** mimic chest bites the hero; the isekai status-window summon; shouting the full attack name; a boulder-training montage; the tournament arc; the sword in the stone.
- **Space opera:** the computer's polite refusal; the captain's log; the beam-up; hailing frequencies; the replicator order; the Star Destroyer flyover; "Han shot first".

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| r9-anime beats r8-anime | overall 56% [46, 66], funnier 47% | leaning ahead, not significant |
| r9-anime ties r7-c on funnier and overall | overall 49% ✓, funnier 34% ✗ | |
| r9-space ties or beats r7-c | overall 50%, funnier 42% | ✓ tie |
| Veteran appeal above 60% | anime 66% vs r7-c ✓; 55% vs r8; space 48% ✗ | mixed |
| A meme on the page in at least 40% of comics, none repeated | 28% and 23%; one repeat each | ✗ |
| Manga on 10–25% of anime pages | 0% | ✗ (bug, below) |
| Backgrounds by panel focus up | 39/39 and 35/40 | ✓ |
| Medium index at least 4.5 | 4.62 and 4.63 | ✓ |
| Round 8 variety holds | places fell to 22 and 21 distinct | ✗ |
| Zero respect failures | 0 | ✓ |

## What we learned

1. **The veteran-appeal judge works and recognises allusions without names.** The checklist named "Han shot first", the HAL-style refusal and the mimic chest without a single name in the comics. Anime fantasy beats space opera 66% on veteran appeal. Its overall gap to r7-c closed from 36% (round 8) to 49%, and it now leans ahead of round 8 (56%).
2. **Authors use offered memes too rarely.** Only 7 of 39 and 9 of 40 scripts set `meme`. The memes are optional, and a random three often don't fit the PR's moment, so authors skip them. Where a meme was used, the page shows it.
3. **Humor against space opera is still the gap for anime** (34%). In space opera, memes didn't change humor (42%, overlapping a tie).
4. **Panel-focus backgrounds took hold:** every anime page and 35 of 40 space pages now vary background detail with the panel's focus.
5. **The style mix assigned manga, but the author overrode the palette.** All 7 `shonen-action` comics set `palette: full-color`, which that style allows, so none came out black and white. The mix has to fix the palette as well.
6. **Place variety dropped** (22 and 21 distinct, from 29). Space opera's top place, the "orbital launch bay", reached 25%. The new instructions may crowd out the setting list.

## Next

- **Style mix:** entries carry a palette (`shonen-action:bw-accent 2`), and `comic check` enforces it.
- **Memes:** offer five instead of three so one is more likely to fit, and tell the author to use one when any fits. Measure on the page again.
- **Places:** restore variety with a host-picked place offer (three places per comic), like personas and memes.
- **Visual:** the visual verdict is close to noise (kappa about 0), so stop using it for decisions until a human pass calibrates it.
