// Tests for the catalog-site indexer (scripts/build-index.mjs). One describe per acceptance criterion
// of SPEC-04 (AC-1 .. AC-15, AC-28); the repository case runs the indexer on this repository.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, symlinkSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, INDEXER, MARKETPLACE_NAME, tempDir, writeRepo, simpleRepoFiles, fullRepoFiles, runIndexer,
  gitAvailable, gitCommit, CHANGELOG_MIXED, HOSTILE_SKILL,
} from './site-index-fixtures.mjs';
import { json, marketplaceJson } from './helpers.mjs';

const SCRIPTS = path.join(REPO_ROOT, 'scripts');
const byId = (index, id) => index.artifacts.find((a) => a.id === id);
const listFiles = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
};

describe('AC-1 indexer imports', () => {
  const importRe = /(?:^|[\s;])(?:import|export)\s+(?:[^'"`;]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specifiers = (file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(importRe)].map((m) => m[1] ?? m[2] ?? m[3]);
  };

  it('imports only node: built-ins and files under scripts/, transitively', () => {
    const seen = new Set();
    const queue = [INDEXER];
    while (queue.length) {
      const file = queue.pop();
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of specifiers(file)) {
        if (spec.startsWith('node:')) continue;
        assert.ok(spec.startsWith('./') || spec.startsWith('../'), `${path.relative(REPO_ROOT, file)} imports bare specifier "${spec}"`);
        const target = path.resolve(path.dirname(file), spec);
        assert.ok(target.startsWith(SCRIPTS + path.sep), `${spec} resolves outside scripts/`);
        assert.ok(existsSync(target), `${spec} imported by ${path.relative(REPO_ROOT, file)} does not exist`);
        queue.push(target);
      }
    }
    assert.ok(seen.size > 5, 'expected the indexer to be split into modules');
  });

  it('the import scanner sees static, side-effect, re-export and dynamic imports', () => {
    const dir = tempDir();
    const f = path.join(dir, 'x.mjs');
    writeFileSync(f, "import a from 'fs';\nimport 'path';\nexport * from 'os';\nexport { b } from 'url';\nconst c = await import('zlib');\n");
    assert.deepEqual(specifiers(f).sort(), ['fs', 'os', 'path', 'url', 'zlib']);
  });
});

describe('AC-2 output files and keys', () => {
  it('writes index, releases, stats and one body per artifact with a body', () => {
    const r = runIndexer(writeRepo(fullRepoFiles()));
    assert.equal(r.status, 0, r.stderr);
    for (const f of ['index.json', 'releases.json', 'stats.json']) assert.equal(r.readJson(f).schemaVersion, 1, f);
    const index = r.readJson('index.json');
    assert.deepEqual(Object.keys(index), ['schemaVersion', 'marketplace', 'source', 'plugins', 'artifacts']);
    assert.deepEqual(Object.keys(index.marketplace), ['name', 'owner', 'description']);
    assert.deepEqual(Object.keys(index.source), ['repoUrl', 'commit', 'commitDate']);
    assert.deepEqual(Object.keys(index.plugins[0]), [
      'id', 'name', 'version', 'description', 'author', 'dependencies', 'usedBy', 'counts', 'hasReadme', 'sourcePath',
    ]);
    assert.deepEqual(Object.keys(index.artifacts[0]), [
      'id', 'kind', 'plugin', 'name', 'namespacedName', 'description', 'frontmatter', 'details', 'sourcePath', 'supportingFiles', 'hasBody', 'searchText',
    ]);
    assert.deepEqual(Object.keys(r.readJson('releases.json')), ['schemaVersion', 'releases']);
    assert.deepEqual(Object.keys(r.readJson('releases.json').releases[0]), ['plugin', 'version', 'date', 'isCurrent', 'body']);
    assert.deepEqual(Object.keys(r.readJson('stats.json')), [
      'schemaVersion', 'plugins', 'counts', 'dependencyEdges', 'releases', 'commit', 'commitDate',
    ]);
    const bodies = listFiles(path.join(r.out, 'bodies')).map((p) => path.relative(path.join(r.out, 'bodies'), p).split(path.sep).join('/')).sort();
    const expected = index.artifacts.filter((a) => a.hasBody).map((a) => `${a.id}.md`).sort();
    assert.deepEqual(bodies, expected);
    const all = [...listFiles(r.out)].map((p) => path.relative(r.out, p).split(path.sep).join('/'));
    assert.ok(all.every((p) => p === 'index.json' || p === 'releases.json' || p === 'stats.json' || p.startsWith('bodies/')), all.join(','));
  });

  it('prints one summary line per kind', () => {
    const r = runIndexer(writeRepo(fullRepoFiles()));
    for (const kind of ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp']) {
      assert.match(r.stdout, new RegExp(`^build-index: ${kind} \\d+$`, 'm'), r.stdout);
    }
  });
});

describe('AC-3 catalog and artifact kinds', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));
  const index = r.readJson('index.json');

  it('lists plugins in catalog order with manifest fields', () => {
    assert.deepEqual(index.plugins.map((p) => p.name), ['alpha', 'beta', 'gamma']);
    assert.equal(index.plugins[0].version, '1.2.0');
    assert.equal(index.plugins[0].description, 'alpha description');
    assert.deepEqual(index.plugins[0].author, { name: 'Fixture Author' });
    assert.equal(index.marketplace.name, MARKETPLACE_NAME);
    assert.equal(index.marketplace.description, 'Fixture marketplace.');
  });

  it('lists every kind', () => {
    const kinds = new Set(index.artifacts.map((a) => a.kind));
    assert.deepEqual([...kinds].sort(), ['agent', 'command', 'hook', 'mcp', 'plugin', 'skill']);
    assert.ok(byId(index, 'alpha/skill/spec-writing'));
    assert.ok(byId(index, 'alpha/agent/reviewer'));
    assert.ok(byId(index, 'alpha/command/deploy'));
    assert.ok(byId(index, 'alpha/hook/hooks'));
    assert.ok(byId(index, 'alpha/mcp/files'));
    assert.ok(byId(index, 'alpha/mcp/remote'));
    assert.equal(byId(index, 'alpha').kind, 'plugin');
    assert.equal(byId(index, 'alpha/skill/spec-writing').namespacedName, 'alpha:spec-writing');
    assert.deepEqual(index.plugins[0].counts, { skill: 6, agent: 1, command: 1, hook: 1, mcp: 2 });
  });

  it('reads hooks from plugin.json and mcpServers from plugin.json', () => {
    const files = simpleRepoFiles({
      p: { manifest: { hooks: { Stop: [] }, mcpServers: { inline: { command: 'x' } } } },
    });
    const rr = runIndexer(writeRepo(files));
    assert.equal(rr.status, 0, rr.stderr);
    const idx = rr.readJson('index.json');
    assert.deepEqual(byId(idx, 'p/hook/hooks').details, { events: ['Stop'] });
    assert.deepEqual(byId(idx, 'p/mcp/inline').details, { transport: 'stdio' });
  });
});

describe('AC-4 frontmatter fallbacks', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));
  const index = r.readJson('index.json');

  it('uses frontmatter name and description', () => {
    const a = byId(index, 'alpha/skill/spec-writing');
    assert.equal(a.name, 'spec-writing');
    assert.equal(a.description, 'Writes specs');
  });
  it('falls back to the folder name when name is missing', () => {
    const a = byId(index, 'alpha/skill/no-name');
    assert.equal(a.name, 'no-name');
    assert.equal(a.description, 'Has no name');
  });
  it('uses null when description is missing', () => {
    assert.equal(byId(index, 'alpha/skill/no-desc').description, null);
  });
  it('accepts a file without frontmatter', () => {
    const a = byId(index, 'alpha/skill/no-fm');
    assert.equal(a.name, 'no-fm');
    assert.equal(a.description, null);
    assert.equal(r.read('bodies/alpha/skill/no-fm.md'), 'Just a body, no frontmatter.\n');
  });
  it('keeps only allowlisted frontmatter keys per kind', () => {
    assert.deepEqual(byId(index, 'alpha/skill/spec-writing').frontmatter, {
      'allowed-tools': 'Read, Grep', 'argument-hint': '<topic>', 'disable-model-invocation': true,
    });
    assert.deepEqual(byId(index, 'alpha/agent/reviewer').frontmatter, {
      tools: ['Read', 'Grep'], disallowedTools: 'Write, Edit', model: 'sonnet',
    });
    assert.deepEqual(byId(index, 'alpha/command/deploy').frontmatter, { description: 'Deploys', 'argument-hint': '<env>' });
  });
  it('does not stop on an unterminated frontmatter block', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { files: { 'skills/s/SKILL.md': '---\nname: s\nno end\n' } } })));
    assert.equal(rr.status, 0);
    assert.equal(byId(rr.readJson('index.json'), 'p/skill/s').name, 's');
  });
});

describe('AC-5 path-derived IDs', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));
  const index = r.readJson('index.json');

  it('uses the folder name for the ID and body path, never the frontmatter name', () => {
    const a = byId(index, 'alpha/skill/evil-name');
    assert.equal(a.name, '../../evil');
    assert.equal(a.namespacedName, 'alpha:../../evil');
    assert.ok(r.has('bodies/alpha/skill/evil-name.md'));
    assert.ok(index.artifacts.every((x) => x.id.split('/').every((s) => /^[a-z0-9][a-z0-9-]*$/.test(s))));
  });
  it('skips a non-kebab folder with a warning naming the path', () => {
    assert.ok(!index.artifacts.some((a) => a.id.includes('Bad')));
    assert.match(r.stderr, /warning: .*plugins\/alpha\/skills\/Bad Name/);
  });
  it('writes nothing outside the output dir', () => {
    const root = writeRepo(fullRepoFiles());
    const parent = tempDir();
    const out = path.join(parent, 'out');
    runIndexer(root, { out });
    assert.deepEqual(readdirSync(parent), ['out']);
  });
  it('rejects a catalog plugin name that is not a safe segment', () => {
    const files = simpleRepoFiles({ p: {} });
    files['.claude-plugin/marketplace.json'] = marketplaceJson([{ name: '../evil', source: './plugins/p' }]);
    const rr = runIndexer(writeRepo(files));
    assert.equal(rr.status, 1);
    assert.match(rr.stderr, /error: .*marketplace\.json/);
  });
  it('rejects a catalog source outside plugins/', () => {
    const files = simpleRepoFiles({ p: {} });
    files['.claude-plugin/marketplace.json'] = marketplaceJson([{ name: 'p', source: '../elsewhere' }]);
    const rr = runIndexer(writeRepo(files));
    assert.equal(rr.status, 1);
    assert.match(rr.stderr, /error: /);
  });
});

describe('AC-6 dependencies', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));
  const index = r.readJson('index.json');
  const plugin = (n) => index.plugins.find((p) => p.name === n);

  it('records the three dependency forms with inCatalog', () => {
    assert.deepEqual(plugin('alpha').dependencies, [
      { name: 'beta', marketplace: null, range: null, inCatalog: true },
      { name: 'gamma', marketplace: MARKETPLACE_NAME, range: '^1.0.0', inCatalog: true },
      { name: 'outside', marketplace: null, range: null, inCatalog: false },
    ]);
    assert.deepEqual(plugin('gamma').dependencies, [{ name: 'beta', marketplace: MARKETPLACE_NAME, range: null, inCatalog: true }]);
  });
  it('computes usedBy as the reverse of catalog-internal edges', () => {
    assert.deepEqual(plugin('beta').usedBy, ['alpha', 'gamma']);
    assert.deepEqual(plugin('gamma').usedBy, ['alpha']);
    assert.deepEqual(plugin('alpha').usedBy, []);
  });
  it('counts internal edges in stats', () => {
    assert.equal(r.readJson('stats.json').dependencyEdges, 3);
  });
  it('marks a dependency on another marketplace as not in the catalog', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { manifest: { dependencies: ['beta@other-marketplace'] } } })));
    assert.equal(rr.readJson('index.json').plugins[0].dependencies[0].inCatalog, false);
  });
  it('warns about and skips a malformed dependency item', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { manifest: { dependencies: [42, 'ok'] } } })));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*dependencies\[0\]/);
    assert.equal(rr.readJson('index.json').plugins[0].dependencies.length, 1);
  });
});

describe('AC-7 releases', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));
  const rel = r.readJson('releases.json').releases.filter((x) => x.plugin === 'alpha');

  it('parses only semver headings, with dates only from the heading', () => {
    assert.deepEqual(rel.map((x) => [x.version, x.date, x.isCurrent]), [
      ['1.2.0', '2026-10-01', true],
      ['1.1.0', '2026-09-01', false],
      ['1.0.0', null, false],
      ['0.9.0-rc.1', null, false],
    ]);
  });
  it('stores the section text as body, keeping fenced headings', () => {
    assert.equal(rel[0].body, 'Dated with a dash.');
    assert.match(rel[2].body, /^Undated\.\n\n```\n## 9\.9\.9\n```$/);
  });
  it('orders by plugin then semver descending', () => {
    const files = simpleRepoFiles({
      b: { manifest: { version: '1.10.0' }, files: { 'CHANGELOG.md': '## 1.2.0\nx\n\n## 1.10.0\ny\n\n## 1.9.0\nz\n' } },
      a: { files: { 'CHANGELOG.md': '## 1.0.0\nq\n' } },
    });
    const rr = runIndexer(writeRepo(files));
    assert.deepEqual(rr.readJson('releases.json').releases.map((x) => `${x.plugin}@${x.version}`), ['a@1.0.0', 'b@1.10.0', 'b@1.9.0', 'b@1.2.0']);
  });
  it('rejects an impossible date', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { files: { 'CHANGELOG.md': '## 1.0.0 - 2026-13-45\nx\n' } } })));
    assert.equal(rr.readJson('releases.json').releases[0].date, null);
  });
  it('warns when no release matches the manifest version', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { manifest: { version: '2.0.0' }, files: { 'CHANGELOG.md': '## 1.0.0\nx\n' } } })));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*p.*2\.0\.0/);
    assert.equal(rr.readJson('releases.json').releases.some((x) => x.isCurrent), false);
  });
});

describe('AC-8 missing optional files', () => {
  it('warns about a missing CHANGELOG and README and exits 0', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: {} })));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*plugins\/p\/CHANGELOG\.md/);
    assert.match(rr.stderr, /warning: .*plugins\/p\/README\.md/);
    const idx = rr.readJson('index.json');
    assert.equal(idx.plugins[0].hasReadme, false);
    assert.equal(byId(idx, 'p').hasBody, false);
    assert.equal(rr.has('bodies/p.md'), false);
    assert.deepEqual(rr.readJson('releases.json').releases, []);
  });
  it('warns about a skill folder without SKILL.md and keeps the rest', () => {
    const files = simpleRepoFiles({ p: { files: { 'skills/empty/references/x.md': 'x', 'skills/ok/SKILL.md': 'ok\n' } } });
    const rr = runIndexer(writeRepo(files));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*plugins\/p\/skills\/empty/);
    const ids = rr.readJson('index.json').artifacts.map((a) => a.id);
    assert.ok(ids.includes('p/skill/ok'));
    assert.ok(!ids.includes('p/skill/empty'));
  });
  it('warns about an unreadable artifact file (a directory named SKILL.md)', () => {
    const files = simpleRepoFiles({ p: { files: { 'skills/odd/SKILL.md/keep': 'x', 'skills/ok/SKILL.md': 'ok\n' } } });
    const rr = runIndexer(writeRepo(files));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*skills\/odd/);
  });
  it('warns about invalid JSON in hooks.json and continues', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { files: { 'hooks/hooks.json': '{nope' } } })));
    assert.equal(rr.status, 0);
    assert.match(rr.stderr, /warning: .*hooks\/hooks\.json/);
  });
});

describe('AC-9 fatal errors leave no partial output', () => {
  const cases = {
    'marketplace.json missing': (f) => { f['.claude-plugin/marketplace.json'] = null; },
    'marketplace.json invalid JSON': (f) => { f['.claude-plugin/marketplace.json'] = '{not json'; },
    'marketplace.json without plugins array': (f) => { f['.claude-plugin/marketplace.json'] = json({ name: MARKETPLACE_NAME, owner: { name: 'x' } }); },
    'plugin.json missing': (f) => { f['plugins/alpha/.claude-plugin/plugin.json'] = null; },
    'plugin.json invalid JSON': (f) => { f['plugins/alpha/.claude-plugin/plugin.json'] = '[1,'; },
    'plugin.json without version': (f) => { f['plugins/alpha/.claude-plugin/plugin.json'] = json({ name: 'alpha' }); },
  };
  for (const [label, mutate] of Object.entries(cases)) {
    it(label, () => {
      const files = fullRepoFiles();
      mutate(files);
      const parent = tempDir();
      const out = path.join(parent, 'data');
      const rr = runIndexer(writeRepo(files), { out });
      assert.equal(rr.status, 1, rr.stdout + rr.stderr);
      assert.match(rr.stderr, /error: .*(marketplace|plugin)\.json/);
      assert.deepEqual(readdirSync(parent), [], 'no output dir or temp dir left behind');
    });
  }
  it('keeps previous output untouched on error', () => {
    const good = runIndexer(writeRepo(fullRepoFiles()));
    const before = readFileSync(path.join(good.out, 'index.json'), 'utf8');
    const rr = runIndexer(writeRepo({ '.claude-plugin/marketplace.json': '{' }), { out: good.out });
    assert.equal(rr.status, 1);
    assert.equal(readFileSync(path.join(good.out, 'index.json'), 'utf8'), before);
  });
  it('refuses to replace a non-empty directory that is not indexer output', () => {
    const out = tempDir();
    writeFileSync(path.join(out, 'precious.txt'), 'keep');
    const rr = runIndexer(writeRepo(fullRepoFiles()), { out });
    assert.equal(rr.status, 1);
    assert.match(rr.stderr, /error: .*refus/);
    assert.equal(readFileSync(path.join(out, 'precious.txt'), 'utf8'), 'keep');
  });
});

describe('AC-10 empty catalog', () => {
  it('writes empty data and exits 0', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({})));
    assert.equal(rr.status, 0, rr.stderr);
    const idx = rr.readJson('index.json');
    assert.deepEqual([idx.plugins, idx.artifacts], [[], []]);
    assert.deepEqual(rr.readJson('releases.json').releases, []);
    const stats = rr.readJson('stats.json');
    assert.equal(stats.plugins, 0);
    assert.deepEqual(stats.counts, { plugin: 0, skill: 0, agent: 0, command: 0, hook: 0, mcp: 0 });
    assert.equal(stats.dependencyEdges, 0);
    assert.equal(stats.releases, 0);
  });
});

describe('AC-11 raw bodies and hostile content', () => {
  const r = runIndexer(writeRepo(fullRepoFiles()));

  it('stores the body exactly as the source minus frontmatter', () => {
    const source = HOSTILE_SKILL;
    const expected = source.slice(source.indexOf('\n---\n', 4) + 5);
    assert.equal(r.read('bodies/alpha/skill/hostile.md'), expected);
    assert.ok(expected.includes('<script>alert(1)</script>'));
    assert.ok(expected.includes('\u0000'));
  });
  it('stores the plugin README as the plugin body', () => {
    assert.equal(r.read('bodies/alpha.md'), '# Alpha\n\nAlpha readme with <b>html</b>.\n');
  });
  it('produces valid JSON in every JSON file', () => {
    for (const f of ['index.json', 'releases.json', 'stats.json']) JSON.parse(r.read(f));
  });
  it('searchText is plain text: no HTML tags, no null bytes', () => {
    const t = byId(r.readJson('index.json'), 'alpha/skill/hostile').searchText;
    assert.ok(!/<[a-z!/]/i.test(t), t);
    assert.ok(!t.includes('\u0000'));
    assert.match(t, /Hostile/);
  });
  it('handles CRLF line endings in frontmatter', () => {
    const files = simpleRepoFiles({ p: { files: { 'skills/s/SKILL.md': '---\r\nname: s\r\ndescription: crlf\r\n---\r\nBody\r\n' } } });
    const rr = runIndexer(writeRepo(files));
    assert.equal(byId(rr.readJson('index.json'), 'p/skill/s').description, 'crlf');
    assert.equal(rr.read('bodies/p/skill/s.md'), 'Body\r\n');
  });
});

describe('AC-12 symlinks', () => {
  it('skips a symlinked skill folder pointing outside plugins/ with a warning', () => {
    const outside = tempDir('site-index-outside-');
    mkdirSync(path.join(outside, 'x'), { recursive: true });
    writeFileSync(path.join(outside, 'SKILL.md'), '---\nname: leaked\n---\nOUTSIDE_SECRET_BODY\n');
    const root = writeRepo(simpleRepoFiles({ p: { files: { 'skills/ok/SKILL.md': 'ok\n' } } }), {
      symlinks: { 'plugins/p/skills/linked': outside },
    });
    const rr = runIndexer(root);
    assert.equal(rr.status, 0, rr.stderr);
    assert.match(rr.stderr, /warning: plugins\/p\/skills\/linked: symlink skipped/);
    assert.ok(!rr.readJson('index.json').artifacts.some((a) => a.id.includes('linked')));
    for (const f of listFiles(rr.out)) assert.ok(!readFileSync(f, 'utf8').includes('OUTSIDE_SECRET_BODY'));
  });
  it('does not list a symlink inside a skill folder as a supporting file', () => {
    const outside = tempDir('site-index-outside-');
    const root = writeRepo(simpleRepoFiles({ p: { files: { 'skills/s/SKILL.md': 's\n', 'skills/s/real.md': 'r' } } }), {
      symlinks: { 'plugins/p/skills/s/escape': outside },
    });
    const rr = runIndexer(root);
    assert.deepEqual(byId(rr.readJson('index.json'), 'p/skill/s').supportingFiles, ['plugins/p/skills/s/real.md']);
    assert.match(rr.stderr, /symlink/);
  });
  it('rejects a symlinked plugin directory', () => {
    const outside = tempDir('site-index-outside-');
    mkdirSync(path.join(outside, '.claude-plugin'));
    writeFileSync(path.join(outside, '.claude-plugin', 'plugin.json'), json({ name: 'p', version: '1.0.0' }));
    const files = simpleRepoFiles({});
    files['.claude-plugin/marketplace.json'] = marketplaceJson([{ name: 'p', source: './plugins/p' }]);
    const rr = runIndexer(writeRepo(files, { symlinks: { 'plugins/p': outside } }));
    assert.equal(rr.status, 1);
    assert.match(rr.stderr, /error: .*plugins\/p/);
  });
});

describe('AC-13 determinism and ordering', () => {
  it('two runs give byte-identical outputs', () => {
    const root = writeRepo(fullRepoFiles());
    const a = runIndexer(root);
    const b = runIndexer(root);
    const names = (r) => listFiles(r.out).map((p) => path.relative(r.out, p)).sort();
    assert.deepEqual(names(a), names(b));
    for (const n of names(a)) {
      assert.ok(readFileSync(path.join(a.out, n)).equals(readFileSync(path.join(b.out, n))), n);
    }
  });
  it('orders artifacts by kind order then name', () => {
    const index = runIndexer(writeRepo(fullRepoFiles())).readJson('index.json');
    const order = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
    const keys = index.artifacts.map((a) => [order.indexOf(a.kind), a.name]);
    for (let i = 1; i < keys.length; i++) {
      assert.ok(keys[i - 1][0] < keys[i][0] || (keys[i - 1][0] === keys[i][0] && keys[i - 1][1] <= keys[i][1]), `${i}: ${keys[i - 1]} > ${keys[i]}`);
    }
  });
  it('lists supporting files sorted, repository-relative, POSIX', () => {
    const index = runIndexer(writeRepo(fullRepoFiles())).readJson('index.json');
    assert.deepEqual(byId(index, 'alpha/skill/spec-writing').supportingFiles, [
      'plugins/alpha/skills/spec-writing/assets/x.txt',
      'plugins/alpha/skills/spec-writing/references/a.md',
    ]);
  });
});

describe('AC-14 git source', () => {
  it('uses null commit and date when there is no .git', () => {
    const rr = runIndexer(writeRepo(fullRepoFiles()));
    const idx = rr.readJson('index.json');
    assert.equal(idx.source.commit, null);
    assert.equal(idx.source.commitDate, null);
    assert.equal(rr.readJson('stats.json').commit, null);
    assert.equal(rr.readJson('stats.json').commitDate, null);
    assert.equal(idx.source.repoUrl, 'https://github.com/ochubey/home-ai-marketplace-learning');
  });
  it('reads the short commit and ISO date from git when available', { skip: !gitAvailable() && 'git not available' }, () => {
    const root = writeRepo(fullRepoFiles());
    const sha = gitCommit(root);
    const rr = runIndexer(root);
    const idx = rr.readJson('index.json');
    assert.equal(idx.source.commit, sha);
    assert.match(idx.source.commitDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(rr.readJson('stats.json').commit, sha);
  });
});

describe('AC-15 generated files are ignored by git', () => {
  it('.gitignore lists node_modules, dist and generated data under site/', () => {
    const lines = readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8').split('\n').map((l) => l.trim());
    for (const p of ['site/node_modules/', 'site/dist/', 'site/public/data/']) assert.ok(lines.includes(p), `missing ${p}`);
  });
});

describe('AC-28 hook and mcp data', () => {
  const rr = runIndexer(writeRepo(fullRepoFiles()));
  const idx = rr.readJson('index.json');
  it('keeps hook event names and mcp transport only', () => {
    assert.deepEqual(byId(idx, 'alpha/hook/hooks').details, { events: ['PreToolUse', 'SessionStart'] });
    assert.deepEqual(byId(idx, 'alpha/mcp/files').details, { transport: 'stdio' });
    assert.deepEqual(byId(idx, 'alpha/mcp/remote').details, { transport: 'http' });
    assert.equal(byId(idx, 'alpha/hook/hooks').hasBody, false);
    assert.equal(byId(idx, 'alpha/mcp/files').description, null);
  });
  it('never writes env, args, headers, commands or urls into any data file', () => {
    const all = listFiles(rr.out).map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const needle of ['PLACEHOLDER_ARG', 'PLACEHOLDER_ENV', 'PLACEHOLDER_HEADER', 'HOOK_COMMAND_LITERAL', 'HOOK_COMMAND_TWO', 'example.invalid/mcp', 'API_TOKEN']) {
      assert.ok(!all.includes(needle), `${needle} leaked into the data files`);
    }
  });
});

describe('caps', () => {
  it('caps searchText at 20,000 characters and the body at 200 KB with a notice', () => {
    const big = 'word '.repeat(100_000);
    const files = simpleRepoFiles({ p: { files: { 'skills/big/SKILL.md': `---\nname: big\n---\n${big}`, 'README.md': 'x' } } });
    const rr = runIndexer(writeRepo(files));
    const a = byId(rr.readJson('index.json'), 'p/skill/big');
    assert.ok(a.searchText.length <= 20_000);
    assert.ok(a.searchText.length > 19_000);
    const body = rr.read('bodies/p/skill/big.md');
    assert.ok(Buffer.byteLength(body) <= 200 * 1024 + 1024, `body is ${Buffer.byteLength(body)} bytes`);
    assert.ok(Buffer.byteLength(body) < Buffer.byteLength(big));
    assert.match(body, /truncated/i);
    assert.match(body, /https:\/\/github\.com\/ochubey\/home-ai-marketplace-learning\/blob\/main\/plugins\/p\/skills\/big\/SKILL\.md/);
  });
  it('leaves a small body without any notice', () => {
    const rr = runIndexer(writeRepo(simpleRepoFiles({ p: { files: { 'skills/s/SKILL.md': 'small\n' } } })));
    assert.equal(rr.read('bodies/p/skill/s.md'), 'small\n');
  });
});

describe('this repository', () => {
  const rr = runIndexer(REPO_ROOT);
  const idx = rr.readJson('index.json');
  const dirs = (p) => readdirSync(path.join(REPO_ROOT, p), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

  it('exits 0 with 4 plugins in catalog order', () => {
    assert.equal(rr.status, 0, rr.stderr);
    assert.deepEqual(idx.plugins.map((p) => p.name), ['engineering-paved-path', 'research-tools', 'architecture-review', 'sdd-engineering']);
  });
  it('lists the skill and agent names found on disk', () => {
    for (const plugin of idx.plugins.map((p) => p.name)) {
      const base = `plugins/${plugin}`;
      const skills = existsSync(path.join(REPO_ROOT, base, 'skills')) ? dirs(`${base}/skills`) : [];
      const agents = existsSync(path.join(REPO_ROOT, base, 'agents'))
        ? readdirSync(path.join(REPO_ROOT, base, 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort()
        : [];
      const got = (kind) => idx.artifacts.filter((a) => a.plugin === plugin && a.kind === kind).map((a) => a.id.split('/')[2]).sort();
      assert.deepEqual(got('skill'), skills, `${plugin} skills`);
      assert.deepEqual(got('agent'), agents, `${plugin} agents`);
    }
  });
  it('has the sdd-engineering dependencies and the architecture-review usedBy', () => {
    const sdd = idx.plugins.find((p) => p.name === 'sdd-engineering');
    assert.deepEqual(sdd.dependencies.map((d) => d.name).sort(), ['architecture-review', 'engineering-paved-path', 'research-tools']);
    assert.ok(sdd.dependencies.every((d) => d.inCatalog));
    assert.deepEqual(idx.plugins.find((p) => p.name === 'architecture-review').usedBy, ['sdd-engineering']);
  });
  it('has 6 releases, all undated', () => {
    const { releases } = rr.readJson('releases.json');
    assert.equal(releases.length, 6);
    assert.ok(releases.every((x) => x.date === null));
    assert.equal(releases.filter((x) => x.isCurrent).length, 4);
  });
  it('stays within the size budget and has a real commit', () => {
    assert.ok(statSync(path.join(rr.out, 'index.json')).size <= 1_000_000);
    assert.match(idx.source.commit, /^[0-9a-f]{7,}$/);
  });
  it('runs in under 5 seconds', () => {
    const t = Date.now();
    runIndexer(REPO_ROOT);
    assert.ok(Date.now() - t < 5000);
  });
  it('writes the generated data outside the working tree when given --out', () => {
    assert.ok(!rr.out.startsWith(REPO_ROOT));
  });
});

describe('--out default and arguments', () => {
  it('rejects an unknown argument with exit 2', () => {
    const rr = runIndexer(REPO_ROOT, { args: ['--bogus'] });
    assert.equal(rr.status, 2);
    assert.match(rr.stderr, /usage/i);
  });
});
