/**
 * One judge call from either model family, for measures v2: Codex (the
 * user's Codex quota, as every other bench call) or Claude (headless Claude
 * Code, `claude -p`, the user's own subscription; no API key). Images are
 * copied to neutral names (A.png, B.png…) in an empty folder, so file names
 * and repository context can't bias the judge.
 */
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { codexExec } from './codex.ts';

export type Family = 'codex' | 'claude';
export const CLAUDE_JUDGE_MODEL = process.env.COMICBENCH_CLAUDE_MODEL || 'claude-opus-5-5';
const CLAUDE_BIN = process.env.COMICBENCH_CLAUDE_BIN || 'claude';

export interface JudgeCall {
  family: Family;
  prompt: string;
  images: string[];
  schema: object;
  /** Where to keep the call's log (Codex) or the raw reply (Claude). */
  logDir: string;
  timeoutMs?: number;
}

export interface JudgeReply {
  ok: boolean;
  json?: unknown;
  error?: string;
  ms: number;
  costUsd?: number;
}

function run(cmd: string, args: string[], cwd: string, timeoutMs: number): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => p.kill(), timeoutMs);
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err });
    });
  });
}

export async function askJudge(c: JudgeCall): Promise<JudgeReply> {
  const started = Date.now();
  const dir = mkdtempSync(join(tmpdir(), 'cb-judge-'));
  try {
    const names = c.images.map((img, i) => {
      const name = `${String.fromCharCode(65 + i)}${extname(img).toLowerCase() || '.png'}`;
      copyFileSync(img, join(dir, name));
      return join(dir, name);
    });
    if (c.family === 'codex') {
      const r = await codexExec({ prompt: c.prompt, cwd: dir, images: names, schema: c.schema, logDir: c.logDir, noTools: true, timeoutMs: c.timeoutMs ?? 10 * 60_000 });
      return { ok: r.ok, json: r.json, ...(r.error ? { error: r.error } : {}), ms: Date.now() - started };
    }
    const files = names.map((n) => `./${n.split(/[\\/]/).pop()}`).join(', ');
    const prompt = `${c.prompt}\n\nFiles: ${files}. Read every file with the Read tool before answering. If you cannot see an image, say so. Answer only with the structured result.`;
    const r = await run(CLAUDE_BIN, ['-p', prompt, '--model', CLAUDE_JUDGE_MODEL, '--output-format', 'json', '--allowedTools', 'Read', '--json-schema', JSON.stringify(c.schema)], dir, c.timeoutMs ?? 10 * 60_000);
    mkdirSync(c.logDir, { recursive: true });
    writeFileSync(join(c.logDir, 'claude.json'), r.out || r.err);
    if (r.code !== 0) return { ok: false, error: `claude exit ${r.code}: ${r.err.slice(-300)}`, ms: Date.now() - started };
    const json = JSON.parse(r.out) as { structured_output?: unknown; is_error?: boolean; result?: string; total_cost_usd?: number };
    if (json.is_error || !json.structured_output) return { ok: false, error: `claude: ${json.result ?? 'no structured output'}`, ms: Date.now() - started };
    return { ok: true, json: json.structured_output, ms: Date.now() - started, costUsd: Number(json.total_cost_usd ?? 0) };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300), ms: Date.now() - started };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {}
  }
}

/** Run tasks with at most `n` in flight. */
export async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}
