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
  addresses. The frozen cases stay in the git-ignored `cases-local/` until
  they are published as a dataset release.

Next:

- Publish the frozen cases as a dataset release.
- The author, drawing and judge runners.
- Anchor comics and judge controls.

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
