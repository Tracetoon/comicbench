# Round 7: casting by rotation, fight recipes, back on #204

**Date:** 2026-11-23
**Question:** starting again from #204 (r3-medium), do two small additions fix what rounds 4–6 broke? The first spreads casting across comics instead of asking each comic to be diverse. The second gives space opera fight recipes. And do they keep the comics as good as r3-medium?

**Review page:** `results/r7/review/index.html` (local, opens straight from disk). It has r3-medium and the three arms, plus the three arenas against r3-medium.

## Why this round

Rounds 4–6 (run by Codex) each added more casting and setting guidance to the skill, and each made the comics worse:
- One modal lead, an older dark-skinned woman with silver hair, appeared in 1/40 r3-medium comics, then 18/40 in r4 and 22/40 in r5.
- Craft drawn from outside went from 15% to 50–62% of comics, with zero battles.
- R5's rewrite dropped the medium index from 4.70 to 2.58.

No round was ever compared with r3-medium. Round 7 restarts from #204 and changes one thing per arm. Every arm runs head to head against r3-medium.

## Arms

| Arm | Tracetoon change on #204 |
| --- | --- |
| A | Casting. The host gives about one comic in three a seeded, optional `castHint` from a 33-person pool, and the script records `leadLook`. `comic check` warns when the lead's look repeats a recent comic's. The skill gets one respect rule ("Nobody is the butt for who they are") and no list of identities. |
| B | Fights. Space opera gets four joke hooks that map a mechanism to a fight (retries as fighter waves, a race condition as two fighters diving for one docking slot, a cache as a decoy fleet, a flaky test as a blaster that fires every other pull), three archetypes, a note welcoming comic combat, and the trope-parody paragraph. |
| C | A + B |

Cases: dev split, 20 cases × 2, recent-comic memory of 10. The arena judges each pair in both orders and adds a second judge (`gpt-6.2-astra`, 30% share). r3-medium's checklist was rerun under the current schema so lead-look and conflict measures are comparable. Its v1 answers are kept as `checklist-v1.json`.

**Casting v1 was stopped after 3–5 comics per arm.** Its skill line ("Cast people the way a crowd would have them… who fills them varies") and a `leadLook` that named skin brought the template straight back: the first leads were "stocky mechanic, silver curls, brown skin", "broad older woman, deep brown skin, white buzz cut" and so on. Even one line about varying the cast was enough to trigger it. V2 removed both, and A and C were rerun from scratch.

## Results

### Head to head against r3-medium (win rate of the arm; ties count half)

| | A casting | B fights | C both |
| --- | --- | --- | --- |
| Funnier | 41% [31, 52] | **36% [24, 48]** | 46% [34, 58] |
| About this PR | 51% [39, 63] | 44% [35, 54] | 47% [35, 58] |
| Use of the medium | 52% [36, 67] | 56% [45, 66] | 51% [41, 61] |
| Visual | 49% [39, 59] | 46% [36, 56] | 58% [48, 69] |
| Overall (raw) | 44% | 43% | **53%** |

The arena's gated "overall" is blank because r3-medium predates the respect gate, so every pair counts as incomplete. Raw overall uses the same verdicts without the gate. Second-judge kappa ranges from 0.11 to 0.78.

### Checklist

| | r3-medium | A | B | C |
| --- | --- | --- | --- | --- |
| Medium index (of 6) | 4.67 | 4.38 | 4.55 | 4.53 |
| Largest single lead look | 2.5% | 2.5% | 2.5% | 2.5% |
| Distinct lead looks | 40 | 40 | 40 | 40 |
| Dark skin + light hair lead (image) | 2/40 | 7/40 | 1/40 | 3/39 |
| Office-like setting | 35% | 28% | 30% | **18%** |
| Setting entropy (bits) | 1.44 | 1.33 | 1.66 | **1.81** |
| Space conflict on the page | 0/40 | 1/40 | 1/40 | 1/40 |
| Cast hints given | — | 13/40 | — | 10/40 |
| Explicit background, script / page | 0 / 0 | 6 / 0 | 0 / 0 | 12 / 0 |
| LGBTQ+ cue, script / page | 0 / 0 | 8 / 0 | 0 / 0 | 1 / 0 |
| Respect forfeits | 0 | 0 | 0 | 0 |
| Comics gated | 0 | 1 (factual) | 0 | 1 (factual) |

## Against the bar

| Bar | C | |
| --- | --- | --- |
| Ties or beats r3-medium overall | 53% raw | ✓ tie |
| Medium index ≥ 4.5 | 4.53 | ✓ |
| No lead look over 15% | 2.5% | ✓ |
| Battles on some pages | 1/40 | ✗ |
| Zero respect failures | 0 | ✓ |

## What we learned

1. **Rotation fixes the casting collapse, but only if the skill says almost nothing about identity.** With the hint as the only identity lever, all 40 leads are distinct in every arm. A one-line "vary the cast" instruction was enough to bring the template back, so the rule is now respect-only. A's 7/40 dark-skin, light-hair leads are spread across different builds, ages and outfits; they are the image model's default for "older, silver hair", not one repeated design.
2. **Representation reaches the script but not the page.** Authors used the hints (a Lebanese pilot, a Samoan shipwright, a trans woman, an older lesbian couple). But no reader-visible cue survived into balloons or art: 0/40 on the page in every arm. The checklist only counts what a reader can see, so a character's identity in the notes counts for nothing. Making it visible ("mentions her wife") without making it the topic is the next step.
3. **Fight recipes as joke hooks don't produce fights, and they cost humor on their own.** B lost "funnier" 36%, and battles stayed at 1/40 in both B and C. Authors start from the PR's mechanism, and a list of genre hooks is one more set of options they mostly pass over. When they do take one, the joke gets more generic. This is the same lesson as scenes in round 3.
4. **C is better than either part alone.** It leads on visual (58%), setting variety (entropy 1.81, office-like 18%) and raw overall (53%). The confidence intervals overlap, so the honest reading is "ties r3-medium with more varied settings", not a win.

## Next

- **Ship casting** (A's mechanism, which C uses): it ties r3-medium and removes the collapse.
- **Battles:** use the mechanism that worked for casting. Give about one space-opera comic in four a seeded `genreBeat` hint ("stage it as a fighter dogfight", "a fleet standoff", "a glowing-sword duel") instead of joke hooks. Measure battles on the page and "funnier" against r3-medium.
- **Visible representation:** phrase LGBTQ+ hints as something a character can say or show in passing, and check the page, not the script.
