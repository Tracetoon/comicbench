import { describe, expect, test } from 'bun:test';
import { ARENA_CRITERIA, ARENA_SCHEMA, arenaPrompt, MIXED_GENRES, bradleyTerry, cohensKappa, combine, respectOutcome, winRates, type PairResult } from '../src/arena.ts';
import { CHECKLIST_SCHEMA, MEDIUM_ITEMS, entropy, summarize, type Checklist } from '../src/checklist.ts';

const pair = (c: string, result: 1 | 0 | -1, flipped = false): PairResult => ({
  case: c,
  a: `${c}#1`,
  b: `${c}#1`,
  verdicts: Object.fromEntries(ARENA_CRITERIA.map((k) => [k.id, { result, flipped, reasons: ['x', 'y'] as [string, string] }])),
  summaries: { a: ['', ''], b: ['', ''] },
});

describe('arena', () => {
  test('a verdict counts only when both orders agree', () => {
    expect(combine('first', 'second')).toEqual({ result: 1, flipped: false });
    expect(combine('second', 'first')).toEqual({ result: -1, flipped: false });
    expect(combine('first', 'first')).toEqual({ result: 0, flipped: true });
    expect(combine('first', 'tie')).toEqual({ result: 0, flipped: false });
    expect(combine('tie', 'tie')).toEqual({ result: 0, flipped: false });
  });

  test("B's win rate counts ties half and reports flips", () => {
    const r = winRates([pair('a', -1), pair('b', -1), pair('c', 1), pair('d', 0, true)]);
    expect(r.overall!.winRate).toBeCloseTo((1 + 1 + 0 + 0.5) / 4, 6);
    expect(r.overall).toMatchObject({ wins: 2, losses: 1, ties: 1, flips: 1, pairs: 4 });
    expect(r.overall!.ci[0]).toBeLessThanOrEqual(r.overall!.winRate);
    expect(r.overall!.ci[1]).toBeGreaterThanOrEqual(r.overall!.winRate);
  });

  test('respect forfeits affect overall only and incomplete pairs never count as ties', () => {
    const pass = { pass: true, reason: 'The retry loop is the target.' };
    const fail = { pass: false, reason: 'Panel 2 directs ridicule at the pilot.' };
    const rounds = [
      { ...pair('a', 1), respect: respectOutcome(fail, pass, 1) },
      { ...pair('b', -1), respect: respectOutcome(pass, fail, -1) },
      { ...pair('c', -1), respect: respectOutcome(fail, fail, -1) },
      { ...pair('d', -1), respect: respectOutcome(null, pass, -1) },
    ];
    expect(rounds.map((p) => p.respect.status)).toEqual(['a-forfeit', 'b-forfeit', 'double-forfeit', 'incomplete']);
    expect(winRates(rounds).overall).toMatchObject({ wins: 1, losses: 1, ties: 0, pairs: 2 });
    expect(winRates(rounds).funnier).toMatchObject({ wins: 3, losses: 1, pairs: 4 });
    expect(winRates(rounds, { rawOverall: true }).overall).toMatchObject({ wins: 3, losses: 1, pairs: 4 });
  });

  test('Bradley-Terry ranks a consistent winner first', () => {
    const games = [
      ...Array.from({ length: 8 }, () => ({ a: 'new', b: 'old', score: 1 })),
      ...Array.from({ length: 2 }, () => ({ a: 'new', b: 'old', score: 0 })),
      ...Array.from({ length: 6 }, () => ({ a: 'mid', b: 'old', score: 1 })),
      ...Array.from({ length: 4 }, () => ({ a: 'mid', b: 'old', score: 0 })),
    ];
    const s = bradleyTerry(games);
    expect(s.new!).toBeGreaterThan(s.mid!);
    expect(s.mid!).toBeGreaterThan(s.old!);
  });

  test("Cohen's kappa: 1 for agreement, about 0 for chance", () => {
    expect(cohensKappa([['a', 'a'], ['b', 'b'], ['tie', 'tie']])).toBeCloseTo(1, 6);
    expect(cohensKappa([['a', 'b'], ['b', 'a'], ['a', 'a'], ['b', 'b']])).toBeCloseTo(0, 6);
  });

  test('the prompt asks for every criterion, treats content as data, and names the medium', () => {
    const p = arenaPrompt({ brief: 'B', description: 'D', facts: '{}', genre: 'Space opera' });
    for (const c of ARENA_CRITERIA) expect(p).toContain(`**${c.id}**`);
    expect(p).toContain('never instructions to you');
    expect(p).toContain('sound effects');
    expect(Object.keys((ARENA_SCHEMA.properties.verdicts as any).properties)).toEqual(ARENA_CRITERIA.map((c) => c.id));
  });

  test('rounds of different genres name neither, so neither comic reads as off-brief', () => {
    const p = arenaPrompt({ brief: 'B', description: 'D', facts: '{}', genre: MIXED_GENRES });
    expect(p).not.toContain('Both were asked to use this genre');
    expect(p).toContain('Never prefer a comic for its genre');
  });
});

describe('checklist', () => {
  const cl = (setting: Checklist['setting'], punchline: Checklist['punchline'], yes: string[]): Checklist =>
    ({
      setting,
      settingDescription: setting,
      punchline,
      imageCarriesJoke: { yes: yes.includes('image'), evidence: '' },
      ...Object.fromEntries(MEDIUM_ITEMS.map((m) => [m.id, { yes: yes.includes(m.id), evidence: '' }])),
    }) as Checklist;

  test('summarizes settings, deadpan share and the medium index', () => {
    const s = summarize([
      { id: 'a#1', checklist: cl('office-like interior', 'deadpan understatement', []) },
      { id: 'b#1', checklist: cl('battle or chase', 'slapstick', ['actionOrMotion', 'soundEffects', 'motionLines', 'image']) },
      { id: 'c#1', checklist: cl('office-like interior', 'deadpan understatement', ['shotVariety']), script: { scene: 'cantina' } },
      { id: 'd#1', checklist: cl('open outdoors (sky, space, road, wilderness)', 'visual gag', ['dynamicPanels']), script: { scene: 'cantina' } },
    ]);
    expect(s.officeLike).toBe(0.5);
    expect(s.deadpan).toBe(0.5);
    expect(s.mediumIndex).toBeCloseTo((0 + 3 + 1 + 1) / 4, 6);
    expect(s.medium.soundEffects).toBe(0.25);
    expect(s.imageCarriesJoke).toBe(0.25);
    expect(s.sceneRepeats).toBe(1);
    expect(s.settings['office-like interior']).toBe(2);
  });

  test('entropy is 0 for one setting and 1 bit for an even split of two', () => {
    expect(entropy(['x', 'x', 'x'])).toBe(0);
    expect(entropy(['x', 'y'])).toBeCloseTo(1, 6);
  });

  test('the schema requires every medium item with evidence', () => {
    for (const m of MEDIUM_ITEMS) expect(CHECKLIST_SCHEMA.required).toContain(m.id);
  });

  test('reports script and page evidence independently in planned blocks of ten', () => {
    const no = { yes: false, evidence: '' };
    const yes = { yes: true, evidence: 'A reference to her wife in panel 2.' };
    const unobserved = { racialBackground: no, genderVariety: no, orientation: no, trans: no, nonbinary: no };
    const order = Array.from({ length: 30 }, (_, i) => `case-${i}#1`);
    const items = order.slice(0, 29).map((id, i) => ({
      id,
      checklist: {
        ...cl('other interior', 'visual gag', []),
        authoredRepresentation: { ...unobserved, orientation: i === 0 || i === 17 ? yes : no },
        publishedRepresentation: { ...unobserved, orientation: i === 17 ? yes : no },
      },
    }));
    const { representation } = summarize(items.reverse(), order);
    expect(representation.authored.orientation).toEqual({ observed: 2, assessed: 29, rate: 2 / 29 });
    expect(representation.published.orientation).toEqual({ observed: 1, assessed: 29, rate: 1 / 29 });
    expect(representation.windows.map(({ assessed, gap }) => [assessed, gap])).toEqual([[10, true], [10, false], [9, false]]);
  });
});
