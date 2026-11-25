# Round 12: anime fantasy cast from the isekai archetype guide, with one definitive prompt

**Date:** 2026-11-25
**Review page:** `results/r12/review/index.html`, with r11-anime and r12-anime and their arena. Each card shows the exact image prompt.

## What changed

**Tracetoon (`comic-isekai`, stacked on `comic-leads`):**
- **The guide:** anime fantasy is cast from the owner's isekai archetype guide (`docs/research/isekai/`): 106 archetypes, 12 presets, and the guide's generator.
  - The generator is ported to TypeScript and matches the original's verdicts on 240 parity cases.
  - It reproduces the guide's self-test (1,200 casts, 0 invalid), its 18 domain fixtures and its 10 source-reference shapes.
- **The cast:** each comic gets a fresh cast from a weighted preset (the 4 most recognizable ×2), skipping the last two comics' presets.
- **The author's decisions:** the lead plus at most two companions and one contact on the page, one final design each (no "or"), one `place`, and a `background` per panel.
- **Shelved for this genre:** the old roster, diverse cast, leads, memes and style mix. The misread review stays.
- **The prompt:** decisions only, for every genre.
  - One `Setting:` line instead of the genre's list of places.
  - No conditional style or medium rules.
  - Format layouts decided from the script.
  - Genre-neutral negatives.
  - Plain placement phrasing.
  - A lint (`art/prompt-lint.json`) records any option left.

**Comicbench (`round-12`):** add-on v2 asks whether each on-page character reads as its archetype, whether the cast differs in silhouette, and whether the decided place is on the page.

## Results

### Against r11-anime (74 of 80 pairs; win rate of r12)

| | Win rate |
| --- | --- |
| Funnier | 44% [33, 56] |
| About this PR | **61%** [52, 71] |
| Use of the medium | 39% [26, 54] |
| Visual | **59%** [47, 69] |
| Veteran appeal | 33% [20, 47] |
| Overall | 46% [34, 59] |

Respect forfeits are zero. Six pairs failed (Codex exit 143: a 20-minute timeout on long arena calls).

### The cast

- **Archetypes recognised:** **55 of 60** assessed on-page characters read as their archetype (92%; 29 of 89 unclear).
- **Distinct silhouettes:** the on-page cast differs in silhouette in 40/40 comics.
- **The place:** the decided place is on the page in 38/40.
- **Spread:**
  - 47 distinct archetypes across 89 on-page characters;
  - every preset appeared (disaster comedy 6, guild ensemble 7, survival 5, standard adventure 4, and so on), with professional and monster court once each.
- **The lead:** a clear protagonist in 34/40 (r11: 32/40). The assigned lead is that protagonist in 21/40.
- **The prompt:** **0 of 40** prompts with an open choice.
- **Misread:** 2 comics redrawn once each, 0 gated.
- **Medium index:** 4.47 (r11 4.42).

### An example (aifirstcli-javafx-maven #1)

- **Cast:** preset disaster comedy. Lead M09, the obsessively cautious overpowered hero. Companions: P08 rabbit powerhouse, P19 deadpan superior maid, P29 sociable warrior friend, P32 unreliable elderly archmage. Contacts: N01 guild receptionist, N07 dwarf blacksmith.
- **On the page:** Bracewick (M09) and Presshem (P19, written as a male valet: gender is a design choice in the guide).
- **The prompt:** one `Setting: A guild's stone practice alcove with a single oak lesson lectern.` line, and decided designs ("five plain sheathed spare swords fanned out in one quick-release harness").

## Against the bar

| Bar | Result | |
| --- | --- | --- |
| At least 75% of on-page characters read as their archetype | 92% of assessed | ✓ |
| Zero prompt-lint hits | 0/40 | ✓ |
| Presets in proportion; at least 40 distinct archetypes | all 12; 47 | ✓ |
| A clear main character in at least 85% | 34/40 (85%) | ✓ |
| Overall and funnier at least 45% against r11 | 46% and 44% | ~ (tie; funnier just under) |
| Visual at least 45% | **59%** | ✓ |
| Zero misread concerns among published comics; zero respect failures | 0; 0 | ✓ |
| Run under 1 hour | 85 min (45 for drawing and judging; a 40-minute tail on 6 timed-out arena calls) | ✗ |

## What we learned

1. **The guide's cast reads as the genre.** 92% of characters are recognisable as their archetype, every comic's cast differs in silhouette, and casts spread across 47 archetypes and all 12 presets.
2. **Decided prompts help the art.** Visual rose to 59% (from 34–36% in round 11's comparisons), with a single place and per-panel backgrounds. About this PR rose to 61%.
3. **Veteran appeal fell (33%)** because memes are shelved for this genre, and use of the medium fell to 39%. Humor is level (44%).
4. **The assigned lead** is the visible protagonist in only 21 of 40 comics; a companion often steals the page. The skill could ask for the lead in the first and last panels.
5. **Six arena calls timed out**, which made a 40-minute tail. A shorter per-call timeout with one retry would cap it.

## Next

- Bring memes back for anime fantasy, offered by the cast's archetypes, to recover veteran appeal.
- Strengthen the lead: in the first and last panels.
- Arena calls: a 10-minute timeout with one retry.
- Trim the doubled period in the Layout line (`…open book..`).
