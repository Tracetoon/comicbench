/**
 * Descriptive stats for script-stage arms (round 20 research): words on the
 * page, last-line length, office words, gate-type premises, staples used,
 * a command or product among the anchor terms, and settings chosen.
 *
 *   bun scripts/arm-stats.ts s20-A s20-J ...
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const office = /\b(office|desk|counter|paperwork|registry|clerk|filing|permit|memo|inbox|bureaucra)/i;
const gate = /\b(gate|bridge|arch|toll|door|portal)\b/i;
type D = { speaker?: string; kind?: string; text?: string };
type S = { place?: string; setting?: string; meme?: string; anchor?: { terms?: string[] }; panels: { scene?: string; dialogue?: D[] }[] };
const spoken = (d: D) => d.kind !== 'sign' && d.kind !== 'sfx' && d.speaker !== 'caption' && d.kind !== 'caption';
const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);

for (const round of process.argv.slice(2)) {
  const root = join(ROOT, 'results', round, 'comics');
  const rows: S[] = [];
  for (const c of readdirSync(root))
    for (const n of readdirSync(join(root, c))) {
      const f = [join(root, c, n, 'art', 'comic.json'), join(root, c, n, 'packet', 'comic.json')].find(existsSync);
      if (f) rows.push(JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')));
    }
  const words = rows.map((s) => s.panels.flatMap((p) => (p.dialogue ?? []).map((d) => d.text ?? '')).join(' ').split(/\s+/).length);
  const lastLine = rows.map((s) => {
    const l = (s.panels.at(-1)?.dialogue ?? []).filter(spoken);
    return l.length ? (l.at(-1)!.text ?? '').split(/\s+/).length : 0;
  });
  const cmd = rows.filter((s) => (s.anchor?.terms ?? []).some((t) => /^(tracetoon|prbench|vexaim|vexagent|showtail|aifirst|codex|bun|npm|gh|mvn|winapps)\b|--|\s(run|score|snap|init|check)\b/i.test(t))).length;
  const settings: Record<string, number> = {};
  for (const s of rows) settings[s.setting ?? '-'] = (settings[s.setting ?? '-'] ?? 0) + 1;
  console.log(
    `${round.padEnd(10)} n ${rows.length} | words ${mean(words)} | last line ${mean(lastLine)} words | office ${rows.filter((s) => office.test(`${s.place} ${JSON.stringify(s.panels)}`)).length} | gate-type ${rows.filter((s) => gate.test(`${s.place} ${s.panels[0]?.scene ?? ''}`)).length} | staple ${rows.filter((s) => s.meme).length} | command term ${cmd} | settings ${JSON.stringify(settings)}`,
  );
}
