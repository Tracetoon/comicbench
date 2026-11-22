/**
 * Turns judgments into points. A criterion's 1–5 score maps to 0–100
 * ((s - 1) / 4), weighted by the rubric; any failed gate scores the comic 0.
 * The headline combines the mean comic score with the set's variety score.
 */
import {
  CRITERIA,
  GATES,
  HEADLINE,
  SET_CRITERIA,
  TOTAL_WEIGHT,
  type GateId,
  type SetCriterionId,
} from './rubric.ts';
import { clusteredBootstrapCI, mean, type BootstrapOpts } from './stats.ts';

/** One judged comic. A criterion the judges could not assess is null. */
export interface ComicJudgment {
  case: string;
  sample: number;
  gates: Record<GateId, boolean>;
  scores: Record<string, number | null>;
}

export type SetJudgment = Record<SetCriterionId, number>;

const isScore = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

/** Problems that make a judgment unusable; empty when it is valid. */
export function judgmentProblems(j: ComicJudgment): string[] {
  const out: string[] = [];
  for (const g of GATES)
    if (typeof j.gates?.[g.id] !== 'boolean') out.push(`gate ${g.id} must be true or false`);
  for (const c of CRITERIA) {
    const v = j.scores?.[c.id];
    if (v !== null && !isScore(v)) out.push(`${c.id} must be an integer 1–5 or null`);
  }
  for (const k of Object.keys(j.scores ?? {}))
    if (!CRITERIA.some((c) => c.id === k)) out.push(`unknown criterion ${k}`);
  return out;
}

/**
 * Points out of 100 for one comic, or null when a criterion is unassessed
 * (an unknown never silently counts as a low or a high score).
 */
export function comicScore(j: ComicJudgment): number | null {
  if (GATES.some((g) => j.gates[g.id] === false)) return 0;
  let points = 0;
  for (const c of CRITERIA) {
    const v = j.scores[c.id];
    if (!isScore(v)) return null;
    points += (c.weight * (v - 1)) / 4;
  }
  return (100 * points) / TOTAL_WEIGHT;
}

/** The set's variety on 0–100. */
export function setScore(s: SetJudgment): number {
  let total = 0;
  for (const c of SET_CRITERIA) {
    const v = s[c.id];
    if (!isScore(v)) throw new Error(`set ${c.id} must be an integer 1–5`);
    total += (c.share * (v - 1)) / 4;
  }
  return 100 * total;
}

export interface Report {
  comics: number;
  scored: number;
  /** Comics a gate zeroed. */
  gated: number;
  /** Comics left out because a criterion was unassessed. */
  unknown: number;
  comicMean: number;
  comicCI: [number, number];
  set: number | null;
  headline: number | null;
  /** Mean 1–5 score per criterion over gate-passing comics. */
  criteria: Record<string, number>;
  perCase: Record<string, number>;
}

export function report(
  judgments: ComicJudgment[],
  set?: SetJudgment,
  bootstrap: BootstrapOpts = {},
): Report {
  const byCase = new Map<string, number[]>();
  let gated = 0;
  let unknown = 0;
  for (const j of judgments) {
    const s = comicScore(j);
    if (s === null) {
      unknown++;
      continue;
    }
    if (s === 0 && GATES.some((g) => j.gates[g.id] === false)) gated++;
    byCase.set(j.case, [...(byCase.get(j.case) ?? []), s]);
  }
  const scores = [...byCase.values()].flat();
  const comicMean = mean(scores);
  const passing = judgments.filter((j) => GATES.every((g) => j.gates[g.id]));
  const criteria = Object.fromEntries(
    CRITERIA.map((c) => [
      c.id,
      mean(passing.map((j) => j.scores[c.id]).filter(isScore)),
    ]),
  );
  const setPoints = set ? setScore(set) : null;
  return {
    comics: judgments.length,
    scored: scores.length,
    gated,
    unknown,
    comicMean,
    comicCI: clusteredBootstrapCI(byCase, bootstrap),
    set: setPoints,
    headline:
      setPoints === null || Number.isNaN(comicMean)
        ? null
        : HEADLINE.comic * comicMean + HEADLINE.set * setPoints,
    criteria,
    perCase: Object.fromEntries([...byCase].map(([k, v]) => [k, mean(v)])),
  };
}

/** Host-computed variety hints for the set judge, from the comic scripts. */
export function varietyHints(
  scripts: { case: string; characters?: { name?: string }[]; format?: string; composition?: { family?: string } }[],
): { castReuse: number; formatSpread: number; familySpread: number } {
  const casesByName = new Map<string, Set<string>>();
  for (const s of scripts)
    for (const c of s.characters ?? []) {
      const name = c.name?.trim().toLowerCase();
      if (!name) continue;
      casesByName.set(name, (casesByName.get(name) ?? new Set()).add(s.case));
    }
  const names = [...casesByName.values()];
  const spread = (xs: (string | undefined)[]) =>
    xs.length ? new Set(xs.filter(Boolean)).size / xs.length : 0;
  return {
    // Share of character names that recur across different cases.
    castReuse: names.length ? names.filter((c) => c.size > 1).length / names.length : 0,
    formatSpread: spread(scripts.map((s) => s.format)),
    familySpread: spread(scripts.map((s) => s.composition?.family)),
  };
}
