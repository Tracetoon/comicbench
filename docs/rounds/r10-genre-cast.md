# Round 10: diversity from the genre's own archetypes

**Date:** 2026-11-25
**Question:** if cast diversity comes from each genre's source works, does it stop looking out of place, without costing quality?

The change replaces rounds 7–9's generic hints ("a Lebanese woman", "a trans man") with researched, genre-true archetypes, and the comic must cast the one it's assigned.

**Review page:** `results/r10/review/index.html`, with r9-anime, r9-space, r10-anime and r10-space, grouped by arm with labels.

**Run:** the first full `comicbench campaign` (`campaigns/r10.json`).

## What changed

**Tracetoon (`comic-genre-cast`, stacked on `comic-memes`):**
- **Removed:** the generic `CAST_POOL` and `castHint`. A genre without its own list gets no hint.
- **Archetype lists:** anime fantasy carries 101 diverse archetypes and space opera 109, compiled from the genres' source works. The source character for each is in `docs/research/*-archetypes.md`.
  - **Anime fantasy examples:** a dark-skinned elf warrior, a beastfolk sword master, the dark-skinned axe fighter who runs the tavern, two heroines in love.
  - **Space opera examples:** a commanding station captain, two married officers, an agender security android.
  - About a quarter of each list is LGBTQ+, written into relationships and dialogue.
- **Required, not optional:** about 1 comic in 5 must cast one archetype. It replaces the offered persona of the same role (anime fantasy) or comes as `requiredCast` (space opera), and `comic check` enforces it.
- **Skill:** "Cast people the way the genre's own stories do… never mark who someone is with a haircut, accessory or other styling tell."
- **Lead-look warning:** it no longer prompts a hair change.
- **Genre notes:** each genre gets a "style people as the source works do" line.

**Comicbench (`round-10`):**
- the packet passes the required archetype;
- checklist v7 adds `castFitsGenre`, `stylingTell` and `requiredOnPage`.

## Results

### Head to head (r10 against r9 in the same genre; win rate of r10; ties count half)

| | r10-anime vs r9-anime | r10-space vs r9-space |
| --- | --- | --- |
| Funnier | 56% [45, 67] | 53% [39, 66] |
| About this PR | 53% | 57% |
| Use of the medium | 47% | 50% |
| Visual | 51% | 40% [29, 52] |
| Veteran appeal | 51% | 50% |
| Overall | **54%** [44, 64] | **52%** [40, 64] |

Respect forfeits are zero.

### Casting

| | r9-anime | r10-anime | r9-space | r10-space |
| --- | --- | --- | --- | --- |
| Comics assigned an archetype | — | 10 | — | 4 (seed variance; about 8 expected) |
| Assigned archetype cast | — | **10/10** | — | **4/4** |
| Personas used (anime cast offers) | 30 | **44** | — | — |
| Checklist: an off-genre character | 1/39 | 0/40 | 1/40 | 0/40 |
| Checklist: a styling tell | 1/39 | 0/40 | 2/40 | 0/40 |
| Scripts with shaved head, undercut or shaved sides | 5 | **11** | 12 | 7 |
| Memes on the page | 11/39 | **18/40** | 9/40 | 11/40 |
| Medium index | 4.59 | 4.47 | 4.60 | 4.60 |

**Examples of cast archetypes:**
- a broad dark-skinned axe fighter with a shaved head and goatee who runs the tavern;
- a lion beastman gladiator obsessed with stew;
- a half-elf mage horrified by dungeon food;
- a stern fencing captain hiding her feelings in a locket;
- a ruthless admiral betrayed by the woman she loved.

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| Off-genre characters and styling tells at most 2 of 40 | 0 and 0 | ✓, but see the measurement problem below |
| Required archetype on the page in at least 80% | anime: not assessed; space 2/2 assessed | ✗ measurement bug |
| About 8 of 40 comics get one | 10 and 4 | ~ |
| Overall and funnier tie or beat round 9 | 54% / 56% and 52% / 53% | ✓ |
| Medium index at least 4.5 | 4.47 and 4.60 | ~ |
| Zero respect failures | 0 | ✓ |
| Run under 1¾ hours | 208 min | ✗ |

## What we learned

1. **Required archetypes work and cost nothing in quality.** Every assigned archetype was cast (14/14), the cast reads as the genre's own, and r10 leans ahead of r9 in both genres (overall 54% and 52%, funnier 56% and 53%; ties within the intervals).
2. **The checklist can't see what the owner sees.** In r9-anime, the rabbit-eared scout the owner flagged is described as "dark brown skin, short black coils… a practical moss-green field jacket". The judge rated its cast "fits the fantasy setting". The near-zero off-genre counts in both rounds therefore show the judge is lenient, not that the comics are clean. The judge needs calibration examples from the owner's review before this measure means anything.
3. **Shaved heads persist as an author default.** In anime they rose from 5 to 11 scripts. Some come from archetypes (the axe fighter), but most are the author's own choice for an unrelated lead: a healer, a time-loop hero. A per-genre styling note, or a check warning on repeated hairstyles, could target this.
4. **The image model adds styling the script doesn't name.** The dreadlocks on the flagged character aren't in any script; "short black coils" became dreadlocks in the drawing.
5. **Measurement bug:** `requiredOnPage` asks the judge about a "required" persona, but the script doesn't mark which one it is, so anime comics were never assessed. The checklist prompt should name the required archetype.
6. **Side-only offers:** a required archetype with a main role can land in a side-only comic (it replaces the side slot), which counted as 1 of 4 side-only comics "not kept". The draw should pick a side or nemesis archetype for side-only offers.

## The campaign's first full run

- **Total:** 208 minutes, against 4½ hours of compute for round 9 run step by step.
- **Drawing (80 comics):** done in 73 minutes, against about 2 hours in round 9.
- **Judging:** the remaining 2¼ hours. Drawing had priority on all 12 slots, so 720 judging calls queued behind it. Judging calls averaged about 2½ minutes each (24 hours of call time across 12 slots).
- **Rate limits:** none.
- **Next:**
  - raise the slots (no rate limit came close);
  - reserve a few slots for judging so it keeps pace with drawing;
  - judge only what a round needs: checklists for the two reference rounds were rerun under the new version, at about 160 calls.
