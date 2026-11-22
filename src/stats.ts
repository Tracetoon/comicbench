// Small, dependency-free statistics. mulberry32, bootstrapMeanCI and mean are
// copied from prbench (src/stats.ts, Apache-2.0) so the two benchmarks freeze
// independently; clusteredBootstrapCI is comicbench's own.

/** Deterministic PRNG so reports are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mean = (xs: number[]): number =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;

function percentiles(sorted: number[], level: number): [number, number] {
  const n = sorted.length;
  const lo = sorted[Math.floor(((1 - level) / 2) * n)]!;
  const hi = sorted[Math.min(n - 1, Math.ceil((1 - (1 - level) / 2) * n) - 1)]!;
  return [lo, hi];
}

export interface BootstrapOpts {
  resamples?: number;
  level?: number;
  seed?: number;
}

/** Percentile bootstrap interval for the mean of `values`. */
export function bootstrapMeanCI(values: number[], opts: BootstrapOpts = {}): [number, number] {
  if (values.length === 0) return [NaN, NaN];
  const resamples = opts.resamples ?? 5000;
  const rand = mulberry32(opts.seed ?? 1);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum += values[Math.floor(rand() * values.length)]!;
    means.push(sum / values.length);
  }
  return percentiles(means.sort((a, b) => a - b), opts.level ?? 0.95);
}

/**
 * Case-clustered bootstrap: resample whole cases (with all their samples), so
 * several comics drawn for one brief don't count as independent evidence.
 */
export function clusteredBootstrapCI(
  byCase: Map<string, number[]>,
  opts: BootstrapOpts = {},
): [number, number] {
  const clusters = [...byCase.values()].filter((v) => v.length);
  if (!clusters.length) return [NaN, NaN];
  const resamples = opts.resamples ?? 5000;
  const rand = mulberry32(opts.seed ?? 1);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < clusters.length; i++) {
      const c = clusters[Math.floor(rand() * clusters.length)]!;
      for (const x of c) sum += x;
      n += c.length;
    }
    means.push(sum / n);
  }
  return percentiles(means.sort((a, b) => a - b), opts.level ?? 0.95);
}
