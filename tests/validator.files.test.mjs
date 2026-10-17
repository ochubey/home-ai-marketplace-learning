import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, makeRepo, runValidator, check, assertOk, assertProblem, marketplaceJson } from './helpers.mjs';

const filesLib = await import(pathToFileURL(path.join(REPO_ROOT, 'scripts/lib/files.mjs')).href).catch(() => ({}));
const gitOk = spawnSync('git', ['--version']).status === 0;
const ghToken = 'ghp' + '_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6';

describe('T3 files and json (AC-17)', () => {
  it('accepts CRLF line endings in JSON', () => {
    assertOk(check({ '.claude-plugin/marketplace.json': marketplaceJson().replace(/\n/g, '\r\n') }));
  });

  it('fails a BOM in marketplace.json with json-bom', () => {
    assertProblem(check({ '.claude-plugin/marketplace.json': '﻿' + marketplaceJson() }), 'json-bom', 'marketplace.json');
  });

  it('skips binary files and does not count them', () => {
    const root = makeRepo({ 'img.bin': Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(ghToken)]) });
    const r = runValidator(root);
    assertOk(r);
    assert.match(r.stdout, /2 files scanned/);
  });

  it('walk mode normalises separators, sorts, and skips .git and node_modules', () => {
    const root = makeRepo({
      'b/c/d.txt': 'x\n',
      'a.txt': 'x\n',
      'node_modules/pkg/i.txt': ghToken + '\n',
      '.git/config': 'x\n',
    });
    const { files } = filesLib.listFiles(root);
    assert.deepEqual(files, ['.claude-plugin/marketplace.json', '.github/CODEOWNERS', 'a.txt', 'b/c/d.txt']);
    assertOk(runValidator(root));
  });

  it('git mode lists untracked-not-ignored files and skips ignored .env', { skip: !gitOk }, () => {
    const root = makeRepo({
      '.gitignore': '.env\n',
      '.env': 'A=1\n',
      'notes.txt': ghToken + '\n',
    });
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
    const { files } = filesLib.listFiles(root);
    assert.ok(files.includes('notes.txt'));
    assert.ok(!files.includes('.env'));
    const r = runValidator(root);
    assertProblem(r, 'secret-github', 'notes.txt:1');
    assert.ok(!r.stdout.includes('secret-env-file'));
  });
});
