# Round 19: evaluation and research paths

**Date:** 2026-11-27
**Follows:** `docs/rounds/r19-adventure.md`

## Context

Round 19 (adventure settings, retired niche leads, uniform gutters, PR-matched staples, payoff-panel anchor, counts-first layout sentence) was scored on measures v2.
- **The headline:** the medium rose to its best yet (93% chance of beating an average real comic), and office parody went to 0.
- **The costs:** "about this PR" fell clearly, and humor and overall dipped within noise.

The owner asked for a thorough evaluation, not a single fix, and at least five research paths. The evidence below comes from:
- the v2 scores (per comic, per criterion);
- three read-only studies:
  - jokes in the best and worst comics, plus 1,850 judge games;
  - PR relevance across r12, r18 and r19 on the same PRs;
  - the pipeline logs, packets and images.

## What the evaluation found

### Humor: structure decides, not length or polish
- **Mean humor by how the comic ends:**

  | Ending | Mean |
  | --- | --- |
  | Payoff reinterprets the PR's own subject as a developer gripe ("The three is silent", "faceprint" as a signature) | ≈ +1.3 |
  | Character misreads or doubles down on the rule | ≈ +0.4 |
  | Slapstick from a literalized term | ≈ −2.2 |
  | Unrelated character quirk (dumpling, penny, corn, teeth); 11 of 40 comics | ≈ −4 |

- **xkcd won 97 of 98 games** against r19. Its strips have:
  - a premise every developer already knows, in one line;
  - a repeated setup with one thing changed;
  - a short, plain last line;
  - often a second, drier laugh that grows out of the first.
- **The material sets the ceiling.** Both independent winapps drafts found the same joke ("silent three"). Obscure identifiers (`--aggregate-only`, `micropython_core`) sink jokes.
- **Overall follows humor** (correlation 0.67), not craft (0.06).

### About this PR: the change is not said, and the setting hides the mechanism
- **Legibility is not the problem:** anchor terms are lettered cleanly.
- **The change is never stated plainly.** Same PR, same scene: r18 said "Give the macOS dummy the extra level it's supposed to report"; r19 replaced it with a toll coin.
- **Random settings force stand-ins:**
  - 29 of 40 comics are outdoors (r18: 5). Files become sun and moon tiles; a test input becomes a coin.
  - r12's best comics carried the PR on fantasy documents (a foldout, a reply parchment). The skill itself says to pick where the PR "maps most naturally".
- **Side details replace the purpose, and the entry point goes missing.** All three r19 high scorers name the command (`vexaim snap`, `tracetoon review run --all`, `prbench score --aggregate-only`).
- **Setting puns rose:** wordplay punchlines went 0 → 2 → 7 (r12 → r18 → r19).
- **The skill ranks the PR low.** "Recognizably this PR" comes third, after cold-read clarity and funniness.

### Variety collapsed in a new direction
- **Repeated premises:** 19 of 40 premises are a gate, bridge, arch or toll to pass (r18: 14).
- **Repeated jokes:** in 12 of 20 cases both samples tell the same joke (r18: 9).
- **Place types:** setting entropy fell from 2.13 to 1.22.

### Sampling noise is as large as the differences between PRs
- **Variance:** for humor, sample-to-sample variance is 3.3 against 4.7 between PRs in r19 (r18: 4.4 vs 2.3).
- **Best-of-2:** an oracle pick of the better of two samples moves r19 humor from 18% to 37% vs real comics, and overall from 8% to 18%. That's larger than any change we've shipped.

### Process waste and gaps
- **Wasted check rounds:**
  - `leadLook` fails on its 80-character limit in about 85% of comics (71 failures over two rounds). The limit is documented nowhere the author reads, and the packet's own look text is about 250 characters.
  - 7 JSON failures come from a UTF-8 BOM.
  - The skill says `memeOffer` where the packet says `tropeOffer`.
- **The last-panel rule got gamed:** 24 failures, then 35 of 40 final panels satisfy it with a sign re-lettering the term.
- **Instruction load:** about 95 KB and roughly 85 rules before writing; r19's instructions are 4.9 KB against r12's 3.0 KB.
- **Review gaps:**
  - The misread review flagged a "swastika-like" gate fitting as "possible" (javafx #1) and it was published; 0 redraws in 80 comics.
  - Lettering is never measured.
  - Reviews wait up to about 20 min for slots.
- **The bench's `author/stats.json` undercounts** check runs (0 for 35 of 40).
- **Staples are not helping:** used in 6 of 40, and the comics that used one scored lower (n small).

### The measures themselves
- **The humor anchors are bimodal.** xkcd scores +2.6 to +7.4; Pepper&Carrot (our genre's peer) scores −3.6 to −6.7. The prompt's "software developer" reader makes "vs real comics" mean "vs xkcd".
- **About this PR and veteran appeal** still rest only on the old Codex arena, with no anchors and no second family.

## Research paths

Each path has a question, the evidence, a cheap experiment and a decision rule. Most can be tested **at the script stage, without drawing**, once path 6 gives us a script judge we trust.

### 1. Jokes about the mechanism
- **Question:** does requiring the payoff to reinterpret the PR's own subject raise humor and "about this PR" together?
- **Evidence:** the structure table above; xkcd's patterns; the quirk endings at about −4.
- **Experiment:**
  - Author variants on the 20 dev cases, scripts only:
    - (a) current;
    - (b) "the last line only works because of what this PR changes: it reinterprets the change; one setup repeated with one thing varied; payoff of 8 words or fewer; a tag must reuse something already on the page";
    - (c) (b) plus "first name the developer frustration this PR touches, in one sentence".
  - Judge the scripts pairwise (path 6), then draw the winning variant for 20 cases.
- **Decision rule:** keep it if humor and about-this-PR both rise with CIs apart from (a).

### 2. Generate, then select
- **Question:** how much of the best-of-N gain can a real judge capture, at which stage, and at what N?
- **Evidence:** the best-of-2 oracle roughly doubles both humor and overall; within-PR variance is large; 12 of 20 sample pairs repeat the same joke, so drafts must also be pushed apart.
- **Experiment:**
  1. **Picker accuracy, at no cost:** on r12–r19's existing sample pairs (about 120), have a script-only judge and a page judge pick the better comic; measure agreement with the v2 ranking.
  2. **Diversified drafts:** for 20 cases, write 4 scripts with forced-different premises or obstacles, pick 1 at the script stage, draw it; compare with drawing a single draft.
  3. **Production design** if it wins: N scripts, a judge pick, one drawing. Cost: N author calls plus one judging pass, and no extra images.
- **Decision rule:** adopt if the picker agrees with v2 at least 70% of the time and the selected arm beats single-draft on humor.

### 3. Carrying the PR in-world
- **Question:** which mechanism restores "about this PR" without bringing office parody back?
- **Evidence:** r12's documents; r19's stand-in objects; random settings; missing entry points.
- **Arms** (scripts first, then draw the best two):
  - (a) a plain in-world before→after line, spoken;
  - (b) host offers 3 settings and the author picks the best fit;
  - (c) fantasy documents allowed: quest board, scroll, map, status window. Narrow the office rule to "no clerks or bureaucracy as the joke";
  - (d) the entry point (command or product name) required among the anchor terms;
  - replace the last-panel rule with "named in dialogue at the payoff", since it was gamed by signs.
- **Checks:** the office-parody rate, using the checklist's office-like measure as the bar.
- **Decision rule:** keep the arms that raise about-this-PR without raising office parody or lowering humor.

### 4. Choosing the material
- **Question:** should the author first pick which detail of the PR to joke about, the one closest to a universal developer gripe, before any setting or cast?
- **Evidence:** the material sets the ceiling (winapps); obscure identifiers sink jokes; side details replace the purpose.
- **Experiment:** a "material" step that ranks 3 candidate details by how universal the gripe is and how central it is to the PR's purpose, then writes from the top one. Compare with path 1's (c) on scripts.
- **Variety:** also test whether it reduces repeated premises (gates, bridges, tolls) across a round.
- **Decision rule:** keep it if it beats (c) on humor or about-this-PR without lowering the other.

### 5. Leaner instructions
- **Question:** does cutting the packet to what matters raise quality, by giving the author less to juggle?
- **Evidence:**
  - about 95 KB and about 85 rules;
  - staging rules grew every round;
  - documentation gaps cost a check round in most comics (`leadLook`, BOM, `memeOffer`).
- **Experiment:**
  - Fix the gaps first (path 7).
  - Then an ablation on scripts: the current packet against a slim one (the PR, the cast, the assigned layout, the joke rules from path 1, the anchor rule), with staples and memes removed or moved to an optional appendix.
  - Separately, test staples on or off.
- **Decision rule:** keep the slim packet if it is no worse on any criterion; drop staples if "on" doesn't beat "off" on veteran appeal.

### 6. Measurement: a script judge, better anchors, the remaining criteria
- **Question:** can we iterate cheaply on scripts, and are the anchors measuring the right thing?
- **Experiments:**
  - **Script-stage judge:** score r12–r19 scripts pairwise (text only, plus the PR) and measure correlation with their page-level v2 scores. If the correlation is high, paths 1–5 run at the script stage at about a tenth of the cost.
  - **Genre-matched anchors:** add the Pepper&Carrot gag pages that actually land, more fantasy and webcomic gag strips, and developer-life strips beyond xkcd. Report "vs developer comics" and "vs genre comics" separately. Re-check the humor prompt's "software developer" framing against the caption-contest data.
  - **About this PR and veteran appeal:** move both into v2 games (Codex and Claude, both orders, with the PR context), so they get position correction and a second family.
- **Decision rule:**
  - the script judge is used for screening only if its correlation with page scores is ≥ 0.6;
  - anchor scores are reported per family of comics.

### 7. Quick fixes (no research needed; do first)
- **Author documentation:**
  - state `leadLook` ≤ 80 characters, or derive it from the cast;
  - accept a UTF-8 BOM in `comic check`;
  - rename `memeOffer` to `tropeOffer` in the skill.
- **Image stage:**
  - a "possible" offensive-symbol misread forces a redraw;
  - add a lettering and legibility field to the checklist.
- **Bench:**
  - fix `author/stats.json` check-run counting;
  - give the review steps their own slot pool.

## Order

1. **Path 7:** quick fixes.
2. **Path 6, the script judge and its validation** (no images). It gates the cheap screening for everything else.
3. **Paths 1, 3 and 4 as script-stage arms on the 20 dev cases;** path 5's slim packet as a further arm.
4. **Path 2, picker accuracy, on existing pairs** (no new comics).
5. **One drawn round (r20):** the best script-stage combination, plus selection if path 2 passes, scored on v2 with the improved anchors.

## Verification

- **Script judge:** its correlation with page-level v2 scores on r12–r19 is reported before it is used.
- **Each research arm:** reported with CIs on the v2 scale and the office-parody rate; keep or drop by the decision rules above.
- **Quick fixes:** unit tests (BOM accepted, `leadLook` documented or derived, misread "possible" forces a redraw), then the full Tracetoon suite and the bench tests.
- **Round 20:** the canary, then the run, a write-up with per-structure humor and about-this-PR breakdowns like this one, and both branches pushed.
