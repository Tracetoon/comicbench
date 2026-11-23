/** Reproduce the matched Round 6 author and render cohorts. */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runRound, treeHash } from '../src/round.ts';
import { sha256 } from '../src/cases.ts';
import { runScriptAudit } from '../src/script-audit.ts';

const root = resolve(import.meta.dir, '..');
const cache = join(root, '.comicbench-cache');
const broad = join(cache, 'r5-control', 'skill');
const genre = join(cache, 'r5-control', 'space-opera.md');
const runtime = join(cache, 'tracetoon-r4');
const out = join(root, 'results', 'r6');
const model = 'gpt-6.2-sol';

const tracks = {
  staging: {
    cases: ['aifirstcli-learner-replay-ux', 'showtail-windows-cmd', 'winapps-sdl-wayland', 'aifirstcli-javafx-maven'],
    before: '6. **Run the check command',
    guidance: `   As you script a beat, make its key action, reaction or line the first
   thing the eye finds. Use scale, contrast or space around it to keep it
   distinct from the rest of the panel. Let the beat choose the comic tool:
   a tilted edge can carry a lurch, an inset can expose a tiny mistake, a
   radio balloon can locate a voice outside the shot, and a burst or oversized
   lettering can sell a reversal. A quiet area around the payoff lets the
   border, background effects and lettering do their work where they matter.
`,
  },
  action: {
    cases: ['prbench-crossjudge', 'tracetoon-review-run-all', 'aifirstcli-javafx-maven', 'vexagent-cli-snap'],
    before: '   the one every other comic tells.\n',
    guidance: `   the one every other comic tells.
   In space opera, ask what can visibly respond to the PR's changed behavior.
   When that mechanism makes opposing moves natural, try the exchange in one
   of the three concepts: what the first craft or formation does, how the
   other side answers, and how the changed behavior determines the outcome or
   lands the joke. A fighter duel can turn on one maneuver and countermove.
   A fleet engagement can turn on several ships coordinating under pressure.
   Keep the consequence legible on the page. A launch or a battle in the
   distance does not show this exchange. Use the same criteria above to pick
   the winner. In the local design notes, briefly say what exchange you
   considered and why it fit or lost, or why the PR offered no natural fit.
`,
  },
  casting: {
    cases: ['tracetoon-review-run-all', 'tracetoon-render-name-check', 'winapps-sdl-wayland', 'vexagent-cli-snap'],
    before: '- **Vary the cast across comics.** When people suit the story, let a wider',
    guidance: `- **Make genre roles recognizable through what happens.** A captain makes a
  decision the crew acts on. An ace pulls a maneuver another pilot has to
  answer. Show the beat that makes the role legible. Choose age, silhouette,
  hair, clothing and accessories separately from the authority or competence
  the character needs in the story. Any of those roles can belong to people
  of different ages, looks or backgrounds.
- **Vary the cast across comics.** Draw from a wide range of cultural
  backgrounds, including Latino, Asian and Pacific Islander characters when
  they fit. Let characters of varied genders and orientations, including
  trans and nonbinary people, inhabit genre roles across backgrounds. An
  ordinary line about a partner or spouse can carry through to the page when
  it belongs in the scene. Some jokes naturally feature ships, creatures or
  a cast with no such cue. Keep identities incidental and aim the joke at the
  bug, tool or predicament. Avoid demeaning stereotypes and turning a
  marginalized character into the object of ridicule.
`,
  },
};

type Track = keyof typeof tracks;

function subject(track: Track) {
  const dest = join(cache, 'r6', track, 'skill');
  const skillFile = join(broad, 'SKILL.md');
  const original = readFileSync(skillFile, 'utf8');
  const { before, guidance } = tracks[track];
  const endOfCast = '- **Invent this comic';
  if (original.split(before).length !== 2 || (track === 'casting' && !original.includes(endOfCast))) {
    throw new Error(`Broad instruction anchor changed for ${track}`);
  }
  const candidate = track === 'casting'
    ? original.slice(0, original.indexOf(before)) + guidance + original.slice(original.indexOf(endOfCast))
    : original.replace(before, track === 'staging' ? guidance + before : guidance);
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
    cpSync(join(broad, 'references'), join(dest, 'references'), { recursive: true });
    writeFileSync(join(dest, 'SKILL.md'), candidate);
  }
  if (readFileSync(join(dest, 'SKILL.md'), 'utf8') !== candidate ||
      treeHash(join(dest, 'references')) !== treeHash(join(broad, 'references'))) {
    throw new Error(`Round 6 candidate files changed for ${track}`);
  }
  return dest;
}

async function main() {
  const [stage, ...requested] = process.argv.slice(2);
  const selection = requested.length ? requested : Object.keys(tracks);
  if (!stage || !['check', 'audit', 'render', 'judge', 'review'].includes(stage) ||
      selection.some((track) => !Object.hasOwn(tracks, track)) ||
      ((stage === 'render' || stage === 'judge') && !requested.length)) {
    throw new Error('Usage: bun scripts/round6.ts check|audit|review [staging action casting] | render|judge <track>...');
  }
  if (treeHash(broad) !== 'e1c6ace26d5163c56d4e74ff18a73898c94fe69f75b85d528619185f3d78204c' ||
      sha256(readFileSync(genre)) !== '6e9939daa2bcc8e830f77d16caf23503bc69c669b66dbac0d6521117bc2917c2' ||
      sha256([
        treeHash(join(runtime, 'src')),
        sha256(readFileSync(join(runtime, 'scripts', 'comic-draw.ts'))),
        sha256(readFileSync(join(runtime, 'bun.lock'))),
      ].join('\n')) !== 'acf9099cbac0e76918ac796ff7fde2defd8dc58872b994defc011daa9be2a789') {
    throw new Error('The Round 5 Broad control, genre or runtime hash changed.');
  }
  process.env.TRACETOON_CODEX_IMAGE_AGENT_MODEL = model;
  process.env.TRACETOON_CODEX_IMAGE_AGENT_EFFORT = 'medium';
  const selected = [...new Set(selection as Track[])];
  if (stage === 'review') {
    const { buildReview } = await import('../src/review.ts');
    const [first, ...rest] = selected.flatMap((track) => [join(out, `${track}-broad`), join(out, `${track}-candidate`)]);
    const dir = buildReview({
      round: first!, rounds: rest, tracetoon: runtime, out: join(out, 'review'),
      arenas: selected.map((track) => join(out, `${track}-arena`)),
      scriptAudits: selected.map((track) => join(out, `${track}-audit`)),
    });
    console.log(join(dir, 'index.html'));
    return;
  }
  if (stage === 'judge') {
    const [{ runArena }, { runChecklist }] = await Promise.all([import('../src/arena.ts'), import('../src/checklist.ts')]);
    const results = await Promise.allSettled(selected.map(async (track) => {
      const a = join(out, `${track}-broad`);
      const b = join(out, `${track}-candidate`);
      if (![a, b].every((dir) => existsSync(join(dir, 'report.json')))) {
        throw new Error(`Finish both rendered arms for ${track} before judging.`);
      }
      if ([a, b].some((dir) => {
        const progress = JSON.parse(readFileSync(join(dir, 'progress.json'), 'utf8'));
        const checkpoint = JSON.parse(readFileSync(join(dir, 'script-report.json'), 'utf8'));
        return progress.length !== checkpoint.states.length ||
          progress.some(({ status }: { status: string }) => status !== 'judged' && status !== 'gated');
      })) {
        throw new Error(`Resume failed render or judging work for ${track} first.`);
      }
      const [arena, ...checklists] = await Promise.all([
        runArena({ a, b, out: join(out, `${track}-arena`), model2: 'gpt-6.2-astra', share2: 1, pairing: 'matched', jobs: 4 }),
        runChecklist({ round: a, jobs: 2 }),
        runChecklist({ round: b, jobs: 2 }),
      ]);
      console.log(`${track} · ${arena.report.pairs} arena pairs · ${checklists.map((checklist) => checklist.comics).join(' + ')} checklists`);
      if (arena.report.errors.length || checklists.some((checklist) => checklist.errors.length)) {
        throw new Error(`${track} judging has incomplete samples`);
      }
    }));
    for (const failure of results) if (failure.status === 'rejected') {
      console.error(failure.reason);
      process.exitCode = 1;
    }
    return;
  }
  if (stage === 'audit') {
    const audits = await Promise.allSettled(selected.map(async (track) => {
      const audit = await runScriptAudit({
        a: join(out, `${track}-broad`), b: join(out, `${track}-candidate`), out: join(out, `${track}-audit`),
        jobs: Math.max(1, Math.floor(6 / selected.length)),
      });
      const completed = audit.results.filter((row) => !('error' in row)).length;
      console.log(`${track} · ${completed}/${audit.results.length} pairs audited`);
      if (completed !== audit.results.length) throw new Error(`${track} audit has incomplete pairs`);
    }));
    for (const failure of audits) if (failure.status === 'rejected') {
      console.error(failure.reason);
      process.exitCode = 1;
    }
    return;
  }
  const runs = selected.flatMap((track) => [
    { track, skill: broad, dir: join(out, `${track}-broad`) },
    { track, skill: subject(track), dir: join(out, `${track}-candidate`) },
  ]);
  if (stage === 'render' && runs.some((run) => !existsSync(join(run.dir, 'script-report.json')))) {
    throw new Error('Run the author checkpoint for the entire matched cohort before rendering.');
  }
  if (stage === 'render' && selected.some((track) => !existsSync(join(out, `${track}-audit`, 'script-audit.json')))) {
    throw new Error('Review the paired script audit before rendering a Round 6 track.');
  }
  const results = await Promise.allSettled(runs.map(async ({ track, skill, dir }) => {
    const result = await runRound({
      cases: join(root, 'cases-local'),
      split: 'dev',
      only: tracks[track].cases,
      samples: 2,
      jobs: 1,
      author: 'inline',
      model,
      skill,
      genre,
      tracetoon: runtime,
      out: dir,
      stopAfter: stage === 'check' ? 'check' : undefined,
      drawJobs: stage === 'render' ? Math.max(2, Math.floor(12 / runs.length)) : undefined,
    });
    console.log(`${result.name} · ${result.states.map(({ status }) => status).join(', ')}`);
    if (result.states.some(({ status }) => status === 'error')) throw new Error(`${result.name} has incomplete samples`);
  }));
  const failures = results.filter((r) => r.status === 'rejected');
  for (const failure of failures) console.error(failure.reason);
  if (failures.length) process.exitCode = 1;
}

if (import.meta.main) await main();
