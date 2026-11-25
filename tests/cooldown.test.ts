import { describe, expect, test } from 'bun:test';
import { benchCooldown, type Recent } from '../src/round.ts';

describe('cooldowns in a parallel round', () => {
  const done = (n: number) => ({ id: `c${n}`, summary: { pitch: `AF-M01-0${n}`, archetypes: [`P0${n}`], meme: `meme-${n}` } });

  test('finished comics, newest first: scenarios 10, characters 3, memes 100', () => {
    const recent: Recent = { list: [1, 2, 3, 4].map(done) };
    const c = benchCooldown(recent);
    expect(c.scenes).toEqual(['AF-M01-01', 'AF-M01-02', 'AF-M01-03', 'AF-M01-04']);
    expect(c.characters).toEqual(['P01', 'P02', 'P03']);
    expect(c.memes).toHaveLength(4);
  });

  test('comics in flight count as the newest, each one comic in every window', () => {
    const recent: Recent = {
      list: [1, 2, 3].map(done),
      inFlight: [
        { id: 'f1', hold: { scenes: ['AF-P01-01', 'AF-P02-01', 'AF-P03-01'], characters: ['M08', 'P19'], memes: [] } },
        { id: 'f2', hold: { scenes: ['AF-P04-01'], characters: ['M09'], memes: ['mimic-chest'] } },
      ],
    };
    const c = benchCooldown(recent);
    expect(c.scenes).toContain('AF-P02-01');
    expect(c.scenes).toContain('AF-M01-03');
    // The three newest comics: two in flight and the latest finished one.
    expect(c.characters.sort()).toEqual(['M08', 'M09', 'P01', 'P19']);
    expect(c.memes).toContain('mimic-chest');
  });
});
