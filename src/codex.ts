/**
 * One headless Codex call: `codex exec` with the prompt on stdin, optional
 * images and a strict output schema, the user's Codex config and skills left
 * out (--ignore-user-config) and no session kept (--ephemeral). Every model
 * call comicbench makes (comic author, judges) goes through here, so runs use
 * the Codex quota and nothing else.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
}

/** The codex command; COMICBENCH_CODEX_BIN overrides it (a .ts stand-in runs under Bun, for tests). */
export function codexCommand(): string[] {
  const bin = process.env.COMICBENCH_CODEX_BIN ?? 'codex';
  return bin.endsWith('.ts') ? [process.execPath, bin] : [bin];
}

export async function codexExec(c: CodexCall): Promise<CodexResult> {
  mkdirSync(c.logDir, { recursive: true });
  const out = join(c.logDir, 'last-message.txt');
  const log = join(c.logDir, 'codex.log');
  writeFileSync(join(c.logDir, 'prompt.md'), c.prompt);
  const args = [...codexCommand(), 'exec', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config'];
  args.push('-s', c.sandbox ?? 'read-only', '-C', c.cwd);
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
  const text = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (code !== 0) return { ok: false, text, error: `codex exit ${code}: ${stderr.trim().slice(-500)}`, ms, model };
  if (!c.schema) return { ok: true, text, ms, model };
  try {
    return { ok: true, text, json: JSON.parse(text), ms, model };
  } catch (e) {
    return { ok: false, text, error: `not JSON: ${(e as Error).message}`, ms, model };
  }
}
