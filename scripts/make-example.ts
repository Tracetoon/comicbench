/**
 * Writes the synthetic example case (cases/example) and a sample genre file
 * (genres/space-opera.md), so the CLI and tests run without the real dataset.
 * Run: bun scripts/make-example.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CASE_FILES, CASE_SCHEMA, sha256, type CaseMeta } from '../src/cases.ts';

const root = join(import.meta.dir, '..');

export const EXAMPLE_FILES: Record<(typeof CASE_FILES)[number], string> = {
  'brief.md': `requests[1]{ref,kind,text}:
  S1,goal,"Retry the flaky upload with backoff instead of failing the build."
changes[1]{change,where,behavior}:
  CH1,src/upload.ts (uploadWithRetry),"uploadWithRetry: + retries up to 3 times, waiting 1s, 2s, 4s"
process[1]{ref,kind,fact}:
  PR1,test,"Tests failed twice on a timeout, then passed after the backoff change."
doNotSay[1]{kind,text}:
  numbers,"Never say more than 3 retries."
`,
  'description.md': `Uploads that time out now retry up to three times with exponential backoff
(1s, 2s, 4s) instead of failing the build on the first timeout.

Where to start: \`uploadWithRetry\` in \`src/upload.ts\`.
`,
  'changes.patch': `diff --git a/src/upload.ts b/src/upload.ts
--- a/src/upload.ts
+++ b/src/upload.ts
@@ -1,3 +1,9 @@
-export const upload = (f: File) => send(f);
+export async function uploadWithRetry(f: File) {
+  for (let i = 0; i < 3; i++) {
+    try { return await send(f); } catch { await sleep(1000 * 2 ** i); }
+  }
+  return send(f);
+}
`,
  'facts.json': `${JSON.stringify(
    {
      schema: 'prbench.facts/v1',
      claims: [{ id: 'C1', text: 'Uploads retry up to three times with 1s, 2s and 4s waits.' }],
      context: [],
      uncertainties: [],
      traps: [{ id: 'T1', text: 'Claims of unlimited retries.' }],
    },
    null,
    2,
  )}\n`,
};

export const EXAMPLE_GENRE = `---
id: space-opera
name: Space opera
setting: a starship bridge, docking bays, cargo holds and alien bazaars
archetypes:
  - grizzled starship captain
  - eager ensign
  - deadpan ship AI
props:
  - bridge viewscreen
  - red-alert panel
  - airlock warning sign
jokeHooks:
  - the ship AI takes an order literally
  - red alert over something tiny
styles:
  - space-opera
---
`;

export function writeExample(dir = join(root, 'cases', 'example')): string {
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(EXAMPLE_FILES)) writeFileSync(join(dir, name), text);
  const meta: CaseMeta = {
    schema: CASE_SCHEMA,
    id: 'example',
    split: 'dev',
    source: { dataset: 'synthetic', case: 'example' },
    tracetoon: 'synthetic',
    description: 'synthetic',
    license: 'Apache-2.0',
    sha256: Object.fromEntries(
      CASE_FILES.map((f) => [f, sha256(readFileSync(join(dir, f)))]),
    ) as CaseMeta['sha256'],
  };
  writeFileSync(join(dir, 'case.json'), JSON.stringify(meta, null, 2) + '\n');
  return dir;
}

if (import.meta.main) {
  writeExample();
  mkdirSync(join(root, 'genres'), { recursive: true });
  writeFileSync(join(root, 'genres', 'space-opera.md'), EXAMPLE_GENRE);
  console.log('Wrote cases/example and genres/space-opera.md');
}
