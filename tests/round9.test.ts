import { expect, test } from 'bun:test';
import { ARENA_CRITERIA, ARENA_SCHEMA, arenaPrompt } from '../src/arena.ts';
import { CHECKLIST_SCHEMA, memeSummary, type Checklist } from '../src/checklist.ts';

test('the arena rewards a well-placed genre meme for veteran fans', () => {
  expect(ARENA_CRITERIA.map((c) => c.id)).toEqual(['funnier', 'aboutPr', 'medium', 'visual', 'veteranAppeal', 'overall']);
  const p = arenaPrompt({ brief: 'B', description: 'D', facts: '{}', genre: 'Space opera' });
  expect(p).toContain('**veteranAppeal**');
  expect(ARENA_CRITERIA.find((c) => c.id === 'overall')!.question).toContain('counts strongly in its favor');
  expect(ARENA_CRITERIA.find((c) => c.id === 'funnier')!.question).toContain('not a stale joke');
  expect(Object.keys((ARENA_SCHEMA.properties.verdicts as any).properties)).toContain('veteranAppeal');
});

test('the checklist asks for memes on the page and backgrounds by panel focus', () => {
  expect(CHECKLIST_SCHEMA.required).toContain('genreMeme');
  expect(CHECKLIST_SCHEMA.required).toContain('backgroundFocus');
  const cl = (state: 'present' | 'absent', meme = '') => ({ genreMeme: { state, meme, evidence: 'e' } }) as unknown as Checklist;
  const s = memeSummary([
    { checklist: cl('present', 'mimic chest'), script: { meme: 'mimic' }, offers: ['mimic', 'slime', 'goddess'] },
    { checklist: cl('present', 'mimic chest'), script: { meme: 'mimic' }, offers: ['mimic', 'elf', 'truck'] },
    { checklist: cl('absent'), script: { meme: 'rogue' }, offers: ['elf', 'truck', 'loop'] },
    { checklist: cl('absent'), script: {}, offers: ['elf', 'truck', 'loop'] },
  ]);
  expect(s.offered).toBe(4);
  expect(s.scripted).toBe(3);
  expect(s.outsideOffer).toBe(1);
  expect(s.repeats).toBe(1);
  expect(s.onPage).toEqual({ observed: 2, assessed: 4, rate: 0.5 });
  expect(s.pageMemes).toEqual(['mimic chest', 'mimic chest']);
});
