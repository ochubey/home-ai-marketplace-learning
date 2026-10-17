// Releases from CHANGELOG.md: one per `## <semver>` heading. Dates come only from the heading.
import { isSemver } from '../lib/semver.mjs';
import { cmp } from './util.mjs';
import { capBody } from './text.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s) {
  if (!DATE_RE.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s) ? s : null;
}

/** Returns { version, date } for a heading text, or null when it is not a version heading. */
export function parseHeading(text) {
  const m = /^\[?(\S+?)\]?(?:\s+(.*))?$/.exec(text.trim());
  if (!m || !isSemver(m[1])) return null;
  const rest = (m[2] ?? '').trim();
  const dated = /^(?:[-\u2013\u2014]\s*(\d{4}-\d{2}-\d{2})|\((\d{4}-\d{2}-\d{2})\))/.exec(rest);
  return { version: m[1], date: dated ? validDate(dated[1] ?? dated[2]) : null };
}

/** SemVer 2.0.0 precedence; build metadata is ignored. */
export function compareSemver(a, b) {
  const split = (v) => {
    const [core, pre] = v.split('+')[0].split(/-(.*)/s);
    return { nums: core.split('.').map(Number), pre: pre === undefined ? null : pre.split('.') };
  };
  const x = split(a);
  const y = split(b);
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] < y.nums[i] ? -1 : 1;
  if (x.pre === null && y.pre === null) return 0;
  if (x.pre === null) return 1;
  if (y.pre === null) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) {
      if (Number(p) !== Number(q)) return Number(p) < Number(q) ? -1 : 1;
    } else if (pn !== qn) return pn ? -1 : 1;
    else if (p !== q) return cmp(p, q);
  }
  return 0;
}

/** Splits a changelog into sections: [{ version, date, body }]. */
export function parseChangelog(text) {
  const sections = [];
  let current = null;
  let fence = null;
  const finish = () => {
    if (current) current.body = current.lines.join('\n').replace(/^\s*\n/, '').replace(/\s+$/, '');
  };
  for (const line of text.split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (fence === null) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    }
    const h = fence === null ? /^## +(.+?)\s*#*\s*$/.exec(line) : null;
    if (h) {
      finish();
      const parsed = parseHeading(h[1]);
      current = parsed ? { ...parsed, lines: [] } : null;
      if (current) sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  finish();
  return sections.map(({ version, date, body }) => ({ version, date, body }));
}

export function buildReleases(ctx, plugins) {
  const releases = [];
  for (const plugin of plugins) {
    const file = `${plugin.sourcePath}/CHANGELOG.md`;
    let text;
    try {
      text = ctx.readText(ctx.abs(file));
    } catch {
      ctx.warn(`${file}: CHANGELOG.md is missing or unreadable, no releases for ${plugin.name}`);
      continue;
    }
    const seen = new Set();
    let hasCurrent = false;
    for (const s of parseChangelog(text)) {
      if (seen.has(s.version)) {
        ctx.warn(`${file}: duplicate release heading ${s.version}, kept the first`);
        continue;
      }
      seen.add(s.version);
      const isCurrent = s.version === plugin.version;
      hasCurrent ||= isCurrent;
      releases.push({ plugin: plugin.name, version: s.version, date: s.date, isCurrent, body: capBody(s.body, file) });
    }
    if (!hasCurrent) ctx.warn(`${file}: no release matches the manifest version ${plugin.version} of ${plugin.name}`);
  }
  return releases.sort((a, b) => cmp(a.plugin, b.plugin) || compareSemver(b.version, a.version));
}
