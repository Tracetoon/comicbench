/**
 * One gate for every model call in the process. A campaign runs comics,
 * checklists and arenas at once; the gate caps how many Codex calls run
 * together (slots), lets comic work (the critical path) go before judging,
 * shrinks the cap while Codex is rate-limiting and recovers it afterwards.
 * Outside a campaign the gate is unlimited, so single commands behave as before.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type Lane = 'comic' | 'judge';
const lane = new AsyncLocalStorage<Lane>();

/** Runs fn with every model call inside it on the given lane. */
export const inLane = <T>(l: Lane, fn: () => Promise<T>): Promise<T> => lane.run(l, fn);
export const currentLane = (): Lane => lane.getStore() ?? 'judge';

/** Codex said it was rate- or usage-limited (its own words, not a stray number). */
export const RATE_LIMIT = /\b(rate[ -]?limit(ed)?|usage limit|too many requests|quota (exceeded|exhausted)|exceeded your (current )?quota|try again (later|in \d+))\b/i;

export interface GateStats {
  calls: Record<Lane, number>;
  ms: Record<Lane, number>;
  rateLimits: number;
  backoffMs: number;
  /** The lowest the slot count fell while rate-limited. */
  minSlots: number;
}

class Gate {
  private base = Infinity;
  private limit = Infinity;
  private active = 0;
  private lastLimit = 0;
  private queues: Record<Lane, (() => void)[]> = { comic: [], judge: [] };
  stats: GateStats = { calls: { comic: 0, judge: 0 }, ms: { comic: 0, judge: 0 }, rateLimits: 0, backoffMs: 0, minSlots: Infinity };
  /** How long without a rate limit before the slots recover. */
  recoverMs = 10 * 60_000;

  setSlots(n: number) {
    this.base = this.limit = n > 0 ? n : Infinity;
    this.stats = { calls: { comic: 0, judge: 0 }, ms: { comic: 0, judge: 0 }, rateLimits: 0, backoffMs: 0, minSlots: this.limit };
    this.pump();
  }

  get slots() {
    return this.limit;
  }

  get running() {
    return this.active;
  }

  private pump() {
    if (this.limit < this.base && Date.now() - this.lastLimit > this.recoverMs) this.limit = this.base;
    while (this.active < this.limit) {
      const next = this.queues.comic.shift() ?? this.queues.judge.shift();
      if (!next) return;
      this.active++;
      next();
    }
  }

  acquire(l: Lane): Promise<void> {
    return new Promise((resolve) => {
      this.queues[l].push(resolve);
      this.pump();
    });
  }

  release() {
    this.active--;
    this.pump();
  }

  /** Codex is rate-limiting: run a third fewer calls for a while. */
  limited() {
    this.stats.rateLimits++;
    this.lastLimit = Date.now();
    if (Number.isFinite(this.base)) this.limit = Math.max(2, Math.min(this.limit, Math.floor((this.base * 2) / 3)));
    this.stats.minSlots = Math.min(this.stats.minSlots, this.limit);
  }

  record(l: Lane, ms: number) {
    this.stats.calls[l]++;
    this.stats.ms[l] += ms;
  }
}

export const gate = new Gate();

/** Holds one slot on the current lane while fn runs. */
export async function withSlot<T>(fn: () => Promise<T>, l: Lane = currentLane()): Promise<T> {
  await gate.acquire(l);
  const started = performance.now();
  try {
    return await fn();
  } finally {
    gate.record(l, performance.now() - started);
    gate.release();
  }
}

/** Backoff before retry n (0-based): base doubling, capped at ten minutes. */
export function backoffMs(n: number, base = Number(process.env.COMICBENCH_BACKOFF_MS ?? 30_000)): number {
  return Math.min(10 * 60_000, base * 2 ** n);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
