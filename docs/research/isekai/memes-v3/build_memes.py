"""Seed anime meme list (option 3) from the research index's documented sources.

Usage: python -I build_memes.py <anime-fantasy.json> <anime-fantasy-index.json> <out.json>
The expanded list from the parallel research agent replaces this later.
"""
import json, sys

pool = json.load(open(sys.argv[1], encoding='utf-8'))
index = json.load(open(sys.argv[2], encoding='utf-8'))
sources = index['sources'] if isinstance(index['sources'], list) else list(index['sources'].values())
src = {s['id']: s for s in sources}

# id, name, allusion (how to evoke it on the page without naming the work), series, source ids
MEMES = [
    ('whispered-ultimate-attack', 'I Am Atomic', 'a cloaked figure dims the lights and whispers a grand ultimate-attack name at something trivial', 'The Eminence in Shadow', ['L-T01']),
    ('sasuga-master-plan', 'Sasuga Ainz-sama', 'loyal followers praise an accident or improvisation as the master\'s flawless secret plan', 'Overlord', ['P-T03', 'L-T02', 'W-T01']),
    ('applaud-supreme-power', 'Applaud my supreme power', 'an overlord demands applause for a display of power that was barely anything', 'Overlord', ['L-T11']),
    ('useless-goddess', 'Aqua is useless', 'the party\'s self-proclaimed goddess is loudly, tearfully useless at the one job she boasted about', 'KonoSuba', ['P-T01']),
    ('one-big-explosion', 'Megumin\'s Explosion', 'a mage who only knows one enormous explosion spell casts it at a tiny problem, then collapses face-down and has to be carried', 'KonoSuba', ['P-T02']),
    ('mimic-chest', 'Frieren stuck in a mimic chest', 'a mage is stuck head-first in a treasure-chest mimic, legs kicking, after insisting on opening it', "Frieren: Beyond Journey's End", ['L-T13']),
    ('truck-kun', 'Truck-kun', 'a looming truck is the portal that sends people to another world', 'isekai genre (fandom nickname)', ['W-T02', 'W-T03']),
    ('glasses-glint', 'Anime glasses', 'a schemer pushes up their glasses and both lenses flash opaque white', 'anime trope', ['L-T07']),
    ('tsundere-denial', 'Tsundere', '"It\'s not like I did it for you!" while blushingly doing exactly that', 'anime trope', ['P-T11']),
    ('hero-squares-up', "Kazuma's square up", 'the hero squares up in a fighting stance facing his own troublesome party members', 'KonoSuba', ['L-T03']),
    ('cooking-head-bob', 'How it feels to cook a yummy meal', 'a character smiles and head-bobs blissfully through a sparkling cooking montage', 'anime redraw format (2026)', ['R-T01']),
    ('return-by-death', 'Return by Death', 'a hero dies in a silly way and wakes back at the same checkpoint, already exhausted by the loop', 'Re:Zero', ['L-T04', 'L-T12']),
    ('oblivious-doom-flags', 'Bakarina', 'a cheerful heroine dodges every doom flag while everyone around her falls for her, and she notices none of it', 'My Next Life as a Villainess', ['L-T05', 'W-T04']),
    ('lethal-cooking', "Shion's cooking", 'a proud cook serves a dish that is visibly a hazard, purple smoke and all', 'That Time I Got Reincarnated as a Slime', ['P-T04', 'P-T05']),
    ('tiny-hidden-boss', 'The small monster is the boss', 'a tiny, cute monster turns out to be the most dangerous thing in the dungeon', "So I'm a Spider, So What?", ['L-T10', 'L-T09']),
    ('my-meat', 'Fel: my meat', 'a legendary wolf guards its meat portion with total, dignified possessiveness', 'Campfire Cooking in Another World', ['P-T09']),
    ('appraisal-crystal-breaks', 'The appraisal crystal breaks', 'an "F-rank" newcomer touches the guild\'s appraisal crystal and it cracks while the receptionist freezes', 'isekai genre (guild stories)', ['W-T07']),
    ('anxious-emperor', 'Best frend', 'an anxious ruler misreads a polite overpowered visitor\'s every word as a threat', 'Overlord', ['W-T08']),
    ('crumbs-goddess', 'The goddess with crumbs', 'a supposedly dignified goddess delivers a solemn speech with food crumbs on her face', 'Tondemo Skill de Isekai Hourou Meshi', ['W-T05']),
    ('i-suppose-pout', 'Grumpy Beatrice, I suppose', 'a tiny library spirit pouts with crossed arms and ends every sentence with "I suppose"', 'Re:Zero', ['P-T07', 'P-T06']),
    ('retro-console-uncle', 'Uncle and the SEGA Saturn', 'a returned hero explains everything through his love of a long-dead game console', 'Uncle from Another World', ['L-T06']),
    ('strength-solves-it', 'Delta solves it with strength', 'a beast-girl fighter answers every complicated plan with "just hit it harder"', 'The Eminence in Shadow', ['P-T08']),
]

TIER = {'documented_meme': 1, 'documented_fandom_pattern': 2, 'observed_post': 3, 'series_attention_only': 4}

out = []
for mid, name, allusion, series, ids in MEMES:
    best = min(ids, key=lambda i: TIER[src[i]['evidence_tier']])
    suits = sorted({e['focus_archetype_id'] for e in pool if set(e.get('trend_evidence_ids', [])) & set(ids)})
    out.append({
        'id': mid,
        'name': name,
        'allusion': allusion,
        'series': series,
        'evidence': {'tier': src[best]['evidence_tier'], 'url': src[best]['url']},
        'suits': suits,
    })
json.dump(out, open(sys.argv[3], 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
print(len(out), 'memes;', sum(1 for m in out if m['evidence']['tier'] == 'documented_meme'), 'documented')
