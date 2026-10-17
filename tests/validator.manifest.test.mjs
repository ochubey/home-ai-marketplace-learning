import { describe, it } from 'node:test';
import { check, withPlugins, assertOk, assertProblem, assertNoProblem } from './helpers.mjs';

const PJ = 'plugins/alpha/.claude-plugin/plugin.json';

describe('T5 manifest and semver (AC-20, 21, 22)', () => {
  it('accepts valid versions including pre-release and build suffixes', () => {
    for (const version of ['1.0.0', '1.0.0-rc.1', '0.0.1+build.5', '2.1.3-alpha.1+meta']) {
      assertOk(check(withPlugins([{ name: 'alpha', version }])));
    }
  });

  it('fails invalid or missing versions', () => {
    for (const version of ['1.0', 'v1.0.0', '1.0.0.0', '01.0.0', '', 'latest']) {
      assertProblem(check(withPlugins([{ name: 'alpha', version }])), 'plugin-version', PJ);
    }
    assertProblem(check(withPlugins([{ name: 'alpha', version: undefined }])), 'plugin-version', 'missing');
  });

  it('fails a non-string version', () => {
    assertProblem(check(withPlugins([{ name: 'alpha', version: 1 }])), 'plugin-version');
  });

  it('fails a name mismatch and names both values', () => {
    assertProblem(check(withPlugins([{ name: 'alpha', manifest: { name: 'beta' } }])), 'plugin-name-mismatch', 'alpha', 'beta');
  });

  it('fails a BOM in plugin.json', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files[PJ] = '﻿' + files[PJ];
    assertProblem(check(files), 'json-bom', PJ);
  });

  it('fails invalid plugin.json', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files[PJ] = '[1,';
    assertProblem(check(files), 'json-invalid', PJ);
  });

  it('allows a catalog version only when equal to plugin.json', () => {
    assertOk(check(withPlugins([{ name: 'alpha', entry: { version: '1.0.0' } }])));
    const r = check(withPlugins([{ name: 'alpha', version: '1.0.1', entry: { version: '1.0.0' } }]));
    assertProblem(r, 'catalog-version-mismatch', '1.0.0', '1.0.1');
    assertNoProblem(r, 'plugin-version');
  });
});
