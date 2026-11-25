"""Meme list for Tracetoon from the research toolkit v3 (meme-patterns.json).

Usage: python -I convert_memes.py <toolkit dir> <out.json>
Keeps patterns in the isekai and fantasy-anime scopes with real evidence
(documented meme, documented fandom pattern, observed post) that work in a
static comic, as the toolkit's own quick start recommends. Canon premises are
plot premises, not memes; broader anime imports are left out of this genre.
"""
import json, sys
from pathlib import Path

kit = Path(sys.argv[1])
patterns = json.load(open(kit / 'meme-patterns.json', encoding='utf-8'))
sources = json.load(open(kit / 'sources.json', encoding='utf-8'))
sources = sources if isinstance(sources, list) else sources.get('sources', list(sources.values()))
url_of = {s['id']: s.get('url') for s in sources if isinstance(s, dict) and 'id' in s}

EVIDENCE = {'documented_meme', 'documented_fandom_pattern', 'observed_post'}
SCOPES = {'isekai', 'fantasy_anime'}
out, skipped = [], {}
for p in patterns:
    why = None
    if p['evidence_level'] not in EVIDENCE: why = 'evidence:' + p['evidence_level']
    elif p['scope'] not in SCOPES: why = 'scope:' + p['scope']
    elif p['static_comic_suitability'] == 'weak': why = 'static:weak'
    elif p['audio_dependency'] == 'essential': why = 'audio:essential'
    if why:
        skipped[why] = skipped.get(why, 0) + 1
        continue
    urls = [url_of.get(i) for i in p.get('evidence_source_ids', [])] + list(p.get('source_urls', []))
    urls = [u for u in urls if u]
    out.append({
        'id': p['id'].lower(),
        'name': p['label'],
        'allusion': p['recognition_hook'],
        'cues': p.get('minimum_recognition_cues', [])[:4],
        'series': ', '.join(p.get('source_series', [])[:2]) or 'anime fantasy',
        'evidence': {'tier': p['evidence_level'], 'url': urls[0] if urls else ''},
        'suits': sorted(set(p.get('usable_archetype_ids', []) + p.get('primary_archetype_ids', []))),
        **({'requires': p['world_rules_all']} if p.get('world_rules_all') else {}),
        'priority': p.get('priority', {}).get('score', 0),
    })
out.sort(key=lambda m: (-m['priority'], m['id']))
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(out), 'memes;', dict(Counter(m['evidence']['tier'] for m in out)), '; skipped', skipped)
print('no url:', sum(1 for m in out if not m['evidence']['url']), '; with world rules:', sum(1 for m in out if 'requires' in m))
