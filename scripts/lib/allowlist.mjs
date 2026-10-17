// Explicit allowlist for documents that must show a forbidden pattern as an example.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { problem } from './report.mjs';

export const ALLOWLIST_FILE = 'scripts/validate-allowlist.json';
const FIELDS = ['path', 'rule', 'contains', 'reason'];

function loadEntries(root, files, problems) {
  if (!files.includes(ALLOWLIST_FILE)) return [];
  let data;
  try {
    data = JSON.parse(readFileSync(path.join(root, ...ALLOWLIST_FILE.split('/')), 'utf8'));
  } catch (err) {
    problems.push(problem(ALLOWLIST_FILE, 'allowlist-invalid', `invalid JSON: ${err.message}`, 'fix the JSON syntax'));
    return [];
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) {
    problems.push(problem(ALLOWLIST_FILE, 'allowlist-invalid', 'expected an object with an "entries" array', 'use { "entries": [] }'));
    return [];
  }
  const entries = [];
  data.entries.forEach((e, i) => {
    const bad = !e || typeof e !== 'object' ? FIELDS : FIELDS.filter((f) => typeof e[f] !== 'string' || e[f].trim() === '');
    if (bad.length) {
      problems.push(
        problem(ALLOWLIST_FILE, 'allowlist-invalid', `entries[${i}] needs non-empty string field(s): ${bad.join(', ')}`, 'give every entry path, rule, contains and reason'),
      );
      return;
    }
    entries.push({ path: e.path, rule: e.rule, contains: e.contains, used: false });
  });
  return entries;
}

/** Applies the allowlist to scan findings and appends the surviving problems. */
export function applyAllowlist(root, files, findings, problems) {
  const entries = loadEntries(root, files, problems);
  for (const f of findings) {
    const hit = entries.filter((e) => e.path === f.file && e.rule === f.rule && f.text.includes(e.contains));
    if (hit.length) {
      for (const e of hit) e.used = true;
      continue;
    }
    // The allowlist file itself may only carry the values it allows.
    if (f.file === ALLOWLIST_FILE && entries.some((e) => e.rule === f.rule && e.contains.includes(f.value))) continue;
    problems.push(f.problem);
  }
  for (const e of entries) {
    if (!e.used) {
      problems.push(
        problem(ALLOWLIST_FILE, 'allowlist-stale', `entry for ${e.path} [${e.rule}] suppresses nothing`, 'remove the entry or fix its path, rule or contains'),
      );
    }
  }
}
