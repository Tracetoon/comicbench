ANIME FANTASY MEME TOOLKIT — VERSION 3
Research snapshot: November 25, 2026 (America/Los_Angeles)

START HERE
For a better meme vocabulary, ingest meme-patterns.json first. It contains 247 canonical researched patterns; documented-memes.json is the strict 125-family documented subset. anime-fantasy.json provides 5,300 compatible application rows for retrieval and caption/cast variation.

EXACT COUNTS
- 125 documented meme families.
- 28 documented fandom patterns.
- 19 patterns supported by an observed post/artifact.
- 75 canon/premise patterns.
- 530 retained v2 scenarios + 4,770 new captioned applications = 5,300 rows.
- 37 broad browsing categories; 93 normalized series/franchise anchors.
- 381 source records from 323 distinct URL strings.
- All 106 archetypes in the unchanged system.json are represented in the canonical cast mappings and full reverse index.

The documented total is approximately 11.4 times the approximately eleven distinct documented families described in the handoff. It includes 21 isekai, 45 fantasy-anime, and 59 explicitly labeled broader-anime imports. Restricting to isekai/fantasy retains 66 documented families, plus the relevant lower-evidence premises and fandom patterns. The full application file is exactly ten times the previous 530-row pool.

FILE MAP
meme-patterns.json          Canonical researched patterns, cast roles, cues, evidence, and priority.
documented-memes.json       Strict documented_meme subset; best starting point for established formats.
premise-gimmicks.json       Title/premise material, including the newer niche anime.
anime-fantasy.json          5,300 extended application rows; retains tier/roles/meme/use fields.
anime-fantasy.legacy.json   Four-field export for an older consumer; loses the richer matching safeguards.
anime-fantasy-index.json    Reverse character index, categories, allocations, source registry, methodology.
sources.json               Evidence records and exact URLs; includes preserved baseline sources.
categories.json            37 category definitions, counts, and associated pattern IDs.
world-rule-glossary.json   Explicit setting/capability gates and the patterns that use them.
system.json                Your supplied 106-archetype catalog, unchanged.
ai_matching_prompt.txt     Full AI matching and comic adaptation instructions.
AI_MATCHING_PROMPT.txt     Identical uppercase compatibility alias.
match_memes.py             Python standard-library cast filter and lexical shortlist builder.
build_pool.py              Deterministic builder for the full 5,300-row pool.
baseline-530.json          Exact v2 input rows used by the builder.
application-contexts.json  Authored caption briefs; not independently discovered memes.
anime-fantasy.schema.json  JSON Schema for the extended row contract.
validate_pool.py           Integrity and meaningful matcher regression checks.
validation.json            Results and hashes for the delivered snapshot.
matching_examples.json     Actual lexical outputs plus smaller editorial selections showing semantic review.
example-cast.json          A small illustrative fixed cast with names and instance IDs.
research_report.txt        Findings, source interpretation, counting decisions, and limitations.
pattern-catalog.txt        Readable full canonical catalog with cues, casting, examples, and URLs.
pattern-merge-log.json     Five merged research records and their surviving canonical IDs.

QUICK START — PYTHON 3.9 OR LATER, NO RUNTIME PACKAGES REQUIRED
Run commands from the unpacked toolkit directory.

1. Generate a strict documented shortlist for a fixed party:
python3 match_memes.py --cast M02,P15,P17,P21 --joke "One impressive action uses all the energy for the rest of the day" --documented-only --scope isekai,fantasy_anime --static-only --limit 3

2. Let the matcher propose the required actors for a joke:
python3 match_memes.py --plan-cast --joke "The manager claims credit after someone else does all the work" --documented-only --static-only --limit 3

3. Use named instances and confirmed story facts:
python3 match_memes.py --cast-file example-cast.json --joke "The specialist is powerful but cannot handle one basic practical task" --scope isekai,fantasy_anime --limit 3

4. Inspect conditional options, with their missing requirements disclosed:
python3 match_memes.py --cast M13,P05 --joke "The legendary weapon is also the responsible camp chef" --include-conditional --limit 3

5. Rebuild and validate:
python3 build_pool.py
python3 validate_pool.py

FILTERS AND LIMITS
--documented-only accepts only documented_meme rows, excluding the legacy rows even if they cite a documented pattern. --scope isekai,fantasy_anime excludes broader anime imports and legacy_mixed_fantasy. Omit --scope to consider all scopes.

--static-only rejects essential-audio formats and explicitly weak static formats. Helpful audio with conditional static suitability can still pass; missing legacy metadata remains eligible. The AI must still check that the chosen pose, lettering, or sequence preserves recognition.

By default, the shortlist contains at most one application per pattern_id or dedupe_group. --allow-same-pattern is an intentional opt-in to variants. Fixed-cast mode never adds actors. --plan-cast proposes the necessary participants; it is not a full party-composition generator and does not override system.json's separate party-building guidance.

The matcher uses lexical and topic fit, then evidence priority as a tie-break. It has no embeddings, no model calls, and no live social analytics. It is a candidate retriever, not a complete semantic judge; use ai_matching_prompt.txt to rerank and write the final comic. matching_examples.json shows this distinction explicitly: raw lexical results can include weak analogies, while the smaller editorial selection keeps the actual reversal. A source-title-only query intentionally receives no joke relevance; filter source_series in the registry for series browsing instead. Pre-filter programmatically and send only the shortlist, relevant character cards, and source records into the AI prompt rather than the entire 5,300-row file.

CONDITIONS
world_rules is an explicit list of confirmed story facts. The caller must confirm the capability for the actor actually assigned to the scene. The script does not infer all a source anime character's powers from a similar archetype. Relationship conditions use slot names in the pool and actual instance IDs in the cast file. Adult presentation is checked only for scenes that declare it.

COUNTING AND EVIDENCE
Do not market the 5,300 rows as 5,300 discovered viral memes. They are 530 original legacy scenarios and 4,770 caption/cast applications of 247 researched patterns. The original example scene may recur across several applications; a new caption is not new research evidence. Canonical family IDs are the intended diversity unit.

Priority measures editorial evidence strength and dated activity, capped at the pattern's evidence class. It does not compare platform-wide popularity. Old engagement snapshots keep their original context and are not current totals. The source examples, original reference scenes, and application captions remain separately identified.

JSON SCHEMA
The schema accepts a subset array as well as the full pool. validate_pool.py checks the delivered 5,300-row count and referential integrity. If jsonschema is installed, validation additionally checks the JSON Schema; the other checks run using Python's standard library.
