/**
 * One headless Codex call: `codex exec` with the prompt on stdin, optional
 * images and a strict output schema, the user's Codex config and skills left
 * out (--ignore-user-config) and no session kept (--ephemeral). Every model
 * call comicbench makes (comic author, judges) goes through here, so runs use
 * the Codex quota and nothing else.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { backoffMs, gate, RATE_LIMIT, sleep, withSlot } from './gate.ts';

export interface CodexCall {
  prompt: string;
  /** Working directory; the only place a workspace-write call may change files. */
  cwd: string;
  images?: string[];
  schema?: object;
  sandbox?: 'read-only' | 'workspace-write';
  /** Reasoning effort; medium unless set. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh';
  addDirs?: string[];
  /** Inline authors get only the supplied prompt, with local file tools disabled. */
  noTools?: boolean;
  model?: string;
  timeoutMs?: number;
  /** Where to keep the prompt, Codex's log and its last message (a folder). */
  logDir: string;
}

export interface CodexResult {
  ok: boolean;
  text: string;
  json?: unknown;
  error?: string;
  ms: number;
  /** The model Codex reported in its log header, when it did. */
  model?: string;
  /** The sandbox Codex reported it actually used (it can differ from the one asked for). */
  sandbox?: string;
}

/** The codex command; COMICBENCH_CODEX_BIN overrides it (a .ts stand-in runs under Bun, for tests). */
export function codexCommand(): string[] {
  const bin = process.env.COMICBENCH_CODEX_BIN ?? 'codex';
  return bin.endsWith('.ts') ? [process.execPath, bin] : [bin];
}

/** Rate-limit retries before a call gives up. */
export const RATE_LIMIT_TRIES = 6;

/**
 * One Codex call through the process gate (gate.ts): it waits for a slot, and
 * a rate-limited reply is retried with backoff, the slot released meanwhile.
 */
export async function codexExec(c: CodexCall): Promise<CodexResult> {
  for (let attempt = 0; ; attempt++) {
    const r = await withSlot(() => codexOnce(c));
    if (r.ok || !r.limited || attempt + 1 >= RATE_LIMIT_TRIES) return r;
    gate.limited();
    const wait = backoffMs(attempt);
    gate.stats.backoffMs += wait;
    await sleep(wait);
  }
}

async function codexOnce(c: CodexCall): Promise<CodexResult & { limited?: boolean }> {
  mkdirSync(c.logDir, { recursive: true });
  const out = join(c.logDir, 'last-message.txt');
  const log = join(c.logDir, 'codex.log');
  writeFileSync(join(c.logDir, 'prompt.md'), c.prompt);
  const args = [...codexCommand(), 'exec', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config'];
  args.push('-s', c.sandbox ?? 'read-only', '-C', c.cwd);
  if (c.noTools) {
    args.push('--ignore-rules', '--disable', 'shell_tool', '--disable', 'unified_exec');
    args.push('--disable', 'multi_agent', '--disable', 'multi_agent_v2', '-c', 'web_search="disabled"');
    args.push('--disable', 'view_image', '--disable', 'image_generation');
  }
  // --ignore-user-config also drops the user's [windows] sandbox setting, and
  // without it Codex can't sandbox commands on Windows: workspace-write falls
  // back to read-only and every shell call is rejected. Set it explicitly.
  if (process.platform === 'win32') args.push('-c', `windows.sandbox="${process.env.COMICBENCH_WINDOWS_SANDBOX ?? 'elevated'}"`);
  for (const d of c.addDirs ?? []) args.push('--add-dir', d);
  if (c.model) args.push('-m', c.model);
  // Without the user's config Codex defaults to no reasoning; prbench's writers and judges use medium.
  args.push('-c', `model_reasoning_effort="${c.effort ?? 'medium'}"`);
  if (c.schema) {
    const file = join(c.logDir, 'schema.json');
    writeFileSync(file, JSON.stringify(c.schema));
    args.push('--output-schema', file);
  }
  for (const i of c.images ?? []) args.push('-i', i);
  args.push('-o', out, '-');
  const started = performance.now();
  mkdirSync(dirname(out), { recursive: true });
  const p = Bun.spawn(args, { stdin: new Blob([c.prompt]), stdout: 'pipe', stderr: 'pipe', env: process.env });
  const timer = setTimeout(() => p.kill(), c.timeoutMs ?? 20 * 60_000);
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  clearTimeout(timer);
  writeFileSync(log, `${stdout}\n${stderr}`);
  const ms = Math.round(performance.now() - started);
  const model = /^model:\s*(\S+)/m.exec(`${stdout}\n${stderr}`)?.[1];
  const sandbox = /^sandbox:\s*(\S+)/m.exec(`${stdout}\n${stderr}`)?.[1];
  const text = existsSync(out) ? readFileSync(out, 'utf8') : '';
  const base = { text, ms, model, sandbox };
  // Only a failed call's own output counts: a model reply can quote "429" or "rate limit".
  if (code !== 0) return { ok: false, ...base, limited: RATE_LIMIT.test(stderr), error: `codex exit ${code}: ${stderr.trim().slice(-500)}` };
  if (!c.schema) return { ok: true, ...base };
  try {
    return { ok: true, ...base, json: JSON.parse(text) };
  } catch (e) {
    return { ok: false, ...base, error: `not JSON: ${(e as Error).message}` };
  }
}
