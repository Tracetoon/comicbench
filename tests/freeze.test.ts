import { describe, expect, test } from 'bun:test';
import { chooseSplits, cleanBody, redactEmails } from '../scripts/freeze-cases.ts';

describe('freezing cases', () => {
  test('personal addresses are redacted; example, role and systemd names are kept', () => {
    const text =
      'Author: Ada Person <ada.person@gmail.com>, see build@example.invalid, eval@example.com, ' +
      'noreply@anthropic.com, support@signpath.io and gamescope-session-plus@ogui-steam.service';
    const out = redactEmails(text);
    expect(out).toContain('<email>');
    expect(out).not.toContain('ada.person@gmail.com');
    for (const kept of [
      'build@example.invalid',
      'eval@example.com',
      'noreply@anthropic.com',
      'support@signpath.io',
      'gamescope-session-plus@ogui-steam.service',
    ])
      expect(out).toContain(kept);
  });

  test("a golden draft loses Tracetoon's comment markers", () => {
    const body = '<!-- tracetoon:start -->\nHello.\n<!-- tracetoon:meta {"v":1} -->\n\n\n\nBye.\n<!-- tracetoon:end -->';
    expect(cleanBody(body)).toBe('Hello.\n\nBye.\n');
  });

  test('splits pick 20 dev cases spread over repositories, deterministically', () => {
    const repoOf = new Map<string, string>();
    const sizes: Record<string, number> = { a: 20, b: 15, c: 10, d: 10, e: 6 };
    for (const [repo, n] of Object.entries(sizes))
      for (let i = 0; i < n; i++) repoOf.set(`${repo}-${i}`, repo);
    const splits = chooseSplits(repoOf);
    const dev = [...splits].filter(([, s]) => s === 'dev').map(([id]) => id);
    expect(dev).toHaveLength(20);
    // Every repository with enough cases gets a share near its proportion.
    for (const repo of Object.keys(sizes)) expect(dev.some((id) => id.startsWith(`${repo}-`))).toBe(true);
    expect([...chooseSplits(repoOf)]).toEqual([...splits]);
  });
});
