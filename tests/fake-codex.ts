#!/usr/bin/env bun
/**
 * A stand-in for `codex exec` in tests: reads the prompt from stdin, writes
 * FAKE_CODEX_REPLY (or `{"ok":true}`) to the -o file, prints a model header,
 * and exits with FAKE_CODEX_EXIT (default 0). Never calls a model.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('fake-codex 1.0');
  process.exit(0);
}
const out = args.includes('-o') ? args[args.indexOf('-o') + 1] : undefined;
const prompt = await new Response(Bun.stdin.stream()).text();
console.log('model: fake-codex');
// Report the sandbox the way Codex's header does; FAKE_CODEX_SANDBOX simulates a silent downgrade.
console.log(`sandbox: ${process.env.FAKE_CODEX_SANDBOX ?? args[args.indexOf('-s') + 1]}`);
if (process.env.FAKE_CODEX_ARGS) writeFileSync(process.env.FAKE_CODEX_ARGS, JSON.stringify(args));
if (out) {
  const responses = process.env.FAKE_CODEX_RESPONSES ? JSON.parse(readFileSync(process.env.FAKE_CODEX_RESPONSES, 'utf8')) : {};
  const match = Object.keys(responses).find((prefix) => prompt.startsWith(prefix));
  const reply = match ? JSON.stringify(responses[match]) : process.env.FAKE_CODEX_REPLY ?? '{"ok":true}';
  writeFileSync(out, reply);
}
process.exit(Number(process.env.FAKE_CODEX_EXIT ?? 0));
