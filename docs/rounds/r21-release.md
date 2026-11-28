# Round 21: choosing the release configuration

**Date:** 2026-11-28
**Follows:** `docs/rounds/r20-research.md`
**Scored with:** measures v2 (38 anchors in three families; Codex games, with a seeded Claude sample)

## The question

Round 20's control (A) was the release candidate: round 19 plus the quick fixes. Round 21 tested two cheap changes against it, on the 20 dev PRs with 2 drafts each:

| Arm | Change from the release candidate | Question |
| --- | --- | --- |
| free | no assigned setting; office places and office parody still rejected | Did assigned settings cause the humor slide since round 18? |
| command | the PR's command or product named among the anchor terms | Can recognizability improve without the humor cost of stating the change plainly? |

**Decision rule, set before the run:** ship the arm with the best overall score; humor must not fall below the release candidate's; "about this PR" breaks ties. If neither variant clearly wins, ship the release candidate.

## Results (mean, 95% case-bootstrap CI)

| | r18 | r19 | Release candidate | free | command |
| --- | --- | --- | --- | --- | --- |
| Funnier | −2.50 | −3.09 | −3.60 [−4.38, −2.82] | −3.59 [−4.31, −2.88] | −3.64 [−4.48, −2.79] |
| Overall | −2.77 | −3.17 | −3.60 [−4.36, −2.77] | −3.68 [−4.41, −2.90] | −4.06 [−4.87, −3.25] |
| Medium | 3.18 | 4.27 | 3.45 | 3.03 | 3.35 |
| Craft | 1.01 | 0.72 | 0.75 | 0.30 | 0.36 |
| About this PR (relative) | 0.40 | −0.70 | −0.87 | −0.22 | −0.66 |
| Veteran appeal (relative) | −0.16 | −0.05 | −0.11 | 0.10 | **0.75** [0.05, 1.45] |

**Humor against fantasy gag strips:** r18 53%, r19 38%, release candidate 27%, free 27%, command 26%.

**Judge agreement** (Claude sample, 176 games): kappa 0.73 on humor, 0.78 on craft, 0.54 on medium and 0.66 overall.

## Decision: ship the release candidate

- **Free setting:**
  - Humor is identical to the release candidate's.
  - "About this PR" is higher, and craft and medium lower, all within noise.
  - Assigned settings did not cause the humor slide.
- **Command named:**
  - Humor is unchanged and overall slightly lower.
  - Veteran appeal is higher, just significant, but that is not enough to adopt it.
- **Neither variant clearly wins,** so the release configuration is the release candidate:
  - assigned adventure settings with the office check;
  - staples offered;
  - no joke or carrier rules;
  - plus the production two-draft selection: a fresh author writes a second draft, and the funnier wins a blind comparison in both orders.

## Still open

- **Humor fell from round 18 to the release candidate:** −2.50 to −3.60 (fantasy strips 53% → 27%). The CIs overlap slightly, but the trend is consistent across r19, r20 and r21.
- **Settings are ruled out,** so the remaining suspects are round 19's other changes:
  - the retired leads;
  - the uniform gutters and counts-first layout sentence;
  - the staple changes.

  Some are owner decisions that stay. Comparing round 18 with round 19 on the same PRs is the next experiment.

## Released: Tracetoon 1.0.0-rc.53 (2026-11-28)

The release candidate shipped as 1.0.0-rc.53 (Tracetoon #244, then the release PR #245), with the production two-draft selection on by default.

### Sealed validation (41 held-out PRs, never tuned against; 2 drafts each)

| | Dev (release config, 20 PRs) | Sealed (41 PRs) |
| --- | --- | --- |
| Funnier | −3.04 [−3.80, −2.27] · fantasy strips 32% | −3.11 [−3.68, −2.58] · fantasy strips 30% |
| Overall | −3.51 | −3.39 |
| Craft | 0.93 | 1.00 |
| Medium | 3.21 | 2.84 |

- **No overfitting to the dev PRs:** the sealed scores match dev on every criterion.
- **Picking the better draft on unseen PRs:**
  - The page judge (the shipped design) captured 51% of the best-possible humor gain (+0.55 logit), against 69–75% on dev.
  - The script judge captured 11%.
  - So the two-draft gain is real but smaller than dev suggested.
- **Scope:** Codex judges only; no PR-context games, because each sealed PR has comics from one round only.
