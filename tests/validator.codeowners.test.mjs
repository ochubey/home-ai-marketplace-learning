import { describe, it } from 'node:test';
import { check, withPlugins, assertOk, assertProblem } from './helpers.mjs';

const CO = '.github/CODEOWNERS';

describe('T7 CODEOWNERS (AC-13, 24)', () => {
  it('passes an empty catalog with only the default rule', () => {
    assertOk(check({ [CO]: '* @owner\n' }));
    assertOk(check({ [CO]: '# comment\n\n/** @owner\n' }));
  });

  it('fails a missing file', () => {
    assertProblem(check({ [CO]: null }), 'codeowners-missing', CO);
  });

  it('fails without a default owner rule', () => {
    assertProblem(check({ [CO]: '/docs/ @owner\n' }), 'codeowners-default');
    assertProblem(check({ [CO]: '*\n' }), 'codeowners-default');
    assertProblem(check({ [CO]: '# * @owner\n' }), 'codeowners-default');
  });

  it('fails a plugin covered only by the default rule', () => {
    assertProblem(check(withPlugins([{ name: 'alpha', owned: false }])), 'codeowners-plugin', 'plugins/alpha');
  });

  it('accepts a plugin-specific rule', () => {
    assertOk(check(withPlugins([{ name: 'alpha' }])));
    assertOk(check(withPlugins([{ name: 'alpha', owned: false }], { [CO]: '* @o\nplugins/alpha/ @a\n' })));
    assertOk(check(withPlugins([{ name: 'alpha', owned: false }], { [CO]: '* @o\n/plugins/* @a\n' })));
    assertOk(check(withPlugins([{ name: 'alpha', owned: false }], { [CO]: '* @o\n/plugins/**/plugin.json a@b.co\n' })));
    assertOk(check(withPlugins([{ name: 'alpha', owned: false }], { [CO]: '* @o\n/plugins/alph? @a\n' })));
  });

  it('uses last-match semantics', () => {
    const files = withPlugins([{ name: 'alpha' }], { [CO]: '/plugins/alpha/ @a\n* @o\n' });
    assertProblem(check(files), 'codeowners-plugin', 'plugins/alpha');
  });

  it('fails a plugin rule that has no owner', () => {
    const files = withPlugins([{ name: 'alpha' }], { [CO]: '* @o\n/plugins/alpha/\n' });
    assertProblem(check(files), 'codeowners-plugin', 'plugins/alpha');
  });

  it('does not match a different plugin directory', () => {
    const files = withPlugins([{ name: 'alpha' }], { [CO]: '* @o\n/plugins/alpha-other/ @a\n' });
    assertProblem(check(files), 'codeowners-plugin', 'plugins/alpha');
  });
});
