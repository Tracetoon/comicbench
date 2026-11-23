# Round 4 — Broader space opera and cast guidance

## Question

Can broader space-opera and cast guidance improve on Medium while preserving
humor and relevance to the PR? The candidate uses familiar tropes with
original designs, offers more places and action to build a joke around, and
encourages varied casts across comics.

## Setup

| | |
| --- | --- |
| Cases | `comic-cases@1.0.0` dev split, 20 cases × 2 samples per arm |
| Medium | Round 3 Medium author skill and original space-opera genre |
| Broad | Medium with broader space opera, trope parody, and varied-cast guidance |
| Runtime | Shared Tracetoon #204 base with the #199 standalone checker and the follow-up image prompt and genre catalog |
| Author and image route | Codex `gpt-6.2-sol`, medium effort. Both arms use the inline author and the Codex page-lettering route |
| Judges | Codex `gpt-6.2-sol`, with `gpt-6.2-astra` on 30% of the planned arena pairs |
| Rubric | v4, arena v2, checklist v2 |

The inline author has local file tools disabled. A live probe could not read
a synthetic `facts.json` from the author environment. The first smoke run
stopped at the checker because #204 lacks `comic check --file`. With the
standalone checker added to the benchmark runtime, the smoke draft passed
the check and drew successfully. Both arms were generated fresh for this
comparison, with the same six-worker limit and seeded case order.

## Calibration

Both models matched all four respect fixtures, for eight correct verdicts in
total. Each fixture pair used the same staging with either a technical gag or
ridicule as the punchline. The primary judge preferred the drawn comic to
the photoreal control in both presentation orders on all five visual pairs.

## Results

All 80 comics, 80 primary pairs and 24 second-judge pairs completed. The
win rates below are for Broad, with ties counting half and 95% intervals
resampled by case.

| Criterion | Broad win rate | 95% interval |
| --- | ---: | ---: |
| Overall | 57.5% | 46.3–68.1% |
| Humor | 47.5% | 35.6–60.0% |
| About this PR | 55.6% | 43.1–68.1% |
| Use of the comic medium | 62.5% | 47.5–76.3% |
| Visual | 45.0% | 33.1–57.5% |

Both arms had zero respect and factual gate failures. Raw and adjusted
overall results therefore agree. Every interval includes parity. The
second judge agreed most on use of the medium (κ 0.65) and least on visuals
(κ 0.21). Overall verdicts flipped with presentation order on 28 of 80 pairs.

### Craft observed on the finished pages

| Measure | Medium | Broad |
| --- | ---: | ---: |
| Ship exterior or open space | 5/40 | 12/40 |
| Office-like interior | 14/40 | 13/40 |
| Planet surface or outdoors | 1/40 | 1/40 |
| Setting entropy, bits | 1.54 | 1.71 |
| Comic-medium checklist, out of 6 | 4.03 | 4.60 |

Broad used more space exteriors and more comic techniques. Offices remained
common, and one comic in each arm was set primarily outdoors on a planet.
The checklist shows a change in staging and craft, while the arena leaves
the overall quality comparison inconclusive.

### Representation evidence

Each denominator is 40 assessed comics. Cast appearance is a separate
observation of visible variety in skin tone or features.

| Measure | Medium scripts | Broad scripts | Medium pages | Broad pages |
| --- | ---: | ---: | ---: | ---: |
| Explicit racial or ethnic background | 0 | 16 | 0 | 0 |
| More than one evidenced gender | 0 | 2 | 0 | 0 |
| LGBTQ+ orientation or relationship cue | 0 | 0 | 0 | 0 |
| Explicit trans representation | 0 | 0 | 0 | 0 |
| Explicit nonbinary representation | 0 | 2 | 0 | 0 |
| Visible cast appearance variation | | | 26 | 25 |

All four blocks of ten in each arm had zero reader-visible LGBTQ+ cues.
The evidence for Broad's two nonbinary characters stopped at their cast
descriptions. A follow-up can test cues that already fit the action, such as
a passing mention of a spouse during a pickup, while keeping identity
incidental to the gag.

Open `results/r4/review/index.html` directly from disk for the comics and
judge evidence. Raw results are under `results/r4-medium`, `results/r4-broad`,
`results/r4-controls` and `results/r4/arena`.
