import { expect, test } from 'bun:test';
import { castSummary } from '../src/checklist.ts';

test('cast summary counts offered versus used personas and side-only compliance', () => {
  const party = { kind: 'party' as const, personas: [{ id: 'elf', role: 'mage' }, { id: 'dwarf', role: 'warrior' }, { id: 'priest', role: 'healer' }, { id: 'lich', role: 'nemesis' }, { id: 'bard', role: 'side' }] };
  const sideOnly = { kind: 'side-only' as const, personas: [{ id: 'lich', role: 'nemesis' }, { id: 'bard', role: 'side' }, { id: 'smith', role: 'side' }, { id: 'inn', role: 'side' }, { id: 'slime', role: 'side' }] };
  const s = castSummary([
    { offer: party, script: { personas: ['elf', 'dwarf'] } },
    { offer: party, script: { personas: ['elf', 'goddess'] } },
    { offer: sideOnly, script: { personas: ['bard', 'smith'] } },
    { offer: sideOnly, script: { personas: [] } },
    { script: { personas: ['elf'] } },
  ])!;
  expect(s.comics).toBe(4);
  expect(s.sideOnly).toBe(2);
  expect(s.sideOnlyKept).toBe(1);
  expect(s.withPersonas).toBe(3);
  expect(s.outsideOffer).toBe(1);
  expect(s.distinctUsed).toBe(4);
  expect(s.topShare).toBe(0.5);
  expect(castSummary([{ script: {} }])).toBeNull();
});
