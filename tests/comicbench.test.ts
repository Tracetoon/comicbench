import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXAMPLE_GENRE, writeExample } from '../scripts/make-example.ts';
import { caseProblems } from '../src/cases.ts';
import { scoreRun, validate, writePacket } from '../src/cli.ts';
import { parseGenre } from '../src/genre.ts';
import { comicPacketFiles } from '../src/packet.ts';
import { CRITERIA, GATES, HEADLINE, SET_CRITERIA, TOTAL_WEIGHT, RUBRIC_VERSION } from '../src/rubric.ts';
import { comicScore, report, setScore, varietyHints, type ComicJudgment } from '../src/score.ts';
import { clusteredBootstrapCI } from '../src/stats.ts';

const temp = () => mkdtempSync(join(tmpdir(), 'comicbench-'));
const allPass = Object.fromEntries(GATES.map((g) => [g.id, true])) as ComicJudgment['gates'];
const judged = (c: string, sample: number, s: number, gates = allPass): ComicJudgment => ({
  case: c,
  sample,
  gates,
  scores: Object.fromEntries(CRITERIA.map((k) => [k.id, s])),
});

describe('rubric', () => {
  test('per-comic weights add up to 100 and set shares to 1', () => {
    expect(TOTAL_WEIGHT).toBe(100);
    expect(SET_CRITERIA.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1);
    expect(HEADLINE.comic + HEADLINE.set).toBeCloseTo(1);
    expect(new Set(CRITERIA.map((c) => c.id)).size).toBe(CRITERIA.length);
  });
});

describe('scoring', () => {
  test('1 maps to 0, 3 to 50 and 5 to 100; a failed gate scores 0', () => {
    expect(comicScore(judged('a', 1, 1))).toBe(0);
    expect(comicScore(judged('a', 1, 3))).toBe(50);
    expect(comicScore(judged('a', 1, 5))).toBe(100);
    expect(comicScore(judged('a', 1, 5, { ...allPass, factualIntegrity: false }))).toBe(0);
  });

  test('an unassessed criterion leaves the comic unscored instead of guessing', () => {
    const j = judged('a', 1, 4);
    j.scores.humor = null;
    expect(comicScore(j)).toBeNull();
    expect(report([j]).unknown).toBe(1);
  });

  test('humor weighs more than art style', () => {
    const funny = judged('a', 1, 3);
    funny.scores.humor = 5;
    const pretty = judged('a', 1, 3);
    pretty.scores.artStyle = 5;
    expect(comicScore(funny)!).toBeGreaterThan(comicScore(pretty)!);
  });

  test('set score and headline combine 80/20', () => {
    const set = { premiseVariety: 5, castVariety: 5, formatVariety: 5 } as const;
    expect(setScore(set)).toBeCloseTo(100);
    const r = report([judged('a', 1, 3), judged('b', 1, 3)], set, { resamples: 200 });
    expect(r.comicMean).toBe(50);
    expect(r.headline).toBeCloseTo(0.8 * 50 + 0.2 * 100);
    expect(r.gated).toBe(0);
  });

  test('the clustered bootstrap resamples cases, not samples', () => {
    // One case with many identical samples must not shrink the interval to a point.
    const byCase = new Map([
      ['a', [0, 0, 0, 0, 0, 0]],
      ['b', [100]],
    ]);
    const [lo, hi] = clusteredBootstrapCI(byCase, { resamples: 500 });
    expect(lo).toBeLessThan(hi);
  });

  test('variety hints flag a character reused across cases', () => {
    const h = varietyHints([
      { case: 'a', characters: [{ name: 'Ada' }], format: 'tiered-strip' },
      { case: 'b', characters: [{ name: 'ada' }, { name: 'Bo' }], format: 'tiered-strip' },
    ]);
    expect(h.castReuse).toBe(0.5);
    expect(h.formatSpread).toBe(0.5);
  });
});

describe('cases and packets', () => {
  test('the example case validates, and a changed file is caught', () => {
    const root = temp();
    const dir = writeExample(join(root, 'example'));
    expect(validate(root).ok).toBe(true);
    writeFileSync(join(dir, 'brief.md'), 'changed');
    expect(caseProblems(dir)).toContain('brief.md does not match its sha256');
  });

  test('a genre file parses into the option a packet offers', () => {
    const g = parseGenre(EXAMPLE_GENRE);
    expect(g).toMatchObject({ id: 'space-opera', name: 'Space opera' });
    expect(g.archetypes).toContain('deadpan ship AI');
  });

  test('the packet holds the brief and description but never the facts', () => {
    const root = temp();
    const dir = writeExample(join(root, 'example'));
    const genre = join(root, 'space-opera.md');
    writeFileSync(genre, EXAMPLE_GENRE);
    const out = join(root, 'packet');
    const files = writePacket(dir, { skillFiles: [join(root, 'SKILL.md')], genre, out });
    expect(files.map((f) => f.slice(out.length + 1)).sort()).toEqual(
      ['brief.md', 'context.json', 'description.md', 'instructions.md'].sort(),
    );
    const all = files.map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(all).toContain('uploadWithRetry');
    expect(all).not.toContain('Claims of unlimited retries');
    expect(existsSync(join(out, 'facts.json'))).toBe(false);
  });

  test('matches Tracetoon packet output when Tracetoon is checked out beside this repo', async () => {
    const peer = join(import.meta.dir, '..', '..', 'tracetoon', 'src', 'comic', 'packet.ts');
    if (!existsSync(peer)) return;
    const tracetoon = await import(peer);
    const input = {
      brief: 'b',
      description: 'd',
      genres: [parseGenre(EXAMPLE_GENRE)],
      skillFiles: ['/s/SKILL.md'],
      patchPath: '/p',
      out: { comic: '/o/comic.json', design: '/o/design.json' },
      checkCommand: 'check',
    };
    expect(comicPacketFiles(input)).toEqual(tracetoon.comicPacketFiles(input));
  });
});

describe('score command', () => {
  test('reads judgments and the set, writes report.json', () => {
    const run = temp();
    for (const [c, s] of [
      ['a', 4],
      ['b', 2],
    ] as const) {
      mkdirSync(join(run, 'judgments', c), { recursive: true });
      writeFileSync(join(run, 'judgments', c, '1.json'), JSON.stringify(judged(c, 1, s)));
    }
    writeFileSync(
      join(run, 'set.json'),
      JSON.stringify({ premiseVariety: 3, castVariety: 3, formatVariety: 3 }),
    );
    const r = scoreRun(run);
    expect(r.comicMean).toBe(50);
    expect(r.set).toBe(50);
    expect(JSON.parse(readFileSync(join(run, 'report.json'), 'utf8')).rubricVersion).toBe(RUBRIC_VERSION);
  });

  test('refuses a judgment with an out-of-range score', () => {
    const run = temp();
    mkdirSync(join(run, 'judgments', 'a'), { recursive: true });
    const bad = judged('a', 1, 3);
    bad.scores.humor = 7;
    writeFileSync(join(run, 'judgments', 'a', '1.json'), JSON.stringify(bad));
    expect(() => scoreRun(run)).toThrow('humor must be an integer 1–5');
  });
});
