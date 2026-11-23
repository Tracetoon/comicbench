import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CONTROLS, controlRates, drift, mechanicalVariant, pickAnchors } from '../src/calibrate.ts';
import { authorChecks } from '../src/compare.ts';
import { alphaOrdinal, sampleIds } from '../src/reliability.ts';
import { blindPrompt } from '../src/judges.ts';
import { artSheet, splitClusters } from '../src/round.ts';
import { RUBRIC_VERSION, SCALE } from '../src/rubric.ts';

const temp = () => mkdtempSync(join(tmpdir(), 'comicbench-r2-'));
const FAKE = resolve(import.meta.dir, 'fake-codex.ts');

describe('author sandbox', () => {
  test('asks for the Windows sandbox and reports the sandbox Codex used', async () => {
    process.env.COMICBENCH_CODEX_BIN = FAKE;
    const { codexExec } = await import('../src/codex.ts');
    const dir = temp();
    process.env.FAKE_CODEX_ARGS = join(dir, 'args.json');
    const r = await codexExec({ prompt: 'p', cwd: dir, sandbox: 'workspace-write', logDir: join(dir, 'log') });
    const args = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')) as string[];
    expect(args[args.indexOf('-s') + 1]).toBe('workspace-write');
    expect(args).toContain('--ignore-user-config');
    if (process.platform === 'win32') expect(args).toContain('windows.sandbox="elevated"');
    expect(r.sandbox).toBe('workspace-write');

    // A silent downgrade is visible to the caller, which stops the round.
    process.env.FAKE_CODEX_SANDBOX = 'read-only';
    const down = await codexExec({ prompt: 'p', cwd: dir, sandbox: 'workspace-write', logDir: join(dir, 'log2') });
    expect(down.sandbox).toBe('read-only');
    delete process.env.FAKE_CODEX_SANDBOX;
    delete process.env.FAKE_CODEX_ARGS;
  });

  test('reads the check runs a sandboxed author made from its log', () => {
    const log = [
      'exec',
      `"pwsh.exe" -Command "bun 'C:\\p\\tracetoon-check.js' comic check --file 'C:\\p\\comic.json'"`,
      ' exited 1 in 300ms:',
      'warning: anchor.mapping[0]: no words say so',
      'comic.json looks good.',
      '',
      'codex',
      'Fixing the mapping.',
      'exec',
      '"pwsh.exe" -Command "$d = \'C:\\p\'',
      'bun "$d\\tracetoon-check.js" comic check --file x"',
      ' succeeded in 200ms:',
      'comic.json looks good.',
      'exec',
      '"pwsh.exe" -Command "Get-Content brief.md"',
      ' succeeded in 10ms:',
      'not a check',
    ].join('\n');
    const runs = authorChecks(log);
    expect(runs.map((r) => r.clean)).toEqual([false, true]);
    expect(runs[0]!.output).toContain('anchor.mapping[0]');
  });

  test('inline authors disable local read tools and use the supplied packet', async () => {
    const { codexExec } = await import('../src/codex.ts');
    const dir = temp();
    const prior = process.env.COMICBENCH_CODEX_BIN;
    process.env.COMICBENCH_CODEX_BIN = FAKE;
    process.env.FAKE_CODEX_ARGS = join(dir, 'args.json');
    try {
      await codexExec({ prompt: 'Packet only', cwd: dir, noTools: true, logDir: join(dir, 'log') });
      const args = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')) as string[];
      const disabled = args.flatMap((value, i) => value === '--disable' ? [args[i + 1]] : []);
      expect(disabled).toContain('shell_tool');
      expect(disabled).toContain('unified_exec');
      expect(disabled).toContain('view_image');
      expect(disabled).toContain('multi_agent_v2');
      expect(args).toContain('web_search="disabled"');
    } finally {
      delete process.env.FAKE_CODEX_ARGS;
      if (prior === undefined) delete process.env.COMICBENCH_CODEX_BIN;
      else process.env.COMICBENCH_CODEX_BIN = prior;
    }
  });
});

describe('recent comics and variety', () => {
  test('splits the set judge clusters into same-PR and cross-PR repeats', () => {
    const s = splitClusters([['a#1', 'a#2'], ['b#1', 'c#1', 'c#2'], ['d#1']]);
    expect(s.withinCase).toBe(2);
    expect(s.acrossCase).toBe(1);
    expect(s.casesWithSamePair).toEqual(['a', 'c']);
  });
});

describe('rubric v2', () => {
  test('a 4 or 5 needs a named strength, and art style is judged against the requested style', () => {
    expect(RUBRIC_VERSION).toBeGreaterThanOrEqual(2);
    expect(SCALE).toContain('scores 3');
    expect(SCALE).toContain('Name that strength');
    const tt = { styleById: (id: string) => (id === 'ink' ? { name: 'Ink wash', prompt: 'loose ink wash' } : undefined) };
    const genre = 'name: Space opera\nsetting: a starship bridge\n';
    expect(artSheet(genre, tt as any, { style: 'ink' })).toContain('Requested art style: Ink wash: loose ink wash');
    expect(artSheet(genre, tt as any, { style: 'chunky crayon' })).toContain('a custom style: chunky crayon');
    expect(blindPrompt(artSheet(genre, tt as any, { style: 'ink' }))).toContain('judge art style against this style');
  });
});

describe('calibration', () => {
  test('mechanical controls break only geometry or style', () => {
    const s = { v: 2, style: 'ink', styleFamily: 'ink', composition: { family: 'vertical', title: { mode: 'heading' } }, panels: [{ dialogue: [{ text: 'hi' }] }] };
    const tiny = mechanicalVariant('tiny', s);
    expect(tiny.composition.family).toBe('sequence');
    expect(tiny.panels).toEqual(s.panels);
    const off = mechanicalVariant('offStyle', s);
    expect(off.style).toContain('photorealistic');
    expect(off.styleFamily).toBeUndefined();
    expect(s.composition.family).toBe('vertical');
  });

  test('a control passes when the judges notice the break at least 80% of the time', () => {
    const o = { scores: { humor: 4, relevance: 4, fidelity: 4, artStyle: 5 }, gates: { factualIntegrity: true, phoneLegibility: true } };
    const flat = CONTROLS.find((c) => c.id === 'flat')!;
    expect(flat.hit(o, { scores: { humor: 2 }, gates: {} })).toBe(true);
    expect(flat.hit(o, { scores: { humor: 4 }, gates: {} })).toBe(false);
    const fact = CONTROLS.find((c) => c.id === 'wrongFact')!;
    expect(fact.hit(o, { scores: { fidelity: 4 }, gates: { factualIntegrity: false } })).toBe(true);
    const rates = controlRates([
      ...Array.from({ length: 4 }, () => ({ control: 'flat' as const, hit: true })),
      { control: 'flat', hit: false },
      { control: 'swap', hit: true },
      { control: 'swap', hit: false },
      { control: 'tiny', hit: null },
    ]);
    expect(rates.flat).toMatchObject({ hits: 4, of: 5, pass: true });
    expect(rates.swap).toMatchObject({ hits: 1, of: 2, pass: false });
    expect(rates.tiny).toMatchObject({ of: 0, pass: false });
  });

  test('anchors span the range and drift is the mean move per criterion', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, total: i * 10 }));
    expect(pickAnchors(rows).map((r) => r.id)).toEqual(['c0', 'c1', 'c4', 'c5', 'c8', 'c9']);
    const d = drift([{ humor: 3 }, { humor: 4 }], [{ humor: 4 }, { humor: 5 }]);
    expect(d.humor).toEqual({ mean: 1, flagged: true });
    expect(drift([{ humor: 3 }], [{ humor: 3 }]).humor!.flagged).toBe(false);
  });
});

describe('reliability', () => {
  test("Krippendorff's alpha: perfect agreement is 1, systematic disagreement is below 0", () => {
    expect(alphaOrdinal([[1, 1], [3, 3], [5, 5], [2, 2]])).toBeCloseTo(1, 6);
    expect(alphaOrdinal([[1, 5], [5, 1], [2, 4], [4, 2]])).toBeLessThan(0);
    expect(Number.isNaN(alphaOrdinal([[3, 3], [3, 3]]))).toBe(true);
    expect(alphaOrdinal([[1, null], [2, 2], [4, 4], [5, 4]])).toBeGreaterThan(0.6);
  });

  test('the sampled share is seeded and stable', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `case${i}#1`);
    const a = sampleIds(ids, 0.3, 'second:r2');
    expect(a).toHaveLength(12);
    expect(sampleIds(ids, 0.3, 'second:r2')).toEqual(a);
    expect(sampleIds(ids, 0.3, 'second:r3')).not.toEqual(a);
  });
});

describe('review page', () => {
  test('renders a round with scores, reasons, gates and the notes controls, without network', async () => {
    const root = temp();
    const cases = join(root, 'cases');
    const round = join(root, 'round');
    mkdirSync(join(cases, 'pr1'), { recursive: true });
    writeFileSync(join(cases, 'pr1', 'case.json'), JSON.stringify({ schema: 'comicbench.case/v1', id: 'pr1', split: 'dev', source: { dataset: 'x', case: 'pr1' }, tracetoon: 't', description: 'd', license: 'MIT', files: {} }));
    writeFileSync(join(cases, 'pr1', 'description.md'), '# Fix the flaky timer\n\nBody.');
    writeFileSync(join(cases, 'pr1', 'brief.md'), 'brief text');
    const dir = join(round, 'comics', 'pr1', '1');
    mkdirSync(join(dir, 'packet'), { recursive: true });
    mkdirSync(join(dir, 'judge'), { recursive: true });
    mkdirSync(join(round, 'judgments', 'pr1'), { recursive: true });
    writeFileSync(join(round, 'manifest.json'), JSON.stringify({ name: 'round', casesDir: cases, model: 'm', rubricVersion: 2, author: 'sandbox', genre: { path: 'space.md' }, skill: { hash: 'abc' } }));
    writeFileSync(join(dir, 'packet', 'comic.json'), JSON.stringify({ title: 'Tick Tock', style: 'ink', composition: { family: 'tiered' }, panels: [{}, {}, {}], characters: [{ name: 'Wren' }] }));
    writeFileSync(join(dir, 'judge', 'blind.json'), JSON.stringify({ observation: 'A clock argues.', joke: 'The timer was late.', scores: { humor: { score: 4, reason: 'The <late> clock lands.' }, clarity: { score: 3, reason: 'ok' }, artStyle: { score: 3, reason: 'ok' } }, punchUp: { pass: true, reason: 'fine' } }));
    writeFileSync(join(dir, 'judge', 'context.json'), JSON.stringify({ scores: { relevance: { score: 4, reason: 'About timers.' }, fidelity: { score: 4, reason: 'ok' }, audience: { score: 3, reason: 'ok' }, genre: { score: 3, reason: 'ok' } }, factualIntegrity: { pass: true, reason: 'matches' } }));
    writeFileSync(join(round, 'judgments', 'pr1', '1.json'), JSON.stringify({ case: 'pr1', sample: 1, gates: { factualIntegrity: true, phoneLegibility: true, punchUp: true, outputContract: true }, scores: { humor: 4, clarity: 3, artStyle: 3, relevance: 4, fidelity: 4, audience: 3, genre: 3 } }));
    const { buildReview } = await import('../src/review.ts');
    const out = buildReview({ round, out: join(root, 'review') });
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>');
    expect(html).toContain('They never change a score');
    // Serverless: opens from file://, so no fetch, and the data comes in by a script tag.
    expect(html).not.toContain('fetch(');
    expect(html).toContain('<script src="data.js"></script>');
    expect(html).not.toMatch(/src="https?:/);
    expect(html).not.toContain('window.claude');
    const js = readFileSync(join(out, 'data.js'), 'utf8');
    expect(js.startsWith('window.REVIEW_DATA = ')).toBe(true);
    const data = JSON.parse(js.slice('window.REVIEW_DATA = '.length).trim().replace(/;$/, ''));
    expect(data.arenaCriteria.map((c: any) => c.id)).toContain('medium');
    const c = data.arms[0].comics[0];
    expect(c.key).toBe('round--pr1--1');
    expect(c.judge.scores.humor).toEqual({ score: 4, reason: 'The <late> clock lands.' });
    expect(c.comic.cast).toEqual(['Wren']);
    expect(c.status).toBe('judged');
    expect(data.cases.pr1.title).toBe('Fix the flaky timer');
    expect(existsSync(join(out, 'img'))).toBe(true);
  });
});
