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
import { ARENA_CRITERIA } from './arena.ts';
import { BEAT_CHOICES, CONFLICT_KINDS, FRAME_FEATURES, MEDIUM_ITEMS, REPRESENTATION_ITEMS } from './checklist.ts';

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
      respect: blind?.respect ?? null,
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
  const checkpoint = readJson(join(round, 'script-report.json'));
  const progress = readJson(join(round, 'progress.json')) ?? checkpoint?.states ?? [];
  const states = new Map<string, { status: string; error?: string }>(
    progress.map((s: any) => [`${s.case}#${s.sample}`, s]),
  );
  const comics: any[] = [];
  const root = join(round, 'comics');
  const imgDir = join(out, 'img', arm);
  mkdirSync(imgDir, { recursive: true });
  for (const cid of existsSync(root) ? readdirSync(root).sort() : [])
    for (const n of readdirSync(join(root, cid)).sort()) {
      const dir = join(root, cid, n);
      const judgment = readJson<ComicJudgment & { phoneMissing?: string[]; phoneDiagnosticError?: string; note?: string }>(join(round, 'judgments', cid, `${n}.json`));
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
      const state = states.get(`${cid}#${n}`);
      const status = !judgment ? state?.status ?? (existsSync(join(dir, 'art')) ? 'in progress' : 'not judged') : Object.values(judgment.gates).every(Boolean) ? 'judged' : 'gated';
      comics.push({
        key: `${arm}--${cid}--${n}`,
        arm,
        case: cid,
        sample: Number(n),
        imagePrompt: existsSync(join(dir, 'art', 'prompt.txt')) ? readFileSync(join(dir, 'art', 'prompt.txt'), 'utf8').slice(0, 20000) : null,
        misread: existsSync(join(dir, 'art', 'misread.json')) ? JSON.parse(readFileSync(join(dir, 'art', 'misread.json'), 'utf8')) : null,
        // Round 14 on: the brainstorm (pitches, gags with their scores, the pick).
        brainstorm: (() => {
          const ctx = existsSync(join(dir, 'packet', 'context.json')) ? JSON.parse(readFileSync(join(dir, 'packet', 'context.json'), 'utf8')) : undefined;
          const option = ctx?.genreOptions?.[0];
          if (!option?.pitches?.length) return null;
          const gags = existsSync(join(dir, 'packet', 'comic-gags.json')) ? JSON.parse(readFileSync(join(dir, 'packet', 'comic-gags.json'), 'utf8')).gags : [];
          return { pitches: option.pitches.map((p: any) => ({ id: p.id, label: p.label, premise: p.premise })), gags, memes: Object.fromEntries((option.memeList ?? []).map((m: any) => [m.id, m.name + ' (' + m.series + ')'])), pick: option.pick ? { gag: option.pick.gag.id, scores: option.pick.scores, judged: option.pick.judged, anchor: option.pick.anchor, recovered: option.pick.recovered } : null, layout: option.assignedLayout ?? null };
        })(),
        status,
        total: judgment ? comicScore(judgment) : null,
        gates: judgment?.gates ?? null,
        note: judgment?.note ?? state?.error ?? null,
        judge: primary ?? null,
        second: second ? { scores: Object.fromEntries(Object.entries(second.scores).map(([k, v]: [string, any]) => [k, v.score])), reasons: Object.fromEntries(Object.entries(second.scores).map(([k, v]: [string, any]) => [k, v.reason])), gates: Object.fromEntries(Object.entries(second.gates).map(([k, v]: [string, any]) => [k, v?.pass ?? null])) } : null,
        repeat: repeat ? Object.fromEntries(Object.entries(repeat.scores).map(([k, v]: [string, any]) => [k, v.score])) : null,
        phone: phone ? { items: phone.items ?? [], unreadable: phone.unreadable ?? [], missing: judgment?.phoneMissing ?? [] } : null,
        phoneDiagnostic: !!checkpoint,
        phoneDiagnosticError: judgment?.phoneDiagnosticError ?? null,
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
          chosen: design?.chosen ?? design?.selected ?? design?.choice ?? design?.pick ?? null,
          concepts: (Array.isArray(design?.concepts) ? design.concepts : []).map((c: any) => ({
            id: c?.id ?? c?.title ?? '', punchline: c?.punchline ?? '', jokeShape: c?.jokeShape ?? '', layout: c?.layout ?? '',
            beats: Array.isArray(c?.beats) ? c.beats : [],
          })),
          reason: design?.why ?? design?.reason ?? design?.choiceReason ?? design?.selectionReason ?? '',
        },
        recent: readJson<string[]>(join(dir, 'recent.json')) ?? [],
        checklist: readJson(join(dir, 'checklist.json')) ?? null,
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
  const labelFile = join(round, 'label.txt');
  return {
    arm,
    label: existsSync(labelFile) ? readFileSync(labelFile, 'utf8').trim() : '',
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
    checkpoint: checkpoint?.states?.length ?? null,
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
    checklist: readJson(join(round, 'checklist.json')) ?? null,
    reliability: reliability
      ? { model2: reliability.model2, second: reliability.secondJudge, repeat: reliability.repeat }
      : null,
    comics,
    caseInfo,
  };
}

export function buildReview(o: { round: string; compare?: string; rounds?: string[]; arenas?: string[]; scriptAudits?: string[]; out: string; tracetoon?: string }): string {
  mkdirSync(o.out, { recursive: true });
  const rounds = [o.round, ...(o.compare ? [o.compare] : []), ...(o.rounds ?? [])];
  const arms = rounds.map((r) => armData(r, o.out));
  let comparison: any = null;
  if (rounds.length >= 2 && existsSync(join(rounds[0]!, 'judgments')) && existsSync(join(rounds[1]!, 'judgments'))) {
    try {
      comparison = compareRounds(rounds[0]!, rounds[1]!);
    } catch {
      comparison = null;
    }
  }
  const arenas = (o.arenas ?? []).flatMap((d) => {
    const r = readJson(existsSync(join(d, 'arena.json')) ? join(d, 'arena.json') : d);
    return r ? [r] : [];
  });
  const scriptAudits = (o.scriptAudits ?? []).flatMap((d) => {
    const audit = readJson(existsSync(join(d, 'script-audit.json')) ? join(d, 'script-audit.json') : d);
    return audit ? [audit] : [];
  });
  const data = {
    arenas,
    scriptAudits,
    arenaCriteria: ARENA_CRITERIA.map(({ id, question }) => ({ id, question })),
    representationItems: REPRESENTATION_ITEMS,
    craft: { conflicts: CONFLICT_KINDS, frames: FRAME_FEATURES, beats: BEAT_CHOICES },
    mediumItems: MEDIUM_ITEMS.map(({ id, question }) => ({ id, question })),
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
  // A script, not JSON: browsers load <script src> from file:// but block fetch.
  writeFileSync(join(o.out, 'data.js'), `window.REVIEW_DATA = ${JSON.stringify(data).replace(/<\/(script)/gi, '<\\/$1')};\n`);
  let lockup = '';
  if (o.tracetoon && existsSync(join(o.tracetoon, 'plugin', 'assets', 'tracetoon.svg')))
    lockup = readFileSync(join(o.tracetoon, 'plugin', 'assets', 'tracetoon.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').replace(/<svg /, '<svg class="mark" aria-hidden="true" ');
  // A whole document, so it opens from disk; data.js beside it holds the data.
  const body = PAGE.replace('<!--MARK-->', lockup).replace('<div class="wrap">', '</head>\n<body>\n<div class="wrap">');
  writeFileSync(
    join(o.out, 'index.html'),
    `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${body}</body>\n</html>\n`,
  );
  return o.out;
}

/** The page. Everything it shows comes from data.json beside it. */
const PAGE = String.raw`<title>Comicbench Round Review</title>
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
.armgroup { margin-top: 18px; border-top: 2px dashed var(--rule); padding-top: 10px }
.armhead { margin: 0; font-size: 1.05rem }
.armlabel { font: 500 .9rem var(--body); color: var(--muted); margin: 2px 0 6px }
.armrow { --card: 420px; margin-top: 8px }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card, 520px)), 1fr)); gap: 22px; margin-top: 14px; align-items: start }
.card { padding: 14px; min-width: 0; display: grid; gap: 12px }
.cardtop { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between }
.who { font: 700 .8rem var(--body); text-transform: uppercase; letter-spacing: .08em; color: var(--muted) }
.score { font: 400 2.2rem/1 var(--display); font-variant-numeric: tabular-nums }
.score small { font: 600 .8rem var(--body); color: var(--muted) }
.comicimg { display: block; width: 100%; max-width: 100%; height: auto; border: 2px solid var(--ink); border-radius: 3px; cursor: zoom-in; background: var(--rule) }
body.narrow .comicimg { width: 760px; max-width: 100% }
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

  <section id="arena-pairs"></section>
  <section id="checklist"></section>
  <section id="script-audits"></section>
  <section id="summary"></section>
  <section id="criteria"></section>
  <section id="variety"></section>

  <div class="toolbar" role="toolbar" aria-label="Filter comics">
    <label for="f-arm">Arm <select id="f-arm"><option value="">All</option></select></label>
    <label for="f-status">Show <select id="f-status">
      <option value="">Every comic</option><option value="judged">Passed every gate</option><option value="gated">Gated</option><option value="checked">Checked script</option><option value="error">Error</option>
      <option value="disagree">Comics I disagreed with</option><option value="split">Judges disagree (±2)</option></select></label>
    <label for="f-sort">Order <select id="f-sort">
      <option value="case">By pull request</option><option value="delta">Biggest arm difference first</option><option value="low">Lowest score first</option><option value="high">Highest score first</option></select></label>
    <label for="f-q">Find <input id="f-q" type="search" placeholder="case, name, layout" size="16"></label>
    <span style="flex:1"></span>
    <button id="v-pr" aria-pressed="true" type="button">Full width</button>
    <button id="v-phone" aria-pressed="false" type="button">PR column · 760</button>
    <button id="export" type="button">Export notes</button>
    <button id="import" type="button">Import notes</button>
    <input id="import-file" type="file" accept="application/json,.json" hidden>
    <span class="saved" id="store"></span>
  </div>
  <section id="comics"></section>
</div>
<dialog id="zoom" aria-label="Comic at full size"><img alt="" id="zoomimg"></dialog>

<script src="data.js"></script>
<script>
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const f1 = (n) => (n == null || Number.isNaN(n) ? 'n/a' : Number(n).toFixed(1));
  const f2 = (n) => (n == null || Number.isNaN(n) ? 'n/a' : Number(n).toFixed(2));
  let D = null;
  const notes = {};            // key -> { marks: {criterion: 'agree'|'disagree'}, text, at }
  // Notes live in this browser's storage (per file, so a rebuilt page in the
  // same folder keeps them); Export and Import move them as notes.json.
  const LS = 'comicbench-notes-v1';
  let storageOk = true;
  const local = { load() { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { storageOk = false; return {}; } },
                  save() { try { localStorage.setItem(LS, JSON.stringify(notes)); } catch { storageOk = false; } } };

  function setStore(msg) { $('#store').textContent = msg; }

  function connectStore() {
    Object.assign(notes, local.load());
    setStore(storageOk ? 'Notes are kept in this browser; export them to share' : 'This browser blocks storage here: export your notes before closing');
  }

  function saveNote(key) {
    notes[key].at = new Date().toISOString();
    local.save();
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
  function armLabel(id) { const a = armById(id); return a && a.label ? ' <span class="armlabel">' + esc(a.label) + '</span>' : ''; }

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
      const checked = a.comics.filter((c) => c.status === 'checked').length;
      return '<article class="arm inked"><h3>' + esc(a.arm) + '</h3>' + (a.label ? '<p class="armlabel">' + esc(a.label) + '</p>' : '') +
        '<div class="big">' + f1(r.headline) + ' <small style="font:600 .85rem var(--body);color:var(--muted)">headline</small></div>' +
        '<dl class="kv">' +
        '<dt>Comic score</dt><dd>' + f1(r.comicMean) + ' [' + f1(r.comicCI && r.comicCI[0]) + ', ' + f1(r.comicCI && r.comicCI[1]) + ']</dd>' +
        '<dt>Variety (set)</dt><dd>' + f1(r.set) + '</dd>' +
        '<dt>Comics</dt><dd>' + a.comics.length + ' (' + judged + ' passed every gate, ' + gated + ' gated' + (checked ? ', ' + checked + ' checked scripts' : '') + ')</dd>' +
        (r.respect ? '<dt>Respect gate</dt><dd>' + r.respect.failed + '/' + r.respect.assessed + ' failed · ' + r.respect.unassessed + '/' + r.respect.planned + ' unassessed</dd>' : '') +
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
    const relNote = rel ? '<p class="legend">Second judge: <b>' + esc(rel.reliability.model2) + '</b> re-judged ' + rel.reliability.second.pairs + ' comics; the same judge re-ran on ' + rel.reliability.repeat.pairs + '. α is Krippendorff\'s alpha (ordinal): 1 is perfect agreement, 0 is chance, and below about 0.67 the scores are too noisy to rank small differences.</p>' :
      D.arenas.some((a) => a.secondJudge) ? '<p class="legend">Second-model pair judgments appear under Head to head.</p>' : '';
    const calibration = D.arms.some((a) => a.calibration) ? ' Calibration compares original comics against deliberately weakened controls.' : '';
    $('#criteria').innerHTML = '<h2>How the judges scored</h2><p class="legend">Each criterion is scored 1 to 5 against written anchors. A competent comic scores 3, and a 4 or 5 must name its strength. A failed gate scores the comic 0.' + calibration + '</p><div class="scroll inked" style="padding:6px 8px"><table><thead>' + head + '</thead><tbody>' + body + gates + '</tbody></table></div>' + relNote;
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
      (x.phone && !x.phoneDiagnostic ? gateChip('phone', g.phoneLegibility, x.phone.missing.length ? 'Unreadable at 360 px: ' + x.phone.missing.join(' | ') : 'Every required word read at 360 px') : '') +
      gateChip('punch up', g.punchUp, jr.punchUp && jr.punchUp.reason) +
      (Object.hasOwn(g, 'respect') ? gateChip('respect', g.respect, jr.respect && jr.respect.reason) : '') +
      gateChip('valid script', g.outputContract, x.author.finalCheck) + '</div>';
    const gateReasons = ['factualIntegrity', 'punchUp', 'respect'].filter((k) => jr[k] && jr[k].reason).map((k) => '<li><b>' + esc(k) + ':</b> ' + esc(jr[k].reason) + critique(x.key, k).replace('class="critique"', 'class="critique" style="display:inline-flex;margin-left:6px"') + '</li>').join('');
    const m = x.comic;
    const meta = m ? '<div class="meta"><span class="chip plain">' + esc(m.layout) + ' · ' + m.panels + ' panels</span><span class="chip plain">' + esc(m.style) + '</span>' + m.cast.map((n) => '<span class="chip plain">' + esc(n) + '</span>').join('') + '</div>' : '';
    const phone = x.phone ? '<details><summary>What the phone reader could read (' + x.phone.items.length + ' items' + (x.phone.missing.length ? ', ' + x.phone.missing.length + ' required lines missed' : '') + ')</summary><ul class="tight phone">' +
      x.phone.items.map((i) => '<li>' + (i.panel != null ? 'Panel ' + esc(i.panel) + ': ' : '') + '“' + esc(i.words) + '” <span class="chip ' + (i.legible === 'yes' ? 'ok' : i.legible === 'partly' ? 'warn' : 'bad') + '">' + esc(i.legible) + '</span></li>').join('') +
      x.phone.missing.map((t) => '<li class="missing">Missed: “' + esc(t) + '”</li>').join('') + '</ul></details>' :
      (x.phoneDiagnosticError ? '<p class="legend">Phone diagnosis unavailable · ' + esc(x.phoneDiagnosticError) + '</p>' : '');
    const checks = x.author.checks;
    const author = '<details><summary>How the author got there (' + (checks.length || 'no') + ' check run' + (checks.length === 1 ? '' : 's') + ')</summary>' +
      (x.author.concepts.length ? '<p><b>Concepts it weighed</b></p><ul class="tight">' + x.author.concepts.map((c) => '<li><b>' + esc(c.id) + ':</b> ' + esc(c.punchline) + (c.layout ? ' <span class="legend">(' + esc(c.layout) + ')</span>' : '') +
        (c.beats.length ? '<ul>' + c.beats.map((beat) => '<li>' + esc(beat) + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>' : '') +
      (x.author.chosen ? '<p><b>Chose:</b> ' + esc(typeof x.author.chosen === 'string' ? x.author.chosen : JSON.stringify(x.author.chosen)) + (x.author.reason ? ' — ' + esc(x.author.reason) : '') + '</p>' : '') +
      checks.map((c, i) => '<p><b>Check ' + (i + 1) + '</b> <span class="chip ' + (c.clean ? 'ok' : 'warn') + '">' + (c.clean ? 'clean' : 'problems') + '</span></p><pre>' + esc(c.output) + '</pre>').join('') +
      '<p><b>Runner\'s final check:</b> ' + esc(x.author.finalCheck || 'not run') + '</p>' +
      (x.recent.length ? '<p class="legend">It saw these earlier comics as recent: ' + x.recent.map(esc).join(', ') + '</p>' : '<p class="legend">It saw no earlier comics.</p>') + '</details>';
    const n = notes[x.key] || {};
    const img = x.img ? '<img class="comicimg" src="' + esc(x.img) + '" alt="' + esc(m ? m.altText || m.title : x.key) + '" loading="lazy" data-zoom>' : '<div class="noimg">' +
      (x.status === 'checked' ? 'Checked script' : x.status === 'gated' ? 'Script failed the check' : x.status === 'error' ? 'Run error' : 'No image yet') + '</div>';
    return '<article class="card inked" id="' + esc(x.key) + '"><div class="cardtop"><div><div class="who">' + esc(x.arm) + ' · sample ' + x.sample + '</div>' +
      (m && m.title ? '<h3>' + esc(m.title) + '</h3>' : '') + '</div><div class="score">' + (x.total == null ? '—' : x.total.toFixed(0)) + '<small> / 100</small></div></div>' +
      img + meta + (m?.synopsis ? '<p class="legend">' + esc(m.synopsis) + '</p>' : '') + checkChips(x.checklist) + gates +
      (x.note ? '<p class="legend">' + esc(x.note) + '</p>' : '') +
      (x.judge ? '<div class="said"><b>The cold reader saw:</b> ' + esc(x.judge.observation) + '<br><b>The joke, in its words:</b> ' + esc(x.judge.joke) + '</div>' : '') +
      '<div class="crit">' + crit + '</div>' +
      (gateReasons ? '<details open><summary>Gate reasons</summary><ul class="tight">' + gateReasons + '</ul></details>' : '') +
      phone + author +
      (x.imagePrompt ? '<details><summary>Image prompt (exactly what the image model was sent)</summary><pre>' + esc(x.imagePrompt) + '</pre></details>' : '') +
      (x.brainstorm ? '<details><summary>Brainstorm (' + x.brainstorm.gags.length + ' gags' + (x.brainstorm.pick ? ', picked ' + esc(x.brainstorm.pick.gag) + (x.brainstorm.pick.judged ? (x.brainstorm.pick.recovered ? ', PR link recovered' : ', PR link NOT recovered') : '') : '') + (x.brainstorm.layout ? ', layout ' + esc(x.brainstorm.layout) : '') + ')</summary>' +
        (x.brainstorm.pick && x.brainstorm.pick.anchor ? '<p><b>Anchor:</b> ' + esc(x.brainstorm.pick.anchor.change) + ' (' + x.brainstorm.pick.anchor.terms.map(esc).join(', ') + ')</p>' : '') +
        '<ul class="tight">' + x.brainstorm.pitches.map((p) => '<li><b>' + esc(p.id) + ' · ' + esc(p.label) + ':</b> ' + esc(p.premise) + '</li>').join('') + '</ul>' +
        '<ul class="tight">' + x.brainstorm.gags.map((g) => {
          const sc = x.brainstorm.pick ? (x.brainstorm.pick.scores || []).find((s) => s.gag === g.id) : null;
          const jd = x.brainstorm.pick ? (x.brainstorm.pick.judged || []).find((j) => j.gag === g.id) : null;
          const picked = x.brainstorm.pick && x.brainstorm.pick.gag === g.id;
          return '<li>' + (picked ? '<b>★ ' : '<b>') + esc(g.id) + '</b> (' + esc(g.pitch) + (sc ? ', score ' + sc.total + ': PR ' + sc.aboutPr + ', funny ' + sc.funny + ', veteran ' + sc.veteranAppeal + ', visual ' + sc.visual : '') + (jd ? ', rank ' + jd.rank + ', ' + (jd.matched ? '✓' : '✗') : '') + '): ' + esc(g.gag) + (g.shows ? ' <i>Shows: ' + esc(g.shows) + '</i>' : '') + (jd ? ' <i>Judge read: ' + esc(jd.recovered) + '</i>' : '') + (g.meme ? ' <i>Meme: ' + esc(x.brainstorm.memes[g.meme] || g.meme) + ': ' + esc(g.memeUse || '') + '</i>' : '') + '</li>';
        }).join('') + '</ul></details>' : '') +
      (x.misread ? '<details><summary>Misread review (' + (x.misread.concern ? 'concern' : 'clear') + ', ' + x.misread.redraws + ' redraw' + (x.misread.redraws === 1 ? '' : 's') + ')</summary><ul class="tight">' +
        (x.misread.reviews || []).flatMap((r, i) => (r.items || []).map((it) => '<li><b>Review ' + (i + 1) + ', panel ' + esc(it.panel) + ' (' + esc(it.likelihood || 'likely') + '):</b> ' + esc(it.what) + ' could read as ' + esc(it.couldReadAs) + '</li>')).join('') +
        ((x.misread.reviews || []).every((r) => !(r.items || []).length) ? '<li>Nothing could be misread.</li>' : '') + '</ul></details>' : '') +
      '<div class="notes"><label for="note-' + esc(x.key) + '"><b>Your note</b> <span class="legend">what the judges got wrong, or what the comic needs</span></label><textarea id="note-' + esc(x.key) + '" data-note="' + esc(x.key) + '">' + esc(n.text || '') + '</textarea></div>' +
      '</article>';
  }

  function visibleComics() {
    const arm = $('#f-arm').value, st = $('#f-status').value, q = $('#f-q').value.trim().toLowerCase();
    let xs = D.arms.flatMap((a) => a.comics).filter((x) => !arm || x.arm === arm);
    if (['judged', 'gated', 'checked', 'error'].includes(st)) xs = xs.filter((x) => x.status === st);
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
      // One row per arm, in the page's arm order, with that arm's samples side by side.
      const armOrder = D.arms.map((a) => a.arm);
      const cs = byCase.get(k).sort((a, b) => armOrder.indexOf(a.arm) - armOrder.indexOf(b.arm) || a.sample - b.sample);
      const byArm = armOrder.map((arm) => cs.filter((x) => x.arm === arm)).filter((g) => g.length);
      const means = D.arms.map((a) => { const m = mean(cs, a.arm); return m == null ? '' : '<span class="chip plain">' + esc(a.arm) + ' ' + m.toFixed(0) + '</span>'; }).join(' ');
      return '<section class="case"><div class="casehead"><h3>' + esc(info.title || k) + '</h3><span class="src">' + esc(k) + '</span>' + means + '</div>' +
        '<details class="casebody"><summary>What the pull request changed (the evidence the judges had)</summary><pre>' + esc(info.brief || '') + '</pre><pre>' + esc(info.description || '') + '</pre></details>' +
        byArm.map((g) => '<div class="armgroup"><h4 class="armhead">' + esc(g[0].arm) + armLabel(g[0].arm) + '</h4><div class="row armrow">' + g.map(card).join('') + '</div></div>').join('') + '</section>';
    }).join('') : '<p class="empty">No comics match these filters.</p>');
  }

  function checkChips(cl) {
    if (!cl) return '';
    const yes = D.mediumItems.filter((m) => cl[m.id] && cl[m.id].yes);
    const evidence = ['authoredRepresentation', 'publishedRepresentation'].flatMap((source) => {
      if (!cl[source]) return [];
      const label = source === 'authoredRepresentation' ? 'Script' : 'Page';
      return D.representationItems.filter((m) => cl[source][m.id]?.yes).map((m) =>
        '<li>' + label + ' · ' + esc(m.label) + ' · ' + esc(cl[source][m.id].evidence) + '</li>');
    });
    const observation = (label, ob) => ob ? '<li>' + esc(label) + ' · ' + esc(ob.state === 'supportsBeat' ? 'supports the beat' : ob.state) + ' · ' + esc(ob.evidence) + '</li>' : '';
    if (cl.castAppearance?.yes) evidence.push('<li>Visible cast variation · ' + esc(cl.castAppearance.evidence) + '</li>');
    if (cl.castContrast) evidence.push(observation('Human-to-human contrast', cl.castContrast.humanToHuman), observation('Human-to-alien contrast', cl.castContrast.humanToAlien));
    const craft = [];
    if (cl.spaceConflict) {
      craft.push(observation('Combat in concepts', cl.spaceConflict.considered), observation('Combat in selected concept', cl.spaceConflict.selected), observation('Combat in script', cl.spaceConflict.scripted));
      for (const kind of D.craft.conflicts) craft.push(observation(kind + ' on page', cl.spaceConflict[kind]));
    }
    if (cl.renderedGeometry) {
      const features = (values) => values == null ? 'unassessed' : values.join(', ') || 'rectangular frames';
      craft.push('<li>Scripted frames · ' + esc(features(cl.scriptedGeometry)) + '</li>');
      craft.push('<li>Rendered frames · ' + esc(features(cl.renderedGeometry.features)) + ' · ' + esc(cl.renderedGeometry.evidence) + '</li>');
    }
    if (cl.beatCraft) for (const choice of D.craft.beats) craft.push(observation(choice, cl.beatCraft[choice]));
    if (cl.roleRead?.intendedRole) craft.push(observation('Role · ' + cl.roleRead.intendedRole, cl.roleRead.visible));
    if (cl.roleRead?.pageRole) craft.push(observation('Image-only role · ' + (cl.roleRead.pageRole.role ?? 'none discerned'), cl.roleRead.pageRole));
    if (cl.leadDesign?.traits.length) {
      craft.push('<li>Focal character · ' + esc(cl.leadDesign.traits.join(', ')) + ' · ' + esc(cl.leadDesign.evidence) + '</li>');
    }
    if (cl.leadDesign) craft.push(observation('Dark skin with silver or white hair', cl.leadDesign.darkSkinLightHair));
    for (const bg of cl.authoredBackgrounds ?? []) evidence.push('<li>Script · ' + esc(bg.label) + ' · ' + esc(bg.quote ? '“' + bg.quote + '” · ' : '') + esc(bg.evidence) + '</li>');
    return '<div class="meta"><span class="chip ' + (cl.setting === 'office-like interior' ? 'warn' : 'plain') + '" title="' + esc(cl.settingDescription) + '">' + esc(cl.setting) + '</span><span class="chip plain">' + esc(cl.punchline) + '</span>' +
      D.mediumItems.map((m) => '<span class="chip ' + (cl[m.id] && cl[m.id].yes ? 'ok' : 'plain') + '" title="' + esc(cl[m.id] ? cl[m.id].evidence : '') + '">' + (cl[m.id] && cl[m.id].yes ? '✓ ' : '· ') + esc(m.id) + '</span>').join('') +
      '<span class="chip plain">medium ' + yes.length + '/6</span></div>' +
      (evidence.length ? '<details><summary>Representation evidence</summary><ul>' + evidence.join('') + '</ul></details>' : '') +
      (craft.some(Boolean) ? '<details><summary>Art direction evidence</summary><ul>' + craft.join('') + '</ul></details>' : '');
  }
  const pct = (x) => (x == null || Number.isNaN(x) ? 'n/a' : Math.round(100 * x) + '%');
  const imgOf = (arm, id) => {
    const [cs, n] = id.split('#');
    const a = D.arms.find((x) => x.arm === arm);
    const c = a && a.comics.find((x) => x.case === cs && String(x.sample) === n);
    return c && c.img ? c.img : null;
  };

  function scriptAudits() {
    const audits = D.scriptAudits || [];
    if (!audits.length) return;
    const signal = (label, observation) => '<li><b>' + esc(label) + '</b> · ' + esc(observation.state) + ' · ' + esc(observation.evidence) + '</li>';
    const sections = audits.map((audit) => {
      const pairs = audit.results.map((pair) => {
        const [cid, sample] = pair.id.split('#');
        const columns = [['a', audit.a], ['b', audit.b]].map(([key, arm]) => {
          const entry = pair[key];
          const title = '<h4><a href="#' + esc(arm + '--' + cid + '--' + sample) + '">' + esc(arm) + '</a></h4>';
          if (!entry) return '<div>' + title + '<p>' + esc(pair.status?.[key]) + '</p></div>';
          const rows = [
            signal('PR grounding', entry.grounded), signal('Staging', entry.staging),
            ...Object.entries(entry.action).map(([stage, observation]) => signal('Engagement ' + stage, observation)),
            signal('Role through action', entry.casting.roleThroughAction),
            signal('Dark skin and silver or white hair in script', entry.casting.darkSkinLightHair),
            signal('Reader-facing LGBTQ+ cue', entry.casting.readerFacingLgbtqCue),
            ...entry.casting.backgrounds.map((b) => '<li>' + esc(b.label) + ' · “' + esc(b.quote) + '”</li>'),
          ];
          return '<div>' + title + '<ul class="tight">' + rows.join('') + '</ul></div>';
        });
        const ordered = pair.first === audit.b ? [audit.b, audit.a] : [audit.a, audit.b];
        const comparisons = pair.comparison ? '<p class="legend">Judge order · first ' + esc(ordered[0]) + ' · second ' + esc(ordered[1]) + '</p><ul class="tight">' +
          Object.entries(pair.comparison).map(([name, text]) => '<li><b>' + esc(name) + '</b> · ' + esc(text) + '</li>').join('') + '</ul>' : '';
        return '<details class="pair"><summary>' + esc(pair.id) + '</summary>' +
          '<div class="arms">' + columns.join('') + '</div>' + comparisons +
          (pair.error ? '<p class="legend">' + esc(pair.error) + '</p>' : '') + '</details>';
      });
      return '<h3>' + esc(audit.b) + ' vs ' + esc(audit.a) + '</h3>' + pairs.join('');
    });
    $('#script-audits').innerHTML = '<h2>Script checkpoint and AI audit</h2><p class="legend">The judge compares matched scripts before drawing. Open a pair to see the evidence from concepts and scripts.</p>' + sections.join('');
  }

  // Head to head: the headline. Win rate of B over A per criterion, then every pair.
  function arena() {
    if (!D.arenas || !D.arenas.length) { $('#arena-pairs').innerHTML = ''; return; }
    const tables = D.arenas.map((r) => {
      const rows = D.arenaCriteria.map((c) => {
        const v = r.criteria[c.id];
        const sig = v.ci[0] > 0.5 ? 'ok' : v.ci[1] != null && v.ci[1] < 0.5 ? 'bad' : 'plain';
        const question = r.arenaVersion === 1 && c.id === 'visual' ? 'Which is more visually striking and better drawn, with lettering that reads cleanly at PR width?' : c.question;
        return '<tr><td><b>' + esc(c.id) + '</b><div class="legend">' + esc(question) + '</div></td><td class="num"><span class="chip ' + sig + '">' + pct(v.winRate) + '</span></td><td class="num">[' + pct(v.ci[0]) + ', ' + pct(v.ci[1]) + ']</td><td class="num">' + v.wins + ' / ' + v.losses + ' / ' + v.ties + '</td><td class="num">' + v.flips + '</td>' +
          (r.secondJudge ? '<td class="num">' + (r.secondJudge.criteria ? pct(r.secondJudge.criteria[c.id]?.winRate) + ' · κ ' : '') +
          (Number.isNaN(r.secondJudge.kappa[c.id]) || r.secondJudge.kappa[c.id] == null ? 'n/a' : r.secondJudge.kappa[c.id].toFixed(2)) + '</td>' : '') + '</tr>';
      }).join('');
      const gate = r.respect;
      const forfeits = gate ? '<p class="legend">Respect gate · ' + esc(r.a) + ' forfeits ' + gate.aForfeits + ' · ' + esc(r.b) + ' forfeits ' + gate.bForfeits + ' · double forfeits ' + gate.doubleForfeits + ' · incomplete ' + gate.incomplete + '. Overall uses ' + r.criteria.overall.pairs + ' pairs. Raw overall is ' + pct(r.rawOverall.winRate) + ' across ' + r.rawOverall.pairs + ' pairs.</p>' : '';
      return '<article class="arm inked" style="padding:12px 14px"><h3>' + esc(r.b) + ' vs ' + esc(r.a) + '</h3><p class="legend">' + r.pairs + (r.plannedPairs == null ? '' : '/' + r.plannedPairs) + ' pairs judged in both orders. A tie counts half.' +
        (r.secondJudge ? ' Second judge ' + esc(r.secondJudge.model) + ' · ' + r.secondJudge.pairs + '/' + (r.secondJudge.planned ?? r.secondJudge.pairs) + ' pairs.' : '') +
        '</p>' + forfeits + '<div class="scroll"><table><thead><tr><th>Criterion</th><th>' + esc(r.b) + ' wins</th><th>95% interval</th><th>won / lost / tied</th><th>flipped with order</th>' + (r.secondJudge ? '<th>2nd judge ' + (r.secondJudge.criteria ? 'wins · ' : '') + 'κ</th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div></article>';
    }).join('');
    const pairs = D.arenas.map((r) => {
      const items = r.results.map((p) => {
        const ia = imgOf(r.a, p.a), ib = imgOf(r.b, p.b);
        const verdicts = D.arenaCriteria.map((c) => {
          const v = p.verdicts[c.id];
          const who = v.result === 1 ? r.a : v.result === -1 ? r.b : 'tie';
          const orders = p.orderVerdicts?.[c.id];
          const choice = (order) => order === 'tie' ? 'tie' : order + ' image';
          return '<div class="c" style="grid-template-columns:90px 120px 1fr"><div class="n">' + esc(c.id) + '</div><div><span class="chip ' + (v.result === 0 ? 'plain' : 'warn') + '">' + esc(who) + (v.flipped ? ' · flipped' : '') + '</span></div><div class="r">' + (orders ? esc(choice(orders[0])) + ' · ' : '') + esc(v.reasons[0]) + '<div class="alt">Swapped order: ' + (orders ? esc(choice(orders[1])) + ' · ' : '') + esc(v.reasons[1]) + '</div></div>' + critique('arena--' + r.a + '--' + r.b + '--' + p.a + '--' + p.b, c.id) + '</div>';
        }).join('');
        const result = p.respect ? p.respect.overall : p.verdicts.overall.result;
        const overall = result === 1 ? r.a : result === -1 ? r.b : result === 0 ? 'tie' : p.respect.status.replaceAll('-', ' ');
        const reasons = p.respect ? [[r.a, p.respect.a], [r.b, p.respect.b]].filter(([, g]) => g && !g.pass).map(([arm, g]) => '<p class="legend">' + esc(arm) + ' forfeits · ' + esc(g.reason) + '</p>').join('') : '';
        return '<details class="pair"><summary>' + esc(p.case) + ': ' + esc(r.a) + ' #' + esc(p.a.split('#')[1]) + ' vs ' + esc(r.b) + ' #' + esc(p.b.split('#')[1]) + ' · overall: ' + esc(overall) + '</summary>' + reasons +
          '<div class="row" style="--card:360px">' + [[r.a, p.a, ia, p.summaries.a[0]], [r.b, p.b, ib, p.summaries.b[0]]].map(([arm, id, img, sum]) => '<div class="card inked"><div class="who">' + esc(arm) + ' · ' + esc(id) + '</div>' + (img ? '<img class="comicimg" src="' + esc(img) + '" alt="' + esc(id) + '" loading="lazy" data-zoom>' : '<div class="noimg">image not in this page</div>') + '<div class="said">' + esc(sum) + '</div></div>').join('') + '</div>' +
          '<div class="crit">' + verdicts + '</div></details>';
      }).join('');
      return '<h3 style="margin-top:18px">' + esc(r.b) + ' vs ' + esc(r.a) + ': every pair</h3>' + items;
    }).join('');
    $('#arena-pairs').innerHTML = '<h2>Head to head</h2><p class="legend">Each pair is two comics for the same pull request, judged twice with the order swapped. A criterion goes to one comic only when both orders agree; otherwise it is a tie and counts as a flip. Because both comics share a PR, the PR itself can\'t tilt the result.</p><div class="arms">' + tables + '</div>' + pairs;
  }

  // The craft checklist per arm: what the comics actually do.
  function checklist() {
    const arms = D.arms.filter((a) => a.checklist);
    if (!arms.length) return;
    const items = D.mediumItems;
    const head = '<tr><th>Measure</th>' + arms.map((a) => '<th>' + esc(a.arm) + '</th>').join('') + '</tr>';
    const row = (label, f) => '<tr><td>' + label + '</td>' + arms.map((a) => '<td class="num">' + f(a.checklist) + '</td>').join('') + '</tr>';
    const rate = (value) => value?.assessed ? value.observed + '/' + value.assessed : 'n/a';
    const craftRows = arms.some((a) => a.checklist.diagnostics) ? [
      ...['considered', 'selected', 'scripted', 'rendered'].map((stage) => row('Space conflict · ' + stage, (s) => rate(s.diagnostics?.spaceConflict[stage]))),
      ...D.craft.conflicts.map((kind) => row('Space conflict on page · ' + kind, (s) => rate(s.diagnostics?.spaceConflict.kinds[kind]))),
      ...['any', ...D.craft.frames].map((feature) => row('Dynamic frames · ' + feature, (s) => {
        const f = s.diagnostics?.geometry[feature];
        return f ? rate(f.scripted) + ' script · ' + rate(f.rendered) + ' page · ' + f.both + ' both' : 'n/a';
      })),
      row('Scripted layout families', (s) => s.diagnostics ? Object.entries(s.diagnostics.layouts).map(([label, n]) => esc(label) + ' · ' + n).join('<br>') || 'n/a' : 'n/a'),
      ...D.craft.beats.map((choice) => row('Supports a story beat · ' + choice, (s) => rate(s.diagnostics?.beatCraft[choice]))),
      row('Recognizable central genre role', (s) => {
        const value = s.diagnostics?.roleRead;
        return value?.intended ? rate(value) + ' assessed · ' + value.intended + ' intended roles' : 'n/a';
      }),
      row('Explicit authored backgrounds', (s) => {
        const x = s.diagnostics?.backgrounds;
        return x?.assessed ? x.comicsWithBackground + '/' + x.assessed + '<br>' + Object.entries(x.counts).map(([label, n]) => esc(label) + ' · ' + n).join('<br>') : 'n/a';
      }),
      row('Most frequent explicit background, among scripts with one', (s) => pct(s.diagnostics?.backgrounds.topShare)),
      row('Dark skin with silver or white hair on page', (s) => rate(s.diagnostics?.leadDesign.darkSkinLightHair)),
      row('Focal designs repeated across cases', (s) => s.diagnostics?.leadDesign.repeats.map((x) => esc(x.traits) + ' · ' + x.cases + ' cases').join('<br>') || 'n/a'),
    ] : [];
    const rows = [
      row('<b>Medium use index</b> (of 6)', (s) => s.mediumIndex == null ? 'n/a' : s.mediumIndex.toFixed(2)),
      ...items.map((m) => row(esc(m.id) + '<div class="legend">' + esc(m.question) + '</div>', (s) => pct(s.medium[m.id]))),
      row('Office-like interior (bridge, console, desk)', (s) => pct(s.officeLike)),
      row('Deadpan punchline', (s) => pct(s.deadpan)),
      row('The picture carries the joke', (s) => pct(s.imageCarriesJoke)),
      row('Setting variety (entropy, bits)', (s) => s.settingEntropy.toFixed(2)),
      row('Settings', (s) => Object.entries(s.settings).sort((x, y) => y[1] - x[1]).map(([k, v]) => esc(k) + ' ' + v).join('<br>')),
      row('Punchlines', (s) => Object.entries(s.punchlines).sort((x, y) => y[1] - x[1]).map(([k, v]) => esc(k) + ' ' + v).join('<br>')),
      ...D.representationItems.map((m) => row(esc(m.label), (s) => {
        if (!s.representation) return 'n/a';
        const a = s.representation.authored[m.id];
        const p = s.representation.published[m.id];
        return a.observed + '/' + a.assessed + ' script · ' + p.observed + '/' + p.assessed + ' page';
      })),
      ...(arms.some((a) => a.checklist.representation?.castAppearance?.assessed) ?
        [row('Visible variation in cast appearance', (s) => rate(s.representation?.castAppearance))] : []),
      ...(arms.some((a) => a.checklist.representation?.castContrast) ? [
        row('Visible human-to-human contrast', (s) => rate(s.representation?.castContrast?.humanToHuman)),
        row('Visible human-to-alien contrast', (s) => rate(s.representation?.castContrast?.humanToAlien)),
      ] : []),
      ...(arms.some((a) => a.checklist.representation?.windows?.length) ? [
        row('LGBTQ+ evidence in ten-comic blocks', (s) => s.representation?.windows.map((w) => w.from + '–' + w.to + ' · ' + w.observed + '/' + w.assessed).join('<br>') || 'n/a'),
      ] : []),
      ...craftRows,
    ].join('');
    $('#checklist').innerHTML = '<h2>Craft checklist</h2><p class="legend">Observations from the concept notes, script and finished page. Evidence appears on each comic\'s card.</p><div class="scroll inked" style="padding:6px 8px"><table><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
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
  $('#v-pr').addEventListener('click', () => { document.body.classList.remove('narrow'); $('#v-pr').setAttribute('aria-pressed', 'true'); $('#v-phone').setAttribute('aria-pressed', 'false'); });
  $('#v-phone').addEventListener('click', () => { document.body.classList.add('narrow'); $('#v-phone').setAttribute('aria-pressed', 'true'); $('#v-pr').setAttribute('aria-pressed', 'false'); });
  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), notes }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'notes.json'; a.click();
  });

  $('#import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      const got = JSON.parse(t);
      const incoming = got.notes || got;
      let n = 0;
      for (const [k, v] of Object.entries(incoming)) { if (v && typeof v === 'object') { notes[k] = v; n++; } }
      local.save();
      setStore('Imported notes for ' + n + ' comics');
      render();
    }).catch(() => setStore('That file is not a notes.json export'));
    e.target.value = '';
  });

  // data.js (a script tag, not fetch) so the page opens straight from disk.
  const data = window.REVIEW_DATA;
  if (!data) {
    $('#lede').textContent = 'data.js is missing beside this page. Rebuild it with: comicbench review <round> --out <this folder>';
  } else {
    D = data;
    connectStore();
    for (const a of D.arms) { const o = document.createElement('option'); o.value = a.arm; o.textContent = a.arm; $('#f-arm').appendChild(o); }
    const total = D.arms.reduce((s, a) => s + a.comics.length, 0);
    $('#lede').textContent = D.arms.map((a) => a.arm).join(' vs ') + ' · ' + total + ' comics · built ' + D.builtAt.slice(0, 16).replace('T', ' ') + ' UTC. Head-to-head verdicts lead; every score comes with the judge\'s own reason. Mark the ones you disagree with.';
    arena(); scriptAudits(); checklist(); summary(); criteria(); variety(); comics();
  }
})();
</script>
`;
