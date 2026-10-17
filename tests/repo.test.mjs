import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, MARKETPLACE_NAME, runValidator } from './helpers.mjs';

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

describe('T11 catalog skeleton (AC-1, AC-2)', () => {
  it('marketplace.json declares name, owner and an empty plugins array', () => {
    const m = JSON.parse(read('.claude-plugin/marketplace.json'));
    assert.equal(m.name, MARKETPLACE_NAME);
    assert.equal(m.owner.name, 'AI Engineering (ochubey)');
    assert.ok(typeof m.metadata?.description === 'string' && m.metadata.description.length > 0);
    assert.ok(Array.isArray(m.plugins));
    assert.equal(m.plugins.length, 0);
  });

  it('plugins/README.md exists', () => {
    assert.ok(existsSync(path.join(REPO_ROOT, 'plugins/README.md')));
  });

  it('.gitignore carries the required entries', () => {
    const lines = read('.gitignore').split(/\r?\n/);
    for (const l of ['.env', '.env.*', '!.env.example', '.DS_Store', 'node_modules/', '.claude/settings.local.json']) {
      assert.ok(lines.includes(l), `missing ${l}`);
    }
  });

  // CODEOWNERS arrives in Phase 4 (T18); until then it is the only expected problem.
  // Replace this with a plain "exit 0" assertion once .github/CODEOWNERS exists.
  it('the validator reports no problem on this repository except the pending CODEOWNERS file', () => {
    const r = runValidator(REPO_ROOT);
    const errors = r.stdout.split('\n').filter((l) => l.startsWith('ERROR '));
    const pending = existsSync(path.join(REPO_ROOT, '.github/CODEOWNERS')) ? [] : ['[codeowners-missing]'];
    assert.equal(errors.filter((l) => !pending.some((p) => l.includes(p))).length, 0, r.stdout);
    assert.match(r.stdout, /0 plugins checked/);
  });
});
