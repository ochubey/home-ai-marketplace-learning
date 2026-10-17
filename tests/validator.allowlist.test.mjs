import { describe, it } from 'node:test';
import { check, assertOk, assertProblem, json } from './helpers.mjs';

const AL = 'scripts/validate-allowlist.json';
const sample = '/home/' + 'alice/.config';
const doc = `Example of a forbidden path: ${sample}\n`;
const entry = (extra = {}) => ({ path: 'docs/SECURITY.md', rule: 'abs-path', contains: sample, reason: 'documents the forbidden pattern', ...extra });
const allow = (...entries) => json({ entries });

describe('T9 allowlist (AC-27)', () => {
  it('suppresses a match only when path, rule and contains all match', () => {
    assertOk(check({ 'docs/SECURITY.md': doc, [AL]: allow(entry()) }));
  });

  it('the same line in a non-allowlisted file still fails', () => {
    const r = check({ 'docs/SECURITY.md': doc, 'README.md': doc, [AL]: allow(entry()) });
    assertProblem(r, 'abs-path', 'README.md:1');
  });

  it('a different rule or contains does not suppress', () => {
    assertProblem(check({ 'docs/SECURITY.md': doc, [AL]: allow(entry({ rule: 'secret-github' })) }), 'abs-path', 'docs/SECURITY.md:1');
    assertProblem(check({ 'docs/SECURITY.md': doc, [AL]: allow(entry({ contains: 'other text' })) }), 'abs-path', 'docs/SECURITY.md:1');
  });

  it('reports schema errors as allowlist-invalid', () => {
    assertProblem(check({ [AL]: '{ nope' }), 'allowlist-invalid', AL);
    assertProblem(check({ [AL]: json({ nope: [] }) }), 'allowlist-invalid', 'entries');
    assertProblem(check({ [AL]: allow({ path: 'a', rule: 'abs-path' }) }), 'allowlist-invalid', 'contains');
    assertProblem(check({ [AL]: allow(entry({ reason: '' })) }), 'allowlist-invalid', 'reason');
    assertProblem(check({ [AL]: allow('text') }), 'allowlist-invalid');
  });

  it('reports an entry that suppresses nothing as allowlist-stale', () => {
    assertProblem(check({ 'docs/SECURITY.md': 'clean\n', [AL]: allow(entry()) }), 'allowlist-stale', 'docs/SECURITY.md');
  });

  it('accepts an empty allowlist and a missing allowlist file', () => {
    assertOk(check({ [AL]: allow() }));
    assertOk(check());
  });

  it('exempts the allowlist file only for its own contains values', () => {
    assertOk(check({ 'docs/SECURITY.md': doc, [AL]: allow(entry()) }));
    const other = '/home/' + 'mallory/x';
    const files = { 'docs/SECURITY.md': doc, [AL]: allow(entry({ reason: `see ${other}` })) };
    assertProblem(check(files), 'abs-path', AL);
  });
});
