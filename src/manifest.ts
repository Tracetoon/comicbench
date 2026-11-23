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
  const manifest = JSON.parse(readFileSync(join(round, 'manifest.json'), 'utf8')) as RoundManifest;
  if (manifest.schema !== 'comicbench.round/v2' || manifest.rubricVersion !== RUBRIC_VERSION) {
    throw new Error(`${round} uses an older or unsupported round manifest. Open its recorded review to see historical results.`);
  }
  return manifest;
}

export function comparableRounds(a: string, b: string) {
  const A = readRoundManifest(a);
  const B = readRoundManifest(b);
  const keys = ['rubricVersion', 'model', 'runtimeHash', 'imageRoute', 'author', 'cases', 'order', 'samples', 'split', 'jobs'] as const;
  for (const key of keys) {
    if (A[key] === undefined || B[key] === undefined || JSON.stringify(A[key]) !== JSON.stringify(B[key])) {
      throw new Error(`Round manifests disagree on ${key}.`);
    }
  }
  return { A, B };
}
