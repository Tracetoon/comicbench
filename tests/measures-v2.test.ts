import { describe, expect, test } from 'bun:test';
import { familyKappa, fitBT, positionLock, rng, roundScore, type Game } from '../src/measures-v2.ts';

/** Simulated judge: true strengths, a lean toward the second image, both orders. */
function simulate(strength: Record<string, number>, lean: number, reps: number, seed = 's'): Game[] {
  const r = rng(seed);
  const ids = Object.keys(strength);
  const games: Game[] = [];
  for (let k = 0; k < reps; k++)
    for (const a of ids)
      for (const b of ids) {
        if (a >= b) continue;
        for (const [f, s] of [[a, b], [b, a]] as const) {
          const p = 1 / (1 + Math.exp(-(strength[f]! - strength[s]! + lean)));
          games.push({ first: f, second: s, score: r() < p ? 1 : 0, source: 'codex:anchor', key: `${a} vs ${b}` });
        }
      }
  return games;
}

describe('measures v2', () => {
  test('the fit recovers the true order and the position lean, centred on the anchors', () => {
    const truth = { 'anchor/x': 1, 'anchor/y': 0.5, 'r1/c#1': -0.5, 'r1/c#2': 0, 'r2/c#1': 1.5 };
    const fit = fitBT(simulate(truth, -1.2, 60));
    const order = Object.entries(fit.theta).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    expect(order).toEqual(['r2/c#1', 'anchor/x', 'anchor/y', 'r1/c#2', 'r1/c#1']);
    expect(fit.position['codex:anchor']!).toBeLessThan(-0.8);
    expect(Math.abs((fit.theta['anchor/x']! + fit.theta['anchor/y']!) / 2)).toBeLessThan(1e-9);
  });

  test('a judge that always picks the second image gives no information, not a winner', () => {
    const games: Game[] = [];
    for (const [a, b] of [['p', 'q'], ['q', 'r'], ['p', 'r']]) games.push({ first: a!, second: b!, score: 0, source: 's', key: `${a}${b}` }, { first: b!, second: a!, score: 0, source: 's', key: `${a}${b}` });
    const fit = fitBT(games);
    for (const v of Object.values(fit.theta)) expect(Math.abs(v)).toBeLessThan(0.05);
    expect(fit.position.s!).toBeLessThan(-1);
    expect(positionLock(games)).toEqual({ locked: 3, of: 3 });
  });

  test('round scores bootstrap over cases', () => {
    const s = roundScore({ a: 1, b: 2, c: 3, d: 4 }, [{ id: 'a', case: 'x' }, { id: 'b', case: 'x' }, { id: 'c', case: 'y' }, { id: 'd', case: 'y' }], 500);
    expect(s.mean).toBe(2.5);
    expect(s.lo).toBeGreaterThanOrEqual(1.5);
    expect(s.hi).toBeLessThanOrEqual(3.5);
  });

  test('family agreement compares the same comparisons in the same order', () => {
    const g = (src: string, f: string, s: string, score: number): Game => ({ first: f, second: s, score, source: src, key: [f, s].sort().join(' vs ') });
    const k = familyKappa([g('codex:anchor', 'a', 'b', 1), g('claude:anchor', 'a', 'b', 1), g('codex:anchor', 'c', 'd', 0), g('claude:anchor', 'c', 'd', 0), g('codex:anchor', 'e', 'f', 1), g('claude:anchor', 'e', 'f', 0)], 'codex', 'claude');
    expect(k.n).toBe(3);
    expect(k.agree).toBeCloseTo(2 / 3);
  });
});
