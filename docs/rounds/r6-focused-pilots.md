# Round 6 — Focused space-opera pilots

Round 5 gained visual polish and lost expressive framing, lettering and
effects. The scripts had already dropped those devices before the renderer
saw them. The new casting language also coincided with more older leads with
light hair, while a conditional suggestion to consider combat produced no
scripted spacecraft engagement. Round 6 tests three edits independently from
the exact Broad package used as the Round 5 control.

## Setup

| Track | Candidate edit | Frozen dev cases |
| --- | --- | --- |
| Staging | At script writing, give the action, reaction or line that carries a beat a clear focal point. Keep Broad’s directions on frames, lettering, effects and camera. | Learner Replay, Showtail Windows, WinApps Wayland, JavaFX Maven |
| Action | At concept selection, ask what could visibly oppose or respond to the software’s behavior. Follow the PR mechanism through the exchange and its outcome when it fits, then use Broad’s existing selection criteria. | CrossJudge and Tracetoon Review Run All for plausible responses, JavaFX Maven and VEX CLI Snap for weak fits |
| Casting | Establish the role through a choice or another character’s response. Choose age, silhouette and other traits separately. Give characters varied backgrounds and occasional ordinary relationship or identity cues where they fit. | Tracetoon Review Run All, Render Name Check, WinApps Wayland, VEX CLI Snap |

Each track has a fresh Broad and candidate arm with two samples per case. The
pinned runtime, space-opera genre, image route, medium-effort author model
and tool-free packet are shared. Each arm authors in seeded order so its
recent-comic context comes from the same earlier slots. The fact sheets
are accessible only to judges. Render verification uses the completed
checkpoint files and rubric v6. The arena uses `gpt-6.2-sol` and
`gpt-6.2-astra` with both presentation orders for each same-case,
same-sample pair.

The script audit compares each sample with its counterpart, alternates
presentation order and cites what was considered, selected and scripted.
Checklisting adds what is visible on the finished page, freezes the image-only
role reading before comparing it to the script, and verifies literal identity
excerpts. Cast observations describe the sample. The phone transcription is
a diagnostic for the desktop comic.

`bun scripts/round6.ts check` regenerates the subjects from the frozen Broad
package and writes the checkpoints. `bun scripts/round6.ts audit` audits all
three tracks. `bun scripts/round6.ts render <track>...` resumes selected
matched cohorts from those checkpoints. `bun scripts/round6.ts judge <track>...`
runs the arena and craft checklist. `bun scripts/round6.ts review` rebuilds
the offline page. The scripts, art and judge evidence live under the ignored
`results/r6/` directory.

## Script checkpoint

All 48 scripts passed the output contract. All 24 paired script audits
completed. The judge found a grounded technical joke in every script.

- **Staging.** Both arms gave the judge a clear focal beat. The candidate
  still authored eight sound effects, sixteen shaped balloons and seventeen
  panels with effects, compared with ten, fifteen and eighteen in Broad.
  Neither arm specified a dynamic frame in this cohort. Specific staging
  choices did change. For example, *Window Seat* uses the two chairs to land
  the JavaFX joke in the picture, and *Solo Hours* lets the tow crossing
  establish the shared Windows launch route before the baggage reveal.
  The retained craft and changed focal choices justify testing the artwork.
- **Action.** The candidate explicitly considered spacecraft contest in
  five designs and scripted it in three. Broad had zero by that test.
  The two Review Run All scripts used a sweep across scout craft and a
  selective rerun. CrossJudge still picked a cooperative order swap. The
  JavaFX control had a possible blockade and also showed the downside of
  forcing an opponent. One author rejected the intercept concept because
  it could look like the cause of the real launch problem. The judge
  counted one contest in a VEX camera story through pointed glare and
  continued observation. These are signals about countermoves. Fleet-scale
  battle and fighter-duel staging still need to be checked on the page.
- **Casting.** The candidate explicitly named Puerto Rican, Vietnamese,
  Filipino, Samoan and Black characters. Broad primarily named Black
  characters and had one explicit East Asian description. Five candidate
  scripts used Filipino casting. The script audit found the dark-skin and
  silver-hair pairing in two Broad scripts and none in the candidate,
  with three Broad samples marked unclear. Roles came through via action
  in every script on both sides. The audit found zero reader-facing LGBTQ+
  cues in the casting comparison. Role readability and the appearance
  observations both warrant an image check.

All three tracks advanced to render verification. For calibration, the
image-only role reader distinguished a passive figure labeled “CAPTAIN”
from a figure whom the crew obeys. The first craft calibration uncovered an
incorrect archived fixture label. The Learner Replay page has diagonal
movement inside rectangular panels. The corrected calibration uses it as a
negative control and tests a confirmed slanted gutter on the Render Name
Check page. All six corrected fixtures matched their expected checks.

The first render pass hit a phone-diagnostic error after delivering pages.
The pinned desktop runtime had dropped the reader’s schema and matcher.
Comicbench now owns that diagnostic. The replay uses the saved scripts,
page images and any completed desktop judge responses. The first pass is
recorded in `results/r6/render-attempt-1/`.

## Render verification

All 48 pages rendered and completed desktop judging. Every page passed the
respect and factual-integrity gates, and every phone transcription completed
after the reader fix. At 360 px the word-overlap check flagged 4 of 72 staging
candidate lettering items and 9 of 66 Broad items. The action counts were
5 of 66 and 7 of 70, and casting was 5 of 66 and 4 of 63. The phone counts
are diagnostic.

Both arena judges completed all 24 matched pairs in both orders. The table
shows candidate win share with ties counting half. The primary judge comes
first in each cell. Each track covers four frozen cases, so agreement on a
specific effect is more informative here than a narrow overall margin.

| Track | Humor | PR relevance | Use of medium | Visual | Overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Staging | 68.8% / 62.5% | 37.5% / 37.5% | 50% / 50% | 37.5% / 56.3% | 56.3% / 50% |
| Action | 50% / 37.5% | 37.5% / 12.5% | 37.5% / 56.3% | 56.3% / 25% | 37.5% / 25% |
| Casting | 50% / 62.5% | 31.3% / 56.3% | 37.5% / 25% | 75% / 81.3% | 43.8% / 62.5% |

### Staging preserved medium use and improved small-text reading

The arena judges tied on medium use and disagreed on visual preference.
Their humor judgments favored the candidate in this sample. The checklist
found sound-effects lettering and shaped balloons on six candidate pages
and seven Broad pages. It found no dynamic frames in either arm. The
focal-point guidance earned another look for readability. An angular
border or inset is still a layout decision the author has to connect to a
beat when choosing the composition.

### Action produced two small conflicts on the page

The candidate had three scripted engagements and two rendered engagements,
compared with zero at both stages for Broad. The page judge caught the
scout formation disrupted by a sweeping foil cape in Review Run All and
the tug flooding a recon craft with light in VEX CLI Snap. It found no fleet
engagements or fighter duels. Review Run All’s second script specifies a
freighter rolling to hide its hatch while the fighters fan out around it.
The page shows the fighters spreading around an angled freighter, with no
clear visual cue that the freighter moves in response.

The prompt made authors explore counterplay and helped some of it reach the
page. Both arena judges had the candidate behind on PR relevance. The
right condition for a future battle premise is a PR mechanism that turns
the contest, with both moves visible in the panels. In CrossJudge, the
order reversal was easier to read as two controlled passes. Review Run
All’s selective retry gave the characters a better reason to change their
flight pattern in response to a disruption.

### Casting reduced the repeated look and revealed a craft tradeoff

The dark-skin and silver-hair combination appeared on six Broad pages
and zero candidate pages. The image-only role reading matched the intended
role on five Broad and six candidate pages. In the scripts, the candidate
used a broader range of explicit backgrounds, with Filipino characters
still recurring across five samples. The checklist could assess
human-to-human contrast on five Broad pages and two candidate pages.
It could assess human-to-alien contrast on one Broad page and five
candidate pages. The judges found no reader-visible LGBTQ+ cues anywhere
in the pilot.

Both arena judges preferred the candidate’s visual art and favored Broad’s
use of the medium. The candidate had sound-effect lettering on three pages
versus five for Broad, and one dynamic layout on the page versus two.
Casting is the strongest lead for a follow-up. Its central role and
appearance choices can be carried forward as a focused test with a separate
check that the joke still gets expressive framing and lettering. A combined
candidate would need its own comparison.
