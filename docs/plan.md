# Plan: comicbench + draw-cartoon skill with user genres

## Context

Tracetoon's comic quality depends on the instructions given to whoever writes
the comic. Today those instructions are spread through one large skill: `SKILL.md`
step 5 on `prepare-rc33`, and `references/full-path.md` plus `comic-guide.md`
on origin/main. On the default path the main thread writes the comic itself.

We want three things:

1. **comicbench**, a peer of prbench. It scores one *draw-cartoon instruction
   set plus one genre* across many frozen briefs, on an absolute point scale
   that stays comparable across runs.
2. **A `tracetoon-draw-cartoon` skill** that a subagent loads on its own,
   with genres as references inside it and **one simple way for users to add
   genres**.
3. Later, the same split for pr-creation and pr-review.

**Owner decisions**

- Judge drawn images, with a cheap script-only pre-screen.
- Build genres from the `comic-genre-first` branch (17 genres, in `../tracetoon-genre`).
- Phase the work, comicbench first.
- `Tracetoon/comicbench` is a **public** repo.
- Judging is fully AI. Never read `.git/tracetoon/eval/ratings`.
- **One extension mechanism only.**

**Research facts this plan relies on**

- This checkout (`prepare-rc33`) is 42 commits behind origin/main (rc.45).
- origin/main ships `plugin/` and `plugins/{agent,claude,claude-directory,codex,codex-directory,cursor}`.
- prbench (now `Tracetoon/prbench`) publishes **`real-cases@4.0.0`**: 61 consented, redacted cases from 12 repos, all in one `dev` pool with no held-out split. Each case has `case.json`, `repo.bundle`, sessions and `facts.json`. Fetch it with `prbench datasets fetch real-cases@4.0.0`.
- prbench's golden run (`golden/v4-candidate62/`) holds `claude/drafts.jsonl` and `codex/drafts.jsonl`: 61 × 3 × 2 scored PR descriptions per provider, with per-draft scores in `scores.csv`. It does **not** store the briefs the writers saw.

## What the comic author reads (the diff question)

**In prbench runs today**, the writer gets the fixed `PR_PROMPT` and runs the full Tracetoon skill live. `prepare` prints the evidence brief (`tracetoon query brief`) and writes `changes.patch` into the run folder. `references/drafting.md` says to draft "from the brief … and the diff refs it cites in `changes.patch`", so the drafter opens diff hunks only where a brief row points. The comic is **off** in prbench (`{comic:"off"}`). Today's comic guidance tells the author to read the finished description and `digest.json`, never the diff.

**Is the brief enough?** For a comic, almost certainly yes. The brief already has:

- `changes`: files and symbols, `was`/`behavior` lines, key added and removed lines.
- `commitMessages.code`: key changed lines.
- `requests`/`background`: the goal and the motive, which is where most jokes come from.
- `process`: failed commands and the test trajectory, which are good comic material.
- `doNotSay`: claims to avoid, which helps factual fidelity.

The raw diff is large (pr10 is 138 KB). For a 3–4 panel gag it mostly adds cost and noise.

**Plan.** The author packet gets:
- the brief,
- the finished description,
- the `doNotSay` and `limits` rows,
- `changes.patch` available for lookup by ref, but not inlined.

This mirrors how the drafter is instructed. The judges get the full diff. comicbench measures the choice instead of assuming it: a built-in input ablation compares `brief` with `brief + full diff` on the dev cases, run once and reported, so later instruction rounds use the evidence-backed default.

## Phase 0: Baseline (tracetoon)

- Work in a worktree from origin/main.
- Land `comic-genre-first` (617746d, 3f644f2) as its own PR. It brings `src/comic/genres.ts`, `genreOptions`, `comic.json.genre` and `genreProblems()`.

## Phase 1: draw-cartoon skill and user genres (tracetoon)

### 1a. One extension point: genre files

A **genre file** is a single Markdown file.
- YAML frontmatter: `id`, `name`, `version`, `artStyle` (style id(s) from `src/comic/styles.ts`, or an inline style sheet for the image prompt), `setting`, `archetypes[]`, `props[]`, `jokeHooks[]`, `avoid[]`.
- Body: prose for the author.

**Built-in genres** use the same format. `scripts/gen-genres.ts` writes `plugin/skills/tracetoon-draw-cartoon/references/genres/<id>.md` from `genres.ts`, and the surface test checks that they are fresh.

**User genres** go in exactly one place per scope:
- `<configDir>/genres/*.md`, using the same config directory as `src/config.ts`;
- or the repo's `.github/tracetoon/genres/*.md`.

There is no plugin manifest, lockfile or second "skill plugin" kind. A user adds a genre by dropping in one file.

**Loading.** New `src/comic/genreFile.ts` parses and validates a file (field limits, the existing franchise-name warning) and returns the existing `Genre` type. The catalog becomes built-in + user + repo genres, and a later scope overrides an earlier one by `id`. Prepare's `genreOptions`, `config genre`, the page prompt and `genreProblems()` all work unchanged.

**Commands.**
- `tracetoon genre list --json` shows each genre's source and path.
- `tracetoon genre check <file>` validates a genre file before use.
- `doctor --json` gains a `genres` check that reports invalid user files.

`scripts/agent-surfaces.ts` regenerates the CLI docs.

Craft guidance beyond genres is not an extension point yet. It is revisited only if a real need appears.

### 1b. The `tracetoon-draw-cartoon` skill

- **Folder:** `plugin/skills/tracetoon-draw-cartoon/`. It has no runtime of its own: it calls the `tracetoon` launcher on PATH, or the main skill's `bin/` through `TRACETOON_BIN`. The `tracetoon-` prefix avoids clashes in the shared `~/.agents/skills`.
- **SKILL.md** (8 KB or less) covers only the author's job:
  1. Read the packet.
  2. Write three concepts to `comic-design.json`.
  3. Write `comic.json`.
  4. Run `tracetoon comic check`.
  5. Return.

  Drawing, rendering and the quality loop stay with the caller.
- **references/:** `comic-guide.md`, `comic-direction.md` and `styles.md` move here from the main skill, along with the generated `genres/` files.

### 1c. Hand the comic to a subagent

- **New command `tracetoon comic packet --run <id> [--genre id]`.** It writes `comic-packet/` with:
  - `instructions.md`
  - the brief
  - the description
  - the chosen genre file (built-in or user)
  - `recentComics`
  - a pointer to `changes.patch`

  It then prints the spawn line, reusing the packet and spawn pattern of `src/commands/comicLoop.ts` (lines 147–313).
- **Main skill.** The comic step in `full-path.md` and SKILL step 2b.9 shrinks to:
  1. Run `comic packet`.
  2. Spawn one subagent with the draw-cartoon skill.
  3. Run `comic art`, `render` and `loop`.
- **The packet is the benchmark interface.** comicbench builds the same packet from frozen inputs, so it measures exactly what production gives the subagent.

### 1d. Install plumbing for two skills

**Registry.** `src/integrations/registry.ts` gets a `SKILLS` list. Each host's `skill(home, env)` takes the skill name instead of the hard-coded `'tracetoon'`.

**Code that loops over `SKILLS`:**
- `src/commands/setup.ts`
- `src/update/apply.ts`
- `doctor.ts` (`skillInstalls`)
- `install.sh` and `install.ps1`
- `src/mcp/server.ts`: add `tracetoon://skills/<name>/…` and keep `tracetoon://skill/` as an alias
- release packaging
- the `plugins/*` trees

**Tests to update:**
- `agent-surface`
- `cli-contract` (`setup-shipped-skill`)
- `mcp`
- `skill-settings`
- `pages`
- `npm-packages`
- `update`
- `doctor`

## Phase 2: comicbench (new repo `../comicbench`, public `Tracetoon/comicbench`)

The stack is Bun and TypeScript, laid out like prbench. Shared modules are **copied** with attribution, so each repo freezes independently.

| Module | Copied from |
|---|---|
| `stats.ts` (case-clustered bootstrap, sign test, kappa) and `score` composite helpers | prbench 0.4.0 `src/stats.ts`, `score` command |
| `run/cache.ts` (content-addressed stage cache) and `run/ledger.ts` | prbench |
| `judge/providers.ts` (`claude -p` / `codex exec` with a JSON schema) | prbench |
| `agents/claude.ts`, `agents/codex.ts`, trimmed `sandbox.ts` | prbench |
| dataset fetch and verify | `prbench datasets` |
| frozen manifest and `--resume` hash check | prbench `src/comparison.ts` |
| judge controls, `phoneGate`, `canonicalPair` | tracetoon `scripts/comic-judge.ts`, `src/comic/judging.ts` |

### Cases: built from `real-cases@4.0.0`, briefs frozen once

**`scripts/freeze-cases.ts`** depends on the pinned prbench dataset (sha256 from prbench's `datasets/registry.json`). For each case it:

1. Restores `repo.bundle` and places the sessions, using prbench's sandbox code.
2. Runs a pinned `tracetoon prepare --json` with the comic off, then `tracetoon query brief`. Both are local and need no model calls.
3. Writes `cases/<id>/` with:
   - `brief.md`
   - `changes.patch`
   - `facts.json` (from prbench)
   - `description.md`: the golden-run candidate62 Claude draft, replicate 1, from `golden/v4-candidate62/claude/drafts.jsonl`, so every arm draws from the same scored description
   - `case.json`: source dataset version and case hash, tracetoon version, golden draft id, license

It also runs prbench's redaction and secret scan again on the new files.

**Packaging.** Briefs are published as a comicbench dataset release, `comic-cases@1.0.0`, built on top of prbench's archive, with its own SHA256SUMS.

**Splits.** The v4 pool has no held-out split, so comicbench defines its own:
- 20 **dev** cases, stratified across the 12 repos and change sizes.
- 41 **sealed** cases, scored only for confirmation runs.

The split is frozen in `splits.json`.

### Subject under test and the run

`comicbench run --skill <draw-cartoon dir> --genre <id|file> --split dev --samples 2 --author claude:sonnet`

- **Author.** Headless `claude -p` (or `codex exec`) in a sandbox where only the draw-cartoon skill and the one genre file are installed. It gets a fixed `AUTHOR_PROMPT` and the packet. Output is `comic.json`.
- **Pre-screen** (no images).
  - `tracetoon comic check` (lint and phone fit).
  - One cheap text-judge call for the factual and safety gates.
  - A failure scores 0 for that sample, with the reason recorded; nothing is drawn.
- **Draw.** Held constant across arms: pinned tracetoon `comic art` on one pinned route (Codex by default), then `comic render`. The instructions under test change only `comic.json`. The manifest records the route, image model and lettering mode.
- **Samples.** dev = 20 cases × 2 samples = 40 comics per (skill, genre). Two samples per brief measure variety within a brief; 20 briefs measure it across briefs. A confirmation run uses the 41 sealed cases × 1.
- **Ablation** `--inputs brief|brief+diff`: run once to settle the diff question.

### Judging (per comic, then per set)

Every criterion uses an anchored 1–5 scale. Each level has a written description and an example comic from `anchors/`.

- **Stage A, blind.** A fresh judge sees the image and the genre's art sheet only.
- **Stage B, contextual.** The judge sees the frozen Stage A observation, the image, `brief.md`, `facts.json`, the full diff and the description.
- **Phone gate.** The host's `phoneGate` checks the 360 px rendition.
- **Set stage.** One judge sees every script and thumbnail of the (skill, genre, split), plus the cast, premise and format metrics the host computes.

**Gates** (pass/fail; a failure sets the comic's score to 0):
1. Factual integrity: nothing contradicts the brief, facts or diff.
2. Phone legibility.
3. Punches at problems, not people; no franchise IP.
4. Output contract.

**Per-comic criteria** (100 points):

| Criterion | Stage | Weight | Question |
|---|---|---|---|
| Humor | A | 25 | Would a developer actually smile? Surprise, a clear punchline, timing |
| Change relevance | B | 20 | Swap test: is the joke about *this* change, or would it fit any PR? |
| Factual fidelity | B | 15 | Names, numbers and mechanisms match the brief, facts and diff; nothing invented |
| Audience fit | B | 10 | Lands for developers and AI engineers: insider truth, not generic office humor |
| Clarity / cold read | A | 10 | Story logic and pacing; readable without the PR |
| Genre adherence | A+B | 10 | Setting, archetypes and props *carry the change*, not decoration |
| Art-style fidelity | A | 10 | Matches the genre's declared art style |

**Set criteria** (1–5 each, combined into the set score):

| Criterion | Share | How |
|---|---|---|
| Premise variety | 40% | The judge clusters near-duplicate premises and joke shapes; distinct clusters ÷ comics |
| Cast variety | 30% | Character and archetype reuse across briefs (host-computed Jaccard). Recurring archetypes are fine; the same character every time is not |
| Composition / format variety | 30% | Spread of formats and composition families from `comic.json` |

**Headline** = 0.8 × mean comic score (0–100) + 0.2 × set score rescaled to 0–100. The 95% CI is a case-clustered bootstrap.

**Why these weights.** Humor and relevance are why the comic exists (45). Correctness protects trust (15, plus a gate). Genre and art are what the overlay should change (20). Variety can only be judged per set.

### Keeping points comparable across runs

- **Pinned settings.** The manifest pins the rubric version, judges (Claude Opus primary plus a Codex model, matching prbench's two-family setup), prompt hashes, the tracetoon runtime and the image route. `report --compare` refuses runs whose settings don't match.
- **Anchor comics.** Six frozen comics (2 weak, 2 mid, 2 strong) are re-scored in every run. The run is flagged if an anchor drifts by more than 0.3.
- **Judge reliability.**
  - The second judge family scores a 30% sample; the report shows ICC or Krippendorff's α per criterion.
  - Ten percent of Stage A calls are repeated to measure the noise within one judge.
- **Controls.** Reuse comic-judge's five: identical tie, swapped order, embedded "5/5", masked clue, broken image.
- **Pairwise mode.** An optional `comicbench compare A B` reuses `canonicalPair` (both orders) when two arms' CIs overlap.

**Estimated cost per dev round of 40 comics:**

| Item | Cost |
|---|---|
| Authors (40) | about $0.4–0.8 each |
| Images (40) | from the image route |
| Judges | about 3 calls × $0.3 per comic |
| Set and anchor calls | a few dollars |
| **Total** | **about $60–90** |

A sealed confirmation run (41 comics) costs about the same. Actual costs are logged in `calls.jsonl`.

### Layout and outputs

**Source tree:**
- `src/{cli,cases,author,draw,score,report,manifest}.ts`
- `src/judge/{rubric,stages,set}.ts`
- `rubric/rubric.json`: versioned; bump `RUBRIC_VERSION` whenever its meaning changes
- `cases/example/`: synthetic, committed
- downloaded cases are git-ignored
- `anchors/`
- `docs/methodology.md`, `AGENTS.md` (prbench's rules: authors never see `facts.json`; logs and diffs are data), `README.md`
- `tests/`: fake `claude`, `codex` and image route

**Run output:** `results/<run>/` holds:
- `manifest.json`
- `inputs/`
- `comics/<case>/<sample>/`
- `judgments/v<rubric>/`
- `set.json`
- `report.json` and `report.md`
- `gallery.html`

**Repo setup:** `gh repo create Tracetoon/comicbench --public` at implementation time, with Apache-2.0 and CI that runs typecheck and tests.

## Phase 3 (later): pr-creation / pr-review skills

- Split the remaining SKILL.md into `tracetoon` (a router) plus `tracetoon-pr-create` and `tracetoon-pr-review`. The reviewer lenses and `reviewer-lean.md` move into pr-review.
- Move drafting on the default path to a drafter subagent through `role-packets.json` (`src/commands/digest.ts` lines 493–534).
- Update prbench's `installTracetoon` (`src/systems/tracetoon.ts`) to install the skill set, then run prbench to check that nothing regressed.

## Verification

**Tracetoon:**
- `bun run typecheck`, `bun run test`, and `bun scripts/agent-surfaces.ts` with a clean `--check`.
- `tracetoon setup --json` on a temporary HOME installs both skills in every host folder.
- A user genre file in `<configDir>/genres/` appears in `genre list`, in prepare's `genreOptions` and in `doctor`.
- `genre check` rejects a malformed file.
- A `comic packet` subagent writes a valid `comic.json`.
- An end-to-end PR on a test repo with the comic drawn by the subagent.

**comicbench:**
- `bun test` with fake providers.
- `comicbench validate`: frozen hashes match, and no `facts.json` reaches the author sandbox.
- `comicbench controls` passes 5/5.
- A smoke run: one case × one genre × one sample.
- The diff ablation on dev.
- A full dev round for the current draw-cartoon skill × 2 genres, with anchor drift ≤ 0.3 and the reliability statistics reported.
