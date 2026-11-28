/**
 * How far to trust the judges: a second Codex model re-judges a seeded share
 * of a round's comics, the primary model judges a smaller share again, and
 * agreement per criterion is Krippendorff's alpha (ordinal).
 *
 *   comicbench reliability <round> --tracetoon <dir> --model-2 <name> [--share 0.3] [--repeat-share 0.1]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCases, sha256 } from './cases.ts';
import { CRITERIA } from './rubric.ts';

/**
 * Krippendorff's alpha with the ordinal metric. Each unit is the values its
 * coders gave (null = missing); units with fewer than two values are skipped.
 * NaN when there is no pairable data or no variation at all.
 */
export function alphaOrdinal(units: (number | null)[][]): number {
  const paired = units.map((u) => u.filter((v): v is number => v !== null)).filter((u) => u.length >= 2);
  const values = [...new Set(paired.flat())].sort((a, b) => a - b);
  if (!paired.length || values.length < 2) return Number.NaN;
  const idx = new Map(values.map((v, i) => [v, i]));
  const k = values.length;
  const o = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (const u of paired) {
    const m = u.length;
    for (let a = 0; a < m; a++)
      for (let b = 0; b < m; b++) if (a !== b) o[idx.get(u[a]!)!]![idx.get(u[b]!)!]! += 1 / (m - 1);
  }
  const nc = o.map((row) => row.reduce((s, x) => s + x, 0));
  const n = nc.reduce((s, x) => s + x, 0);
  const delta = (c: number, d: number) => {
    const [lo, hi] = c < d ? [c, d] : [d, c];
    let sum = 0;
    for (let g = lo; g <= hi; g++) sum += nc[g]!;
    return (sum - (nc[lo]! + nc[hi]!) / 2) ** 2;
  };
  let observed = 0;
  let expected = 0;
  for (let c = 0; c < k; c++)
    for (let d = 0; d < k; d++) {
      const dl = delta(c, d);
      observed += o[c]![d]! * dl;
      expected += nc[c]! * nc[d]! * dl;
    }
  if (expected === 0) return Number.NaN;
  return 1 - ((n - 1) * observed) / expected;
}

/** Seeded share of ids: the same ids for the same round and salt every time. */
export function sampleIds(ids: string[], share: number, salt: string): string[] {
  const want = Math.max(1, Math.round(ids.length * share));
  return [...ids].sort((a, b) => sha256(`${salt}:${a}`).localeCompare(sha256(`${salt}:${b}`))).slice(0, Math.min(want, ids.length));
}

interface Scored {
  scores: Record<string, number | null>;
  gates: Record<string, boolean>;
}

/** Agreement between pairs of judgments of the same comics. */
export function agreement(pairs: [Scored, Scored][]) {
  const criteria = Object.fromEntries(
    CRITERIA.map((c) => [
      c.id,
      {
        alpha: alphaOrdinal(pairs.map(([a, b]) => [a.scores[c.id] ?? null, b.scores[c.id] ?? null])),
        meanAbsDiff: mean(pairs.flatMap(([a, b]) => (a.scores[c.id] != null && b.scores[c.id] != null ? [Math.abs(a.scores[c.id]! - b.scores[c.id]!)] : []))),
        meanA: mean(pairs.flatMap(([a]) => (a.scores[c.id] != null ? [a.scores[c.id]!] : []))),
        meanB: mean(pairs.flatMap(([, b]) => (b.scores[c.id] != null ? [b.scores[c.id]!] : []))),
      },
    ]),
  );
  const gateIds = ['factualIntegrity', 'punchUp', 'respect'];
  const gates = Object.fromEntries(
    gateIds.map((g) => {
      const assessed = pairs.filter(([a, b]) => typeof a.gates[g] === 'boolean' && typeof b.gates[g] === 'boolean');
      return [g, { agree: assessed.filter(([a, b]) => a.gates[g] === b.gates[g]).length, of: assessed.length }];
    }),
  );
  return { pairs: pairs.length, criteria, gates };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Number.NaN);

/** The round's drawn comics: id, case dir, art and the primary judgment. */
export function drawnComics(round: string) {
  const manifest = JSON.parse(readFileSync(join(round, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  const cases = new Map(loadCases(manifest.casesDir).map((c) => [c.meta.id, c]));
  const out: { id: string; dir: string; caseDir: string; full: string; w760: string; w360: string; script: any }[] = [];
  const comics = join(round, 'comics');
  if (!existsSync(comics)) return { manifest, comics: out };
  for (const cid of readdirSync(comics).sort())
    for (const n of readdirSync(join(comics, cid)).sort()) {
      const dir = join(comics, cid, n);
      const art = join(dir, 'art');
      const page = existsSync(art) ? readdirSync(art).find((f) => /^page\.(png|jpeg|jpg|webp)$/.test(f)) : undefined;
      const c = cases.get(cid);
      if (!page || !c || !existsSync(join(dir, 'judge', 'context.json'))) continue;
      out.push({
        id: `${cid}#${n}`,
        dir,
        caseDir: c.dir,
        full: join(art, page),
        w760: join(art, 'page-760.png'),
        w360: join(art, 'page-360.png'),
        script: JSON.parse(readFileSync(join(dir, 'packet', 'comic.json'), 'utf8').replace(/^\uFEFF/, '')),
      });
    }
  return { manifest, comics: out };
}

function judged(dir: string): Scored | undefined {
  const b = join(dir, 'blind.json');
  const c = join(dir, 'context.json');
  if (!existsSync(b) || !existsSync(c)) return undefined;
  const blind = JSON.parse(readFileSync(b, 'utf8').replace(/^\uFEFF/, ''));
  const context = JSON.parse(readFileSync(c, 'utf8').replace(/^\uFEFF/, ''));
  return {
    scores: Object.fromEntries([...Object.entries(blind.scores), ...Object.entries(context.scores)].map(([k, v]: [string, any]) => [k, v?.score ?? null])),
    gates: { punchUp: blind.punchUp.pass === true, factualIntegrity: context.factualIntegrity.pass === true, ...(typeof blind.respect?.pass === 'boolean' ? { respect: blind.respect.pass } : {}) },
  };
}

export async function runReliability(o: { round: string; tracetoon: string; model2: string; share?: number; repeatShare?: number; jobs?: number }) {
  const { tracetoonModules, judgeComic } = await import('./round.ts');
  const tt = await tracetoonModules(o.tracetoon);
  const { manifest, comics } = drawnComics(o.round);
  const genreText = readFileSync(manifest.genre.path, 'utf8');
  const ids = comics.map((c) => c.id);
  const second = new Set(sampleIds(ids, o.share ?? 0.3, `second:${manifest.name}`));
  const repeat = new Set(sampleIds(ids, o.repeatShare ?? 0.1, `repeat:${manifest.name}`));
  const tasks = comics.flatMap((c) => [
    ...(second.has(c.id) ? [{ c, dir: join(c.dir, 'judge-2'), model: o.model2 }] : []),
    ...(repeat.has(c.id) ? [{ c, dir: join(c.dir, 'judge-repeat'), model: manifest.model === 'codex default' ? undefined : (manifest.model as string) }] : []),
  ]);
  const errors: string[] = [];
  const queue = [...tasks];
  await Promise.all(
    Array.from({ length: o.jobs ?? 3 }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const r = await judgeComic({ caseDir: t.c.caseDir, script: t.c.script, art: t.c, judgeDir: t.dir, genreText, tt, model: t.model, skipPhone: true });
        if ('error' in r) errors.push(`${t.c.id} ${t.dir.endsWith('judge-2') ? 'second' : 'repeat'}: ${r.stage}: ${r.error.slice(0, 200)}`);
        console.log(`${t.c.id} ${t.dir.endsWith('judge-2') ? 'second judge' : 'repeat'}: ${'error' in r ? 'error' : 'done'}`);
      }
    }),
  );
  const pairsFor = (sub: string) =>
    comics.flatMap((c) => {
      const a = judged(join(c.dir, 'judge'));
      const b = judged(join(c.dir, sub));
      return a && b ? [[a, b] as [Scored, Scored]] : [];
    });
  const result = {
    model2: o.model2,
    primaryModel: manifest.model,
    secondJudge: { ids: [...second].sort(), ...agreement(pairsFor('judge-2')) },
    repeat: { ids: [...repeat].sort(), ...agreement(pairsFor('judge-repeat')) },
    errors,
  };
  writeFileSync(join(o.round, 'reliability.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
