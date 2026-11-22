/**
 * The review page: one static folder per round (or pair of rounds) that shows
 * every comic with what each judge scored and why, so a person can audit the
 * judges. Notes typed on the page are for the people improving the rubric;
 * they never feed a score.
 *
 *   comicbench review <round> [--compare <round>] [--out <dir>]
 *
 * Writes <out>/index.html, <out>/data.json and <out>/img/<arm>/<case>-<n>.png.
 * Published as an artifact, the page keeps notes in the artifact's database
 * (collection `notes`); opened from disk, in the browser's own storage with
 * an export button.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, sep } from 'node:path';
import { loadCases } from './cases.ts';
import { authorChecks, authorStats, compareRounds } from './compare.ts';
import { CRITERIA, GATES, RUBRIC_VERSION, SET_CRITERIA } from './rubric.ts';
import { comicScore, type ComicJudgment } from './score.ts';

const readJson = <T = any>(f: string): T | undefined => {
  try {
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : undefined;
  } catch {
    return undefined;
  }
};
const readText = (f: string, max = 8000) => (existsSync(f) ? readFileSync(f, 'utf8').slice(0, max) : '');

/** Which calibration control speaks for which criterion or gate. */
const CONTROL_FOR: Record<string, string> = {
  humor: 'flat',
  relevance: 'swap',
  fidelity: 'wrongFact',
  factualIntegrity: 'wrongFact',
  phoneLegibility: 'tiny',
  artStyle: 'offStyle',
};

let jpegOk: boolean | undefined;
/**
 * The page's copy of a comic: a JPEG (about a tenth of the PNG, so a round
 * fits one artifact publish) when Python with Pillow is installed, else the PNG.
 * Returns the path relative to the review folder.
 */
function toJpeg(png: string, base: string): string {
  const rel = (f: string) => {
    const parts = f.split(/[\\/]/);
    return parts.slice(parts.lastIndexOf('img')).join('/');
  };
  if (jpegOk !== false) {
    const out = `${base}.jpg`;
    if (existsSync(out)) return rel(out);
    const code = 'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],"JPEG",quality=82,optimize=True)';
    // Bun's PATH lookup skips Windows Store app aliases, so name that one too.
    const storeAlias = process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA.split(sep).join('/')}/Microsoft/WindowsApps/python.exe` : undefined; // Bun finds it only with forward slashes
    for (const py of [process.env.COMICBENCH_PYTHON, 'python', 'python3', 'py', storeAlias].filter(Boolean) as string[]) {
      try {
        if (Bun.spawnSync([py, '-P', '-c', code, png, out], { stdout: 'pipe', stderr: 'pipe' }).exitCode === 0) {
          process.env.COMICBENCH_PYTHON = py;
          jpegOk = true;
          return rel(out);
        }
      } catch {
        /* not installed under this name */
      }
    }
    jpegOk = false;
  }
  copyFileSync(png, `${base}.png`);
  return rel(`${base}.png`);
}

function caseTitle(caseDir: string): string {
  const d = readText(join(caseDir, 'description.md'), 2000);
  return /^#\s+(.+)$/m.exec(d)?.[1]?.trim() ?? basename(caseDir);
}

function scoresOf(dir: string) {
  const blind = readJson(join(dir, 'blind.json'));
  const context = readJson(join(dir, 'context.json'));
  if (!blind && !context) return undefined;
  return {
    scores: Object.fromEntries(
      CRITERIA.map((c) => {
        const src = c.stage === 'blind' ? blind : context;
        const v = src?.scores?.[c.id];
        return [c.id, { score: v?.score ?? null, reason: v?.reason ?? '' }];
      }),
    ),
    gates: {
      punchUp: blind?.punchUp ?? null,
      factualIntegrity: context?.factualIntegrity ?? null,
    },
    observation: blind?.observation ?? '',
    joke: blind?.joke ?? '',
  };
}

function armData(round: string, out: string) {
  const manifest = readJson(join(round, 'manifest.json')) ?? {};
  const arm = manifest.name ?? basename(round);
  const cases = new Map(loadCases(manifest.casesDir ?? join(round, '..', '..', 'cases-local')).map((c) => [c.meta.id, c]));
  const comics: any[] = [];
  const root = join(round, 'comics');
  const imgDir = join(out, 'img', arm);
  mkdirSync(imgDir, { recursive: true });
  for (const cid of existsSync(root) ? readdirSync(root).sort() : [])
    for (const n of readdirSync(join(root, cid)).sort()) {
      const dir = join(root, cid, n);
      const judgment = readJson<ComicJudgment & { phoneMissing?: string[]; note?: string }>(join(round, 'judgments', cid, `${n}.json`));
      const script = readJson(join(dir, 'packet', 'comic.json'));
      const design = readJson(join(dir, 'packet', 'comic-design.json'));
      const check = readJson(join(dir, 'check.json'));
      const phone = readJson(join(dir, 'judge', 'phone.json'));
      const log = join(dir, 'author', '1', 'codex.log');
      const inlineTries = existsSync(join(dir, 'author'))
        ? readdirSync(join(dir, 'author')).filter((d) => /^\d+$/.test(d) && existsSync(join(dir, 'author', d, 'check.txt')))
        : [];
      const checks = inlineTries.length
        ? inlineTries.sort((a, b) => Number(a) - Number(b)).map((d) => {
            const output = readText(join(dir, 'author', d, 'check.txt'), 4000).trim();
            return { clean: /^comic\.json looks good\.$/.test(output), output };
          })
        : existsSync(log)
          ? authorChecks(readFileSync(log, 'utf8')).map(({ clean, output }) => ({
              clean,
              output: output.split('\n').filter((l) => !/EPERM/.test(l)).join('\n').trim().slice(0, 4000),
            }))
          : [];
      const page = join(dir, 'art', 'page-760.png');
      let img: string | null = null;
      if (existsSync(page)) {
        img = toJpeg(page, join(out, 'img', arm, `${cid}-${n}`));
      }
      const primary = scoresOf(join(dir, 'judge'));
      const second = scoresOf(join(dir, 'judge-2'));
      const repeat = scoresOf(join(dir, 'judge-repeat'));
      const status = !judgment ? (existsSync(join(dir, 'art')) ? 'in progress' : 'not judged') : Object.values(judgment.gates).every(Boolean) ? 'judged' : 'gated';
      comics.push({
        key: `${arm}--${cid}--${n}`,
        arm,
        case: cid,
        sample: Number(n),
        status,
        total: judgment ? comicScore(judgment) : null,
        gates: judgment?.gates ?? null,
        note: judgment?.note ?? null,
        judge: primary ?? null,
        second: second ? { scores: Object.fromEntries(Object.entries(second.scores).map(([k, v]: [string, any]) => [k, v.score])), reasons: Object.fromEntries(Object.entries(second.scores).map(([k, v]: [string, any]) => [k, v.reason])), gates: Object.fromEntries(Object.entries(second.gates).map(([k, v]: [string, any]) => [k, v?.pass ?? null])) } : null,
        repeat: repeat ? Object.fromEntries(Object.entries(repeat.scores).map(([k, v]: [string, any]) => [k, v.score])) : null,
        phone: phone ? { items: phone.items ?? [], unreadable: phone.unreadable ?? [], missing: judgment?.phoneMissing ?? [] } : null,
        img,
        comic: script
          ? {
              title: script.title ?? '',
              synopsis: script.synopsis ?? '',
              style: script.style ?? '',
              genre: script.genre ?? '',
              layout: script.composition?.family ?? script.format ?? '',
              panels: script.panels?.length ?? 0,
              cast: (script.characters ?? []).map((c: any) => c.name),
              anchor: script.anchor?.change ?? '',
              altText: script.altText ?? '',
            }
          : null,
        author: {
          checks,
          finalCheck: check ? (check.ok ? 'passed' : `failed: ${(check.problems ?? []).map((p: any) => `${p.where}: ${p.problem}`).join('; ') || check.error || ''}`) : null,
          chosen: design?.chosen ?? design?.choice ?? design?.pick ?? null,
          concepts: (design?.concepts ?? []).map((c: any) => ({ id: c.id ?? '', punchline: c.punchline ?? '', jokeShape: c.jokeShape ?? '', layout: c.layout ?? '' })),
          reason: design?.why ?? design?.reason ?? design?.choiceReason ?? '',
        },
        recent: readJson<string[]>(join(dir, 'recent.json')) ?? [],
      });
    }
  const caseInfo = Object.fromEntries(
    [...new Set(comics.map((c) => c.case))].map((cid) => {
      const c = cases.get(cid);
      return [cid, c ? { title: caseTitle(c.dir), source: c.meta.source?.case ?? cid, brief: readText(join(c.dir, 'brief.md'), 6000), description: readText(join(c.dir, 'description.md'), 4000) } : { title: cid, source: cid, brief: '', description: '' }];
    }),
  );
  const report = readJson(join(round, 'report.json'));
  const setDetail = readJson(join(round, 'set-detail.json'));
  const calibration = readJson(join(round, 'calibration.json'));
  const reliability = readJson(join(round, 'reliability.json'));
  const author = authorStats(round);
  const names = new Map<string, Set<string>>();
  for (const c of comics) for (const n of c.comic?.cast ?? []) names.set(n.toLowerCase(), new Set([...(names.get(n.toLowerCase()) ?? []), c.case]));
  const layouts: Record<string, number> = {};
  for (const c of comics) if (c.comic) layouts[c.comic.layout || 'unknown'] = (layouts[c.comic.layout || 'unknown'] ?? 0) + 1;
  return {
    arm,
    manifest: {
      skillHash: manifest.skill?.hash?.slice(0, 12) ?? '',
      genre: manifest.genre?.path ? basename(manifest.genre.path) : '',
      model: manifest.model ?? '',
      rubricVersion: manifest.rubricVersion ?? null,
      author: manifest.author ?? 'inline',
      split: manifest.split ?? '',
      samples: manifest.samples ?? null,
      startedAt: manifest.startedAt ?? '',
    },
    report: report ?? null,
    author,
    set: setDetail
      ? {
          scores: setDetail.scores,
          clusters: setDetail.clusters,
          split: setDetail.split ?? null,
        }
      : null,
    variety: {
      reusedNames: [...names].filter(([, cs]) => cs.size > 1).map(([n, cs]) => ({ name: n, cases: [...cs].sort() })).sort((a, b) => b.cases.length - a.cases.length),
      layouts,
    },
    calibration: calibration?.controls ?? null,
    reliability: reliability
      ? { model2: reliability.model2, second: reliability.secondJudge, repeat: reliability.repeat }
      : null,
    comics,
    caseInfo,
  };
}

export function buildReview(o: { round: string; compare?: string; out: string; tracetoon?: string }): string {
  mkdirSync(o.out, { recursive: true });
  const arms = [armData(o.round, o.out), ...(o.compare ? [armData(o.compare, o.out)] : [])];
  let comparison: any = null;
  if (o.compare && existsSync(join(o.round, 'judgments')) && existsSync(join(o.compare, 'judgments'))) {
    try {
      comparison = compareRounds(o.round, o.compare);
    } catch {
      comparison = null;
    }
  }
  const data = {
    rubricVersion: RUBRIC_VERSION,
    builtAt: new Date().toISOString(),
    criteria: CRITERIA.map(({ id, name, weight, stage, question, anchors }) => ({ id, name, weight, stage, question, anchors })),
    gates: GATES.map(({ id, question }) => ({ id, question })),
    setCriteria: SET_CRITERIA.map(({ id, question, share }) => ({ id, question, share })),
    controlFor: CONTROL_FOR,
    arms: arms.map(({ caseInfo, ...a }) => a),
    cases: Object.assign({}, ...arms.map((a) => a.caseInfo)),
    comparison,
  };
  writeFileSync(join(o.out, 'data.json'), JSON.stringify(data));
  let lockup = '';
  if (o.tracetoon && existsSync(join(o.tracetoon, 'plugin', 'assets', 'tracetoon.svg')))
    lockup = readFileSync(join(o.tracetoon, 'plugin', 'assets', 'tracetoon.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<svg /, '<svg class="mark" aria-hidden="true" ');
  writeFileSync(join(o.out, 'index.html'), PAGE.replace('<!--MARK-->', lockup));
  return o.out;
}

/** The page. Everything it shows comes from data.json beside it. */
const PAGE = String.raw`<title>Comicbench Round Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: a comic-book contact sheet. Summary strip first, then one row per PR with its comics side by side as inked panels. */
:root {
  --paper: #fffdf6; --panel: #ffffff; --ink: #1b1913; --muted: #5a5548; --rule: #d9d2bf;
  --pow: #ffd84a; --orange: #f0602b; --teal: #0b8a7b; --tealbg: #dff3ef; --orangebg: #fde6dc; --powbg: #fff4c2;
  --shadow: #1b1913;
  --display: 'Bangers', 'Comic Neue', Impact, sans-serif;
  --letter: 'Comic Neue', 'Comic Sans MS', 'Chalkboard SE', sans-serif;
  --body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #14130f; --panel: #1f1d17; --ink: #f2ede0; --muted: #b5ae9c; --rule: #3a362b;
  --pow: #ffd84a; --orange: #ff7a4a; --teal: #2fc7b1; --tealbg: #11332e; --orangebg: #3a1f14; --powbg: #3a3214; --shadow: #000000; color-scheme: dark } }
:root[data-theme="dark"] {
  --paper: #14130f; --panel: #1f1d17; --ink: #f2ede0; --muted: #b5ae9c; --rule: #3a362b;
  --pow: #ffd84a; --orange: #ff7a4a; --teal: #2fc7b1; --tealbg: #11332e; --orangebg: #3a1f14; --powbg: #3a3214; --shadow: #000000; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--paper); color: var(--ink); font: 15px/1.5 var(--body); }
.wrap { max-width: 1680px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 64px; }
h1, h2, h3 { text-wrap: balance; margin: 0 }
h1 { font: 400 clamp(2rem, 5vw, 3.2rem)/1 var(--display); letter-spacing: .03em }
h2 { font: 400 1.9rem/1.1 var(--display); letter-spacing: .03em; margin-block: 40px 14px }
h3 { font: 700 1.15rem/1.25 var(--letter) }
.mark { width: 56px; height: 56px; flex: none }
header.top { display: flex; gap: 16px; align-items: center; flex-wrap: wrap }
.sub { color: var(--muted); max-width: 70ch }
.inked { background: var(--panel); border: 2px solid var(--ink); border-radius: 6px; box-shadow: 4px 4px 0 var(--shadow) }
.notice { display: inline-block; background: var(--powbg); border: 2px solid var(--ink); padding: 4px 10px; border-radius: 4px; font: 700 .9rem var(--letter); margin-top: 10px }
.arms { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; margin-top: 20px }
.arm { padding: 16px 18px; min-width: 0 }
.arm h3 { font: 400 1.6rem var(--display); letter-spacing: .03em }
.big { font: 400 2.6rem/1 var(--display); letter-spacing: .02em; font-variant-numeric: tabular-nums }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; font-size: .9rem; margin-top: 10px }
.kv dt { color: var(--muted) } .kv dd { margin: 0; font-variant-numeric: tabular-nums; min-width: 0; overflow-wrap: anywhere }
.delta { margin-top: 16px; padding: 12px 16px; font-size: .95rem }
.scroll { overflow-x: auto }
table { border-collapse: collapse; width: 100%; font-size: .9rem }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--rule); vertical-align: top }
th { font: 700 .78rem var(--body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted) }
td.num { font-variant-numeric: tabular-nums; white-space: nowrap }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 999px; border: 1.5px solid var(--ink); font: 700 .75rem/1.6 var(--body); white-space: nowrap }
.ok { background: var(--tealbg); color: var(--ink); border-color: var(--teal) }
.bad { background: var(--orangebg); color: var(--ink); border-color: var(--orange) }
.warn { background: var(--powbg) }
.plain { background: transparent; border-color: var(--rule); color: var(--muted) }
.toolbar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--paper); border-bottom: 2px solid var(--ink); padding-block: 10px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 28px }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--paper) }
.toolbar label { font-size: .85rem; color: var(--muted); display: inline-flex; gap: 6px; align-items: center }
select, button, textarea, input { font: inherit; color: var(--ink); background: var(--panel); border: 1.5px solid var(--ink); border-radius: 4px; padding: 4px 8px }
button { cursor: pointer; font-weight: 600 }
button[aria-pressed="true"] { background: var(--pow); color: #1b1913 }
button:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 3px solid var(--orange); outline-offset: 2px }
.case { margin-top: 34px }
.casehead { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline; border-bottom: 2px solid var(--ink); padding-bottom: 6px }
.casehead h3 { font: 400 1.5rem var(--display); letter-spacing: .03em }
.casehead .src { font: .8rem var(--mono); color: var(--muted) }
.casebody { margin-top: 6px; font-size: .9rem }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card, 520px)), 1fr)); gap: 22px; margin-top: 14px; align-items: start }
.card { padding: 14px; min-width: 0; display: grid; gap: 12px }
.cardtop { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between }
.who { font: 700 .8rem var(--body); text-transform: uppercase; letter-spacing: .08em; color: var(--muted) }
.score { font: 400 2.2rem/1 var(--display); font-variant-numeric: tabular-nums }
.score small { font: 600 .8rem var(--body); color: var(--muted) }
.comicimg { display: block; width: 100%; max-width: 100%; height: auto; border: 2px solid var(--ink); border-radius: 3px; cursor: zoom-in; background: var(--rule) }
body.phone .comicimg { width: 360px; max-width: 100% }
.noimg { padding: 30px; text-align: center; color: var(--muted); border: 2px dashed var(--rule); border-radius: 4px }
.meta { display: flex; flex-wrap: wrap; gap: 6px }
.gates { display: flex; flex-wrap: wrap; gap: 6px }
.crit { display: grid; grid-template-columns: 1fr; gap: 8px }
.c { display: grid; grid-template-columns: 112px 92px 1fr; gap: 4px 10px; align-items: start; padding-top: 6px; border-top: 1px dotted var(--rule) }
.c .n { font-weight: 600; font-size: .88rem } .c .n small { display: block; font-weight: 400; color: var(--muted); font-size: .72rem }
.pips { display: inline-flex; gap: 3px; padding-top: 3px }
.pip { width: 13px; height: 13px; border: 1.5px solid var(--ink); border-radius: 2px; background: transparent }
.pip.on { background: var(--pow) }
.pip.on.low { background: var(--orange) }
.c .r { font-size: .86rem; min-width: 0 }
.c .alt { font-size: .76rem; color: var(--muted); margin-top: 2px }
.critique { grid-column: 1 / -1; display: flex; gap: 6px; align-items: center; font-size: .75rem; color: var(--muted) }
.critique button { padding: 0 8px; font-size: .75rem; font-weight: 600 }
.critique button[data-v="agree"][aria-pressed="true"] { background: var(--tealbg); border-color: var(--teal); color: var(--ink) }
.critique button[data-v="disagree"][aria-pressed="true"] { background: var(--orangebg); border-color: var(--orange); color: var(--ink) }
details { border-top: 1px solid var(--rule); padding-top: 6px }
summary { cursor: pointer; font: 700 .92rem var(--letter) }
.said { background: var(--powbg); border: 1.5px solid var(--ink); border-radius: 14px; padding: 8px 12px; font: 400 .95rem/1.45 var(--letter) }
.said b { font-weight: 700 }
pre { font: .78rem/1.45 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; background: var(--paper); border: 1px solid var(--rule); padding: 8px; border-radius: 4px; max-height: 340px; overflow: auto; margin: 6px 0 0 }
.phone li.missing { color: var(--orange); font-weight: 600 }
ul.tight { margin: 6px 0 0; padding-left: 18px; font-size: .86rem }
textarea { width: 100%; min-height: 64px; font-size: .9rem }
.notes { display: grid; gap: 6px }
.saved { font-size: .75rem; color: var(--muted) }
.clusters { display: grid; gap: 10px; margin-top: 10px }
.cluster { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: 1.5px solid var(--rule); border-radius: 4px }
.cluster img { height: 96px; width: auto; border: 1.5px solid var(--ink); border-radius: 2px }
.cluster .lbl { font: .72rem var(--mono); color: var(--muted) }
.empty { color: var(--muted); font-style: italic }
dialog { border: 2px solid var(--ink); padding: 0; background: var(--panel); max-width: min(96vw, 1400px) }
dialog img { display: block; max-width: 100%; max-height: 90vh }
dialog::backdrop { background: rgba(20,19,15,.7) }
.legend { font-size: .85rem; color: var(--muted); max-width: 90ch }
@media (max-width: 560px) { .c { grid-template-columns: 1fr 92px } .c .r { grid-column: 1 / -1 } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto } }
</style>

<div class="wrap">
  <header class="top">
    <!--MARK-->
    <div>
      <h1>Comicbench review</h1>
      <div class="sub" id="lede">Loading the round…</div>
    </div>
  </header>
  <div class="notice">Your notes are for reviewing the judges. They never change a score.</div>

  <section id="summary"></section>
  <section id="criteria"></section>
  <section id="variety"></section>

  <div class="toolbar" role="toolbar" aria-label="Filter comics">
    <label for="f-arm">Arm <select id="f-arm"><option value="">All</option></select></label>
    <label for="f-status">Show <select id="f-status">
      <option value="">Every comic</option><option value="judged">Passed every gate</option><option value="gated">Gated</option>
      <option value="disagree">Comics I disagreed with</option><option value="split">Judges disagree (±2)</option></select></label>
    <label for="f-sort">Order <select id="f-sort">
      <option value="case">By pull request</option><option value="delta">Biggest arm difference first</option><option value="low">Lowest score first</option><option value="high">Highest score first</option></select></label>
    <label for="f-q">Find <input id="f-q" type="search" placeholder="case, name, layout" size="16"></label>
    <span style="flex:1"></span>
    <button id="v-pr" aria-pressed="true" type="button">PR width · 760</button>
    <button id="v-phone" aria-pressed="false" type="button">Phone · 360</button>
    <button id="export" type="button">Export notes</button>
    <span class="saved" id="store"></span>
  </div>
  <section id="comics"></section>
</div>
<dialog id="zoom" aria-label="Comic at full size"><img alt="" id="zoomimg"></dialog>

<script>
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const f1 = (n) => (n == null || Number.isNaN(n) ? 'n/a' : Number(n).toFixed(1));
  const f2 = (n) => (n == null || Number.isNaN(n) ? 'n/a' : Number(n).toFixed(2));
  let D = null;
  const notes = {};            // key -> { marks: {criterion: 'agree'|'disagree'}, text, at }
  let store = null;            // artifact database, when published
  const LS = 'comicbench-notes-v1';
  const local = { load() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } },
                  save() { try { localStorage.setItem(LS, JSON.stringify(notes)); } catch {} } };

  function setStore(msg) { $('#store').textContent = msg; }

  async function connectStore() {
    Object.assign(notes, local.load());
    setStore('Notes saved in this browser');
    // Inside the artifact viewer a page can't hand out files; notes go to its database instead.
    if (window.claude) $('#export').hidden = true;
    if (!window.claude || !window.claude.use) return;
    try {
      const db = await window.claude.use('db');
      if (!db) return;
      store = db.collection('notes');
      const timer = setTimeout(() => setStore('Notes saved in this browser (shared notes did not load)'), 10000);
      store.onSnapshot((snap) => {
        clearTimeout(timer);
        for (const d of snap.docs) { const v = d.data(); if (v) notes[v.key || d.id] = v; }
        setStore('Notes saved to this page for Claude to read');
        render();
      }, () => { clearTimeout(timer); store = null; setStore('Notes saved in this browser (shared notes unavailable)'); });
      $('#export').hidden = true;
    } catch { store = null; }
  }

  const pending = new Map();
  function saveNote(key) {
    const n = notes[key];
    n.at = new Date().toISOString();
    local.save();
    if (!store) return;
    clearTimeout(pending.get(key));
    pending.set(key, setTimeout(() => {
      store.doc(key).set({ key, marks: n.marks || {}, text: n.text || '', at: n.at }).catch(() => setStore('Could not save to the page; kept in this browser'));
    }, 600));
  }

  function pips(score) {
    if (score == null) return '<span class="chip plain">no score</span>';
    let h = '<span class="pips" aria-label="' + score + ' of 5">';
    for (let i = 1; i <= 5; i++) h += '<span class="pip' + (i <= score ? ' on' + (score <= 2 ? ' low' : '') : '') + '"></span>';
    return h + '</span>';
  }
  const gateChip = (name, pass, reason) =>
    '<span class="chip ' + (pass == null ? 'plain' : pass ? 'ok' : 'bad') + '" title="' + esc(reason || '') + '">' + (pass == null ? '·' : pass ? '✓' : '✗') + ' ' + esc(name) + '</span>';

  function armById(id) { return D.arms.find((a) => a.arm === id); }

  function calBadge(arm, id) {
    const control = D.controlFor[id];
    if (!control) return '<span class="chip plain" title="No calibration control covers this criterion">no control</span>';
    // Both arms share one set of judges, so a calibration run on either arm speaks for both.
    const cal = arm.calibration || (D.arms.find((a) => a.calibration) || {}).calibration;
    const c = cal && cal[control];
    if (!c) return '<span class="chip plain" title="Calibration not run">not run</span>';
    return '<span class="chip ' + (c.pass ? 'ok' : 'bad') + '" title="' + esc(control + ': ' + c.expect) + '">' + (c.pass ? 'calibrated' : 'uncalibrated') + ' ' + c.hits + '/' + c.of + '</span>';
  }

  function summary() {
    const rows = D.arms.map((a) => {
      const r = a.report || {};
      const m = a.manifest;
      const judged = a.comics.filter((c) => c.status === 'judged').length;
      const gated = a.comics.filter((c) => c.status === 'gated').length;
      return '<article class="arm inked"><h3>' + esc(a.arm) + '</h3>' +
        '<div class="big">' + f1(r.headline) + ' <small style="font:600 .85rem var(--body);color:var(--muted)">headline</small></div>' +
        '<dl class="kv">' +
        '<dt>Comic score</dt><dd>' + f1(r.comicMean) + ' [' + f1(r.comicCI && r.comicCI[0]) + ', ' + f1(r.comicCI && r.comicCI[1]) + ']</dd>' +
        '<dt>Variety (set)</dt><dd>' + f1(r.set) + '</dd>' +
        '<dt>Comics</dt><dd>' + a.comics.length + ' (' + judged + ' passed every gate, ' + gated + ' gated)</dd>' +
        '<dt>First draft clean</dt><dd>' + a.author.firstClean + ' / ' + a.author.comics + ', ' + f2(a.author.meanTries) + ' check runs each</dd>' +
        '<dt>Author</dt><dd>' + esc(m.author) + ' · ' + esc(m.model) + '</dd>' +
        '<dt>Genre · rubric</dt><dd>' + esc(m.genre) + ' · v' + esc(m.rubricVersion) + '</dd>' +
        '<dt>Skill hash</dt><dd><code>' + esc(m.skillHash) + '</code></dd>' +
        '</dl></article>';
    }).join('');
    let delta = '';
    const c = D.comparison;
    if (c) delta = '<div class="delta inked"><b>' + esc(c.b.round) + ' minus ' + esc(c.a.round) + '</b> over ' + c.cases + ' shared pull requests: <b>' + f1(c.delta.mean) + '</b> points [' + f1(c.delta.ci[0]) + ', ' + f1(c.delta.ci[1]) + '] (95% interval, resampling whole cases). Higher on ' + c.delta.wins + ', lower on ' + c.delta.losses + ', tied ' + c.delta.ties + '. An interval that spans 0 means no measurable difference.</div>';
    $('#summary').innerHTML = '<h2>The round</h2><div class="arms">' + rows + '</div>' + delta;
  }

  function criteria() {
    const head = '<tr><th>Criterion</th><th>Weight</th><th>Judge</th>' + D.arms.map((a) => '<th>' + esc(a.arm) + ' mean</th>').join('') + '<th>Calibration</th><th>2nd judge α</th><th>Same judge α</th></tr>';
    const rel = D.arms.find((a) => a.reliability);
    const body = D.criteria.map((c) => {
      const means = D.arms.map((a) => {
        const xs = a.comics.map((x) => x.judge && x.judge.scores[c.id] && x.judge.scores[c.id].score).filter((v) => v != null);
        return '<td class="num">' + (xs.length ? (xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(2) : 'n/a') + '</td>';
      }).join('');
      const a2 = rel ? f2(rel.reliability.second.criteria[c.id].alpha) : '—';
      const ar = rel ? f2(rel.reliability.repeat.criteria[c.id].alpha) : '—';
      return '<tr><td><b>' + esc(c.name) + '</b><div class="legend">' + esc(c.question) + '</div></td><td class="num">' + c.weight + '</td><td>' + esc(c.stage) + '</td>' + means +
        '<td>' + D.arms.map((a) => calBadge(a, c.id)).join(' ') + '</td><td class="num">' + a2 + '</td><td class="num">' + ar + '</td></tr>';
    }).join('');
    const gates = D.gates.map((g) => {
      const fails = D.arms.map((a) => '<td class="num">' + a.comics.filter((x) => x.gates && x.gates[g.id] === false).length + ' failed</td>').join('');
      return '<tr><td><b>' + esc(g.id) + '</b> <span class="chip plain">gate</span><div class="legend">' + esc(g.question) + '</div></td><td class="num">0 if failed</td><td></td>' + fails + '<td>' + D.arms.map((a) => calBadge(a, g.id)).join(' ') + '</td><td></td><td></td></tr>';
    }).join('');
    const relNote = rel ? '<p class="legend">Second judge: <b>' + esc(rel.reliability.model2) + '</b> re-judged ' + rel.reliability.second.pairs + ' comics; the same judge re-ran on ' + rel.reliability.repeat.pairs + '. α is Krippendorff\'s alpha (ordinal): 1 is perfect agreement, 0 is chance, and below about 0.67 the scores are too noisy to rank small differences.</p>' : '<p class="legend">The second judge has not run on this round yet.</p>';
    $('#criteria').innerHTML = '<h2>How the judges scored</h2><p class="legend">Each criterion is scored 1 to 5 against written anchors; a competent comic scores 3, and a 4 or 5 must name its strength. A failed gate scores the comic 0. Calibration: the judges saw deliberately broken copies of comics (a flat punchline, a joke about another PR, a wrong fact, tiny lettering, a photo-real render) and had to rank the original higher at least 80% of the time.</p><div class="scroll inked" style="padding:6px 8px"><table><thead>' + head + '</thead><tbody>' + body + gates + '</tbody></table></div>' + relNote;
  }

  function variety() {
    const thumbs = (arm, ids) => ids.map((id) => {
      const [cs, n] = id.split('#');
      const x = arm.comics.find((c) => c.case === cs && String(c.sample) === n);
      return x && x.img ? '<a href="#' + esc(x.key) + '"><img src="' + esc(x.img) + '" alt="' + esc(id) + '" loading="lazy"></a><span class="lbl">' + esc(id) + '</span>' : '<span class="lbl">' + esc(id) + '</span>';
    }).join('');
    const blocks = D.arms.map((a) => {
      const s = a.set;
      const scores = s ? D.setCriteria.map((c) => '<div class="c" style="grid-template-columns:130px 92px 1fr"><div class="n">' + esc(c.id) + '</div><div>' + pips(s.scores[c.id] && s.scores[c.id].score) + '</div><div class="r">' + esc(s.scores[c.id] && s.scores[c.id].reason) + '</div></div>').join('') : '<p class="empty">The set judge has not run yet.</p>';
      const multi = s ? s.clusters.filter((c) => c.length > 1) : [];
      const split = s && s.split ? '<p>' + s.split.withinCase + ' pull requests got the same joke twice; ' + s.split.acrossCase + ' premises repeat across different pull requests.</p>' : '';
      const names = a.variety.reusedNames.length ? '<p><b>Names used in more than one pull request:</b> ' + a.variety.reusedNames.slice(0, 12).map((n) => esc(n.name) + ' (' + n.cases.length + ')').join(', ') + '</p>' : '<p><b>Names:</b> no character name appears in two pull requests.</p>';
      const layouts = '<p><b>Layouts:</b> ' + Object.entries(a.variety.layouts).sort((x, y) => y[1] - x[1]).map(([k, v]) => esc(k) + ' ' + v).join(', ') + '</p>';
      return '<article class="arm inked"><h3>' + esc(a.arm) + '</h3><div class="crit">' + scores + '</div>' + split + names + layouts +
        (multi.length ? '<details><summary>Repeated premises (' + multi.length + ' groups)</summary><div class="clusters">' + multi.map((c) => '<div class="cluster">' + thumbs(a, c) + '</div>').join('') + '</div></details>' : '') + '</article>';
    }).join('');
    $('#variety').innerHTML = '<h2>Variety</h2><p class="legend">The set judge reads every script of an arm and groups comics that tell the same joke. Within a pull request, two samples should differ; across pull requests, premises and casts should not repeat.</p><div class="arms">' + blocks + '</div>';
  }

  function critique(key, crit) {
    const n = notes[key] && notes[key].marks && notes[key].marks[crit];
    return '<div class="critique" data-key="' + esc(key) + '" data-crit="' + esc(crit) + '">Your read: ' +
      '<button type="button" data-v="agree" aria-pressed="' + (n === 'agree') + '">Agree</button>' +
      '<button type="button" data-v="disagree" aria-pressed="' + (n === 'disagree') + '">Disagree</button></div>';
  }

  function card(x) {
    const crit = D.criteria.map((c) => {
      const s = x.judge && x.judge.scores[c.id];
      const alt = [];
      if (x.second && x.second.scores[c.id] != null) alt.push('2nd judge: ' + x.second.scores[c.id] + (x.second.reasons[c.id] ? ' — ' + x.second.reasons[c.id] : ''));
      if (x.repeat && x.repeat[c.id] != null) alt.push('same judge again: ' + x.repeat[c.id]);
      return '<div class="c"><div class="n">' + esc(c.name) + '<small>' + c.weight + ' pts · ' + esc(c.stage) + '</small></div><div>' + pips(s && s.score) + '</div><div class="r">' + esc(s && s.reason) +
        (alt.length ? '<div class="alt">' + alt.map(esc).join('<br>') + '</div>' : '') + '</div>' + critique(x.key, c.id) + '</div>';
    }).join('');
    const g = x.gates || {};
    const jr = x.judge ? x.judge.gates : {};
    const gates = '<div class="gates">' +
      gateChip('factual', g.factualIntegrity, jr.factualIntegrity && jr.factualIntegrity.reason) +
      gateChip('phone', g.phoneLegibility, x.phone && x.phone.missing.length ? 'Unreadable at 360 px: ' + x.phone.missing.join(' | ') : 'Every required word read at 360 px') +
      gateChip('punch up', g.punchUp, jr.punchUp && jr.punchUp.reason) +
      gateChip('valid script', g.outputContract, x.author.finalCheck) + '</div>';
    const gateReasons = ['factualIntegrity', 'punchUp'].filter((k) => jr[k] && jr[k].reason).map((k) => '<li><b>' + esc(k) + ':</b> ' + esc(jr[k].reason) + critique(x.key, k).replace('class="critique"', 'class="critique" style="display:inline-flex;margin-left:6px"') + '</li>').join('');
    const m = x.comic;
    const meta = m ? '<div class="meta"><span class="chip plain">' + esc(m.layout) + ' · ' + m.panels + ' panels</span><span class="chip plain">' + esc(m.style) + '</span>' + m.cast.map((n) => '<span class="chip plain">' + esc(n) + '</span>').join('') + '</div>' : '';
    const phone = x.phone ? '<details><summary>What the phone reader could read (' + x.phone.items.length + ' items' + (x.phone.missing.length ? ', ' + x.phone.missing.length + ' required lines missed' : '') + ')</summary><ul class="tight phone">' +
      x.phone.items.map((i) => '<li>' + (i.panel != null ? 'Panel ' + esc(i.panel) + ': ' : '') + '“' + esc(i.words) + '” <span class="chip ' + (i.legible === 'yes' ? 'ok' : i.legible === 'partly' ? 'warn' : 'bad') + '">' + esc(i.legible) + '</span></li>').join('') +
      x.phone.missing.map((t) => '<li class="missing">Missed: “' + esc(t) + '”</li>').join('') + '</ul></details>' : '';
    const checks = x.author.checks;
    const author = '<details><summary>How the author got there (' + (checks.length || 'no') + ' check run' + (checks.length === 1 ? '' : 's') + ')</summary>' +
      (x.author.concepts.length ? '<p><b>Concepts it weighed</b></p><ul class="tight">' + x.author.concepts.map((c) => '<li><b>' + esc(c.id) + ':</b> ' + esc(c.punchline) + (c.layout ? ' <span class="legend">(' + esc(c.layout) + ')</span>' : '') + '</li>').join('') + '</ul>' : '') +
      (x.author.chosen ? '<p><b>Chose:</b> ' + esc(typeof x.author.chosen === 'string' ? x.author.chosen : JSON.stringify(x.author.chosen)) + (x.author.reason ? ' — ' + esc(x.author.reason) : '') + '</p>' : '') +
      checks.map((c, i) => '<p><b>Check ' + (i + 1) + '</b> <span class="chip ' + (c.clean ? 'ok' : 'warn') + '">' + (c.clean ? 'clean' : 'problems') + '</span></p><pre>' + esc(c.output) + '</pre>').join('') +
      '<p><b>Runner\'s final check:</b> ' + esc(x.author.finalCheck || 'not run') + '</p>' +
      (x.recent.length ? '<p class="legend">It saw these earlier comics as recent: ' + x.recent.map(esc).join(', ') + '</p>' : '<p class="legend">It saw no earlier comics.</p>') + '</details>';
    const n = notes[x.key] || {};
    const img = x.img ? '<img class="comicimg" src="' + esc(x.img) + '" alt="' + esc(m ? m.altText || m.title : x.key) + '" loading="lazy" data-zoom>' : '<div class="noimg">' + (x.status === 'gated' && !x.img ? 'Not drawn: the script failed the check' : 'No image yet') + '</div>';
    return '<article class="card inked" id="' + esc(x.key) + '"><div class="cardtop"><div><div class="who">' + esc(x.arm) + ' · sample ' + x.sample + '</div>' +
      (m && m.title ? '<h3>' + esc(m.title) + '</h3>' : '') + '</div><div class="score">' + (x.total == null ? '—' : x.total.toFixed(0)) + '<small> / 100</small></div></div>' +
      img + meta + gates +
      (x.judge ? '<div class="said"><b>The cold reader saw:</b> ' + esc(x.judge.observation) + '<br><b>The joke, in its words:</b> ' + esc(x.judge.joke) + '</div>' : '') +
      '<div class="crit">' + crit + '</div>' +
      (gateReasons ? '<details open><summary>Gate reasons</summary><ul class="tight">' + gateReasons + '</ul></details>' : '') +
      phone + author +
      '<div class="notes"><label for="note-' + esc(x.key) + '"><b>Your note</b> <span class="legend">what the judges got wrong, or what the comic needs</span></label><textarea id="note-' + esc(x.key) + '" data-note="' + esc(x.key) + '">' + esc(n.text || '') + '</textarea></div>' +
      '</article>';
  }

  function visibleComics() {
    const arm = $('#f-arm').value, st = $('#f-status').value, q = $('#f-q').value.trim().toLowerCase();
    let xs = D.arms.flatMap((a) => a.comics).filter((x) => !arm || x.arm === arm);
    if (st === 'judged' || st === 'gated') xs = xs.filter((x) => x.status === st);
    if (st === 'disagree') xs = xs.filter((x) => notes[x.key] && Object.values(notes[x.key].marks || {}).includes('disagree'));
    if (st === 'split') xs = xs.filter((x) => x.second && x.judge && D.criteria.some((c) => x.second.scores[c.id] != null && x.judge.scores[c.id].score != null && Math.abs(x.second.scores[c.id] - x.judge.scores[c.id].score) >= 2));
    if (q) xs = xs.filter((x) => (x.case + ' ' + (D.cases[x.case] || {}).title + ' ' + (x.comic ? x.comic.cast.join(' ') + ' ' + x.comic.layout + ' ' + x.comic.title : '')).toLowerCase().includes(q));
    return xs;
  }

  function comics() {
    const xs = visibleComics();
    const sort = $('#f-sort').value;
    const byCase = new Map();
    for (const x of xs) byCase.set(x.case, [...(byCase.get(x.case) || []), x]);
    let order = [...byCase.keys()].sort();
    const mean = (cs, arm) => { const v = cs.filter((x) => x.arm === arm && x.total != null).map((x) => x.total); return v.length ? v.reduce((s, y) => s + y, 0) / v.length : null; };
    if (sort === 'low' || sort === 'high') {
      const s = (k) => Math.min(...byCase.get(k).map((x) => x.total == null ? 999 : x.total));
      order.sort((a, b) => sort === 'low' ? s(a) - s(b) : s(b) - s(a));
    } else if (sort === 'delta' && D.arms.length > 1) {
      const d = (k) => { const a = mean(byCase.get(k), D.arms[0].arm), b = mean(byCase.get(k), D.arms[1].arm); return a == null || b == null ? -1 : Math.abs(a - b); };
      order.sort((a, b) => d(b) - d(a));
    }
    $('#comics').innerHTML = '<h2>The comics (' + xs.length + ')</h2>' + (order.length ? order.map((k) => {
      const info = D.cases[k] || {};
      const cs = byCase.get(k).sort((a, b) => a.sample - b.sample || a.arm.localeCompare(b.arm));
      const means = D.arms.map((a) => { const m = mean(cs, a.arm); return m == null ? '' : '<span class="chip plain">' + esc(a.arm) + ' ' + m.toFixed(0) + '</span>'; }).join(' ');
      return '<section class="case"><div class="casehead"><h3>' + esc(info.title || k) + '</h3><span class="src">' + esc(k) + '</span>' + means + '</div>' +
        '<details class="casebody"><summary>What the pull request changed (the evidence the judges had)</summary><pre>' + esc(info.brief || '') + '</pre><pre>' + esc(info.description || '') + '</pre></details>' +
        '<div class="row">' + cs.map(card).join('') + '</div></section>';
    }).join('') : '<p class="empty">No comics match these filters.</p>');
  }

  function render() {
    if (!D) return;
    const y = window.scrollY;
    comics();
    window.scrollTo(0, y);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('.critique button');
    if (b) {
      const box = b.closest('.critique'), key = box.dataset.key, crit = box.dataset.crit, v = b.dataset.v;
      notes[key] = notes[key] || { marks: {}, text: '' };
      notes[key].marks = notes[key].marks || {};
      notes[key].marks[crit] = notes[key].marks[crit] === v ? undefined : v;
      if (!notes[key].marks[crit]) delete notes[key].marks[crit];
      box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(notes[key].marks[crit] === x.dataset.v)));
      saveNote(key);
      return;
    }
    const z = e.target.closest('[data-zoom]');
    if (z) { $('#zoomimg').src = z.src; $('#zoomimg').alt = z.alt; $('#zoom').showModal(); return; }
    if (e.target.id === 'zoom' || e.target.id === 'zoomimg') $('#zoom').close();
  });
  document.addEventListener('input', (e) => {
    const t = e.target.closest('[data-note]');
    if (!t) return;
    const key = t.dataset.note;
    notes[key] = notes[key] || { marks: {}, text: '' };
    notes[key].text = t.value;
    saveNote(key);
  });
  ['#f-arm', '#f-status', '#f-sort', '#f-q'].forEach((s) => $(s).addEventListener('input', render));
  $('#v-pr').addEventListener('click', () => { document.body.classList.remove('phone'); $('#v-pr').setAttribute('aria-pressed', 'true'); $('#v-phone').setAttribute('aria-pressed', 'false'); });
  $('#v-phone').addEventListener('click', () => { document.body.classList.add('phone'); $('#v-phone').setAttribute('aria-pressed', 'true'); $('#v-pr').setAttribute('aria-pressed', 'false'); });
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'notes.json'; a.click();
  });

  fetch('data.json').then((r) => r.json()).then((data) => {
    D = data;
    for (const a of D.arms) { const o = document.createElement('option'); o.value = a.arm; o.textContent = a.arm; $('#f-arm').appendChild(o); }
    const total = D.arms.reduce((s, a) => s + a.comics.length, 0);
    $('#lede').textContent = D.arms.map((a) => a.arm).join(' vs ') + ' · ' + total + ' comics · rubric v' + D.rubricVersion + ' · built ' + D.builtAt.slice(0, 16).replace('T', ' ') + ' UTC. Every score below comes with the judge\'s own reason; mark the ones you disagree with.';
    summary(); criteria(); variety(); comics();
    connectStore();
  }).catch(() => { $('#lede').textContent = 'Could not load data.json. Open this page through a local web server (for example: bunx serve) or from its published link.'; });
})();
</script>
`;
