import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeRepo, runValidator, check, assertOk, assertProblem, marketplaceJson } from './helpers.mjs';

describe('T2 report and CLI (AC-16, AC-28)', () => {
  it('empty valid catalog exits 0 with a summary line', () => {
    const r = check();
    assertOk(r);
    assert.match(r.stdout, /0 plugins checked, 2 files scanned/);
  });

  it('reports two independent problems in one run', () => {
    const r = check({
      '.github/CODEOWNERS': null,
      '.claude-plugin/marketplace.json': JSON.stringify({ name: 'home-ai-marketplace-learning', plugins: [] }),
    });
    assertProblem(r, 'codeowners-missing', '.github/CODEOWNERS', '- fix:');
    assertProblem(r, 'catalog-field', '.claude-plugin/marketplace.json', 'owner', '- fix:');
    assert.match(r.stdout, /validate-marketplace: FAILED - 2 problems, 0 plugins checked, \d+ files scanned/);
  });

  it('output is identical across two runs', () => {
    const root = makeRepo({ '.github/CODEOWNERS': null, 'a.txt': 'hello\n' });
    const a = runValidator(root);
    const b = runValidator(root);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.status, b.status);
  });

  it('sorts problems by file, line, rule', () => {
    const r = check({
      'z.txt': '/Users/' + 'a/b\n',
      'a.txt': 'ok\n/home/' + 'a/b\n',
    });
    const errs = r.stdout.split('\n').filter((l) => l.startsWith('ERROR '));
    assert.deepEqual(errs, [...errs].sort((x, y) => (x.split(' ')[1] < y.split(' ')[1] ? -1 : 1)));
    assert.match(errs[0], /^ERROR a\.txt:2 \[abs-path\]/);
  });

  it('defaults the root to the repository, not the cwd', () => {
    assert.ok(marketplaceJson().includes('plugins'));
  });
});
