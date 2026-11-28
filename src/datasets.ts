/**
 * Downloads a released case dataset (datasets/registry.json), checks the
 * archive's sha256, unpacks it with `tar`, checks every file against the
 * archive's MANIFEST.json, and only then moves it into place.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import registry from '../datasets/registry.json';
import { sha256 } from './cases.ts';

export interface DatasetRelease {
  id: string;
  version: string;
  url: string;
  sha256: string;
  bytes: number;
  cases: number;
}

export function datasetRelease(spec: string = registry.default): DatasetRelease {
  const [id, version] = spec.split('@');
  const d = registry.datasets.find((x) => x.id === id && (!version || x.version === version));
  if (!d) throw new Error(`Unknown dataset ${spec}; known: ${registry.datasets.map((x) => `${x.id}@${x.version}`).join(', ')}`);
  return d;
}

export function defaultDatasetDir(d: DatasetRelease): string {
  return join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'comicbench', 'datasets', d.id, d.version);
}

/** Problems with an unpacked dataset folder against its MANIFEST.json; empty when it matches. */
export function datasetProblems(dir: string, d: DatasetRelease): string[] {
  const file = join(dir, 'MANIFEST.json');
  if (!existsSync(file)) return ['MANIFEST.json is missing'];
  const m = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as { id: string; version: string; cases: number; files: { path: string; sha256: string }[] };
  const out: string[] = [];
  if (m.id !== d.id || m.version !== d.version) out.push(`manifest is ${m.id}@${m.version}, not ${d.id}@${d.version}`);
  if (m.cases !== d.cases) out.push(`manifest lists ${m.cases} cases, the registry ${d.cases}`);
  for (const f of m.files) {
    if (f.path.includes('..') || f.path.startsWith('/')) out.push(`unsafe path ${f.path}`);
    else if (!existsSync(join(dir, f.path))) out.push(`${f.path} is missing`);
    else if (sha256(readFileSync(join(dir, f.path))) !== f.sha256) out.push(`${f.path} does not match its sha256`);
  }
  return out;
}

export async function fetchDataset(d: DatasetRelease, dest = defaultDatasetDir(d), fetcher = fetch): Promise<string> {
  if (existsSync(dest)) {
    const bad = datasetProblems(dest, d);
    if (bad.length) throw new Error(`${dest} exists but does not verify: ${bad.slice(0, 5).join('; ')}`);
    return dest;
  }
  const res = await fetcher(d.url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${d.url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length !== d.bytes || sha256(bytes) !== d.sha256) throw new Error('Downloaded archive does not match the registry sha256');
  const stage = `${dest}.staging-${process.pid}`;
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const archive = join(stage, 'archive.tar.gz');
  writeFileSync(archive, bytes);
  const tar = Bun.spawnSync(['tar', '-xzf', 'archive.tar.gz'], { cwd: stage });
  if (tar.exitCode !== 0) throw new Error(`tar failed: ${tar.stderr.toString()}`);
  const root = join(stage, `${d.id}-${d.version}`);
  const bad = datasetProblems(root, d);
  if (bad.length) throw new Error(`Unpacked dataset does not verify: ${bad.slice(0, 5).join('; ')}`);
  mkdirSync(join(dest, '..'), { recursive: true });
  renameSync(root, dest);
  rmSync(stage, { recursive: true, force: true });
  return dest;
}
