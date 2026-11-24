import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { writeExample } from '../scripts/make-example.ts';
import { ARENA_CRITERIA, judgePairs, runArena } from '../src/arena.ts';
import { keepAwake } from '../src/awake.ts';
import { canaryProblems, pairsFor } from '../src/campaign.ts';
import { codexExec } from '../src/codex.ts';
import { gate, inLane, RATE_LIMIT, withSlot } from '../src/gate.ts';
import type { RoundManifest } from '../src/manifest.ts';
import { RUBRIC_VERSION } from '../src/rubric.ts';

const fake = resolve(import.meta.dir, 'fake-codex.ts');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRz0AAAAASUVORK5CYII=', 'base64');

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  });
}

test('the gate never runs more than its slots, and comic work goes before judging', async () => {
  gate.setSlots(2);
  let running = 0;
  let peak = 0;
  const order: string[] = [];
  const task = (name: string) => async () => {
    running++;
    peak = Math.max(peak, running);
    order.push(name);
    await new Promise((r) => setTimeout(r, 20));
    running--;
  };
  // Two slots taken first, then judge work queued before comic work: comic work still starts first.
  const first = [withSlot(task('j0'), 'judge'), withSlot(task('j1'), 'judge')];
  const queued = [withSlot(task('j2'), 'judge'), withSlot(task('j3'), 'judge'), withSlot(task('c0'), 'comic'), withSlot(task('c1'), 'comic')];
  await Promise.all([...first, ...queued]);
  expect(peak).toBe(2);
  expect(order.slice(2, 4).sort()).toEqual(['c0', 'c1']);
  expect(gate.stats.calls).toEqual({ comic: 2, judge: 4 });
  // The lane travels with async work.
  expect(await inLane('comic', async () => (await import('../src/gate.ts')).currentLane())).toBe('comic');
  gate.setSlots(0);
});

test('a rate-limited Codex call backs off, shrinks the slots and then succeeds', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'comicbench-limit-'));
  const limited = join(dir, 'limited');
  const count = join(dir, 'count');
  writeFileSync(limited, '2');
  gate.setSlots(6);
  const r = await withEnv(
    { COMICBENCH_CODEX_BIN: fake, FAKE_CODEX_LIMITED: limited, FAKE_CODEX_COUNT: count, COMICBENCH_BACKOFF_MS: '10', FAKE_CODEX_REPLY: '{"ok":true}' },
    () => codexExec({ prompt: 'p', cwd: dir, schema: {}, logDir: join(dir, 'log') }),
  );
  expect(r.ok).toBe(true);
  expect(readFileSync(count, 'utf8').trim().split('\n')).toHaveLength(3);
  expect(gate.stats.rateLimits).toBe(2);
  expect(gate.stats.minSlots).toBe(4);
  expect(RATE_LIMIT.test('{"key": "d857a8c50c195404291fef4a46efeb47860a2dcbbee90214757eacf63b24ec7d"}')).toBe(false);
  expect(RATE_LIMIT.test('429 Too Many Requests')).toBe(true);
  gate.setSlots(0);
});

test('pairs for a new comic, on either side of an arena', () => {
  const refs = ['a#1', 'a#2', 'b#1'];
  expect(pairsFor({ side: 'b', id: 'a#2', otherIds: refs })).toEqual(['a#1|a#2', 'a#2|a#2']);
  expect(pairsFor({ side: 'a', id: 'b#1', otherIds: refs })).toEqual(['b#1|b#1']);
});

test('the canary flags errors, failed checks and broken offers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'comicbench-canary-'));
  mkdirSync(join(dir, 'packet'), { recursive: true });
  mkdirSync(join(dir, 'art'), { recursive: true });
  writeFileSync(join(dir, 'art', 'page.png'), PNG);
  writeFileSync(join(dir, 'check.json'), JSON.stringify({ ok: true }));
  writeFileSync(join(dir, 'packet', 'context.json'), JSON.stringify({ genreOptions: [{
    castOffer: { kind: 'party', personas: [{ id: 'elf' }, { id: 'dwarf' }] },
    memeOffer: [{ id: 'mimic' }], assignedStyle: 'shonen-action',
  }] }));
  const state = { case: 'x', sample: 1, dir, status: 'judged' as const };
  writeFileSync(join(dir, 'packet', 'comic.json'), JSON.stringify({ personas: ['elf'], meme: 'mimic', style: 'shonen-action' }));
  expect(canaryProblems(state)).toEqual([]);
  writeFileSync(join(dir, 'packet', 'comic.json'), JSON.stringify({ personas: ['goddess'], meme: 'truck', style: 'anime-fantasy' }));
  expect(canaryProblems(state)).toHaveLength(3);
  expect(canaryProblems({ ...state, status: 'error', stage: 'author', error: 'boom' })[0]).toContain('author boom');
});

test('streamed arena pairs give the same report as a batch run, and the report reads only the cache', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comicbench-stream-'));
  const cases = join(root, 'cases');
  const example = writeExample(join(cases, 'example'));
  const meta = JSON.parse(readFileSync(join(example, 'case.json'), 'utf8'));
  const pin = { path: join(root, 'space.md'), hash: 'x' };
  const manifest = (name: string): RoundManifest => ({
    schema: 'comicbench.round/v2', rubricVersion: RUBRIC_VERSION, name,
    casesDir: cases, cases: [{ id: 'example', sha256: meta.sha256 }],
    order: ['example#1', 'example#2'], samples: 2, split: 'dev', jobs: 1,
    model: 'fake', author: 'inline', runtimeHash: name,
    imageRoute: { provider: 'codex', lettering: 'page', cli: 'fake', agentModel: 'fake', agentEffort: 'medium' },
    skill: pin, genre: pin, tracetoon: root, authorIsolation: 'inline',
  });
  for (const name of ['ref', 'arm']) {
    const round = join(root, name);
    writeFileSync(join(mkdirSync(round, { recursive: true }) ?? round, 'manifest.json'), JSON.stringify(manifest(name)));
    for (const n of ['1', '2']) {
      const dir = join(round, 'comics', 'example', n);
      mkdirSync(join(dir, 'art'), { recursive: true });
      mkdirSync(join(dir, 'judge'), { recursive: true });
      mkdirSync(join(round, 'judgments', 'example'), { recursive: true });
      writeFileSync(join(dir, 'art', 'page.png'), Buffer.concat([PNG, Buffer.from(name + n)]));
      writeFileSync(join(dir, 'judge', 'blind.json'), JSON.stringify({ respect: { pass: true, reason: 'ok' } }));
      writeFileSync(join(round, 'judgments', 'example', `${n}.json`), JSON.stringify({ gates: { respect: true }, scores: {} }));
    }
  }
  const count = join(root, 'count');
  const reply = JSON.stringify({ first: 'F', second: 'S', verdicts: Object.fromEntries(ARENA_CRITERIA.map(({ id }) => [id, { winner: 'second', reason: 'r' }])) });
  await withEnv({ COMICBENCH_CODEX_BIN: fake, FAKE_CODEX_REPLY: reply, FAKE_CODEX_COUNT: count }, async () => {
    const a = join(root, 'ref');
    const b = join(root, 'arm');
    const streamed = join(root, 'arena-streamed');
    // Comics land one at a time; each streams the pairs it completes.
    for (const id of ['example#1', 'example#2']) {
      const keys = pairsFor({ side: 'b', id, otherIds: ['example#1', 'example#2'] });
      const r = await judgePairs({ a, b, out: streamed, onlyPairs: new Set(keys), model2: 'second', share2: 0.5 });
      expect(r.judged).toBe(2);
    }
    const callsAfterStreaming = readFileSync(count, 'utf8').trim().split('\n').length;
    const fromCache = await runArena({ a, b, out: streamed, model2: 'second', share2: 0.5 });
    expect(readFileSync(count, 'utf8').trim().split('\n').length).toBe(callsAfterStreaming);
    const batch = await runArena({ a, b, out: join(root, 'arena-batch'), model2: 'second', share2: 0.5 });
    const strip = (r: typeof batch.report) => JSON.stringify({ ...r, roundA: '', roundB: '' });
    expect(strip(fromCache.report)).toBe(strip(batch.report));
    expect(fromCache.report.pairs).toBe(4);
    expect(fromCache.report.secondJudge?.pairs).toBe(2);
  });
});

test('the keep-awake helper exits with the process it guards', async () => {
  const guarded = Bun.spawn([process.execPath, '-e', 'setTimeout(() => {}, 1500)']);
  const awake = keepAwake(guarded.pid);
  expect(awake.how).not.toBe('');
  await guarded.exited;
  if (!awake.child) return;
  const deadline = Date.now() + 15_000;
  while (awake.child.exitCode === null && awake.child.signalCode === null && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
  expect(awake.child.exitCode !== null || awake.child.signalCode !== null).toBe(true);
}, 30_000);

test('existsSync import used', () => expect(existsSync(fake)).toBe(true));
