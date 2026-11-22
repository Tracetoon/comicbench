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

This repository is in the planning stage. The design is in
[docs/plan.md](docs/plan.md). It also covers the Tracetoon changes comicbench
depends on:

- a separate `tracetoon-draw-cartoon` skill
- user genre files
- a comic author that runs as a subagent

Sibling projects:

- [Tracetoon](https://github.com/Tracetoon/tracetoon): the tool under test
- [prbench](https://github.com/Tracetoon/prbench): the PR-description
  benchmark whose cases and harness patterns comicbench reuses

## License

Apache-2.0. See [LICENSE](LICENSE).
