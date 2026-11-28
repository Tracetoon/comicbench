/**
 * One command for a whole benchmark round: every arm's comics, every
 * checklist, every arena and the review page, run as parallel as the work
 * allows. References are checked right away; each new comic is checked and
 * judged against the references the moment it is drawn; arms run side by
 * side; one gate (gate.ts) shares Codex between them, comic work first. A
 * canary stops a broken run early, and the machine is kept awake.
 *
 * Every step caches per item (comic, checklist, arena pair), so the final
 * batch summaries are cache reads, results match a step-by-step run, and
 * rerunning the same spec resumes.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { keepAwake } from './awake.ts';
import { checkComics } from './checklist.ts';
import { judgePairs } from './arena.ts';
import { gate, inLane } from './gate.ts';
import { buildReview } from './review.ts';
import { runRound, type ComicState } from './round.ts';

export interface CampaignArm {
  name: string;
  label?: string;
  genre: string;
  skill: string;
  tracetoon: string;
  jobs?: number;
}

export interface CampaignSpec {
  name: string;
  cases: string;
  split?: 'dev' | 'sealed' | 'all';
  samples?: number;
  only?: string[];
  arms: CampaignArm[];
  references?: { round: string; label?: string }[];
  /** Pairs of round names (arm or reference) to judge head to head. */
  arenas?: [string, string][];
  secondJudge?: { model: string; share?: number };
  /** Comics per arm drawn before the canary check (default 3); 0 turns it off. */
  canary?: number;
  /** Text calls at once (default 24). */
  slots?: number;
  /** Text slots always left for judging while it waits (default 12). */
  judgeSlots?: number;
  /** Image renders at once, outside the text slots (default 24). */
  drawSlots?: number;
  /** Where results go (default: results). */
  results?: string;
  /** Tracetoon used to render the review page's brand mark. */
  reviewTracetoon?: string;
}

/** A round's comic ids from its folders, case then sample. */
export function comicIds(round: string): string[] {
  const root = join(round, 'comics');
  if (!existsSync(root)) return [];
  return readdirSync(root).sort().flatMap((c) => readdirSync(join(root, c)).sort().map((n) => `${c}#${n}`));
}

const drawn = (round: string, id: string) => {
  const [c, n] = id.split('#') as [string, string];
  return existsSync(join(round, 'comics', c, n, 'art', 'page.png'));
};

const readJson = (f: string) => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8').replace(/^\uFEFF/, '')) : undefined);

/** Problems with one drawn comic that mean the run is broken, for the canary. */
export function canaryProblems(s: ComicState): string[] {
  const out: string[] = [];
  if (s.status === 'error') out.push(`${s.case}#${s.sample}: ${s.stage ?? 'error'} ${s.error ?? ''}`.trim());
  if (readJson(join(s.dir, 'art', 'misread.json'))?.concern === true) out.push(`${s.case}#${s.sample}: misread concern after redraws`);
  const check = readJson(join(s.dir, 'check.json'));
  if (check && check.ok === false) out.push(`${s.case}#${s.sample}: comic check failed`);
  if (s.status !== 'error' && !existsSync(join(s.dir, 'art', 'page.png'))) out.push(`${s.case}#${s.sample}: no image`);
  const ctx = readJson(join(s.dir, 'packet', 'context.json'));
  const script = readJson(join(s.dir, 'packet', 'comic.json'));
  const option = ctx?.genreOptions?.[0];
  if (option && script) {
    const personas: string[] = Array.isArray(script.personas) ? script.personas : [];
    const offered = new Set((option.castOffer?.personas ?? []).map((p: { id: string }) => p.id));
    if (option.castOffer && personas.some((p) => !offered.has(p))) out.push(`${s.case}#${s.sample}: a persona outside the cast offer`);
    // Round 13 on, an isekai cast's offer is \`sceneOffer\`, and using one is required.
    // Round 14 on, an isekai comic's meme comes from its `memeList`, attached to the picked gag.
    const memes = new Set([...(option.memeOffer ?? []), ...(option.sceneOffer ?? []), ...(option.memeList ?? []), ...(option.tropeOffer ?? [])].map((m: { id: string }) => m.id));
    if (script.meme && !memes.has(script.meme)) out.push(`${s.case}#${s.sample}: a meme outside the offer`);
    if (option.sceneOffer?.length && !script.meme) out.push(`${s.case}#${s.sample}: no offered scene used`);
    if (option.pitches?.length && !option.pick) out.push(`${s.case}#${s.sample}: no gag picked`);
    if (option.pick && script.gag !== (option.pick.idea ?? option.pick.gag)?.id) out.push(`${s.case}#${s.sample}: comic is not the picked idea`);
    if (option.assignedStyle && script.style !== option.assignedStyle) out.push(`${s.case}#${s.sample}: style ${script.style} instead of ${option.assignedStyle}`);
  }
  return out;
}

/** The arena pair keys ("aId|bId") a newly drawn comic completes. */
export function pairsFor(o: { side: 'a' | 'b'; id: string; otherIds: string[] }): string[] {
  const c = o.id.split('#')[0];
  return o.otherIds.filter((x) => x.split('#')[0] === c).map((x) => (o.side === 'a' ? `${o.id}|${x}` : `${x}|${o.id}`));
}

export async function runCampaign(o: {
  spec: CampaignSpec;
  slots?: number;
  judgeSlots?: number;
  drawSlots?: number;
  keepAwake?: boolean;
  canary?: number;
  /** The CLI used for the final measures text (default: this repo's src/cli.ts). */
  cli?: string[];
}) {
  const spec = o.spec;
  const results = resolve(spec.results ?? 'results');
  const home = join(results, spec.name);
  mkdirSync(home, { recursive: true });
  const logFile = join(home, 'campaign.log');
  const log = (line: string) => {
    const text = `${new Date().toISOString()} ${line}`;
    console.log(text);
    appendFileSync(logFile, text + '\n');
  };
  const started = Date.now();
  const phases: Record<string, number> = {};
  const mark = (phase: string) => (phases[phase] = Math.round((Date.now() - started) / 1000));

  gate.setSlots(o.slots ?? spec.slots ?? 24, { judge: o.judgeSlots ?? spec.judgeSlots ?? 12, draw: o.drawSlots ?? spec.drawSlots ?? 24 });
  const awake = o.keepAwake === false ? { stop: () => {}, how: 'off' } : keepAwake();
  log(`campaign ${spec.name}: ${spec.arms.length} arms, ${spec.references?.length ?? 0} references, ${spec.arenas?.length ?? 0} arenas, ${gate.slots} text slots (${gate.judgeSlots} kept for judging), ${gate.drawSlots} render slots, keep-awake ${awake.how}`);

  // Round directories by name.
  const dirs = new Map<string, string>();
  for (const r of spec.references ?? []) dirs.set(basename(r.round), resolve(r.round));
  for (const a of spec.arms) dirs.set(a.name, join(results, a.name));
  const armNames = new Set(spec.arms.map((a) => a.name));
  for (const [x, y] of spec.arenas ?? [])
    for (const n of [x, y]) if (!dirs.has(n)) throw new Error(`arena round "${n}" is neither an arm nor a reference`);

  // Labels for the review page.
  for (const r of spec.references ?? []) if (r.label) writeFileSync(join(resolve(r.round), 'label.txt'), r.label + '\n');
  for (const a of spec.arms) {
    mkdirSync(dirs.get(a.name)!, { recursive: true });
    if (a.label) writeFileSync(join(dirs.get(a.name)!, 'label.txt'), a.label + '\n');
  }

  // Judging work runs in the background on the judge lane.
  const pending = new Set<Promise<void>>();
  const errors: string[] = [];
  const judge = (what: string, fn: () => Promise<unknown>) => {
    const p: Promise<void> = inLane('judge', async () => {
      try {
        await fn();
      } catch (e) {
        errors.push(`${what}: ${(e as Error).message.slice(0, 300)}`);
        log(`error in ${what}: ${(e as Error).message.slice(0, 200)}`);
      }
    }).finally(() => pending.delete(p));
    pending.add(p);
  };
  const second = spec.secondJudge;
  const judgeArena = (a: string, b: string, keys: string[]) => {
    if (!keys.length) return;
    judge(`arena ${a} vs ${b} (${keys.length} pairs)`, () =>
      judgePairs({
        a: dirs.get(a)!,
        b: dirs.get(b)!,
        out: join(results, `arena-${a}-vs-${b}`),
        onlyPairs: new Set(keys),
        jobs: keys.length,
        ...(second ? { model2: second.model, share2: second.share ?? 0.3 } : {}),
      }),
    );
  };

  // 1. References: check every comic now; arenas between two references now.
  for (const r of spec.references ?? []) {
    const dir = resolve(r.round);
    judge(`checklist ${basename(dir)}`, () => checkComics({ round: dir, only: comicIds(dir), jobs: 12 }));
  }
  for (const [x, y] of spec.arenas ?? []) {
    if (armNames.has(x) || armNames.has(y)) continue;
    const ys = comicIds(dirs.get(y)!);
    judgeArena(x, y, comicIds(dirs.get(x)!).flatMap((id) => pairsFor({ side: 'a', id, otherIds: ys })));
  }
  mark('referencesQueued');

  // 2. Arms side by side; each comic is checked and judged as it lands.
  const done = new Map<string, string[]>(spec.arms.map((a) => [a.name, []]));
  const canaryAt = o.canary ?? spec.canary ?? 3;
  const canaryStates: ComicState[] = [];
  let stop = false;
  let canaryChecked = canaryAt <= 0;
  const onComic = (arm: string) => (s: ComicState) => {
    const id = `${s.case}#${s.sample}`;
    const dir = dirs.get(arm)!;
    done.get(arm)!.push(id);
    log(`${arm} ${id}: ${s.status}${s.stage ? ` (${s.stage})` : ''}; ${gate.running}/${gate.slots} text and ${gate.drawing} render slots busy, ${pending.size} judging tasks`);
    if (!canaryChecked) {
      canaryStates.push(s);
      if (spec.arms.every((a) => done.get(a.name)!.length >= canaryAt)) {
        canaryChecked = true;
        const problems = canaryStates.flatMap(canaryProblems);
        mark('canary');
        if (problems.length) {
          stop = true;
          log(`canary failed; stopping the run:\n  ${problems.join('\n  ')}`);
          errors.push(...problems.map((p) => `canary: ${p}`));
        } else log(`canary passed (${canaryStates.length} comics)`);
      }
    }
    if (!drawn(dir, id)) return;
    judge(`checklist ${arm} ${id}`, () => checkComics({ round: dir, only: [id], jobs: 1 }));
    for (const [x, y] of spec.arenas ?? []) {
      if (x !== arm && y !== arm) continue;
      const other = x === arm ? y : x;
      const otherIds = armNames.has(other) ? done.get(other)!.filter((i) => drawn(dirs.get(other)!, i)) : comicIds(dirs.get(other)!);
      judgeArena(x, y, pairsFor({ side: x === arm ? 'a' : 'b', id, otherIds }));
    }
  };
  await Promise.all(
    spec.arms.map((arm) =>
      inLane('comic', () =>
        runRound({
          cases: resolve(spec.cases),
          split: spec.split ?? 'dev',
          skill: resolve(arm.skill),
          genre: resolve(arm.genre),
          samples: spec.samples ?? 2,
          out: dirs.get(arm.name)!,
          tracetoon: resolve(arm.tracetoon),
          jobs: arm.jobs ?? 12,
          ...(spec.only ? { only: spec.only } : {}),
          onComic: onComic(arm.name),
          shouldStop: () => stop,
        }),
      ).catch((e) => {
        errors.push(`${arm.name}: ${(e as Error).message.slice(0, 300)}`);
        log(`arm ${arm.name} failed: ${(e as Error).message.slice(0, 300)}`);
      }),
    ),
  );
  mark('armsDone');
  log(`arms done; waiting for ${pending.size} judging tasks`);
  while (pending.size) await Promise.allSettled([...pending]);
  mark('judgingDone');

  // 3. Summaries (cache reads), the measures log and the review page.
  const cli = o.cli ?? [process.execPath, join(import.meta.dir, 'cli.ts')];
  const measures: string[] = [];
  const runCli = (args: string[]) => {
    const p = Bun.spawnSync([...cli, ...args], { stdout: 'pipe', stderr: 'pipe' });
    const text = `${p.stdout.toString()}${p.stderr.toString()}`
      .split(/\r?\n/)
      .filter((l) => l.trim() && !/^[a-z0-9-]+#\d+: /.test(l) && !/: overall /.test(l))
      .join('\n');
    measures.push(text);
  };
  if (!stop) {
    for (const [name, dir] of dirs) {
      const report = readJson(join(dir, 'report.json'));
      if (armNames.has(name) && report) measures.push(`Round ${name}: ${report.comics ?? '?'} comics, headline ${report.headline ?? '?'}`);
      runCli(['checklist', dir, '--jobs', '12']);
    }
    for (const [x, y] of spec.arenas ?? [])
      runCli(['arena', dirs.get(x)!, dirs.get(y)!, '--jobs', '12', ...(second ? ['--model-2', second.model, '--share-2', String(second.share ?? 0.3)] : [])]);
    writeFileSync(join(home, 'measures.log'), measures.join('\n') + '\n');
    const names = [...(spec.references ?? []).map((r) => basename(r.round)), ...spec.arms.map((a) => a.name)];
    const review = buildReview({
      round: dirs.get(names[0]!)!,
      rounds: names.slice(1).map((n) => dirs.get(n)!),
      arenas: (spec.arenas ?? []).map(([x, y]) => join(results, `arena-${x}-vs-${y}`)),
      out: join(home, 'review'),
      ...(spec.reviewTracetoon ? { tracetoon: resolve(spec.reviewTracetoon) } : {}),
    });
    log(`review page: ${join(review, 'index.html')}`);
  }
  mark('end');
  awake.stop();

  // What each comic saw of earlier comics (more workers: fewer finished comics to differ from).
  const seen = Object.fromEntries(
    spec.arms.map((a) => {
      const lens = comicIds(dirs.get(a.name)!).flatMap((id) => {
        const [c, n] = id.split('#') as [string, string];
        const r = readJson(join(dirs.get(a.name)!, 'comics', c, n, 'recent.json'));
        return Array.isArray(r) ? [r.length] : [];
      });
      return [a.name, lens.length ? Math.round((lens.reduce((x, y) => x + y, 0) / lens.length) * 10) / 10 : null];
    }),
  );
  const record = {
    schema: 'comicbench.campaign/v1',
    spec,
    startedAt: new Date(started).toISOString(),
    seconds: phases,
    slots: gate.slots,
    judgeSlots: gate.judgeSlots,
    drawSlots: gate.drawSlots,
    keepAwake: awake.how,
    codex: gate.stats,
    meanRecentSeen: seen,
    stopped: stop,
    errors,
  };
  writeFileSync(join(home, 'campaign.json'), JSON.stringify(record, null, 2) + '\n');
  log(`campaign ${spec.name} ${stop ? 'stopped by the canary' : 'done'} in ${Math.round((Date.now() - started) / 60000)} min; ${errors.length} errors`);
  return record;
}
