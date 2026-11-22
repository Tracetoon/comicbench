/**
 * Freezes comicbench cases from prbench's replay dataset (real-cases@4.0.0),
 * once, with no model calls. For each case the writer's sandbox is built
 * exactly as prbench builds it (prbench scripts/brief-replay.ts: createSandbox,
 * prepareCase, installTracetoon with a pinned bundle), then the skill's
 * launcher runs `task begin` and `prepare` with SKILL.md's flags. The case
 * folder gets:
 *
 *   brief.md        prepare's brief (sandbox paths replaced by "<sandbox>")
 *   changes.patch   the run's diff
 *   facts.json      prbench's fact sheet (judges only)
 *   description.md  the golden run's candidate62 Claude draft, replicate 1
 *   case.json       provenance, split and sha256 of the four files
 *
 * Splits: 20 dev cases chosen per repository in proportion to its case count
 * (deterministic: by sha256 of the id), the rest sealed; written to splits.json.
 *
 * Usage (prbench v0.4.0 checked out with dependencies installed):
 *   bun scripts/freeze-cases.ts --prbench ../prbench-v4 --dataset <real-cases 4.0.0 dir>
 *     --skill <pinned Tracetoon bundle> --out cases-local [--only a,b] [--jobs 3]
 *
 * The pinned bundle is a Tracetoon skill folder with its runtime at
 * bin/tracetoon-<platform>-<arch>[.exe] (prbench's convention).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { CASE_FILES, CASE_SCHEMA, sha256, type CaseMeta } from '../src/cases.ts';

const DEV_COUNT = 20;
const DATASET = 'prbench real-cases@4.0.0';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const runtimeName = () =>
  `tracetoon-${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;

/**
 * Replaces personal email addresses with `<email>`, as the dataset's own
 * redaction does for sessions: the repositories' code history can still carry
 * an author's address. Kept: example and .invalid domains, role addresses
 * (noreply, support) and systemd unit names that look like addresses.
 */
export function redactEmails(text: string): string {
  return text.replace(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g, (m) => {
    const [local, domain] = [m.slice(0, m.lastIndexOf('@')).toLowerCase(), m.slice(m.lastIndexOf('@') + 1).toLowerCase()];
    if (/(^|\.)example\.(com|org|net)$|\.invalid$|\.(service|socket|target|timer|mount)$/.test(domain)) return m;
    if (/^(no-?reply|support|security|info|hello)$/.test(local)) return m;
    return '<email>';
  });
}

/** A golden draft's body without Tracetoon's markers, metadata and footers. */
export function cleanBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

/** id -> body of the candidate62 Claude draft, replicate 1. */
function goldenDescriptions(prbench: string): Map<string, string> {
  const file = join(prbench, 'golden', 'v4-candidate62', 'claude', 'drafts.jsonl');
  const out = new Map<string, string>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as { case: string; replicate: number; system: string; body: string };
    if (row.system === 'tracetoon-candidate' && row.replicate === 1) out.set(row.case, row.body);
  }
  return out;
}

/**
 * 20 dev cases spread over repositories in proportion to their case counts
 * (largest remainder), each repository's picks ordered by sha256 of the id.
 */
export function chooseSplits(repoOf: Map<string, string>, dev = DEV_COUNT): Map<string, 'dev' | 'sealed'> {
  const groups = new Map<string, string[]>();
  for (const [id, repo] of repoOf) groups.set(repo, [...(groups.get(repo) ?? []), id]);
  const total = repoOf.size;
  const quota = [...groups].map(([repo, ids]) => {
    const exact = (ids.length * dev) / total;
    return { repo, ids, n: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = dev - quota.reduce((s, q) => s + q.n, 0);
  for (const q of [...quota].sort((a, b) => b.rest - a.rest || a.repo.localeCompare(b.repo))) {
    if (left <= 0) break;
    if (q.n < q.ids.length) {
      q.n++;
      left--;
    }
  }
  const out = new Map<string, 'dev' | 'sealed'>();
  for (const q of quota) {
    const ordered = [...q.ids].sort((a, b) => sha256(a).localeCompare(sha256(b)));
    ordered.forEach((id, i) => out.set(id, i < q.n ? 'dev' : 'sealed'));
  }
  return out;
}

interface Row {
  case: string;
  status: 'ok' | 'error';
  stage?: string;
  error?: string;
  repo?: string;
}

async function freezeOne(id: string, o: { prbench: string; dataset: string; skill: string; out: string; description: string }): Promise<Row> {
  const { loadCase } = await import(join(o.prbench, 'src/schema/case.ts'));
  const { createSandbox } = await import(join(o.prbench, 'src/run/sandbox.ts'));
  const { prepareCase } = await import(join(o.prbench, 'src/run/comparisonInputs.ts'));
  const { installTracetoon } = await import(join(o.prbench, 'src/systems/tracetoon.ts'));
  const { prepareFlags } = await import(join(o.prbench, 'scripts/brief-replay.ts'));
  const { exec } = await import(join(o.prbench, 'src/util/exec.ts'));

  const loaded = loadCase(join(o.dataset, id));
  const c = loaded.case;
  const repo = basename(String(c.repo.recordedPath ?? c.sessions?.[0]?.cwd ?? id).replace(/[\\/]+$/, ''));
  const fail = (stage: string, e: unknown): Row => ({
    case: id,
    status: 'error',
    stage,
    error: (e instanceof Error ? e.message : String(e)).slice(0, 1000),
    repo,
  });
  const prepFile = join(o.dataset, 'preparation.json');
  const profile = existsSync(prepFile) ? JSON.parse(readFileSync(prepFile, 'utf8')) : undefined;
  for (const entry of Object.values<any>(profile?.cases ?? {}))
    for (const f of entry.fixtures ?? []) f.bundle = resolve(o.dataset, f.bundle);

  let sandbox: any;
  try {
    try {
      sandbox = createSandbox(loaded);
    } catch (e) {
      return fail('sandbox', e);
    }
    try {
      prepareCase(sandbox, id, profile);
    } catch (e) {
      return fail('preparation', e);
    }
    let tt: any;
    try {
      tt = installTracetoon(sandbox, 'claude-code', { skill: o.skill, runtime: join(o.skill, 'bin', runtimeName()) });
    } catch (e) {
      return fail('install', e);
    }
    const scrub = (s: string) => s.replaceAll(sandbox.root, '<sandbox>').replaceAll(sandbox.root.replace(/\\/g, '/'), '<sandbox>');
    const env = { ...sandbox.env, ...tt.env, TRACETOON_HOST_AGENT: 'claude' };
    const launcher = join(tt.skill, 'bin', process.platform === 'win32' ? 'tracetoon.cmd' : 'tracetoon');
    const run = (args: string[]) => exec([launcher, ...args], { cwd: sandbox.repo, env });
    const begin = run(['task', 'begin', '--json']);
    let runId: string;
    try {
      if (begin.code) throw new Error(`exit ${begin.code}: ${scrub(begin.stderr || begin.stdout).trim()}`);
      runId = JSON.parse(begin.stdout).run;
    } catch (e) {
      return fail('begin', e);
    }
    const flags: string[] = prepareFlags(readFileSync(join(tt.skill, 'SKILL.md'), 'utf8'));
    const prep = run(['prepare', '--json', ...flags, '--run', runId]);
    let brief: string;
    try {
      if (prep.code) throw new Error(`exit ${prep.code}: ${scrub(prep.stderr || prep.stdout).trim()}`);
      brief = JSON.parse(prep.stdout).brief;
      if (typeof brief !== 'string' || !brief.trim()) throw new Error('prepare returned no brief');
    } catch (e) {
      return fail('prepare', e);
    }
    const patch = join(sandbox.gitDir, 'tracetoon', 'runs', runId, 'changes.patch');
    if (!existsSync(patch)) return fail('patch', `no changes.patch in run ${runId}`);
    const factsPath = join(loaded.dir, c.facts ?? 'facts.json');
    if (!existsSync(factsPath)) return fail('facts', `no facts at ${factsPath}`);

    const dir = join(o.out, id);
    mkdirSync(dir, { recursive: true });
    const files: Record<(typeof CASE_FILES)[number], string> = {
      'brief.md': redactEmails(scrub(brief)).trimEnd() + '\n',
      'description.md': redactEmails(cleanBody(o.description)),
      'changes.patch': redactEmails(scrub(readFileSync(patch, 'utf8'))),
      'facts.json': redactEmails(readFileSync(factsPath, 'utf8')),
    };
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    const version = readFileSync(join(o.skill, 'VERSION'), 'utf8').trim();
    const meta: CaseMeta = {
      schema: CASE_SCHEMA,
      id,
      split: 'sealed', // set by the coordinator once every case is known
      source: { dataset: DATASET, case: id },
      tracetoon: version,
      description: 'prbench golden/v4-candidate62 claude tracetoon-candidate replicate 1',
      license: 'Apache-2.0',
      sha256: Object.fromEntries(CASE_FILES.map((f) => [f, sha256(readFileSync(join(dir, f)))])) as CaseMeta['sha256'],
    };
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ ...meta, repo }, null, 2) + '\n');
    return { case: id, status: 'ok', repo };
  } finally {
    sandbox?.dispose();
  }
}

if (import.meta.main) {
  const need = (name: string) => {
    const v = arg(name);
    if (!v) throw new Error(`${name} is required (see the usage at the top of scripts/freeze-cases.ts)`);
    return resolve(v);
  };
  const prbench = need('--prbench');
  const dataset = need('--dataset');
  const skill = need('--skill');
  const out = need('--out');
  if (!existsSync(join(skill, 'SKILL.md')) || !existsSync(join(skill, 'bin', runtimeName())))
    throw new Error(`${skill} needs SKILL.md and bin/${runtimeName()}`);
  const golden = goldenDescriptions(prbench);
  mkdirSync(out, { recursive: true });

  const worker = arg('--worker');
  if (worker) {
    const description = golden.get(worker);
    const row = description
      ? await freezeOne(worker, { prbench, dataset, skill, out, description })
      : { case: worker, status: 'error' as const, stage: 'description', error: 'no golden draft' };
    process.stdout.write(JSON.stringify(row));
    process.exit(0);
  }

  const only = arg('--only')?.split(',').filter(Boolean);
  const ids = readdirSync(dataset, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dataset, e.name, 'case.json')))
    .map((e) => e.name)
    .filter((id) => !only || only.includes(id))
    .sort();
  const indexFile = join(out, 'index.json');
  const rows: Record<string, Row> = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')).cases : {};
  const queue = [...ids];
  const jobs = Number(arg('--jobs') ?? 3);
  const save = () =>
    writeFileSync(indexFile, JSON.stringify({ dataset: DATASET, skill, cases: rows }, null, 2) + '\n');
  await Promise.all(
    Array.from({ length: Math.max(1, jobs) }, async () => {
      for (let id = queue.shift(); id; id = queue.shift()) {
        const p = Bun.spawn(
          [process.execPath, import.meta.path, '--worker', id, '--prbench', prbench, '--dataset', dataset, '--skill', skill, '--out', out],
          { stdout: 'pipe', stderr: 'inherit' },
        );
        const text = await new Response(p.stdout).text();
        await p.exited;
        let row: Row;
        try {
          row = JSON.parse(text);
        } catch {
          row = { case: id, status: 'error', stage: 'crash', error: text.slice(-500) };
        }
        rows[id] = row;
        console.error(`${id}: ${row.status}${row.stage ? ` (${row.stage}: ${row.error?.slice(0, 200)})` : ''}`);
        save();
      }
    }),
  );

  // Splits over every case frozen so far, then stamp each case.json.
  const repoOf = new Map(
    Object.values(rows)
      .filter((r) => r.status === 'ok' && r.repo)
      .map((r) => [r.case, r.repo!] as [string, string]),
  );
  const splits = chooseSplits(repoOf);
  for (const [id, split] of splits) {
    const file = join(out, id, 'case.json');
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    meta.split = split;
    writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
  }
  writeFileSync(
    join(out, 'splits.json'),
    JSON.stringify(
      {
        dev: [...splits].filter(([, s]) => s === 'dev').map(([id]) => id).sort(),
        sealed: [...splits].filter(([, s]) => s === 'sealed').map(([id]) => id).sort(),
      },
      null,
      2,
    ) + '\n',
  );
  const ok = Object.values(rows).filter((r) => r.status === 'ok').length;
  console.log(`Frozen ${ok} of ${Object.keys(rows).length} cases into ${out}; splits.json written.`);
}
