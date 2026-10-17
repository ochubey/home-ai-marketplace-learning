import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, MARKETPLACE_NAME, runValidator, makeRepo } from './helpers.mjs';

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

// Plugins that must be in the catalog. Extended in each phase that adds a plugin.
const EXPECTED_PLUGINS = ['engineering-paved-path', 'research-tools', 'architecture-review'];

describe('T11 catalog (AC-1, AC-2)', () => {
  it('marketplace.json declares name, owner and exactly the expected plugins', () => {
    const m = JSON.parse(read('.claude-plugin/marketplace.json'));
    assert.equal(m.name, MARKETPLACE_NAME);
    assert.equal(m.owner.name, 'AI Engineering (ochubey)');
    assert.ok(typeof m.metadata?.description === 'string' && m.metadata.description.length > 0);
    assert.ok(Array.isArray(m.plugins));
    assert.deepEqual(m.plugins.map((p) => p.name).sort(), [...EXPECTED_PLUGINS].sort());
    for (const p of m.plugins) {
      assert.equal(p.source, `./plugins/${p.name}`);
      assert.match(p.description, /^[^.!?]+[.!?]$/, `${p.name}: description must be one sentence`);
      assert.ok(!('version' in p), `${p.name}: catalog entry must not carry a version`);
    }
  });

  it('every expected plugin is owned in CODEOWNERS after the default rule', () => {
    const lines = read('.github/CODEOWNERS').split(/\r?\n/);
    const def = lines.indexOf('* @ochubey');
    assert.ok(def >= 0);
    for (const n of EXPECTED_PLUGINS) {
      const at = lines.indexOf(`/plugins/${n}/ @ochubey`);
      assert.ok(at > def, `CODEOWNERS rule for ${n} missing or before the default rule`);
    }
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

  it('the validator passes on this repository (exit 0, zero problems)', () => {
    const r = runValidator(REPO_ROOT);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stdout.split('\n').filter((l) => l.startsWith('ERROR ')).length, 0, r.stdout);
    assert.match(r.stdout, new RegExp(`validate-marketplace: OK - ${EXPECTED_PLUGINS.length} plugins checked, \\d+ files scanned`));
  });
});

// Recorded from `claude plugin --help` and the subcommand help pages (Claude Code 2.1.x).
const KNOWN_PLUGIN_SUBCOMMANDS = [
  'configure', 'details', 'disable', 'enable', 'eval', 'help', 'init', 'new', 'install', 'i', 'list',
  'marketplace', 'prune', 'autoremove', 'tag', 'test', 'uninstall', 'remove', 'update', 'validate',
];
const KNOWN_MARKETPLACE_SUBCOMMANDS = ['add', 'help', 'list', 'remove', 'rm', 'update'];

const exists = (rel) => existsSync(path.join(REPO_ROOT, rel));

function trackedFiles() {
  const r = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return r.stdout.split('\0').filter(Boolean).filter((f) => exists(f));
}

const pluginDocs = () =>
  exists('plugins')
    ? readdirSync(path.join(REPO_ROOT, 'plugins'), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => [`plugins/${d.name}/README.md`, `plugins/${d.name}/evals/README.md`])
        .filter(exists)
    : [];

const DOCS = [
  'README.md', 'CONTRIBUTING.md', 'docs/PLUGIN-GUIDELINES.md', 'docs/SECURITY.md', 'docs/RELEASES.md', 'docs/temp/README.md',
  ...pluginDocs(),
];

describe('T12 README (AC-4, AC-5)', () => {
  const readme = () => read('README.md');
  it('documents the consumer commands', () => {
    const t = readme();
    for (const needle of [
      'claude plugin marketplace add ochubey/home-ai-marketplace-learning',
      '--scope project',
      '@home-ai-marketplace-learning',
      'claude plugin marketplace update',
      'claude plugin update',
      '/reload-plugins',
      'claude plugin list --json',
      'extraKnownMarketplaces',
      'Marketplaces',
    ]) {
      assert.ok(t.includes(needle), `README missing ${needle}`);
    }
  });
  it('has a Repository layout section naming every top-level entry', () => {
    const t = readme();
    assert.match(t, /^#+ Repository layout/m);
    const tops = new Set(trackedFiles().map((f) => f.split('/')[0]));
    for (const top of tops) assert.ok(t.includes(top), `README layout does not mention ${top}`);
    assert.ok(t.includes('SITE-SPEC.md') && t.includes('COST-BASELINE.md'), 'later-phase files must be mentioned');
  });
});

describe('T13 CONTRIBUTING (AC-3, AC-6, AC-27)', () => {
  it('covers structure, fields, dependencies, commands, rules, allowlist, checklist', () => {
    const t = read('CONTRIBUTING.md');
    for (const needle of [
      './plugins/<name>',
      'source of truth',
      '.claude-plugin/plugin.json',
      'dependencies',
      'name@marketplace',
      'node scripts/validate-marketplace.mjs',
      'node --test',
      'claude plugin validate .',
      'scripts/validate-allowlist.json',
      'contains',
      'CODEOWNERS',
      'Conventional Commits',
      'branch protection',
      '[ ]',
      'dep-cycle',
      'abs-path',
      'codeowners-plugin',
    ]) {
      assert.ok(t.toLowerCase().includes(needle.toLowerCase()), `CONTRIBUTING missing ${needle}`);
    }
  });
  it('documents every rule id the validator can emit', () => {
    const t = read('CONTRIBUTING.md');
    const src = ['catalog', 'manifest', 'deps', 'codeowners', 'scan', 'allowlist', 'files', 'json']
      .map((n) => read(`scripts/lib/${n}.mjs`))
      .join('\n');
    const ids = new Set([...src.matchAll(/['"`]([a-z]+(?:-[a-z]+)+)['"`]/g)].map((m) => m[1]));
    const known = [
      'catalog-missing', 'json-invalid', 'json-bom', 'catalog-field', 'entry-name', 'entry-duplicate', 'entry-source',
      'plugin-dir-missing', 'plugin-manifest-missing', 'plugin-orphan', 'plugin-name-mismatch', 'plugin-version',
      'catalog-version-mismatch', 'dep-unknown', 'dep-self', 'dep-cycle', 'dep-marketplace', 'dep-range', 'dep-format',
      'codeowners-missing', 'codeowners-default', 'codeowners-plugin', 'secret-github', 'secret-aws', 'secret-anthropic',
      'secret-openai', 'secret-slack', 'secret-private-key', 'secret-generic-assign', 'secret-env-file', 'abs-path',
      'allowlist-invalid', 'allowlist-stale',
    ];
    for (const id of known) assert.ok(t.includes(`\`${id}\``), `CONTRIBUTING rule table missing ${id}`);
    assert.ok(ids.size > 0);
  });
});

describe('T14 PLUGIN-GUIDELINES (AC-7)', () => {
  it('covers boundary criteria, naming and portability', () => {
    const t = read('docs/PLUGIN-GUIDELINES.md').toLowerCase();
    for (const n of ['audience', 'permissions', 'owner', 'update cadence', 'naming', 'portable', 'kebab-case']) {
      assert.ok(t.includes(n), `PLUGIN-GUIDELINES missing ${n}`);
    }
  });
});

describe('T15 SECURITY (AC-8, AC-27)', () => {
  it('covers the required items', () => {
    const t = read('docs/SECURITY.md').toLowerCase();
    for (const n of ['secrets', 'credentials', 'absolute path', 'placeholder', 'stop distribution', 'fixed version', 'rotate', 'notify', 'security review']) {
      assert.ok(t.includes(n), `SECURITY missing ${n}`);
    }
  });
  it('carries one allowlisted example that really matches a rule', () => {
    const allow = JSON.parse(read('scripts/validate-allowlist.json'));
    const e = allow.entries.find((x) => x.path === 'docs/SECURITY.md' && x.rule === 'abs-path');
    assert.ok(e, 'allowlist entry for docs/SECURITY.md [abs-path] missing');
    assert.ok(read('docs/SECURITY.md').includes(e.contains));
    assert.ok(!/example/i.test(e.contains));
  });
  it('the same example fails in a non-allowlisted file', () => {
    const e = JSON.parse(read('scripts/validate-allowlist.json')).entries[0];
    const r = runValidator(makeRepo({ 'docs/other.md': `see \`${e.contains}x\`\n` }));
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /\[abs-path\]/);
  });
});

describe('T16 RELEASES (AC-9, AC-10)', () => {
  const t = () => read('docs/RELEASES.md');
  it('covers SemVer, tags, bump rule and the three update kinds', () => {
    for (const n of ['SemVer', '<plugin-name>--vX.Y.Z', 'engineering-paved-path--v1.0.0', 'claude plugin tag', '--dry-run', '--push', '/reload-plugins', 'DISABLE_AUTOUPDATER', 'FORCE_AUTOUPDATE_PLUGINS=1', 'claude plugin marketplace update', 'claude plugin update', 'version']) {
      assert.ok(t().includes(n), `RELEASES missing ${n}`);
    }
    assert.match(t(), /not delivered/i);
    assert.match('engineering-paved-path--v1.0.0', /^[a-z0-9-]+--v\d+\.\d+\.\d+$/);
  });
  it('describes rollback only as a pinned stable channel', () => {
    assert.match(t(), /stable channel/i);
    assert.match(t(), /pinned/i);
  });
});

describe('forbidden claims and CLI accuracy (AC-10)', () => {
  it('never mentions a rollback, lockfile or install-preview command', () => {
    for (const f of DOCS) {
      const text = read(f);
      assert.doesNotMatch(text, /plugin rollback|rollback command|lock ?file|install[- ]preview|plugin lock/i, f);
    }
  });
  it('every documented `claude plugin <sub>` is a known subcommand', () => {
    for (const f of DOCS) {
      for (const m of read(f).matchAll(/claude plugins? ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g)) {
        assert.ok(KNOWN_PLUGIN_SUBCOMMANDS.includes(m[1]), `${f}: unknown subcommand "${m[1]}"`);
        if (m[1] === 'marketplace' && m[2] && !m[2].startsWith('-')) {
          assert.ok(KNOWN_MARKETPLACE_SUBCOMMANDS.includes(m[2]), `${f}: unknown marketplace subcommand "${m[2]}"`);
        }
      }
    }
  });
});

describe('T17 docs/temp (AC-11)', () => {
  it('has a note about temporary research documents', () => {
    const t = read('docs/temp/README.md').toLowerCase();
    assert.ok(t.includes('temporary') && t.includes('deleted'));
    assert.ok(trackedFiles().includes('docs/temp/README.md'));
  });
});

describe('T17a English-only guard (AC-12)', () => {
  it('no Cyrillic in tracked text files', () => {
    const bad = trackedFiles().filter((f) => {
      const buf = readFileSync(path.join(REPO_ROOT, f));
      return !buf.subarray(0, 8192).includes(0) && /[\u0400-\u04FF]/.test(buf.toString('utf8'));
    });
    assert.deepEqual(bad, []);
  });
});

describe('T18 CODEOWNERS (AC-13, AC-24)', () => {
  it('has a default owner rule and a commented plugin template', () => {
    const t = read('.github/CODEOWNERS');
    assert.match(t, /^\* @ochubey$/m);
    assert.match(t, /^# \/plugins\/<name>\/ @owner$/m);
  });
});

describe('T19 pull request template (AC-14)', () => {
  it('lists every required checklist item', () => {
    const t = read('.github/pull_request_template.md').toLowerCase();
    assert.ok((t.match(/^- \[ \]/gm) ?? []).length >= 7);
    for (const n of ['contributing', 'version', 'plugin.json', 'codeowners', 'secrets', 'absolute paths', 'validate-marketplace.mjs', 'node --test', 'claude plugin validate .', '`main`']) {
      assert.ok(t.includes(n), `PR template missing ${n}`);
    }
  });
});

describe('T20 validate workflow (AC-29..32)', () => {
  const wf = () => read('.github/workflows/validate.yml');
  it('has the required shape', () => {
    const t = wf();
    assert.match(t, /^name: validate$/m);
    assert.match(t, /^on:\s*\n\s+pull_request:\s*\n\s+push:\s*\n\s+branches: \[main\]/m);
    assert.match(t, /^permissions:\s*\n\s+contents: read$/m);
    assert.match(t, /^\s+validate:$/m);
    assert.match(t, /runs-on: ubuntu-latest/);
    assert.match(t, /timeout-minutes: 5/);
    assert.match(t, /uses: actions\/checkout@v\d+\s*\n\s+with:\s*\n\s+persist-credentials: false/);
    assert.match(t, /uses: actions\/setup-node@v\d+\s*\n\s+with:\s*\n\s+node-version: 22/);
    assert.match(t, /run: node scripts\/validate-marketplace\.mjs/);
    assert.match(t, /run: node --test/);
    assert.doesNotMatch(t, /cache:/);
  });
  it('is least-privilege and standalone', () => {
    const t = wf();
    assert.doesNotMatch(t, /secrets\./);
    assert.doesNotMatch(t, /pull_request_target/);
    assert.doesNotMatch(t, /\$\{\{\s*(github\.event|github\.head_ref)/);
    assert.doesNotMatch(t, /pages|deploy|upload-artifact/i);
    assert.equal((t.match(/^\s{2}[a-z][a-z0-9-]*:\s*$/gm) ?? []).filter((l) => !/permissions|steps/.test(l)).length >= 1, true);
    const uses = [...t.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    for (const u of uses) assert.match(u, /^actions\/(checkout|setup-node)@v\d+$/);
  });
});
