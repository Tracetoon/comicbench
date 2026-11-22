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

Scores are absolute and reported on a 0–100 scale, so different runs can be
compared. Two things keep them stable: anchor comics that are re-scored in
every run, and pinned judge settings.

## Status

The design is in [docs/plan.md](docs/plan.md). The Tracetoon side has landed:
user genre files (Tracetoon #196), and the `tracetoon-draw-cartoon` skill with
a comic author that runs as a subagent from a comic packet (#197).

What works today, offline and without model calls:

- **The rubric** (`src/rubric.ts`, version 1): seven criteria on anchored 1–5
  scales weighted to 100 points, four pass/fail gates, three set-level variety
  criteria, and the 80/20 headline.
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

Next:

- Anchor comics and judge controls.

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
  --samples 2 --tracetoon ../tracetoon --out results/<round> --jobs 3
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
   `--author inline` is the fallback for hosts without a sandbox: Codex
   read-only, files inlined, and the runner sends check problems back for up
   to two more tries. Either way the runner's own `comic check` is the
   recorded gate.
2. **Draw:** the comic is drawn on the Codex image route, with 760 px and
   360 px renditions.
3. **Judge:**
   - **Blind:** image and art sheet only. Scores humor, clarity and art style,
     and gates punch-up.
   - **Context:** the observation plus the brief, description, facts and diff.
     Scores relevance, fidelity, audience and genre, and gates factual
     integrity.
   - **Phone:** the 360 px rendition only, checked with Tracetoon's phone gate.

Then one set judge scores variety. The round writes `manifest.json`,
`judgments/`, `set.json` and `report.json`, and resumes where it stopped.

## Checking the judges and reviewing a round

- `comicbench compare <round-a> <round-b>`: the paired score difference over
  shared cases, criterion means, gate failures and author check runs.
- `comicbench calibrate <round> --tracetoon <dir>`: broken copies of a few
  comics (flat punchline, another PR's joke, a wrong fact, tiny lettering, a
  photo-real render); a control passes when the judges rank the original
  higher at least 80% of the time.
- `comicbench reliability <round> --tracetoon <dir> --model-2 <model>`: a
  second Codex model re-judges 30% of comics and the same model 10%;
  agreement is Krippendorff's alpha.
- `comicbench anchors freeze|check`: frozen comics with reference scores;
  a criterion whose mean moves more than 0.3 is flagged.
- `comicbench review <round> [--compare <round>]`: a static page of every
  comic with each judge's score and reason, for people to audit the judges.
  Notes typed on it never change a score.

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
