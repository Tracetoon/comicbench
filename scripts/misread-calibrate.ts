/**
 * Calibrates Tracetoon's misread review on finished rounds: runs it on every
 * drawn page and lists the concerns, so a known bad page (one a person flagged)
 * can be checked and the false-alarm rate on the rest measured.
 *
 * bun scripts/misread-calibrate.ts <tracetoon> <round>... [--expect <round>/<case>#<n>]...
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { comicIds } from '../src/campaign.ts';
import { codexExec } from '../src/codex.ts';
import { gate } from '../src/gate.ts';

const args = process.argv.slice(2);
const expect = args.flatMap((a, i) => (args[i - 1] === '--expect' ? [a] : []));
const [tracetoon, ...rest] = args.filter((a, i) => a !== '--expect' && args[i - 1] !== '--expect');
const rounds = rest.map((r) => resolve(r));
const misread = await import(join(resolve(tracetoon!), 'src', 'comic', 'misread.ts'));
gate.setSlots(Number(process.env.COMICBENCH_CODEX_SLOTS ?? 16));

const jobs = rounds.flatMap((round) => comicIds(round).map((id) => ({ round, id })));
const results: { key: string; state: string; items: unknown[] }[] = [];
await Promise.all(
  jobs.map(async ({ round, id }) => {
    const [c, n] = id.split('#') as [string, string];
    const dir = join(round, 'comics', c, n);
    const page = join(dir, 'art', 'page.png');
    if (!existsSync(page)) return;
    const version = process.env.MISREAD_VERSION ?? 'v1';
    const out = join(dir, 'misread', `calibration-${version}.json`);
    let review = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : undefined;
    if (!review) {
      mkdirSync(join(dir, 'misread'), { recursive: true });
      const r = await codexExec({ prompt: misread.MISREAD_PROMPT, cwd: dir, images: [page], schema: misread.MISREAD_SCHEMA, logDir: join(dir, 'misread', `calibration-${version}`) });
      if (!r.ok || !misread.isMisreadReview(r.json)) {
        console.error(`${basename(round)} ${id}: ${r.error ?? 'bad reply'}`);
        return;
      }
      review = r.json;
      writeFileSync(out, JSON.stringify(review, null, 2) + '\n');
    }
    results.push({ key: `${basename(round)}/${id}`, state: review.state, items: review.items });
  }),
);
results.sort((a, b) => a.key.localeCompare(b.key));
const concerns = results.filter((r) => misread.hasConcern ? misread.hasConcern(r) : r.state === 'concern');
console.log(`${results.length} pages reviewed; ${concerns.length} concerns`);
for (const r of concerns) console.log(`CONCERN ${r.key}: ${JSON.stringify(r.items)}`);
for (const e of expect) console.log(`expected concern ${e}: ${concerns.some((r) => r.key === e) ? 'FLAGGED' : 'MISSED'}`);
