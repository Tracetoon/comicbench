#!/usr/bin/env bun
/**
 * comicbench: score one draw-cartoon skill with one genre across frozen cases.
 *
 *   comicbench validate [cases-dir]
 *   comicbench packet <case-dir> --skill <file> [--skill <file>...] --genre <genre.md> --out <dir>
 *   comicbench score <run-dir>
 *
 * The author, drawing and judging runners come next (docs/plan.md, Phase 2).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { caseProblems, loadCases } from './cases.ts';
import { readGenre } from './genre.ts';
import { comicPacketFiles } from './packet.ts';
import { RUBRIC_VERSION } from './rubric.ts';
import { judgmentProblems, report, type ComicJudgment, type SetJudgment } from './score.ts';

function args(argv: string[]): { positional: string[]; flags: Map<string, string[]> } {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${a} needs a value`);
      flags.set(a.slice(2), [...(flags.get(a.slice(2)) ?? []), value]);
      i++;
    } else positional.push(a);
  }
  return { positional, flags };
}

export function validate(root: string): { ok: boolean; lines: string[] } {
  const cases = loadCases(root);
  const lines: string[] = [];
  let ok = cases.length > 0;
  if (!cases.length) lines.push(`No cases under ${root}.`);
  for (const c of cases) {
    const problems = caseProblems(c.dir);
    if (problems.length) ok = false;
    lines.push(problems.length ? `${c.meta.id}: ${problems.join('; ')}` : `${c.meta.id}: ok (${c.meta.split})`);
  }
  return { ok, lines };
}

/** Writes the author packet for one frozen case; the author never sees facts.json. */
export function writePacket(
  caseDir: string,
  opts: {
    skillFiles: string[];
    genre: string;
    out: string;
    checkCommand?: string;
    /** The round's earlier comics (newest first), as production's recentComics. */
    recentComics?: Record<string, unknown>[];
    /** Pin the genre so the repeat rule doesn't refuse a round's shared genre. */
    pinGenre?: boolean;
    /** Scenes per genre id, when the Tracetoon under test has a scene library. */
    sceneOptions?: Record<string, unknown[]>;
  },
): string[] {
  const problems = caseProblems(caseDir);
  if (problems.length) throw new Error(`${caseDir}: ${problems.join('; ')}`);
  mkdirSync(opts.out, { recursive: true });
  const out = resolve(opts.out);
  const files = comicPacketFiles({
    brief: readFileSync(join(caseDir, 'brief.md'), 'utf8'),
    description: readFileSync(join(caseDir, 'description.md'), 'utf8'),
    genres: [readGenre(opts.genre)],
    ...(opts.recentComics ? { recentComics: opts.recentComics } : {}),
    ...(opts.pinGenre ? { pinnedGenre: readGenre(opts.genre).id } : {}),
    ...(opts.sceneOptions ? { sceneOptions: opts.sceneOptions } : {}),
    skillFiles: opts.skillFiles.map((f) => resolve(f)),
    patchPath: resolve(caseDir, 'changes.patch'),
    out: { comic: join(out, 'comic.json'), design: join(out, 'comic-design.json') },
    // `comic check --file` (a Tracetoon release after 1.0.0-rc.45) lints outside a run;
    // the packet's own context and brief give it the repeat and anchor checks.
    checkCommand:
      opts.checkCommand ??
      `tracetoon comic check --file ${join(out, 'comic.json')} --context ${join(out, 'context.json')} --evidence ${join(out, 'brief.md')}`,
  });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(opts.out, name), text);
  return Object.keys(files).map((f) => join(opts.out, f));
}

/** Reads <run>/judgments/<case>/<sample>.json and <run>/set.json; writes <run>/report.json. */
export function scoreRun(runDir: string) {
  const dir = join(runDir, 'judgments');
  if (!existsSync(dir)) throw new Error(`No judgments in ${dir}.`);
  const judgments: ComicJudgment[] = [];
  for (const c of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()))
    for (const f of readdirSync(join(dir, c.name)).filter((n) => n.endsWith('.json'))) {
      const j = JSON.parse(readFileSync(join(dir, c.name, f), 'utf8')) as ComicJudgment;
      j.case ??= c.name;
      j.sample ??= Number(f.replace(/\.json$/, ''));
      const bad = judgmentProblems(j);
      if (bad.length) throw new Error(`${c.name}/${f}: ${bad.join('; ')}`);
      judgments.push(j);
    }
  const setPath = join(runDir, 'set.json');
  const set = existsSync(setPath) ? (JSON.parse(readFileSync(setPath, 'utf8')) as SetJudgment) : undefined;
  const r = { rubricVersion: RUBRIC_VERSION, ...report(judgments, set) };
  writeFileSync(join(runDir, 'report.json'), JSON.stringify(r, null, 2) + '\n');
  return r;
}

const fmt = (n: number | null) => (n === null || Number.isNaN(n) ? 'n/a' : n.toFixed(1));
const fmt2 = (n: number) => (Number.isNaN(n) ? 'n/a' : n.toFixed(2));

if (import.meta.main) {
  try {
    const [cmd, ...rest] = process.argv.slice(2);
    const { positional, flags } = args(rest);
    if (cmd === 'validate') {
      const r = validate(resolve(positional[0] ?? 'cases'));
      console.log(r.lines.join('\n'));
      process.exit(r.ok ? 0 : 1);
    } else if (cmd === 'packet') {
      const [caseDir] = positional;
      const genre = flags.get('genre')?.[0];
      const out = flags.get('out')?.[0];
      const skillFiles = flags.get('skill') ?? [];
      if (!caseDir || !genre || !out || !skillFiles.length)
        throw new Error('usage: comicbench packet <case-dir> --skill <file> --genre <genre.md> --out <dir>');
      const checkCommand = flags.get('check')?.[0];
      console.log(
        writePacket(resolve(caseDir), {
          skillFiles,
          genre,
          out: resolve(out),
          ...(checkCommand ? { checkCommand } : {}),
        }).join('\n'),
      );
    } else if (cmd === 'score') {
      if (!positional[0]) throw new Error('usage: comicbench score <run-dir>');
      const r = scoreRun(resolve(positional[0]));
      console.log(
        `Comics: ${r.comics} (scored ${r.scored}, gated ${r.gated}, unknown ${r.unknown})\n` +
          `Comic score: ${fmt(r.comicMean)} [${fmt(r.comicCI[0])}, ${fmt(r.comicCI[1])}]\n` +
          `Set score: ${fmt(r.set)}\nHeadline: ${fmt(r.headline)} (rubric v${r.rubricVersion})`,
      );
    } else if (cmd === 'compare') {
      const [a, b] = positional;
      if (!a || !b) throw new Error('usage: comicbench compare <round-a> <round-b>');
      const { compareRounds } = await import('./compare.ts');
      const r = compareRounds(resolve(a), resolve(b));
      const f1 = (n: number) => (Number.isNaN(n) ? 'n/a' : n.toFixed(1));
      const f2 = (n: number) => (Number.isNaN(n) ? 'n/a' : n.toFixed(2));
      const side = (s: typeof r.a) =>
        `${s.round}: ${s.comics} comics, score ${f1(s.score)}; first draft clean ${s.author.firstClean}/${s.author.comics}, tries ${f2(s.author.meanTries)}\n` +
        `  criteria ${Object.entries(s.criteria).map(([k, v]) => `${k} ${f2(v)}`).join(', ')}\n` +
        `  gate failures ${Object.entries(s.gateFails).map(([k, v]) => `${k} ${v}`).join(', ')}`;
      console.log(
        `${side(r.a)}\n${side(r.b)}\n` +
          `B - A over ${r.cases} shared cases: ${f1(r.delta.mean)} [${f1(r.delta.ci[0])}, ${f1(r.delta.ci[1])}]; B higher on ${r.delta.wins}, lower on ${r.delta.losses}, tied ${r.delta.ties}`,
      );
      if (flags.get('json')) console.log(JSON.stringify(r, null, 2));
    } else if (cmd === 'datasets' && positional[0] === 'fetch') {
      const { datasetRelease, fetchDataset } = await import('./datasets.ts');
      const d = datasetRelease(positional[1]);
      const out = flags.get('out')?.[0];
      const dir = await fetchDataset(d, out ? resolve(out) : undefined);
      console.log(`Dataset verified: ${d.id}@${d.version}\nCases: ${dir}`);
    } else if (cmd === 'run') {
      const need = (k: string) => {
        const v = flags.get(k)?.[0];
        if (!v) throw new Error(`run needs --${k} (see README: Running a round)`);
        return v;
      };
      const { runRound } = await import('./round.ts');
      const split = (flags.get('split')?.[0] ?? 'dev') as 'dev' | 'sealed' | 'all';
      const result = await runRound({
        cases: resolve(need('cases')),
        split,
        skill: resolve(need('skill')),
        genre: resolve(need('genre')),
        samples: Number(flags.get('samples')?.[0] ?? 2),
        out: resolve(need('out')),
        tracetoon: resolve(need('tracetoon')),
        jobs: Number(flags.get('jobs')?.[0] ?? 3),
        ...(flags.get('model')?.[0] ? { model: flags.get('model')![0]! } : {}),
        ...(flags.get('only')?.[0] ? { only: flags.get('only')![0]!.split(',') } : {}),
        ...(flags.get('author')?.[0] ? { author: flags.get('author')![0] as 'sandbox' | 'inline' } : {}),
      });
      const r = result.report;
      const errors = result.states.filter((s) => s.status === 'error').length;
      console.log(
        `Round ${result.name}: ${r.comics} judged comics (gated ${r.gated}, unknown ${r.unknown}), ${errors} errors\n` +
          `Comic score: ${fmt(r.comicMean)} [${fmt(r.comicCI[0])}, ${fmt(r.comicCI[1])}]\n` +
          `Set score: ${fmt(r.set)}\nHeadline: ${fmt(r.headline)} (rubric v${r.rubricVersion})`,
      );
    } else if (cmd === 'reliability') {
      const round = positional[0];
      const tracetoon = flags.get('tracetoon')?.[0];
      const model2 = flags.get('model-2')?.[0];
      if (!round || !tracetoon || !model2) throw new Error('usage: comicbench reliability <round> --tracetoon <dir> --model-2 <model> [--share 0.3] [--repeat-share 0.1]');
      const { runReliability } = await import('./reliability.ts');
      const r = await runReliability({
        round: resolve(round),
        tracetoon: resolve(tracetoon),
        model2,
        share: Number(flags.get('share')?.[0] ?? 0.3),
        repeatShare: Number(flags.get('repeat-share')?.[0] ?? 0.1),
        jobs: Number(flags.get('jobs')?.[0] ?? 3),
      });
      const line = (name: string, a: typeof r.secondJudge) =>
        `${name} (${a.pairs} comics): ` + Object.entries(a.criteria).map(([k, v]) => `${k} α=${fmt2(v.alpha)}`).join(', ');
      console.log(`${line(`second judge ${r.model2}`, r.secondJudge)}\n${line('same judge again', r.repeat)}${r.errors.length ? `\nerrors: ${r.errors.length}` : ''}`);
    } else if (cmd === 'calibrate') {
      const round = positional[0];
      const tracetoon = flags.get('tracetoon')?.[0];
      if (!round || !tracetoon) throw new Error('usage: comicbench calibrate <round> --tracetoon <dir> [--cases 5] [--pairwise true]');
      const cal = await import('./calibrate.ts');
      if (flags.get('pairwise')?.[0] === 'true') {
        const r = await cal.runPairwiseCalibration({ round: resolve(round), tracetoon: resolve(tracetoon), jobs: Number(flags.get('jobs')?.[0] ?? 3) });
        console.log(Object.entries(r.controls).map(([k, v]) => `${k}: the original won ${v.won}/${v.of} on ${v.target}${v.pass ? '' : ' (UNCALIBRATED)'}`).join('\n'));
      } else {
        const r = await cal.runCalibration({ round: resolve(round), tracetoon: resolve(tracetoon), cases: Number(flags.get('cases')?.[0] ?? 5), jobs: Number(flags.get('jobs')?.[0] ?? 3) });
        console.log(Object.entries(r.controls).map(([k, v]) => `${k}: ${v.hits}/${v.of} noticed (${v.expect})${v.pass ? '' : ' (UNCALIBRATED)'}`).join('\n'));
      }
    } else if (cmd === 'anchors') {
      const [sub, target] = positional;
      const tracetoon = flags.get('tracetoon')?.[0];
      if (!target || !tracetoon || (sub !== 'freeze' && sub !== 'check')) throw new Error('usage: comicbench anchors freeze <round> --tracetoon <dir> [--out anchors] | anchors check <anchors-dir> --tracetoon <dir> --label <name>');
      const cal = await import('./calibrate.ts');
      if (sub === 'freeze') {
        const r = await cal.freezeAnchors({ round: resolve(target), tracetoon: resolve(tracetoon), out: resolve(flags.get('out')?.[0] ?? 'anchors') });
        console.log(r.items.map((i) => `${i.id}: ${i.runs} runs`).join('\n'));
      } else {
        const label = flags.get('label')?.[0];
        if (!label) throw new Error('anchors check needs --label');
        const r = await cal.checkAnchors({ dir: resolve(target), tracetoon: resolve(tracetoon), label });
        console.log(Object.entries(r.drift).map(([k, v]) => `${k}: ${fmt2(v.mean)}${v.flagged ? ' DRIFT' : ''}`).join('\n'));
      }
    } else if (cmd === 'arena') {
      const [a, b] = positional;
      if (!a || !b) throw new Error('usage: comicbench arena <round-a> <round-b> [--out <dir>] [--model-2 <model>] [--share-2 0.3] [--only a,b]');
      const { runArena, ARENA_CRITERIA } = await import('./arena.ts');
      const m2 = flags.get('model-2')?.[0];
      const { out, report } = await runArena({
        a: resolve(a),
        b: resolve(b),
        ...(flags.get('out')?.[0] ? { out: resolve(flags.get('out')![0]!) } : {}),
        ...(m2 ? { model2: m2, share2: Number(flags.get('share-2')?.[0] ?? 0.3) } : {}),
        ...(flags.get('only')?.[0] ? { only: flags.get('only')![0]!.split(',') } : {}),
        jobs: Number(flags.get('jobs')?.[0] ?? 3),
      });
      console.log(`${report.b} vs ${report.a} over ${report.pairs} pairs (win rate of ${report.b}; ties count half):`);
      for (const c of ARENA_CRITERIA) {
        const r = report.criteria[c.id]!;
        console.log(`  ${c.id}: ${(100 * r.winRate).toFixed(0)}% [${(100 * r.ci[0]).toFixed(0)}, ${(100 * r.ci[1]).toFixed(0)}]  (${r.wins} won, ${r.losses} lost, ${r.ties} tied, ${r.flips} flipped with order)`);
      }
      if (report.secondJudge) console.log(`  second judge ${report.secondJudge.model}: kappa ${Object.entries(report.secondJudge.kappa).map(([k, v]) => `${k} ${fmt2(v as number)}`).join(', ')}`);
      if (report.errors.length) console.log(`  errors: ${report.errors.length}`);
      console.log(`Arena: ${join(out, 'arena.json')}`);
    } else if (cmd === 'checklist') {
      const round = positional[0];
      if (!round) throw new Error('usage: comicbench checklist <round> [--jobs 3]');
      const { runChecklist } = await import('./checklist.ts');
      const s = await runChecklist({ round: resolve(round), jobs: Number(flags.get('jobs')?.[0] ?? 3) });
      const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
      console.log(
        `${s.round}: ${s.comics} comics; office-like ${pct(s.officeLike)}, deadpan ${pct(s.deadpan)}, image carries joke ${pct(s.imageCarriesJoke)}; medium index ${fmt2(s.mediumIndex)} of 6\n` +
          `  medium: ${Object.entries(s.medium).map(([k, v]) => `${k} ${pct(v)}`).join(', ')}\n` +
          `  settings: ${Object.entries(s.settings).map(([k, v]) => `${k} ${v}`).join(', ')} (entropy ${fmt2(s.settingEntropy)})\n` +
          `  punchlines: ${Object.entries(s.punchlines).map(([k, v]) => `${k} ${v}`).join(', ')}${s.errors.length ? `\n  errors: ${s.errors.length}` : ''}`,
      );
    } else if (cmd === 'review') {
      const round = positional[0];
      if (!round) throw new Error('usage: comicbench review <round> [<round>...] [--arena <arena-dir>...] [--tracetoon <dir>] [--out <dir>]');
      const { buildReview } = await import('./review.ts');
      const compare = flags.get('compare')?.[0];
      const tracetoon = flags.get('tracetoon')?.[0];
      const out = buildReview({
        round: resolve(round),
        ...(compare ? { compare: resolve(compare) } : {}),
        rounds: positional.slice(1).map((r) => resolve(r)),
        arenas: (flags.get('arena') ?? []).map((a) => resolve(a)),
        ...(tracetoon ? { tracetoon: resolve(tracetoon) } : {}),
        out: resolve(flags.get('out')?.[0] ?? join(round, 'review')),
      });
      console.log(`Review page: ${join(out, 'index.html')}`);
    } else {
      console.error('usage: comicbench <validate|packet|score|run|compare|reliability|calibrate|anchors|review|datasets fetch> ...');
      process.exit(2);
    }
  } catch (e) {
    console.error(`comicbench: ${(e as Error).message}`);
    process.exit(1);
  }
}
