# Round 8: anime fantasy with a host-picked cast

**Date:** 2026-11-24
**Question:** does a new anime-fantasy genre with a host-picked cast give varied, on-genre comics that hold up against round 7's best space opera arm (r7-c)?

**Review page:** `results/r8/review/index.html` (local, opens from disk). It shows r7-c and r8-anime grouped by arm, then sample, with the genre-neutral arena.

## What changed (Tracetoon `comic-anime-fantasy`, stacked on `comic-r7`)

- **Cast hints:** 1 comic in 5, down from 1 in 3.
- **New style `anime-fantasy`:** full-colour fantasy anime with cel shading.
- **New genre `anime-fantasy`:**
  - built from the tropes of today's fantasy and isekai anime, never naming a series;
  - places to choose from: guild counters, taverns, campfires, dungeons, ateliers, academies, hot springs and more;
  - six joke hooks.
- **A 39-persona roster:** heroes, five mages with different personalities, warriors, healers, scouts, nemeses and side characters.
- **Cast offers:** the author never sees the roster. Each comic is offered five personas by seed: usually three main-cast roles, a nemesis and a side character. About 1 in 5 comics is offered side characters only. The script records `personas`, and `comic check` rejects any persona not offered.

## Benchmark changes

- **Checklist v5:**
  - genre-neutral settings;
  - `place`, as free text, with concentration;
  - `renderLook`;
  - `castRoles`: whether the nemesis is on the page, and whether a party member lands the punchline;
  - offered versus used personas.
- **Arena:** the judge was told "both were asked to use this genre: Anime fantasy", read from round B's manifest. It marked every space-opera comic as off-brief, and the overall verdicts cited "fits the requested genre".
  - That first run (`results/arena-r7-c-vs-r8-anime`) gave anime fantasy 74% overall and is **invalid**.
  - The prompt now names a genre only when both rounds share it.
  - The numbers below come from the corrected run, `results/arena-r7-c-vs-r8-anime-neutral`.

## Results

### Head to head against r7-c (win rate of r8-anime; ties count half)

| Criterion | Genre-neutral (valid) | Biased first run |
| --- | --- | --- |
| Funnier | **31% [19, 44]** | 35% |
| About this PR | 51% [39, 63] | 57% |
| Use of the medium | 53% [46, 61] | 56% |
| Visual | **20% [13, 28]** | 45% |
| Overall | **36% [26, 46]** | 74% |

Second-judge kappa: funnier 0.46, about this PR 0.63, medium 0.50, **visual 0.14**, overall 0.36.

### Checklist (v5; r7-c rerun under the same version)

| | r7-c | r8-anime |
| --- | --- | --- |
| Medium index | 4.60 | 4.42 |
| Render look | colour comic 34, anime 4, manga 2 | **full-colour anime 40** |
| Office-like setting | 28% | **13%** |
| Setting entropy (bits) | 1.56 | **2.28** |
| Distinct places / largest | 30 / 10% | 31 / 10% ("guild hall steps") |
| Largest lead look | 2.5% | 2.5% |
| Dark skin + light hair lead | 3/39 | 8/40 |
| Nemesis on the page | 3/40 | 8/40 |
| Party member lands the punchline | 3/29 | 11/30 |
| Cast hints | 10/40 | 5/40 |
| Respect forfeits | 0 | 0 |

**Cast offers:**
- 40 of 40 scripts listed their personas, and none used a persona outside its offer.
- 33 of the 39 personas were used; the largest took 15% of comics (the summoned hero and the vain hero, 6 each).
- All 8 side-only comics kept to side characters.

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| Ties r7-c overall (raw at least 45%) | 36% | ✗ |
| Medium index at least 4.5 | 4.42 | ✗ (near) |
| Full-colour anime at least 60%; manga 5–30% | 100%; 0% | ✓ / ✗ |
| No place over 15%; at least 12 distinct | 10%; 31 | ✓ |
| No lead look over 15% | 2.5% | ✓ |
| At least 20 personas used; none over 15% | 33; 15% | ✓ |
| Side-only comics use no main cast | 8/8 | ✓ |
| Nemesis on the page in at least a third of party comics | 8/40 overall | ✗ |
| Hints in about 8 of 40 | 5 | ✓ (seed variance) |
| Zero respect failures | 0 | ✓ |

## What we learned

1. **The host-picked cast works exactly as intended.** Every author kept to its offer, 33 personas appeared, and side-only comics stayed side-only. A party member carried the punchline in about a third of party comics, against one in ten for space opera. Controlling the spread from the host, not the drafter, carries over from casting to personas.
2. **The setting variety is the best yet.** The office-like share halved, setting entropy rose from 1.56 to 2.28, and places spread across 31.
3. **The comics lost on humor and visuals.**
   - **Humor (31%):** the judges call the anime punchlines "a more familiar genre joke", such as the XP and level-up gags, against space opera's PR-specific payoffs. This is the third time genre-supplied jokes have cost humor (round 3's scenes, round 7's fight recipes, now these hooks).
   - **Visuals (20%):** the judges cite busy pages, where glowing scrolls, detailed stonework and light rays compete with the lettering at PR width. Visual is the least reliable measure (kappa 0.14), and the judge may simply prefer clean Western comic art. A human look at the review page is the deciding check.
4. **No manga pages appeared.** The authors always chose the colour style, which the brief made the default. The "now and then" manga page needs a seeded nudge if it is wanted.
5. **Judge prompts must be genre-neutral across genres.** A one-line genre statement swung "overall" from 36% to 74%.

## Next

- **Hooks:** cut the joke hooks to the two that tie a mechanism to the PR (the glyph stroke, the guild form), or drop them, and rerun humor against r7-c.
- **Style:** tell the style prompt to keep the backgrounds behind dialogue simple and the glow restrained, so lettering reads at PR width.
- **Manga pages:** if wanted, give about one comic in six a seeded style hint toward the manga style.
- **Human review:** check whether the visual loss is real or a judge preference.
