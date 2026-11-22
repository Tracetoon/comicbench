/**
 * Packages frozen cases as a dataset release archive:
 *   comic-cases-<version>.tar.gz  (cases, splits.json, DATASET_CARD.md, LICENSE, MANIFEST.json)
 *   SHA256SUMS.txt
 * Every case must validate first; the run's index.json (local paths) is left out.
 * Usage: bun scripts/package-cases.ts --cases cases-local --version 1.0.0 --out <dir>
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { caseProblems, loadCases, sha256 } from '../src/cases.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export const DATASET_ID = 'comic-cases';

export function datasetCard(version: string, counts: { dev: number; sealed: number; repos: number }): string {
  return `# comicbench ${DATASET_ID} ${version}

Frozen inputs for comicbench: one folder per pull request case, each with the
evidence brief a Tracetoon comic author reads, the PR description, the diff and
a fact sheet for the judges.

- **Cases:** ${counts.dev + counts.sealed} (${counts.dev} dev, ${counts.sealed} sealed), from ${counts.repos} repositories.
  \`splits.json\` lists the split; dev cases are for tuning, sealed cases for
  confirmation runs.
- **Source:** prbench's \`real-cases@4.0.0\` replay dataset (Apache-2.0; consented,
  redacted sessions). Each brief was generated once, with no model calls, by
  rebuilding the prbench writer sandbox and running Tracetoon 1.0.0-rc.45
  \`prepare\` (comicbench \`scripts/freeze-cases.ts\`).
- **Description:** the golden run's candidate62 Claude draft, replicate 1
  (prbench \`golden/v4-candidate62\`), with Tracetoon's comment markers removed.
- **Redaction:** personal email addresses are replaced with \`<email>\`; sandbox
  paths with \`<sandbox>\`. Example, \`.invalid\`, role (noreply, support) and
  systemd-unit addresses are kept.
- **Integrity:** each \`case.json\` pins its four files by sha256; MANIFEST.json
  hashes every file in the archive.
- **Use:** comic authors may read \`brief.md\`, \`description.md\` and
  \`changes.patch\`; \`facts.json\` is for judges only.

License: Apache-2.0.
`;
}

if (import.meta.main) {
  const cases = resolve(arg('--cases') ?? 'cases-local');
  const version = arg('--version') ?? '1.0.0';
  const out = resolve(arg('--out') ?? '.comicbench-cache/release');
  const loaded = loadCases(cases);
  const bad = loaded.flatMap((c) => caseProblems(c.dir).map((p) => `${c.meta.id}: ${p}`));
  if (bad.length) throw new Error(`Cases don't validate:\n${bad.join('\n')}`);
  const splits = JSON.parse(readFileSync(join(cases, 'splits.json'), 'utf8')) as { dev: string[]; sealed: string[] };
  const name = `${DATASET_ID}-${version}`;
  const stage = join(out, name);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const c of loaded) cpSync(c.dir, join(stage, c.meta.id), { recursive: true });
  cpSync(join(cases, 'splits.json'), join(stage, 'splits.json'));
  cpSync(resolve('LICENSE'), join(stage, 'LICENSE'));
  const repos = new Set(loaded.map((c) => (c.meta as unknown as { repo?: string }).repo ?? c.meta.id)).size;
  writeFileSync(join(stage, 'DATASET_CARD.md'), datasetCard(version, { dev: splits.dev.length, sealed: splits.sealed.length, repos }));
  const files: { path: string; sha256: string }[] = [];
  const walk = (rel: string) => {
    for (const e of readdirSync(join(stage, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else files.push({ path: p, sha256: sha256(readFileSync(join(stage, p))) });
    }
  };
  walk('');
  writeFileSync(
    join(stage, 'MANIFEST.json'),
    JSON.stringify({ schema: 'comicbench.dataset/v1', id: DATASET_ID, version, cases: loaded.length, files }, null, 2) + '\n',
  );
  const archive = join(out, `${name}.tar.gz`);
  rmSync(archive, { force: true });
  const tar = Bun.spawnSync(['tar', '-czf', `${name}.tar.gz`, name], { cwd: out });
  if (tar.exitCode !== 0) throw new Error(`tar failed: ${tar.stderr.toString()}`);
  const sum = sha256(readFileSync(archive));
  writeFileSync(join(out, 'SHA256SUMS.txt'), `${sum}  ${name}.tar.gz\n`);
  console.log(JSON.stringify({ archive, sha256: sum, bytes: readFileSync(archive).length, cases: loaded.length }));

}
