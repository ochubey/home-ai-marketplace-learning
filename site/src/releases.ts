import type { Release } from './types';

function parse(v: string): { core: number[]; pre: string | null } {
  const [core = '', pre] = v.split('-', 2);
  return { core: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre: pre ?? null };
}

export function compareSemver(a: string, b: string): number {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
    if (d !== 0) return d;
  }
  if (x.pre === y.pre) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/** Dated releases newest first, then undated ones by plugin name and semver descending. */
export function sortReleases(releases: Release[]): Release[] {
  return [...releases].sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || a.plugin.localeCompare(b.plugin) || compareSemver(b.version, a.version);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.plugin.localeCompare(b.plugin) || compareSemver(b.version, a.version);
  });
}

export const newestReleases = (releases: Release[], count: number) => sortReleases(releases).slice(0, count);
