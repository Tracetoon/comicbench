/**
 * Frozen cases: the static inputs one comic is written from, generated once
 * from a prbench replay case (scripts/freeze-cases.ts, next) so runs pay for
 * no brief generation and every arm sees the same bytes.
 *
 *   cases/<id>/
 *     case.json        provenance, split, hashes of the files below
 *     brief.md         Tracetoon's evidence brief (`tracetoon query brief`)
 *     description.md   the PR description the comic accompanies
 *     changes.patch    the diff; the author may look things up in it
 *     facts.json       prbench's fact sheet; judges only, never the author
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CASE_SCHEMA = 'comicbench.case/v1';
export const CASE_FILES = ['brief.md', 'description.md', 'changes.patch', 'facts.json'] as const;
/** Files the comic author may see; facts.json is for judges only. */
export const AUTHOR_FILES = ['brief.md', 'description.md', 'changes.patch'] as const;

export interface CaseMeta {
  schema: typeof CASE_SCHEMA;
  id: string;
  /** dev: tuned against; sealed: scored only in confirmation runs. */
  split: 'dev' | 'sealed';
  source: {
    /** e.g. prbench real-cases@4.0.0 */
    dataset: string;
    case: string;
  };
  /** The Tracetoon build the brief was generated with. */
  tracetoon: string;
  /** Where description.md came from, e.g. a golden-run draft id. */
  description: string;
  license: string;
  /** sha256 of each case file, so a run can prove its inputs. */
  sha256: Record<(typeof CASE_FILES)[number], string>;
}

export interface Case {
  dir: string;
  meta: CaseMeta;
}

export const sha256 = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

/** Problems with one case folder; empty when it is valid. */
export function caseProblems(dir: string): string[] {
  const out: string[] = [];
  const metaPath = join(dir, 'case.json');
  if (!existsSync(metaPath)) return ['case.json is missing'];
  let meta: CaseMeta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    return [`case.json is not JSON: ${(e as Error).message}`];
  }
  if (meta.schema !== CASE_SCHEMA) out.push(`schema must be ${CASE_SCHEMA}`);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(meta.id ?? '')) out.push('id must be a lowercase slug');
  if (meta.split !== 'dev' && meta.split !== 'sealed') out.push('split must be dev or sealed');
  for (const key of ['tracetoon', 'description', 'license'] as const)
    if (typeof meta[key] !== 'string' || !meta[key]) out.push(`${key} is required`);
  if (!meta.source?.dataset || !meta.source?.case) out.push('source.dataset and source.case are required');
  for (const f of CASE_FILES) {
    const path = join(dir, f);
    if (!existsSync(path)) {
      out.push(`${f} is missing`);
      continue;
    }
    if (meta.sha256?.[f] !== sha256(readFileSync(path))) out.push(`${f} does not match its sha256`);
  }
  try {
    const facts = JSON.parse(readFileSync(join(dir, 'facts.json'), 'utf8').replace(/^\uFEFF/, ''));
    if (typeof facts !== 'object' || facts === null) out.push('facts.json must be an object');
  } catch {
    if (existsSync(join(dir, 'facts.json'))) out.push('facts.json is not JSON');
  }
  return out;
}

/** Every case folder under `root` (a folder holding case folders). */
export function loadCases(root: string): Case[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'case.json')))
    .map((e) => ({
      dir: join(root, e.name),
      meta: JSON.parse(readFileSync(join(root, e.name, 'case.json'), 'utf8').replace(/^\uFEFF/, '')) as CaseMeta,
    }))
    .sort((a, b) => a.meta.id.localeCompare(b.meta.id));
}
