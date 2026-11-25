#!/usr/bin/env python3
"""Seeded isekai cast sketches and explicit rule checks. Python standard library only.

Examples:
  python generate_isekai_party.py --preset standard_adventure --seed 12
  python generate_isekai_party.py --preset object_duo --batch 10
  python generate_isekai_party.py --validate my_cast.json
  python generate_isekai_party.py --self-test

Editorial caps are adjustable design policies, not measured genre frequencies.
Mechanical validation does not measure audience recognition or comic quality.
"""

import argparse
from collections import Counter
from copy import deepcopy
import json
from pathlib import Path
import random
import sys


HERE = Path(__file__).resolve().parent
DEFAULT_DATA = HERE / "isekai_archetype_system.json"
AGE_GROUPS = {"adult", "child", "teen", "nonhuman"}
NONHUMAN_DEFAULTS = {"M10", "M11", "M12", "M13", "M14", "M25", "P34", "P36", "P37", "P38", "P39"}
WORLD_POOLS = {
    "standard_adventure": ["N01", "N02", "N04", "N05", "N07", "N09", "N18", "N19", "N20", "N22"],
    "disaster_comedy": ["N01", "N04", "N05", "N07", "N18", "N20", "N30"],
    "harem_adventure": ["N01", "N04", "N05", "N09", "N10", "N12", "N16", "N19"],
    "survival": ["N04", "N05", "N09", "N19", "N20", "N22"],
    "cozy_familiars": ["N01", "N04", "N05", "N07", "N09", "N20", "N22", "N28"],
    "object_duo": ["N01", "N05", "N07", "N08", "N09", "N19", "N22", "N30"],
    "court_otome": ["N09", "N10", "N11", "N12", "N13", "N14", "N16", "N30"],
    "monster_court": ["N09", "N10", "N12", "N19", "N20", "N24", "N25", "N26", "N30"],
    "professional": ["N01", "N05", "N07", "N08", "N09", "N10", "N15", "N16", "N19", "N22", "N30"],
    "military": ["N19", "N30"],
    "cozy_household": ["N04", "N05", "N07", "N09", "N10", "N16", "N20", "N22"],
    "guild_ensemble": ["N01", "N02", "N04", "N05", "N07", "N09", "N19", "N30"],
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_system(path):
    data = read_json(path)
    index = {item["id"]: item for item in data["archetypes"]}
    if len(index) != len(data["archetypes"]):
        raise ValueError("Catalog contains duplicate archetype IDs.")
    for name, preset in data["presets"].items():
        ids = list(preset.get("main_pool", [])) + list(preset.get("party_pool", []))
        for members in preset.get("fixed_support_by_main", {}).values():
            ids.extend(members)
        missing = sorted(set(ids) - index.keys())
        if missing:
            raise ValueError(f"Preset {name} refers to missing archetypes: {missing}")
    return data, index


def support_bounds(preset):
    bounds = preset.get("support_count", preset.get("minmax", [3, 4]))
    if isinstance(bounds, int):
        return bounds, bounds
    if isinstance(bounds, dict):
        return bounds["min"], bounds["max"]
    return bounds[0], bounds[1]


def as_tags(value):
    if not value:
        return []
    return [value] if isinstance(value, str) else list(value)


def mechanisms(member, config):
    baseline = as_tags(config.get("mechanism_by_id", {}).get(member["archetype_id"]))
    return set(baseline) | set(as_tags(member.get("mechanism_tags")))


def age_for(archetype_id, config):
    explicit = config.get("age_group_by_id", {}).get(archetype_id)
    if explicit:
        return explicit
    if archetype_id in config.get("child_default_ids", []) or archetype_id in {"N06", "N21"}:
        return "child"
    if archetype_id in config.get("teen_default_ids", []):
        return "teen"
    if archetype_id in NONHUMAN_DEFAULTS or archetype_id in config.get("nonhuman_default_ids", []):
        return "nonhuman"
    return "adult"


def make_member(archetype_id, role, index, config, main_id=None, preset_name=None):
    archetype = index[archetype_id]
    familiar = archetype_id in config.get("familiar_ids", [])
    relation = "self" if role == "main" else ("local_contact" if role == "world" else ("familiar" if familiar else "companion"))
    relation = config.get("relationship_by_id", {}).get(archetype_id, relation)
    result = {
        "archetype_id": archetype_id,
        "narrative_role": role,
        "title": archetype["title"],
        "present_age_group": age_for(archetype_id, config),
        "romance_enabled": False,
        "relationship_to_main": relation,
        "species": archetype.get("default_species", "unspecified"),
        "mechanism_tags": as_tags(config.get("mechanism_by_id", {}).get(archetype_id)),
        "contribution": archetype.get("core", ""),
        "functions": archetype.get("functions", []),
    }
    if main_id == "M13" and archetype_id == "P05":
        result.update(present_age_group="child", relationship_to_main="ward", willing_wielder=True)
        result["chosen_variant"] = "Nonromantic child adventurer in a guardian and willing wielder partnership."
    if preset_name == "military" and role == "party":
        result.update(species="human", relationship_to_main="colleague")
        result["chosen_variant"] = "Original military-setting version of the role; uniform and equipment follow this worlds military premise."
    overrides = config.get("fixed_instance_overrides_by_main", {}).get(main_id, {}).get(archetype_id, {})
    result.update(deepcopy(overrides))
    return result


def is_elf(member, archetype, config):
    species = str(member.get("species", archetype.get("default_species", ""))).lower()
    species = species.replace("-", "_").replace(" ", "_")
    return species in config.get("elf_species", []) or "elf" in species or "elven" in species


def validate_cast(cast, data, index=None, preset_override=None):
    """Return separate mechanical errors, editorial policy failures, and warnings."""
    index = index or {a["id"]: a for a in data["archetypes"]}
    config = data.get("generation_config", {})
    preset_name = cast.get("preset")
    preset = preset_override or data.get("presets", {}).get(preset_name)
    hard, policy, warnings = [], [], []

    def fail(code, message):
        hard.append({"rule": code, "message": message})

    def editorial(code, message):
        override = cast.get("overrides", {}).get(code, {})
        reason = override.get("justification", "") if isinstance(override, dict) else ""
        if isinstance(reason, str) and len(reason.strip()) >= 12:
            warnings.append({"rule": code, "message": message, "accepted_exception": reason})
        else:
            policy.append({"rule": code, "message": message})

    if preset is None:
        fail("preset", f"Unknown preset: {preset_name}")
        preset = {}
    members = cast.get("members", [])
    if not isinstance(members, list) or not members:
        fail("members", "A cast requires a nonempty members list.")
        members = []
    known = []
    contacts = cast.get("world_contacts", [])
    if not isinstance(contacts, list):
        fail("world_contacts", "world_contacts must be a list when supplied.")
        contacts = []
    for number, member in enumerate(members + contacts):
        aid = member.get("archetype_id")
        if aid not in index:
            fail("archetype", f"Unknown archetype {aid!r} in member {number + 1}.")
            continue
        known.append(member)
        role = member.get("narrative_role")
        if role not in {"main", "party", "world"}:
            fail("role", f"{aid} needs main, party, or world as narrative_role.")
        if member.get("present_age_group") not in AGE_GROUPS:
            fail("age", f"{aid} needs an explicit adult, child, teen, or nonhuman age group.")
        if not isinstance(member.get("romance_enabled"), bool):
            fail("romance_flag", f"{aid} needs an explicit boolean romance_enabled.")
        if role == "party" and not member.get("relationship_to_main"):
            fail("relationship", f"{aid} needs a declared reason or relationship for joining.")
        if member.get("romance_enabled"):
            relation = member.get("relationship_to_main")
            if member.get("present_age_group") != "adult":
                fail("romance_age", f"{aid} is not an explicitly adult romantic design.")
            if relation in {"familiar", "ward", "child", "sibling", "parent"} or aid in config.get("familiar_ids", []):
                fail("romance_relationship", f"{aid} has a nonromantic familial or familiar relationship.")
            if aid in config.get("nonromantic_ids", []):
                fail("romance_catalog", f"{aid} uses a nonromantic catalog default.")
            if preset.get("romance_mode") == "off":
                fail("romance_mode", f"Romance is off in preset {preset_name}.")

    active = [m for m in known if m.get("narrative_role") in {"main", "party"}]
    leads = [m for m in active if m.get("narrative_role") == "main"]
    supporters = [m for m in active if m.get("narrative_role") == "party"]
    bundle = cast.get("protagonist_bundle", {})
    bundle_valid = bool(bundle.get("id")) and sorted(bundle.get("members", [])) == sorted(m["archetype_id"] for m in leads)
    if len(leads) != 1 and not (len(leads) > 1 and bundle_valid):
        fail("main_count", "Use exactly one protagonist, or an explicitly named bundle listing every co-lead.")
    if leads:
        for lead in leads:
            if preset.get("main_pool") and lead["archetype_id"] not in preset["main_pool"]:
                editorial("main_pool", f"{lead['archetype_id']} is outside this presets normal protagonist pool.")
    for member in supporters:
        if preset.get("party_pool") and member["archetype_id"] not in preset["party_pool"]:
            editorial("party_pool", f"{member['archetype_id']} is outside this presets normal support pool.")
    if preset.get("support_count") is not None:
        low, high = support_bounds(preset)
        if not low <= len(supporters) <= high:
            editorial("support_count", f"Expected {low} to {high} supporting focal characters; found {len(supporters)}.")

    character_ids = [m["character_id"] for m in active if m.get("character_id")]
    if len(character_ids) != len(set(character_ids)):
        fail("character_identity", "Two active entries reuse the same character_id; forms belong to one individual.")
    counts = Counter(m["archetype_id"] for m in active)
    if any(value > 1 for value in counts.values()):
        editorial("repeated_archetype", "The same archetype appears more than once; describe the intended twin, rival, or cohort distinction.")
    signature_counts = Counter(index[m["archetype_id"]].get("signature_family", m["archetype_id"]) for m in active)
    repeated = [key for key, value in signature_counts.items() if value > 1]
    if repeated and not preset.get("allow_repeated_signature", False):
        editorial("repeated_signature", f"Repeated dramatic families need an intentional contrast: {', '.join(repeated)}.")

    elf_count = sum(is_elf(m, index[m["archetype_id"]], config) for m in active)
    cap = preset.get("elf_cap")
    if cap is not None and elf_count > cap:
        editorial("elf_cap", f"This preset prefers at most {cap} elf-coded members; found {elf_count}. This includes half and dark elves.")
    mascot_count = sum(m["archetype_id"] in config.get("mascot_ids", []) or m.get("relationship_to_main") == "familiar" for m in active)
    cap = preset.get("mascot_cap")
    if cap is not None and mascot_count > cap:
        editorial("mascot_cap", f"This preset prefers at most {cap} familiar focal units; found {mascot_count}.")
    premise_tags = sorted(set().union(*(mechanisms(m, config) for m in active))) if active else []
    budget = preset.get("novelty_budget")
    if budget is not None and len(premise_tags) > budget:
        editorial("novelty_budget", f"Found {len(premise_tags)} separate premise mechanisms against budget {budget}: {', '.join(premise_tags)}.")

    functions = set().union(*(set(index[m["archetype_id"]].get("functions", [])) for m in active)) if active else set()
    missing_functions = sorted(set(preset.get("required_functions", [])) - functions)
    if missing_functions:
        editorial("function_coverage", f"Missing broad functions for this preset: {', '.join(missing_functions)}. Support does not imply healing.")
    for lead in leads:
        aid = lead["archetype_id"]
        if aid == "M14" and not any(m["archetype_id"] == "P40" for m in supporters) and not lead.get("mobility_solution") and not cast.get("mobility_solution"):
            fail("mobility", "The vending-machine expedition needs P40 or an explicit mobility_solution, including a stated fixed-location format.")
        if aid == "M13" and not any(m.get("willing_wielder") for m in supporters):
            fail("wielder", "The weapon-guardian premise needs a willing wielder. Teacher-like telekinesis means this is a relationship dependency, not immobility.")
        if aid == "M04" and not any("damage" in index[m["archetype_id"]].get("functions", []) for m in supporters):
            fail("attack_dependency", "A defense-limited shield protagonist needs another active member with an attacking role.")
        for required in preset.get("fixed_support_by_main", {}).get(aid, []):
            if required not in [m["archetype_id"] for m in supporters]:
                editorial("fixed_support", f"This preset pairs {aid} with {required}; a deliberate alternative needs a justified override.")

    return {
        "mechanically_valid": not hard,
        "passes_selected_editorial_policies": not policy,
        "hard_errors": hard,
        "policy_failures": policy,
        "warnings": warnings,
        "recognized_by_audience": "not_measured",
        "coverage": {"broad_functions": sorted(functions), "missing_functions": missing_functions, "elf_count": elf_count, "familiar_focal_units": mascot_count, "premise_mechanisms": premise_tags},
    }


def editorial_notes(cast, index):
    """A few visible creative risks; these are not physics or hard rejections."""
    ids = {m["archetype_id"] for m in cast["members"]}
    notes = ["Choose individual names, voices, goals, and relationships before using this sketch in a comic."]
    if len(ids & {"P15", "P16", "P33"}) > 1:
        notes.append("Two healing-oriented templates overlap: distinguish emergency treatment, purification, supplies, payment, or personal goals.")
    if len(ids & {"P02", "P23", "P24", "P44"}) > 1:
        notes.append("Several court-linked figures need distinct status, obligations, and reasons to travel together.")
    if sum("frontline" in index[m["archetype_id"]].get("functions", []) for m in cast["members"]) >= 3:
        notes.append("Several members can stand in front: separate protection, pursuit, reach, and intimidation instead of giving them the same fight beat.")
    if any(m["narrative_role"] == "main" and m["present_age_group"] in {"child", "teen"} for m in cast["members"]):
        notes.append("The young lead needs explicit friend, mentor, guardian, or colleague relationships; adult romance is not inferred from nearby companions.")
    if cast["preset"] == "harem_adventure":
        notes.append("This is an adult romance candidate pool. Select explicit consenting adult romantic bonds; the sketch currently enables none.")
    return notes


def generate_cast(data, index, preset_name, seed):
    preset = data["presets"][preset_name]
    config = data.get("generation_config", {})
    rng = random.Random(seed)
    low, high = support_bounds(preset)
    for attempt in range(500):
        main_id = rng.choice(preset["main_pool"])
        selected = list(preset.get("fixed_support_by_main", {}).get(main_id, []))
        count = max(rng.randint(low, high), len(selected))
        remaining = [aid for aid in preset["party_pool"] if aid not in selected]
        if len(remaining) < count - len(selected):
            continue
        selected.extend(rng.sample(remaining, count - len(selected)))
        members = [make_member(main_id, "main", index, config, main_id, preset_name)]
        members.extend(make_member(aid, "party", index, config, main_id, preset_name) for aid in selected)
        for number, member in enumerate(members, 1):
            member["character_id"] = f"character_{number}"
        cast = {"preset": preset_name, "seed": seed, "scope": preset.get("scope"), "members": members, "overrides": {}, "sustain_plan": preset.get("sustain_plan", "Specify recovery and resupply."), "generation_note": "Original cast sketch from archetype recipes; not a canonical series roster. Romance remains off until explicit adult relationships are designed."}
        if preset_name == "survival":
            cast["phase_note"] = "An expedition after recruitment, or a longitudinal ally network; a spider-like solo opening can precede this cast."
        if preset_name == "military":
            cast["phase_note"] = "Supporting templates use original native military variants, not transplanted canonical source characters."
        result = validate_cast(cast, data, index)
        if not result["mechanically_valid"] or not result["passes_selected_editorial_policies"]:
            continue
        candidate_world = preset.get("world_pool", config.get("world_pool_by_preset", {}).get(preset_name, WORLD_POOLS.get(preset_name, config.get("world_pool", []))))
        world_pool = [aid for aid in candidate_world if aid in index]
        cast["world_contacts"] = [make_member(aid, "world", index, config, main_id, preset_name) for aid in rng.sample(world_pool, min(2, len(world_pool)))]
        cast["editorial_review_notes"] = editorial_notes(cast, index)
        cast["validation"] = validate_cast(cast, data, index)
        cast["sampling_attempts"] = attempt + 1
        return cast
    raise ValueError(f"Could not satisfy preset {preset_name} after 500 attempts; inspect its pools, dependencies, and editorial caps.")


def roster_key(cast):
    return tuple(sorted((m["narrative_role"], m["archetype_id"]) for m in cast["members"]))


def run_fixture_checks(data, index):
    """Domain-based cast shapes and deliberately broken input, independent of sampling."""
    config = data.get("generation_config", {})
    policy = {"elf_cap": 1, "mascot_cap": 2, "novelty_budget": 1, "allow_repeated_signature": False, "required_functions": [], "romance_mode": "optional_adults_only"}
    tests = []

    def fixture(name, ids, expected, edit=None, expected_rule=None):
        members = [make_member(aid, "main" if n == 0 else "party", index, config, ids[0]) for n, aid in enumerate(ids)]
        cast = {"preset": "fixture", "members": members, "overrides": {}}
        if edit:
            edit(cast)
        result = validate_cast(cast, data, index, policy)
        valid = result["mechanically_valid"] and result["passes_selected_editorial_policies"]
        codes = [x["rule"] for x in result["hard_errors"] + result["policy_failures"]]
        passed = valid == expected and (expected_rule is None or expected_rule in codes)
        tests.append({"name": name, "passed": passed, "expected_valid": expected, "observed_valid": valid, "expected_rule": expected_rule, "observed_rules": codes})

    fixture("Recognizable dysfunctional quartet", ["M02", "P15", "P17", "P21"], True)
    fixture("Shield and offensive partner", ["M04", "P09", "P35"], True)
    fixture("Weapon guardian and willing child wielder", ["M13", "P05"], True)
    fixture("Vending machine and strong carrier", ["M14", "P40"], True)
    fixture("Cook with large and small familiars", ["M15", "P37", "P36"], True)
    fixture("Solo spider opening", ["M12"], True)
    fixture("Two unbundled protagonists", ["M01", "M04", "P09"], False, lambda c: c["members"][1].update(narrative_role="main"), "main_count")
    fixture("Two elf profiles without exception", ["M01", "P01", "P04"], False, expected_rule="elf_cap")
    fixture("Repeated identical elf profile", ["M01", "P01", "P01"], False, expected_rule="repeated_archetype")
    fixture("Immobile machine without transport", ["M14", "P16"], False, expected_rule="mobility")
    fixture("Shield with no attacking companion", ["M04", "P15", "P16"], False, expected_rule="attack_dependency")
    fixture("Romance assigned to a child", ["M06", "P29"], False, lambda c: c["members"][0].update(romance_enabled=True), "romance_age")
    fixture("Romance assigned to a familiar", ["M15", "P37"], False, lambda c: c["members"][1].update(present_age_group="adult", romance_enabled=True), "romance_relationship")
    fixture("Unrelated added time mechanism", ["M01", "P16"], False, lambda c: c["members"][1].update(mechanism_tags=["time_loop"]), "novelty_budget")

    def elf_exception(cast):
        cast["overrides"] = {"elf_cap": {"justification": "Deliberate elf siblings traveling together with different professions."}, "repeated_signature": {"justification": "One precise archer and one formal shield-bearing bodyguard have contrasting tasks and speech."}}
    fixture("Documented two-elf travel exception", ["M01", "P01", "P04"], True, elf_exception)
    fixture("Fixed-location vending service", ["M14", "P16"], True, lambda c: c.update(mobility_solution="The story stays in one village shop; no mobile expedition occurs."))
    fixture("Weapon with no willing wielder", ["M13", "P16"], False, expected_rule="wielder")

    def bundled_leads(cast):
        cast["members"][1]["narrative_role"] = "main"
        cast["protagonist_bundle"] = {"id": "linked_summoned_duo", "members": ["M01", "M04"]}
        cast["overrides"] = {"novelty_budget": {"justification": "The two declared protagonists share one summoning incident and one magic system rather than introducing unrelated genre mechanisms."}}
    fixture("Explicitly bundled co-leads with shared premise", ["M01", "M04", "P09"], True, bundled_leads)
    return tests


def run_reference_shapes(data, index):
    """Adapt ten researched casts to coarse structural fixtures, not full canon models.

    Catalog IDs act only as mechanical role proxies here. Source names, scopes,
    relationships, species overrides, and child safeguards are explicit. Passing
    these selected regressions is not an independent statistical evaluation.
    """
    config = data.get("generation_config", {})
    cases = [
        ("KonoSuba", "traveling_party", ["M02", "P15", "P17", "P21"], ["Kazuma", "Aqua", "Megumin", "Darkness"], "https://konosuba.com/3rd/character/"),
        ("Handyman Saitou", "dungeon_party", ["M30", "P21", "P32", "P33"], ["Saitou", "Raelza", "Morlock", "Lafanpan"], "https://www.aniplus-asia.com/show/handyman-saitou-in-another-world/"),
        ("So Im a Spider So What", "solo_opening", ["M12"], ["I commonly called Kumoko"], "https://kumo-anime.com/character.html"),
        ("Reincarnated as a Sword", "linked_duo", ["M13", "P05", "P37"], ["Teacher", "Fran", "Urushi"], "https://tenken-anime.com/"),
        ("Reborn as a Vending Machine", "linked_duo", ["M14", "P40"], ["Boxxo", "Lammis"], "https://jihanki-anime.com/"),
        ("Campfire Cooking", "familiar_travel", ["M15", "P37", "P36"], ["Mukohda", "Fel", "Sui"], "https://tondemoskill-anime.com/character/"),
        ("In the Land of Leadale", "family_network", ["M27", "P16", "P43", "P31", "P39"], ["Cayna", "Skargo", "Mai-Mai", "Kartatz", "Kee"], "https://leadale.net/character.html"),
        ("My Next Life as a Villainess", "court_circle", ["M19", "P44", "P44", "P25", "P16"], ["Catarina", "Geordo", "Alan", "Sophia", "Maria"], "https://hamehura-anime.com/1st/character/"),
        ("Overlord", "organization", ["M11", "P26", "P28", "P30", "P20", "P05", "P43"], ["Ainz", "Albedo", "Demiurge", "Cocytus", "Sebas", "Aura", "Mare"], "https://overlord-anime.com/_season2/character/"),
        ("The Saga of Tanya the Evil", "military_unit", ["M24", "P28"], ["Tanya", "Visha"], "https://youjo-senki.jp/th/"),
    ]
    results = []
    for number, (series, scope, ids, names, source) in enumerate(cases, 1):
        members = [make_member(aid, "main" if n == 0 else "party", index, config, ids[0]) for n, aid in enumerate(ids)]
        for n, member in enumerate(members):
            member.update(character_id=f"reference_{number}_{n}", source_character=names[n], romance_enabled=False)
        cast = {"preset": "source_reference", "scope": scope, "members": members, "overrides": {}}
        policy = {"elf_cap": 1, "mascot_cap": 1, "novelty_budget": 1, "allow_repeated_signature": False, "required_functions": [], "romance_mode": "off"}
        if number == 1:
            members[0]["present_age_group"] = "teen"
            members[2]["present_age_group"] = "teen"
        if number == 4:
            members[2]["relationship_to_main"] = "familiar"
        if number == 5:
            contact = make_member("N08", "world", index, config)
            contact["source_character"] = "Hulemy"
            cast["world_contacts"] = [contact]
        if number == 6:
            policy["mascot_cap"] = 3
        if number == 7:
            policy["elf_cap"] = None
            for n in (0, 1, 2):
                members[n]["species"] = "elf"
            for n in (1, 2, 3):
                members[n]["relationship_to_main"] = "family"
            members[4].update(species="artificial_intelligence", relationship_to_main="information_assistant")
        if number == 8:
            for member in members:
                member["present_age_group"] = "teen"
            cast["overrides"] = {"repeated_archetype": {"justification": "Geordo and Alan are explicitly linked twins with different temperaments and activities."}, "repeated_signature": {"justification": "The court ensemble intentionally contains twin princes with distinct social dynamics."}}
        if number == 9:
            policy["elf_cap"] = None
            for n in (5, 6):
                members[n].update(species="dark_elf", relationship_to_main="retainer", present_age_group="nonhuman")
        if number == 10:
            members[1].update(species="human", relationship_to_main="adjutant", romance_enabled=False)
            cast["world_contacts"] = []
            for name in ("Lergen", "Zettour"):
                contact = make_member("N30", "world", index, config)
                contact["source_character"] = name
                cast["world_contacts"].append(contact)
        audit = validate_cast(cast, data, index, policy)
        results.append({"series": series, "scope": scope, "source_characters": names, "source_url": source, "passed": audit["mechanically_valid"] and audit["passes_selected_editorial_policies"], "accepted_exceptions": audit["warnings"], "failures": audit["hard_errors"] + audit["policy_failures"], "interpretation": "Coarse role, dependency, age-safeguard, and scope regression only. The proxy cards do not assert the sources exact personality, appearance, age, or full abilities."})
    return results


def self_test(data, index, seeds=100):
    fixture_results = run_fixture_checks(data, index)
    reference_results = run_reference_shapes(data, index)
    modes, examples = {}, []
    all_rosters = set()
    for preset in data["presets"]:
        rosters, failures, hard_invalid, policy_invalid = set(), [], 0, 0
        for seed in range(seeds):
            try:
                cast = generate_cast(data, index, preset, seed)
            except ValueError as error:
                failures.append({"seed": seed, "error": str(error)})
                continue
            audit = validate_cast(cast, data, index)
            hard_invalid += not audit["mechanically_valid"]
            policy_invalid += not audit["passes_selected_editorial_policies"]
            rosters.add(roster_key(cast))
            all_rosters.add(roster_key(cast))
            if seed == 0:
                examples.append(cast)
        modes[preset] = {"requested": seeds, "generated": seeds - len(failures), "unique_archetype_rosters": len(rosters), "hard_invalid": hard_invalid, "policy_invalid": policy_invalid, "generation_failures": failures}
    report = {
        "method": "Seeded rule audit plus independent cast-shape fixtures. Catalog-level abilities and declared relationships are checked; no audience recognition, visual readability, source popularity, or narrative quality is measured.",
        "seeds_per_preset": seeds,
        "preset_count": len(modes),
        "requested_total": seeds * len(modes),
        "unique_archetype_rosters_total": len(all_rosters),
        "roster_definition": "Sorted narrative-role and archetype-ID combinations; different seeds, ordering, or world contacts alone do not make a new roster.",
        "presets": modes,
        "fixture_checks": fixture_results,
        "source_reference_shape_checks": reference_results,
        "all_checks_passed": all(t["passed"] for t in fixture_results + reference_results) and all(v["hard_invalid"] == v["policy_invalid"] == 0 and not v["generation_failures"] for v in modes.values()),
        "limitations": ["Broad functions do not establish a complete spell or healing system; the sustain plan remains an explicit design responsibility.", "Editorial caps can be deliberately overridden with a meaningful justification.", "Sampling from authored preset pools demonstrates available variety, not the statistical distribution of anime casts.", "The seed-zero examples are candidates for qualitative review, not proof that every generated cast is entertaining."],
    }
    return report, examples


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--preset", default="standard_adventure")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--validate", type=Path, help="Validate a saved cast JSON without generating a replacement.")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--seeds", type=int, default=100, help="Seeds per preset for --self-test.")
    parser.add_argument("--output", type=Path, help="Write JSON here instead of printing it.")
    args = parser.parse_args()
    data, index = load_system(args.data)
    if args.self_test:
        report, samples = self_test(data, index, args.seeds)
        report_path = args.output or HERE / "party_validation.json"
        save_json(report_path, report)
        save_json(HERE / "party_samples.json", {"note": "One seeded original candidate per preset; review the cast creatively before comic production.", "casts": samples})
        print(json.dumps({"report": str(report_path), "samples": str(HERE / "party_samples.json"), "all_checks_passed": report["all_checks_passed"], "generated_requested": report["requested_total"], "unique_rosters": report["unique_archetype_rosters_total"]}, indent=2))
        return 0 if report["all_checks_passed"] else 1
    if args.validate:
        result = validate_cast(read_json(args.validate), data, index)
        status = 0 if result["mechanically_valid"] and result["passes_selected_editorial_policies"] else 1
    else:
        if args.preset not in data["presets"]:
            parser.error(f"Unknown preset. Choose from: {', '.join(data['presets'])}")
        if args.batch < 1:
            parser.error("--batch must be positive")
        casts = [generate_cast(data, index, args.preset, args.seed + n) for n in range(args.batch)]
        result = casts[0] if args.batch == 1 else {"casts": casts, "unique_archetype_rosters": len({roster_key(c) for c in casts})}
        status = 0
    if args.output:
        save_json(args.output, result)
        print(str(args.output))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    return status


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, KeyError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(2)
