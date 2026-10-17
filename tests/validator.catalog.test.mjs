import { describe, it } from 'node:test';
import { check, withPlugins, assertOk, assertProblem, assertNoProblem, marketplaceJson, entry, json } from './helpers.mjs';

const MP = '.claude-plugin/marketplace.json';

describe('T4 catalog (AC-3, 17, 18, 19)', () => {
  it('accepts a valid catalog with one plugin', () => {
    assertOk(check(withPlugins([{ name: 'alpha' }])));
  });

  it('fails when marketplace.json is missing', () => {
    assertProblem(check({ [MP]: null }), 'catalog-missing', MP);
  });

  it('fails when marketplace.json is not valid JSON', () => {
    assertProblem(check({ [MP]: '{ nope' }), 'json-invalid', MP);
  });

  it('names the missing field: name, owner, plugins', () => {
    assertProblem(check({ [MP]: json({ owner: { name: 'o' }, plugins: [] }) }), 'catalog-field', 'name');
    assertProblem(check({ [MP]: json({ name: 'm', plugins: [] }) }), 'catalog-field', 'owner');
    assertProblem(check({ [MP]: json({ name: 'm', owner: { name: 'o' } }) }), 'catalog-field', 'plugins');
    assertProblem(check({ [MP]: json({ name: 'M_x', owner: { name: 'o' }, plugins: [] }) }), 'catalog-field', 'kebab-case');
  });

  it('requires kebab-case entry names without reserved prefixes', () => {
    for (const bad of ['Alpha', 'claude-tools', 'anthropic-x', 'anthropics-x', 'cc-plugin-x']) {
      assertProblem(check({ [MP]: marketplaceJson([entry(bad)]) }), 'entry-name', bad);
    }
  });

  it('fails duplicate entry names', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files[MP] = marketplaceJson([entry('alpha'), entry('alpha')]);
    assertProblem(check(files), 'entry-duplicate', 'alpha');
  });

  it('requires source to equal ./plugins/<name>', () => {
    const bad = [
      './plugins/other',
      '../plugins/alpha',
      '/abs/plugins/alpha',
      './other/alpha',
      './plugins/../plugins/alpha',
      'plugins/alpha',
    ];
    for (const source of bad) {
      const files = withPlugins([{ name: 'alpha' }]);
      files[MP] = marketplaceJson([{ name: 'alpha', source }]);
      assertProblem(check(files), 'entry-source', 'alpha');
    }
  });

  it('rejects remote and object sources with a relative-sources-only message', () => {
    for (const source of ['https://example.com/x.git', { source: 'github', repo: 'a/b' }]) {
      const files = withPlugins([{ name: 'alpha' }]);
      files[MP] = marketplaceJson([{ name: 'alpha', source }]);
      assertProblem(check(files), 'entry-source', 'relative sources only');
    }
  });

  it('fails when the source directory is missing', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files['plugins/alpha/.claude-plugin/plugin.json'] = null;
    files[MP] = marketplaceJson([entry('ghost')]);
    assertProblem(check(files), 'plugin-dir-missing', 'ghost');
  });

  it('fails when plugin.json is missing from the source directory', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files['plugins/alpha/.claude-plugin/plugin.json'] = null;
    files['plugins/alpha/README.md'] = 'hello\n';
    assertProblem(check(files), 'plugin-manifest-missing', 'alpha');
  });

  it('fails an orphan folder under plugins/ and ignores plain files', () => {
    const files = withPlugins([{ name: 'alpha' }]);
    files['plugins/README.md'] = 'notes\n';
    assertOk(check(files));
    files['plugins/orphan/readme.md'] = 'x\n';
    assertProblem(check(files), 'plugin-orphan', 'plugins/orphan');
  });

  it('does not report an orphan for a dir whose entry exists', () => {
    assertNoProblem(check(withPlugins([{ name: 'alpha' }])), 'plugin-orphan');
  });
});
