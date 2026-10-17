import { describe, expect, it } from 'vitest';
import { compareSemver, newestReleases, sortReleases } from './releases';
import type { Release } from './types';

const r = (plugin: string, version: string, date: string | null): Release => ({ plugin, version, date, isCurrent: false, body: '' });

describe('compareSemver', () => {
  it('compares numerically, not as text', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.0.0', '10.0.0')).toBeLessThan(0);
  });

  it('puts a prerelease before its release', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
  });
});

describe('sortReleases', () => {
  it('orders dated releases newest first, then undated by plugin name and version descending', () => {
    const sorted = sortReleases([
      r('b', '1.0.0', null),
      r('a', '1.0.0', null),
      r('a', '1.10.0', null),
      r('z', '1.0.0', '2026-01-05'),
      r('y', '2.0.0', '2026-03-01'),
      r('a', '0.9.0', null),
    ]);
    expect(sorted.map((x) => `${x.plugin}@${x.version}`)).toEqual(['y@2.0.0', 'z@1.0.0', 'a@1.10.0', 'a@1.0.0', 'a@0.9.0', 'b@1.0.0']);
  });

  it('does not change its input', () => {
    const input = [r('b', '1.0.0', null), r('a', '1.0.0', null)];
    sortReleases(input);
    expect(input[0]?.plugin).toBe('b');
  });
});

describe('newestReleases', () => {
  it('returns at most the requested count of the sorted feed', () => {
    const list = Array.from({ length: 8 }, (_, i) => r('p', `1.${i}.0`, null));
    const top = newestReleases(list, 5);
    expect(top).toHaveLength(5);
    expect(top[0]?.version).toBe('1.7.0');
  });
});
