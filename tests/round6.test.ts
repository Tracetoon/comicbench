import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { applyChecklistEvidence, checklistPrompt, explicitBackgrounds, summarize, type Checklist } from '../src/checklist.ts';
import { BLIND_IDS, CONTEXT_IDS, isPageRole, PAGE_ROLE_PROMPT } from '../src/judges.ts';
import { runRound, type RoundOpts } from '../src/round.ts';
import { runScriptAudit } from '../src/script-audit.ts';

test('role verification preserves the image-only reading and keeps unknowns unassessed', () => {
  const checklist = {
    roleRead: { intendedRole: 'Captain', visible: { state: 'present', evidence: 'The script names the captain.' } },
  } as Checklist;
  expect(PAGE_ROLE_PROMPT).toContain('A printed title by itself is insufficient');
  expect(isPageRole({ state: 'present', role: null, evidence: 'Title only' })).toBe(false);
  expect(applyChecklistEvidence(structuredClone(checklist), {}, undefined, undefined).roleRead?.visible.state).toBe('unclear');
  const titleOnly = { state: 'absent', role: null, evidence: 'The word CAPTAIN is printed next to a passive figure.' } as const;
  const result = applyChecklistEvidence(checklist, {}, undefined, titleOnly);
  expect(result.roleRead?.visible).toEqual({ state: 'absent', evidence: titleOnly.evidence });
  expect(result.roleRead?.pageRole).toEqual(titleOnly);
  expect(checklistPrompt('The script identifies the captain.', '', titleOnly)).toContain(JSON.stringify(titleOnly));
});

test('identity evidence uses literal script quotes and cross-species contrast has its own denominator', () => {
  const script = {
    characters: [{ description: 'A Black woman pilot.' }],
    panels: [{ dialogue: [{ kind: 'sfx', text: 'ASIAN!' }, { text: 'I told my husband.' }] }],
  };
  const matched = { label: 'Black', quote: '“A Black woman pilot”', evidence: 'In Burrowjet’s character description.' };
  const sound = { label: 'Asian', quote: 'ASIAN', evidence: 'Only a sound effect.' };
  const partial = { label: 'woman', quote: 'woman pilo', evidence: 'Truncated.' };
  expect(explicitBackgrounds([matched, sound, partial], script)).toEqual([matched]);
  const checklist = {
    castContrast: {
      humanToHuman: { state: 'inapplicable', evidence: 'Only one human.' },
      humanToAlien: { state: 'present', evidence: 'Human and lilac alien.' },
    },
    authoredRepresentation: {
      racialBackground: { yes: true, quotes: [matched.quote], evidence: matched.evidence },
      orientation: { yes: true, quotes: ['I told my wife.'], evidence: 'Wrong quote.' },
    },
  } as Checklist;
  const result = applyChecklistEvidence(checklist, script, undefined, undefined);
  expect(result.authoredRepresentation?.racialBackground?.yes).toBe(true);
  expect(result.authoredRepresentation?.orientation).toBeUndefined();
  const summary = summarize([{ id: 'example#1', checklist: {
    ...result, setting: 'other interior', punchline: 'visual gag', imageCarriesJoke: { yes: true, evidence: '' },
  }, script }]);
  expect(summary.representation.castContrast.humanToHuman).toMatchObject({ observed: 0, assessed: 0 });
  expect(summary.representation.castContrast.humanToAlien).toMatchObject({ observed: 1, assessed: 1 });
});

test('stops after the check and resumes the identical scripts with fake providers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'comicbench-r6-'));
  const tracetoon = join(root, 'tracetoon');
  const files = {
    'src/cli.ts': 'console.log(process.argv.includes("--help") ? "--file" : process.argv.includes("--json") ? JSON.stringify({ ok: true }) : "comic.json looks good.");',
    'scripts/comic-draw.ts': 'import { mkdirSync, writeFileSync } from "node:fs"; import { join } from "node:path"; export function draw(_, dir) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, "page.png"), "fake rendered image"); }',
    'src/comic/raster.ts': 'export const svgToPng = () => new Uint8Array([1, 2, 3]);',
    'src/comic/script.ts': 'export const pageText = () => ["A required line."];',
    'src/comic/styles.ts': 'export const styleById = () => undefined;',
    'src/comic/compose.ts': 'export const imageSize = () => ({ w: 4, h: 3 });',
    'src/comic/composition.ts': 'export const comicSummary = () => ({}); export const resolveComposition = () => ({ frames: [] });',
    'src/comic/genres.ts': 'export const genreById = () => ({});',
    'bun.lock': '{}',
  };
  for (const [file, value] of Object.entries(files)) {
    mkdirSync(join(tracetoon, file, '..'), { recursive: true });
    writeFileSync(join(tracetoon, file), value);
  }
  const skill = join(root, 'skill');
  mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), 'A fake skill for test runs.');
  const score = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { score: 3, reason: 'Fixture.' }]));
  const pass = { pass: true, reason: 'Fixture.' };
  const observed = { state: 'present', evidence: 'The foreground console matters.' };
  const side = {
    grounded: observed, staging: observed, action: { considered: observed, selected: observed, scripted: observed },
    casting: { roleThroughAction: observed, darkSkinLightHair: observed, readerFacingLgbtqCue: observed, backgrounds: [] },
  };
  const responses = join(root, 'responses.json');
  writeFileSync(responses, JSON.stringify({
    'You are a comic author': {
      comic: { title: 'Checked first', panels: [] }, design: { concepts: ['Fixture'] },
    },
    'You are a cold reader': {
      observation: 'Fixture.', joke: 'Fixture.', scores: score(BLIND_IDS), respect: pass, punchUp: pass,
      pageRole: { role: 'pilot', ...observed },
    },
    'You judge how well': { scores: score(CONTEXT_IDS), factualIntegrity: pass },
    'You are reading a comic': { items: [], unreadable: [] },
    'Compare two plans and scripts': {
      first: side, second: side, comparison: { joke: 'Tie', staging: 'Tie', action: 'Tie', casting: 'Tie' },
    },
  }));
  const env = { COMICBENCH_CODEX_BIN: resolve(import.meta.dir, 'fake-codex.ts'), FAKE_CODEX_RESPONSES: responses };
  const prior = Object.fromEntries(Object.keys(env).map((name) => [name, process.env[name]]));
  Object.assign(process.env, env);
  try {
    const opts: RoundOpts = {
      cases: resolve(import.meta.dir, '../cases'), split: 'dev', skill, genre: resolve(import.meta.dir, '../genres/space-opera-broad.md'),
      samples: 1, jobs: 1, model: 'fake-codex', author: 'inline', tracetoon, out: join(root, 'arm-a'), stopAfter: 'check',
    };
    const stopped = await runRound(opts);
    expect(stopped.stage).toBe('check');
    expect(stopped.states.map((s) => s.status)).toEqual(['checked']);
    const dir = stopped.states[0]!.dir;
    const scriptFile = join(dir, 'packet', 'comic.json');
    const script = readFileSync(scriptFile, 'utf8');
    expect(existsSync(join(dir, 'art'))).toBe(false);
    expect(existsSync(join(opts.out, 'judgments'))).toBe(false);
    expect(existsSync(join(opts.out, 'report.json'))).toBe(false);
    expect(readFileSync(join(dir, 'author', '1', 'prompt.md'), 'utf8')).not.toContain('facts.json');
    expect((await runRound(opts)).states[0]?.status).toBe('checked');
    const armB = join(root, 'arm-b');
    await runRound({ ...opts, out: armB });
    const audit = await runScriptAudit({ a: opts.out, b: armB, out: join(root, 'audit'), jobs: 1 });
    expect(audit.results[0]).toMatchObject({ id: 'example#1', comparison: { joke: 'Tie' } });
    expect(readFileSync(join(root, 'audit', 'pairs', 'example#1', 'prompt.md'), 'utf8')).toContain('facts.json');
    writeFileSync(scriptFile, script + ' ');
    await expect(runRound({ ...opts, stopAfter: undefined })).rejects.toThrow('Checkpoint artifacts changed');
    writeFileSync(scriptFile, script);
    const complete = await runRound({ ...opts, stopAfter: undefined });
    expect(complete.stage).toBe('complete');
    expect(complete.states[0]?.status).toBe('judged');
    expect(readFileSync(scriptFile, 'utf8')).toBe(script);
    const judgment = JSON.parse(readFileSync(join(opts.out, 'judgments', 'example', '1.json'), 'utf8'));
    expect(judgment.phoneMissing).toEqual(['A required line.']);
    expect(judgment.gates.phoneLegibility).toBe(true);
  } finally {
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
