/**
 * Measures v2: one continuous scale for comics, anchored to real comics.
 *
 * Every comparison ("game") is one judge call on two comics in one order.
 * Scores come from a Bradley-Terry fit with a position term: the judge's lean
 * toward the first or second image is estimated and removed, instead of being
 * turned into ties (round 18's arena tied 30-46% of pairs, almost all of them
 * order flips). A small ridge prior keeps scores finite for comics that win or
 * lose every game.
 *
 * Scores are on a logit scale where 0 is the average real (human-made)
 * anchor comic; `vsAnchors` turns a score into the chance of beating an
 * average anchor.
 */

export interface Game {
  /** Item shown first and second. */
  first: string;
  second: string;
  /** 1 first won, 0 second won, 0.5 tie. */
  score: number;
  /** Which judge and game type, for the position term and agreement (e.g. "codex:anchor"). */
  source: string;
  /** For bootstrap and agreement: the comparison's identity, independent of order. */
  key: string;
}

export interface Fit {
  theta: Record<string, number>;
  /** Position advantage of the first image, per source (logit; positive favours first). */
  position: Record<string, number>;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Bradley-Terry with a position term per source, by gradient ascent on the penalised log-likelihood. */
export function fitBT(games: Game[], opts: { ridge?: number; iterations?: number; anchorPrefix?: string } = {}): Fit {
  const ridge = opts.ridge ?? 0.05;
  const items = [...new Set(games.flatMap((g) => [g.first, g.second]))];
  const sources = [...new Set(games.map((g) => g.source))];
  const theta: Record<string, number> = Object.fromEntries(items.map((i) => [i, 0]));
  const position: Record<string, number> = Object.fromEntries(sources.map((s) => [s, 0]));
  const lr = 0.5;
  for (let it = 0; it < (opts.iterations ?? 600); it++) {
    const gT: Record<string, number> = Object.fromEntries(items.map((i) => [i, -ridge * theta[i]!]));
    const nT: Record<string, number> = Object.fromEntries(items.map((i) => [i, ridge]));
    const gP: Record<string, number> = Object.fromEntries(sources.map((s) => [s, -ridge * position[s]!]));
    const nP: Record<string, number> = Object.fromEntries(sources.map((s) => [s, ridge]));
    for (const g of games) {
      const p = sigmoid(theta[g.first]! - theta[g.second]! + position[g.source]!);
      const d = g.score - p;
      const w = p * (1 - p);
      gT[g.first]! += d;
      gT[g.second]! -= d;
      gP[g.source]! += d;
      nT[g.first]! += w;
      nT[g.second]! += w;
      nP[g.source]! += w;
    }
    // Diagonal Newton steps, damped.
    for (const i of items) theta[i]! += (lr * gT[i]!) / nT[i]!;
    for (const s of sources) position[s]! += (lr * gP[s]!) / nP[s]!;
  }
  // Re-centre so the average anchor is 0 (or the average item, without anchors).
  const prefix = opts.anchorPrefix ?? 'anchor/';
  const anchors = items.filter((i) => i.startsWith(prefix) && !/-(nopayoff|flat)$/.test(i));
  const ref = anchors.length ? anchors : items;
  const c = ref.reduce((a, i) => a + theta[i]!, 0) / ref.length;
  for (const i of items) theta[i]! -= c;
  return { theta, position };
}

export const vsAnchors = (theta: number) => sigmoid(theta);

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
export function sd(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** A seeded uniform generator (mulberry32 on a string hash). */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A round's score with a 95% CI: the mean of its comics' thetas, bootstrapped
 * over cases (a case's comics resampled together), refitting nothing (the
 * thetas are taken as measured; the CI covers case-to-case variation).
 */
export function roundScore(theta: Record<string, number>, items: { id: string; case: string }[], draws = 2000, seed = 'v2'): { mean: number; lo: number; hi: number; sd: number; n: number } {
  const byCase = new Map<string, number[]>();
  for (const it of items) if (theta[it.id] !== undefined) byCase.set(it.case, [...(byCase.get(it.case) ?? []), theta[it.id]!]);
  const cases = [...byCase.values()];
  const all = cases.flat();
  const r = rng(seed);
  const stats: number[] = [];
  for (let d = 0; d < draws; d++) {
    const pick: number[] = [];
    for (let k = 0; k < cases.length; k++) pick.push(...cases[Math.floor(r() * cases.length)]!);
    stats.push(mean(pick));
  }
  stats.sort((a, b) => a - b);
  return { mean: mean(all), lo: stats[Math.floor(0.025 * draws)]!, hi: stats[Math.floor(0.975 * draws)]!, sd: sd(all), n: all.length };
}

/** The share of comparisons where both orders picked the same slot (first both times or second both times). */
export function positionLock(games: Game[]): { locked: number; of: number } {
  const byKey = new Map<string, Game[]>();
  for (const g of games) byKey.set(`${g.source}|${g.key}`, [...(byKey.get(`${g.source}|${g.key}`) ?? []), g]);
  let locked = 0, of = 0;
  for (const gs of byKey.values()) {
    if (gs.length !== 2) continue;
    of++;
    // Same slot won both times, with the items swapped between orders.
    if (gs[0]!.first === gs[1]!.second && gs[0]!.score === gs[1]!.score && gs[0]!.score !== 0.5) locked++;
  }
  return { locked, of };
}

/** Cohen's kappa between two families on the same comparisons (winner item per order). */
export function familyKappa(games: Game[], famA: string, famB: string): { kappa: number; n: number; agree: number } {
  // Both families saw the same order, so the label is simply which slot won.
  const winner = (g: Game) => (g.score === 1 ? 'first' : g.score === 0 ? 'second' : 'tie');
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  for (const g of games) {
    const k = `${g.key}|${g.first}`;
    if (g.source.startsWith(`${famA}:`)) a.set(k, winner(g));
    if (g.source.startsWith(`${famB}:`)) b.set(k, winner(g));
  }
  const pairs: [string, string][] = [];
  for (const [k, w] of a) if (b.has(k)) pairs.push([w, b.get(k)!]);
  if (!pairs.length) return { kappa: NaN, n: 0, agree: NaN };
  const rel = pairs;
  const n = rel.length;
  const po = rel.filter(([x, y]) => x === y).length / n;
  const cats = [...new Set(rel.flat())];
  const pe = cats.reduce((s, c) => s + (rel.filter(([x]) => x === c).length / n) * (rel.filter(([, y]) => y === c).length / n), 0);
  return { kappa: pe === 1 ? NaN : (po - pe) / (1 - pe), n, agree: po };
}
