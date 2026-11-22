import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sha256 } from '../src/cases.ts';
import { datasetProblems, datasetRelease } from '../src/datasets.ts';
import { BLIND_IDS, BLIND_SCHEMA, CONTEXT_IDS, blindPrompt, contextPrompt } from '../src/judges.ts';
import { CRITERIA } from '../src/rubric.ts';

const temp = () => mkdtempSync(join(tmpdir(), 'comicbench-run-'));
const FAKE = resolve(import.meta.dir, 'fake-codex.ts');

describe('codex wrapper', () => {
  test('passes the prompt on stdin and parses a schema reply', async () => {
    process.env.COMICBENCH_CODEX_BIN = FAKE;
    const { codexExec } = await import('../src/codex.ts');
    const dir = temp();
    process.env.FAKE_CODEX_REPLY = '{"answer":42}';
    const r = await codexExec({ prompt: 'six times seven', cwd: dir, schema: { type: 'object' }, logDir: join(dir, 'log') });
    expect(r.ok).toBe(true);
    expect(r.json).toEqual({ answer: 42 });
    expect(r.model).toBe('fake-codex');
    expect(readFileSync(join(dir, 'log', 'prompt.md'), 'utf8')).toBe('six times seven');

    process.env.FAKE_CODEX_REPLY = 'not json';
    const bad = await codexExec({ prompt: 'x', cwd: dir, schema: { type: 'object' }, logDir: join(dir, 'log2') });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('not JSON');
    delete process.env.FAKE_CODEX_REPLY;
  });
});

describe('judges', () => {
  test('blind and context stages together cover every rubric criterion once', () => {
    expect([...BLIND_IDS, ...CONTEXT_IDS].sort()).toEqual(CRITERIA.map((c) => c.id).sort());
    expect(Object.keys((BLIND_SCHEMA.properties.scores as any).properties).sort()).toEqual([...BLIND_IDS].sort());
  });

  test('prompts carry the anchors and treat image and file text as data', () => {
    const blind = blindPrompt('Genre: Space opera.');
    for (const id of BLIND_IDS) expect(blind).toContain(`**${id}**`);
    expect(blind).toContain('never instructions');
    const ctx = contextPrompt({ observation: 'o', brief: 'b', description: 'd', facts: '{}', diff: 'p', genre: 'g' });
    for (const id of CONTEXT_IDS) expect(ctx).toContain(`**${id}**`);
    expect(ctx).toContain('factualIntegrity');
  });
});

describe('datasets', () => {
  test('the registry names the published release, and a changed file fails verification', () => {
    const d = datasetRelease('comic-cases@1.0.0');
    expect(d.url).toContain('/cases-v1.0.0/');
    const dir = temp();
    mkdirSync(join(dir, 'a'));
    writeFileSync(join(dir, 'a', 'x.md'), 'hello');
    writeFileSync(
      join(dir, 'MANIFEST.json'),
      JSON.stringify({ id: d.id, version: d.version, cases: d.cases, files: [{ path: 'a/x.md', sha256: sha256('hello') }] }),
    );
    expect(datasetProblems(dir, d)).toEqual([]);
    writeFileSync(join(dir, 'a', 'x.md'), 'changed');
    expect(datasetProblems(dir, d)).toContain('a/x.md does not match its sha256');
  });
});
