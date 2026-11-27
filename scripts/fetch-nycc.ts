/**
 * Downloads the New Yorker Caption Contest "ranking from pixels" test pairs
 * (Hessel et al. 2023, CC BY 4.0, huggingface.co/datasets/jmhessel/newyorker_caption_contest)
 * for humor calibration: each row is a cartoon and two captions, one of which
 * won the contest or was rated far funnier by the crowd.
 *
 * Writes .comicbench-cache/calib/nycc/rows.json and img/<instance_id>.jpg.
 * Usage: bun scripts/fetch-nycc.ts [--max 400]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dir, '..', '.comicbench-cache', 'calib', 'nycc');
const API = 'https://datasets-server.huggingface.co/rows?dataset=jmhessel%2Fnewyorker_caption_contest&config=ranking_from_pixels&split=test';
const max = Number(process.argv[process.argv.indexOf('--max') + 1] || 400);

interface Row { contest_number: number; caption_choices: string[]; winner_source: string; label: string; instance_id: string; image: { src: string } }

mkdirSync(join(OUT, 'img'), { recursive: true });
const rows: Omit<Row, 'image'>[] = [];
for (let offset = 0; rows.length < max; offset += 100) {
  const res = await fetch(`${API}&offset=${offset}&length=100`);
  if (!res.ok) throw new Error(`datasets-server ${res.status}`);
  const page = (await res.json()) as { rows: { row: Row }[]; num_rows_total: number };
  if (!page.rows.length) break;
  for (const { row } of page.rows) {
    if (rows.length >= max) break;
    const file = join(OUT, 'img', `${row.instance_id}.jpg`);
    if (!existsSync(file)) {
      const img = await fetch(row.image.src);
      if (!img.ok) continue;
      writeFileSync(file, new Uint8Array(await img.arrayBuffer()));
    }
    const { image: _image, ...rest } = row;
    rows.push(rest);
  }
  if (offset + 100 >= page.num_rows_total) break;
}
writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 1) + '\n');
writeFileSync(join(OUT, 'SOURCE.txt'), 'New Yorker Caption Contest benchmarks, Hessel et al. 2023 ("Do Androids Laugh at Electric Sheep?"), CC BY 4.0.\nhttps://huggingface.co/datasets/jmhessel/newyorker_caption_contest (config ranking_from_pixels, split test)\n');
const bySource: Record<string, number> = {};
for (const r of rows) bySource[r.winner_source] = (bySource[r.winner_source] ?? 0) + 1;
console.log(`${rows.length} pairs; winner sources ${JSON.stringify(bySource)}; labels A ${rows.filter((r) => r.label === 'A').length} / B ${rows.filter((r) => r.label === 'B').length}`);
