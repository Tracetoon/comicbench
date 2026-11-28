import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUBRIC_VERSION } from './rubric.ts';

export interface RoundManifest {
  schema: 'comicbench.round/v2';
  rubricVersion: number;
  name: string;
  casesDir: string;
  cases: { id: string; sha256: Record<string, string> }[];
  order: string[];
  samples: number;
  split: string;
  jobs: number;
  model: string;
  author: 'sandbox' | 'inline';
  runtimeHash: string;
  imageRoute: { provider: string; lettering: string; cli: string; agentModel: string; agentEffort: string };
  skill: { path: string; hash: string };
  genre: { path: string; hash: string };
  tracetoon: string;
  authorIsolation: string;
}

export function readRoundManifest(round: string): RoundManifest {
  const manifest = JSON.parse(readFileSync(join(round, 'manifest.json'), 'utf8').replace(/^\uFEFF/, '')) as RoundManifest;
  if (manifest.schema !== 'comicbench.round/v2' || manifest.rubricVersion !== RUBRIC_VERSION) {
    throw new Error(`${round} uses an older or unsupported round manifest. Open its recorded review to see historical results.`);
  }
  return manifest;
}

/**
 * A round's manifest for reading its results, whatever version wrote it. A
 * frozen reference (round 3's comics, say) keeps its older manifest; only the
 * fields every version has are guaranteed.
 */
export function readAnyManifest(round: string): Partial<RoundManifest> & { schema: string; name: string; casesDir: string; cases: { id: string }[] } {
  const manifest = JSON.parse(readFileSync(join(round, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  return { ...manifest, cases: Array.isArray(manifest.cases) ? manifest.cases : [] };
}

/**
 * Whether two rounds can be compared head to head. They must cover the same
 * cases; anything else that differs (the runtime under test, the model, the
 * image route, a legacy manifest) is reported, not refused, because a round
 * is often compared with a frozen reference made under an earlier setup.
 */
export function comparableRounds(a: string, b: string) {
  const A = readAnyManifest(a);
  const B = readAnyManifest(b);
  const ids = (m: { cases: { id: string }[] }) => m.cases.map((c) => c.id).sort().join(',');
  if (ids(A) !== ids(B)) throw new Error('Round manifests cover different cases; compare rounds of the same split.');
  const differences: string[] = [];
  if (A.schema !== B.schema) differences.push(`manifest schema (${A.schema} vs ${B.schema})`);
  for (const key of ['rubricVersion', 'model', 'runtimeHash', 'imageRoute', 'author', 'samples', 'split'] as const) {
    if (JSON.stringify(A[key]) !== JSON.stringify(B[key])) differences.push(key);
  }
  return { A: A as RoundManifest, B: B as RoundManifest, differences };
}
