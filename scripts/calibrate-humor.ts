/**
 * Humor calibration against human judgments (measures v2): does a judge pick
 * the caption the New Yorker contest or its crowd judged funnier?
 *
 * Formats:
 *   pair  - both captions shown, asked "which is funnier" in both orders;
 *           measures accuracy and position bias directly.
 *   score - each caption rated alone 0-100 (no order to be biased by);
 *           the higher-rated caption is the judge's pick.
 *
 * Usage: bun scripts/calibrate-humor.ts --family codex|claude --format pair|score [--n 80] [--jobs 8]
 * Results: .comicbench-cache/calib/nycc/results-<family>-<format>.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { askJudge, pool, type Family } from '../src/judge-family.ts';

const arg = (k: string, d: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1]! : d);
const family = arg('--family', 'codex') as Family;
const format = arg('--format', 'pair') as 'pair' | 'score';
const n = Number(arg('--n', '80'));
const jobs = Number(arg('--jobs', '8'));
const DIR = join(import.meta.dir, '..', '.comicbench-cache', 'calib', 'nycc');
const rows = (JSON.parse(readFileSync(join(DIR, 'rows.json'), 'utf8')) as { caption_choices: string[]; label: string; instance_id: string; winner_source: string }[]).slice(0, n);
const outFile = join(DIR, `results-${family}-${format}.json`);
const done: Record<string, unknown> = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};

const PAIR_SCHEMA = { type: 'object', additionalProperties: false, required: ['funnier', 'reason'], properties: { funnier: { type: 'string', enum: ['1', '2'] }, reason: { type: 'string' } } };
const SCORE_SCHEMA = { type: 'object', additionalProperties: false, required: ['score', 'reason'], properties: { score: { type: 'integer' }, reason: { type: 'string' } } };

const pairPrompt = (c1: string, c2: string) => `This is a single-panel cartoon from a caption contest. Two readers each wrote a caption for it.

Caption 1: "${c1}"
Caption 2: "${c2}"

Which caption makes the cartoon funnier to a typical adult reader? Judge the joke itself: how well the caption explains the oddity in the picture, surprise, wit and economy. Pick one; ties are not allowed.`;

const scorePrompt = (c: string) => `This is a single-panel cartoon from a caption contest, with one reader's caption:

"${c}"

How funny is the cartoon with this caption, for a typical adult reader? Score 0-100 using these anchors:
- 10: no joke; the caption just describes the picture.
- 30: a weak or obvious joke; mildly clever at best.
- 50: a solid joke a reader would smile at.
- 70: a strong joke: surprising, apt, economical; people would share it.
- 90: one of the best captions this cartoon could get.
Use the whole range; most captions are not 50.`;

const key = (r: { instance_id: string }, extra: string) => `${r.instance_id}:${extra}`;
const results = await pool(
  rows.flatMap((r) => (format === 'pair' ? [{ r, o: 'ab' }, { r, o: 'ba' }] : [{ r, o: '0' }, { r, o: '1' }])),
  jobs,
  async ({ r, o }) => {
    const k = key(r, o);
    if (done[k]) return done[k];
    const image = join(DIR, 'img', `${r.instance_id}.jpg`);
    const prompt = format === 'pair'
      ? o === 'ab' ? pairPrompt(r.caption_choices[0]!, r.caption_choices[1]!) : pairPrompt(r.caption_choices[1]!, r.caption_choices[0]!)
      : scorePrompt(r.caption_choices[Number(o)]!);
    const reply = await askJudge({ family, prompt, images: [image], schema: format === 'pair' ? PAIR_SCHEMA : SCORE_SCHEMA, logDir: join(DIR, 'logs', `${family}-${format}`, k.replace(/:/g, '-')) });
    const value = reply.ok ? reply.json : { error: reply.error };
    done[k] = value;
    writeFileSync(outFile, JSON.stringify(done));
    return value;
  },
);
void results;

// Summary.
let correct = 0, judged = 0, firstBoth = 0, secondBoth = 0, failed = 0, cost = 0;
for (const r of rows) {
  const winner = r.label === 'A' ? 0 : 1;
  if (format === 'pair') {
    const ab = done[key(r, 'ab')] as { funnier?: string } | undefined;
    const ba = done[key(r, 'ba')] as { funnier?: string } | undefined;
    if (!ab?.funnier || !ba?.funnier) { failed++; continue; }
    const pickAB = ab.funnier === '1' ? 0 : 1; // index into caption_choices
    const pickBA = ba.funnier === '1' ? 1 : 0;
    if (ab.funnier === '1' && ba.funnier === '1') firstBoth++;
    if (ab.funnier === '2' && ba.funnier === '2') secondBoth++;
    for (const p of [pickAB, pickBA]) { judged++; if (p === winner) correct++; }
  } else {
    const s0 = (done[key(r, '0')] as { score?: number } | undefined)?.score;
    const s1 = (done[key(r, '1')] as { score?: number } | undefined)?.score;
    if (typeof s0 !== 'number' || typeof s1 !== 'number') { failed++; continue; }
    judged++;
    if (s0 === s1) correct += 0.5;
    else if ((s0 > s1 ? 0 : 1) === winner) correct++;
  }
}
const scores = format === 'score' ? rows.flatMap((r) => [0, 1].map((i) => (done[key(r, String(i))] as { score?: number } | undefined)?.score).filter((x): x is number => typeof x === 'number')) : [];
const sd = scores.length ? Math.sqrt(scores.reduce((a, x) => a + (x - scores.reduce((p, q) => p + q, 0) / scores.length) ** 2, 0) / scores.length) : NaN;
console.log(JSON.stringify({
  family, format, pairs: rows.length, failed,
  agreementWithHumans: Math.round((1000 * correct) / Math.max(1, judged)) / 10,
  ...(format === 'pair' ? { positionBias: { firstInBothOrders: firstBoth, secondInBothOrders: secondBoth, of: rows.length - failed } } : { scoreSD: Math.round(sd * 10) / 10 }),
  costUsd: cost,
}));
