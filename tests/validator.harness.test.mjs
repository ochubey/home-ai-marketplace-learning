import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, check, assertOk } from './helpers.mjs';

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('T1 harness (AC-15)', () => {
  it('validates the empty skeleton with plain node', () => {
    assertOk(check());
  });

  it('has no package.json and no node_modules at the repo root', () => {
    assert.equal(existsSync(path.join(REPO_ROOT, 'package.json')), false);
    assert.equal(existsSync(path.join(REPO_ROOT, 'node_modules')), false);
  });

  it('scripts import only node: built-ins or relative files', () => {
    const files = walk(path.join(REPO_ROOT, 'scripts')).filter((f) => f.endsWith('.mjs'));
    assert.ok(files.length > 0);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const specs = [
        ...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
        ...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
        ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
      ].map((m) => m[1]);
      for (const spec of specs) {
        assert.ok(spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../'), `${file}: ${spec}`);
        if (!spec.startsWith('node:')) {
          assert.ok(existsSync(path.resolve(path.dirname(file), spec)), `${file}: missing ${spec}`);
        }
      }
    }
  });
});
