/**
 * Reads a Tracetoon genre file (Markdown with `key: value` and `- item`
 * frontmatter, the format of Tracetoon's src/comic/genreFile.ts) into the
 * genre option a comic packet offers. comicbench takes the genre under test
 * as such a file, the same way a user adds one to Tracetoon.
 */
import { readFileSync } from 'node:fs';
import type { GenreOption } from './packet.ts';

export function parseGenre(text: string): GenreOption {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') throw new Error('a genre file starts with a --- frontmatter block');
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) throw new Error('the frontmatter block has no closing ---');
  const fields = new Map<string, string | string[]>();
  let list: string | undefined;
  for (const raw of lines.slice(1, end)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item) {
      const cur = list ? fields.get(list) : undefined;
      if (!Array.isArray(cur)) throw new Error(`a list item outside a list: ${line}`);
      cur.push(item[1]!.replace(/^(["'])(.*)\1$/, '$2'));
      continue;
    }
    const kv = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`expected key: value, got: ${line}`);
    if (kv[2]!.trim()) {
      fields.set(kv[1]!, kv[2]!.trim().replace(/^(["'])(.*)\1$/, '$2'));
      list = undefined;
    } else {
      fields.set(kv[1]!, []);
      list = kv[1]!;
    }
  }
  const text1 = (k: string) => {
    const v = fields.get(k);
    if (typeof v !== 'string' || !v) throw new Error(`${k} is required`);
    return v;
  };
  const items = (k: string) => {
    const v = fields.get(k);
    return Array.isArray(v) ? v : [];
  };
  const notes = lines.slice(end + 1).join('\n').trim();
  return {
    id: text1('id').toLowerCase(),
    name: text1('name'),
    setting: text1('setting'),
    archetypes: items('archetypes'),
    props: items('props'),
    jokeHooks: items('jokeHooks'),
    ...(notes ? { notes } : {}),
  };
}

export const readGenre = (path: string) => parseGenre(readFileSync(path, 'utf8'));
