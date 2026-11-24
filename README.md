# comicbench

comicbench measures how good the **instructions** are that Tracetoon gives the
agent that writes a pull request comic. Each run scores one
`tracetoon-draw-cartoon` skill version combined with one genre file.

## How it works

1. **Inputs.** Each comic is written from a frozen evidence brief and a PR
   description. The briefs are generated once from prbench's
   `real-cases@4.0.0` dataset: 61 consented, redacted cases.
2. **Drawing.** The comic is drawn through one pinned image route, so the
   instructions under test are the only thing that changes between runs.
3. **Per-comic judging.** AI judges score each comic on an anchored 1–5 scale
   for:
   - humor
   - relevance to the change
   - factual fidelity
   - fit for the audience (developers and AI engineers)
   - clarity
   - genre adherence
   - art-style fidelity
4. **Set judging.** Across the whole set of comics, judges score variety:
   premises, cast, and composition.

The headline is the arena win rate on same-PR pairs, with cases resampled for
the confidence interval. The 0–100 scores are diagnostics. Comparisons
require matching rubric, judges, Tracetoon runtime and image route.

## Status

The design is in [docs/plan.md](docs/plan.md). The Tracetoon side has landed:
user genre files (Tracetoon #196), and the `tracetoon-draw-cartoon` skill with
a comic author that runs as a subagent from a comic packet (#197).

What works today, offline and without model calls:

- **The rubric** (`src/rubric.ts`, version 5): seven criteria on anchored 1–5
  scales, per-comic gates, and three set-level variety criteria.
- **Scoring** (`comicbench score <run>`): turns judgment files into points,
  with a case-clustered 95% bootstrap interval.
- **Frozen cases** (`comicbench validate`): the case format with hashed inputs.
  `cases/example` is synthetic.
- **Author packets** (`comicbench packet`): the same packet Tracetoon's
  `comic packet` writes, built from a frozen case, the skill under test and a
  genre file. The author never sees `facts.json`.
- **Freezing the real cases** (`scripts/freeze-cases.ts`): turns prbench's
  `real-cases@4.0.0` into 61 comicbench cases, 20 dev and 41 sealed. It
  rebuilds each prbench writer sandbox, runs a pinned Tracetoon `prepare`,
  takes the description from prbench's golden run, and redacts personal email
  addresses. They are published as the `comic-cases@1.0.0` dataset release.
- **Rounds** (`comicbench run`): author, draw and judge every comic of a split,
  then the set judge and the report. Every model call goes through Codex
  (`codex exec`); see "Running a round".

## Getting the cases

```sh
bun src/cli.ts datasets fetch comic-cases@1.0.0 --out cases-local
bun src/cli.ts validate cases-local
```

`datasets fetch` checks the archive's sha256 and every file against its
manifest before moving it into place.

## Running a round

A round scores one draw-cartoon skill folder (`SKILL.md` + `references/`) with
one genre file across a split, `--samples` comics per case. It needs the Codex
CLI signed in, and a Tracetoon source checkout with `comic check --file` for
linting and drawing (Tracetoon's own `scripts/comic-draw.ts` on the Codex image
route).

```sh
bun src/cli.ts run --cases cases-local --split dev \
  --skill <draw-cartoon skill folder> --genre genres/space-opera.md \
  --samples 2 --tracetoon ../tracetoon --out results/<round> --jobs 3 \
  --author inline --model gpt-6.2-sol
```

Per comic:

1. **Author** (`--author sandbox`, the default): Codex works in the packet
   folder under its `workspace-write` sandbox (on Windows with
   `windows.sandbox="elevated"`, overridable with
   `COMICBENCH_WINDOWS_SANDBOX`). It reads the packet's instructions, the
   skill, the brief, the description and its copy of the diff, writes
   `comic-design.json` and `comic.json`, and runs the check itself with a
   bundled copy of Tracetoon's checker in the packet. If Codex reports any
   other sandbox, the round stops. The packet holds the earlier comics of
   the arm as `recentComics`. The author never gets `facts.json`; that it
   reads only the packet and skill folders is a convention, not enforced.
   `--author inline` supplies the author packet and skill in the prompt,
   with local file tools disabled. The runner sends check problems back for
   up to two more tries. Use inline mode when judge-only files are readable
   from the sandbox. The runner's own `comic check` is the recorded gate.
2. **Draw:** the comic is drawn on the Codex image route, with 760 px and
   360 px renditions.
3. **Judge:**
   - **Blind:** image and art sheet only. Scores humor, clarity and art style,
     and applies the punch-up and respect gates.
   - **Context:** the observation plus the brief, description, facts and diff.
     Scores relevance, fidelity, audience and genre, and gates factual
     integrity.

Then one set judge scores variety. The round writes `manifest.json`,
`judgments/`, `set.json` and `report.json`, and resumes where it stopped.

Use `run --stop-after check` for an author-only pilot. It saves the designs,
scripts and checker results and records their hashes in `script-report.json`.
Run the same command without that flag to render the checked scripts. Resume checks
the manifest and checkpoint hashes and carries the recorded script failures
forward. Use `--draw-jobs` to parallelize the resumed pipeline. For these
pilots the phone reader's observations are diagnostic.

## Running a whole benchmark round (campaign)

`comicbench campaign <spec.json>` runs a full benchmark round in one command,
as parallel as the work allows. It covers every arm's comics, every checklist,
every arena and the review page.

```sh
bun src/cli.ts campaign campaigns/<round>.json [--slots 12] [--canary 4] [--keep-awake off]
```

The spec names the arms (genre, skill, Tracetoon snapshot, `jobs`), the frozen
reference rounds, the arenas as pairs of round names, and the second judge. See
`campaigns/check-smoke.json`.

- **References are checked right away**, while the arms draw.
- **Arms run side by side** (`jobs` workers each, default 6).
- **Each comic is judged as it lands.** It is checked and judged against the
  references as soon as it is drawn, not after the whole round.
- **One gate (`src/gate.ts`) shares Codex between all of it:**
  - at most `--slots` calls at once (default 12);
  - comic work goes first;
  - a rate-limited call backs off (30 s doubling, up to 10 minutes, 6 tries);
  - while Codex is rate-limiting, the slots shrink by a third, and they
    recover after ten quiet minutes.
- **A canary stops a broken run early.** After `canary` comics per arm, any
  crash, failed check, missing image, or persona, meme or style outside the
  host's offer stops the run.
- **The machine is kept awake** while the run lasts (`src/awake.ts`). The power
  plan is untouched.

Every step caches per item, so:
- the final summaries are cache reads;
- results match running `run`, `checklist` and `arena` one after another;
- rerunning a spec resumes.

The campaign writes `results/<name>/`:
- `campaign.log`;
- `campaign.json` (phase times, Codex calls and time per lane, rate limits and
  backoff, the average number of earlier comics each comic saw);
- `measures.log`;
- `review/`.

More workers mean each comic sees slightly fewer finished comics in
`recentComics`. `campaign.json` records how many it saw.

## Checking the judges and reviewing a round

- `comicbench script-audit <round-a> <round-b> --out <dir>`: an AI comparison
  of matched checked scripts and design notes against the frozen PR evidence.
  Add `--script-audit <dir>` to `review` to include it on the offline page.
- `comicbench arena <round-a> <round-b> --model-2 <model>`: same-case pairs
  in both orders. A respect failure forfeits overall against a passing comic.
  The report retains raw verdicts and counts incomplete and double-forfeit
  pairs separately. Use `--pairing matched` to compare each sample only
  with its counterpart in the other arm.
- `comicbench checklist <round>`: evidence-backed craft and setting measures,
  plus representation from the script and the finished page. The checklist
  traces space conflict from concept to image, compares planned and drawn
  frame geometry, and records where visual choices help the story. It compares
  intended genre roles with the image-only judge's reading and measures
  contrasts between humans separately from contrasts between humans and aliens.
- `comicbench compare <round-a> <round-b>`: the paired score difference over
  shared cases, criterion means, gate failures and author check runs.
- `comicbench calibrate <round> --tracetoon <dir>`: broken copies of a few
  comics (flat punchline, another PR's joke, a wrong fact, tiny lettering, a
  photo-real render); a control passes when the judges rank the original
  higher at least 80% of the time.
- `comicbench calibrate <out> --tracetoon <dir> --respect true`: matched
  technical gags and ridicule controls for the respect gate.
- `comicbench calibrate <reference> --tracetoon <dir> --craft true --out <dir>`:
  check the craft observations against known fixtures and archived pages.
- `comicbench reliability <round> --tracetoon <dir> --model-2 <model>`: a
  second Codex model re-judges 30% of comics and the same model 10%;
  agreement is Krippendorff's alpha.
- `comicbench anchors freeze|check`: frozen comics with reference scores;
  a criterion whose mean moves more than 0.3 is flagged.
- `comicbench review <round> [<round>...] [--arena <arena-dir>]`: a local
  review page with the comics, scores, and judge reasons. Open its
  `index.html` directly from disk. Notes typed on it never change a score.

## Freezing the cases

Needs prbench v0.4.0 checked out with its dependencies installed, the dataset
(`prbench datasets fetch real-cases@4.0.0`), and a pinned Tracetoon bundle (a
skill folder with its runtime at `bin/tracetoon-<platform>-<arch>`). No model
is called.

```sh
bun scripts/freeze-cases.ts --prbench ../prbench-v4 \
  --dataset ~/.cache/prbench/datasets/real-cases/4.0.0 \
  --skill <pinned Tracetoon bundle> --out cases-local --jobs 3
bun src/cli.ts validate cases-local
```

## Using it

```sh
bun install
bun scripts/make-example.ts      # cases/example and genres/space-opera.md
bun src/cli.ts validate cases
bun src/cli.ts packet cases/example --skill <draw-cartoon>/SKILL.md \
  --genre genres/space-opera.md --out /tmp/packet
bun src/cli.ts score results/<run>
bun test && bun run typecheck
```

Sibling projects:

- [Tracetoon](https://github.com/Tracetoon/tracetoon): the tool under test
- [prbench](https://github.com/Tracetoon/prbench): the PR-description
  benchmark whose cases and harness patterns comicbench reuses

## License

Apache-2.0. See [LICENSE](LICENSE).
