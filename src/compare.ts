/**
 * Compares two rounds over the cases both judged: the paired difference in
 * comic score (B minus A, case means, case-resampled 95% interval), per
 * criterion means, gate failures, and how often the author's first draft came
 * back from `comic check` with no warnings or errors (the author's own
 * instruction-following, before any feedback).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CRITERIA, GATES } from './rubric.ts';
import { comicScore, type ComicJudgment } from './score.ts';
import { mean, mulberry32 } from './stats.ts';

function judgments(round: string): ComicJudgment[] {
  const dir = join(round, 'judgments');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((c) =>
    readdirSync(join(dir, c)).map((f) => JSON.parse(readFileSync(join(dir, c, f), 'utf8')) as ComicJudgment),
  );
}

/** Per comic: how many author tries, and whether the first draft came back clean. */
export function authorStats(round: string): { comics: number; firstClean: number; meanTries: number } {
  const root = join(round, 'comics');
  if (!existsSync(root)) return { comics: 0, firstClean: 0, meanTries: NaN };
  const tries: number[] = [];
  let firstClean = 0;
  for (const c of readdirSync(root))
    for (const s of readdirSync(join(root, c))) {
      const author = join(root, c, s, 'author');
      if (!existsSync(author)) continue;
      const rounds = readdirSync(author).filter((d) => /^\d+$/.test(d)).sort((a, b) => Number(a) - Number(b));
      if (!rounds.length) continue;
      tries.push(rounds.length);
      const first = join(author, rounds[0]!, 'check.txt');
      if (existsSync(first) && /^comic\.json looks good\.$/.test(readFileSync(first, 'utf8').trim())) firstClean++;
    }
  return { comics: tries.length, firstClean, meanTries: mean(tries) };
}

const caseMeans = (js: ComicJudgment[]) => {
  const by = new Map<string, number[]>();
  for (const j of js) {
    const s = comicScore(j);
    if (s !== null) by.set(j.case, [...(by.get(j.case) ?? []), s]);
  }
  return new Map([...by].map(([k, v]) => [k, mean(v)]));
};

export function compareRounds(a: string, b: string, opts: { resamples?: number; seed?: number } = {}) {
  const ja = judgments(a);
  const jb = judgments(b);
  const ma = caseMeans(ja);
  const mb = caseMeans(jb);
  const shared = [...ma.keys()].filter((k) => mb.has(k)).sort();
  const deltas = shared.map((k) => mb.get(k)! - ma.get(k)!);
  const rand = mulberry32(opts.seed ?? 1);
  const n = opts.resamples ?? 5000;
  const boots: number[] = [];
  for (let r = 0; r < n && deltas.length; r++) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i++) sum += deltas[Math.floor(rand() * deltas.length)]!;
    boots.push(sum / deltas.length);
  }
  boots.sort((x, y) => x - y);
  const ci: [number, number] = deltas.length ? [boots[Math.floor(0.025 * n)]!, boots[Math.ceil(0.975 * n) - 1]!] : [NaN, NaN];
  const crit = (js: ComicJudgment[]) =>
    Object.fromEntries(CRITERIA.map((c) => [c.id, mean(js.map((j) => j.scores[c.id]).filter((v): v is number => typeof v === 'number'))]));
  const gateFails = (js: ComicJudgment[]) => Object.fromEntries(GATES.map((g) => [g.id, js.filter((j) => j.gates[g.id] === false).length]));
  return {
    cases: shared.length,
    a: { round: a, comics: ja.length, score: mean(shared.map((k) => ma.get(k)!)), criteria: crit(ja), gateFails: gateFails(ja), author: authorStats(a) },
    b: { round: b, comics: jb.length, score: mean(shared.map((k) => mb.get(k)!)), criteria: crit(jb), gateFails: gateFails(jb), author: authorStats(b) },
    delta: { mean: mean(deltas), ci, wins: deltas.filter((d) => d > 0).length, losses: deltas.filter((d) => d < 0).length, ties: deltas.filter((d) => d === 0).length },
  };
}
