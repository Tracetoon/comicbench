import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { writeExample } from '../scripts/make-example.ts';
import { ARENA_CRITERIA, runArena } from '../src/arena.ts';
import { comparableRounds, type RoundManifest } from '../src/manifest.ts';
import { buildReview } from '../src/review.ts';
import { RUBRIC_VERSION } from '../src/rubric.ts';

test('arena and offline review retain raw verdicts, forfeits and missing planned pairs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comicbench-r4-'));
  const cases = join(root, 'cases');
  const example = writeExample(join(cases, 'example'));
  const meta = JSON.parse(readFileSync(join(example, 'case.json'), 'utf8'));
  const a = join(root, 'medium');
  const b = join(root, 'broad');
  const pin = { path: join(root, 'space.md'), hash: 'original' };
  const manifest: RoundManifest = {
    schema: 'comicbench.round/v2', rubricVersion: RUBRIC_VERSION, name: 'medium',
    casesDir: cases, cases: [{ id: 'example', sha256: meta.sha256 }],
    order: ['example#1', 'example#2'], samples: 2, split: 'dev', jobs: 1,
    model: 'fake', author: 'inline', runtimeHash: 'same-runtime',
    imageRoute: { provider: 'codex', lettering: 'page', cli: 'fake', agentModel: 'fake', agentEffort: 'medium' },
    skill: pin, genre: pin, tracetoon: root, authorIsolation: 'inline',
  };
  const candidate = { ...manifest, name: 'broad', genre: { ...pin, hash: 'new-genre' } };
  for (const [round, pass, spec] of [[a, true, manifest], [b, false, candidate]] as const) {
    const dir = join(round, 'comics', 'example', '1');
    mkdirSync(join(dir, 'art'), { recursive: true });
    mkdirSync(join(dir, 'judge'), { recursive: true });
    mkdirSync(join(round, 'judgments', 'example'), { recursive: true });
    writeFileSync(join(round, 'manifest.json'), JSON.stringify(spec));
    writeFileSync(join(dir, 'art', 'page.png'), Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRz0AAAAASUVORK5CYII=', 'base64',
    ));
    const respect = { pass, reason: pass ? 'The bug is the joke.' : 'Panel 2 ridicules the pilot.' };
    writeFileSync(join(dir, 'judge', 'blind.json'), JSON.stringify({ respect }));
    writeFileSync(join(round, 'judgments', 'example', '1.json'), JSON.stringify({ gates: { respect: pass }, scores: {} }));
  }

  const originalBin = process.env.COMICBENCH_CODEX_BIN;
  const originalReply = process.env.FAKE_CODEX_REPLY;
  process.env.COMICBENCH_CODEX_BIN = resolve(import.meta.dir, 'fake-codex.ts');
  process.env.FAKE_CODEX_REPLY = JSON.stringify({
    first: 'First page', second: 'Second page',
    verdicts: Object.fromEntries(ARENA_CRITERIA.map(({ id }) => [id, { winner: 'first', reason: 'The timing.' }])),
  });
  try {
    const { out, report } = await runArena({ a, b, jobs: 1 });
    expect(report.plannedPairs).toBe(4);
    expect(report.pairs).toBe(1);
    expect(report.respect).toEqual({ aForfeits: 0, bForfeits: 1, doubleForfeits: 0, incomplete: 3 });
    expect(report.criteria.overall!.winRate).toBe(0);
    expect(report.rawOverall!.winRate).toBe(0.5);
    expect(report.results[0]?.orderVerdicts?.overall).toEqual(['first', 'first']);

    const review = buildReview({ round: a, rounds: [b], arenas: [out], out: join(root, 'review') });
    const html = readFileSync(join(review, 'index.html'), 'utf8');
    expect(html).toContain('<script src="data.js"></script>');
    expect(html).not.toContain('fetch(');
    expect(readFileSync(join(review, 'data.js'), 'utf8')).toContain('Panel 2 ridicules the pilot.');
    expect(() => new Function(html.match(/<script>([\s\S]+)<\/script>/)?.[1] ?? 'throw new Error("missing script")')).not.toThrow();

    writeFileSync(join(b, 'manifest.json'), JSON.stringify({ ...candidate, runtimeHash: 'changed-runtime' }));
    // A different runtime is what a round tests, so it is reported, not refused; different cases are refused.
    expect(comparableRounds(a, b).differences).toContain('runtimeHash');
    writeFileSync(join(b, 'manifest.json'), JSON.stringify({ ...candidate, cases: [{ id: 'other-case', sha256: {} }] }));
    expect(() => comparableRounds(a, b)).toThrow('different cases');
  } finally {
    if (originalBin === undefined) delete process.env.COMICBENCH_CODEX_BIN;
    else process.env.COMICBENCH_CODEX_BIN = originalBin;
    if (originalReply === undefined) delete process.env.FAKE_CODEX_REPLY;
    else process.env.FAKE_CODEX_REPLY = originalReply;
  }
});
