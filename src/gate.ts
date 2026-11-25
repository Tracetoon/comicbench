/**
 * One gate for every model call in the process. A campaign runs comics,
 * checklists and arenas at once; the gate caps how many run together.
 *
 * Three lanes:
 * - `draw`: image rendering. It is mostly waiting on the image service, so it
 *   has its own cap and never takes a text slot.
 * - `comic`: a comic's text calls (author, scoring), the critical path.
 * - `judge`: checklists and arena pairs.
 * Text calls share `slots`; comic work goes first but always leaves
 * `judgeSlots` free while judging is waiting, so judging keeps pace with
 * drawing. While Codex rate-limits, text slots shrink by a third and recover
 * after ten quiet minutes. Outside a campaign the gate is unlimited.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export type Lane = 'comic' | 'judge' | 'draw';
type TextLane = 'comic' | 'judge';
const lane = new AsyncLocalStorage<Lane>();

/** Runs fn with every model call inside it on the given lane. */
export const inLane = <T>(l: Lane, fn: () => Promise<T>): Promise<T> => lane.run(l, fn);
export const currentLane = (): Lane => lane.getStore() ?? 'judge';

/** Codex said it was rate- or usage-limited (its own words, not a stray number). */
export const RATE_LIMIT = /\b(rate[ -]?limit(ed)?|usage limit|too many requests|quota (exceeded|exhausted)|exceeded your (current )?quota|try again (later|in \d+))\b/i;

export interface GateStats {
  calls: Record<Lane, number>;
  ms: Record<Lane, number>;
  /** Time calls spent waiting for a slot, per lane. */
  waitMs: Record<Lane, number>;
  rateLimits: number;
  backoffMs: number;
  /** The lowest the text slot count fell while rate-limited. */
  minSlots: number;
}

const zero = (): Record<Lane, number> => ({ comic: 0, judge: 0, draw: 0 });

class Gate {
  private base = Infinity;
  private limit = Infinity;
  private reserve = 0;
  private drawLimit = Infinity;
  private active: Record<Lane, number> = zero();
  private lastLimit = 0;
  private queues: Record<Lane, (() => void)[]> = { comic: [], judge: [], draw: [] };
  stats: GateStats = { calls: zero(), ms: zero(), waitMs: zero(), rateLimits: 0, backoffMs: 0, minSlots: Infinity };
  /** How long without a rate limit before the slots recover. */
  recoverMs = 10 * 60_000;

  /** Text slots, the share kept free for judging, and the separate rendering cap (0 means unlimited). */
  setSlots(n: number, opts: { judge?: number; draw?: number } = {}) {
    this.base = this.limit = n > 0 ? n : Infinity;
    this.reserve = Math.max(0, Math.min(opts.judge ?? 0, Number.isFinite(this.base) ? this.base - 1 : 0));
    this.drawLimit = opts.draw && opts.draw > 0 ? opts.draw : Infinity;
    this.stats = { calls: zero(), ms: zero(), waitMs: zero(), rateLimits: 0, backoffMs: 0, minSlots: this.limit };
    this.pump();
  }

  get slots() {
    return this.limit;
  }

  get judgeSlots() {
    return this.reserve;
  }

  get drawSlots() {
    return this.drawLimit;
  }

  /** Text calls running. */
  get running() {
    return this.active.comic + this.active.judge;
  }

  get drawing() {
    return this.active.draw;
  }

  private pump() {
    if (this.limit < this.base && Date.now() - this.lastLimit > this.recoverMs) this.limit = this.base;
    while (this.active.draw < this.drawLimit && this.queues.draw.length) {
      this.active.draw++;
      this.queues.draw.shift()!();
    }
    for (;;) {
      const text = this.running;
      if (text >= this.limit) return;
      // Comic work first, but never into the slots kept for judging while judging waits.
      const reserveFree = Math.min(this.reserve, Math.max(0, this.limit - 1));
      const comicRoom = this.queues.judge.length ? text < this.limit - reserveFree : true;
      const next: TextLane | undefined = this.queues.comic.length && comicRoom ? 'comic' : this.queues.judge.length ? 'judge' : undefined;
      if (!next) return;
      this.active[next]++;
      this.queues[next].shift()!();
    }
  }

  acquire(l: Lane): Promise<void> {
    return new Promise((resolve) => {
      this.queues[l].push(resolve);
      this.pump();
    });
  }

  release(l: Lane) {
    this.active[l]--;
    this.pump();
  }

  /** Codex is rate-limiting: run a third fewer text calls for a while. */
  limited() {
    this.stats.rateLimits++;
    this.lastLimit = Date.now();
    if (Number.isFinite(this.base)) this.limit = Math.max(2, Math.min(this.limit, Math.floor((this.base * 2) / 3)));
    this.stats.minSlots = Math.min(this.stats.minSlots, this.limit);
  }

  record(l: Lane, ms: number, waitMs: number) {
    this.stats.calls[l]++;
    this.stats.ms[l] += ms;
    this.stats.waitMs[l] += waitMs;
  }
}

export const gate = new Gate();

/** Holds one slot on the current lane (or the one given) while fn runs. */
export async function withSlot<T>(fn: () => Promise<T>, l: Lane = currentLane()): Promise<T> {
  const asked = performance.now();
  await gate.acquire(l);
  const started = performance.now();
  try {
    return await fn();
  } finally {
    gate.record(l, performance.now() - started, started - asked);
    gate.release(l);
  }
}

/** Backoff before retry n (0-based): base doubling, capped at ten minutes. */
export function backoffMs(n: number, base = Number(process.env.COMICBENCH_BACKOFF_MS ?? 30_000)): number {
  return Math.min(10 * 60_000, base * 2 ** n);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
