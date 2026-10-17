import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';

const read = (rel) => readFileSync(path.join(REPO_ROOT, rel), 'utf8');

const ALLOWED_ACTIONS = ['actions/checkout', 'actions/setup-node', 'actions/upload-pages-artifact', 'actions/deploy-pages'];
const WORKFLOWS = ['.github/workflows/pages.yml', '.github/workflows/site.yml'];

// Splits the `jobs:` section into { jobName: blockText } by the two-space job keys.
function jobs(text) {
  const body = text.split(/^jobs:\s*$/m)[1] ?? '';
  const out = {};
  const parts = body.split(/^  ([a-z][a-z0-9-]*):\s*$/m);
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = parts[i + 1];
  return out;
}

const topLevel = (text) => text.split(/^jobs:\s*$/m)[0];

describe('pages.yml shape (AC-54, AC-55, AC-56)', () => {
  const t = read('.github/workflows/pages.yml');
  const j = jobs(t);

  it('runs only on push to main and workflow_dispatch', () => {
    assert.match(t, /^on:\s*\n\s+push:\s*\n\s+branches: \[main\]\s*\n\s+workflow_dispatch:\s*$/m);
    assert.doesNotMatch(topLevel(t), /pull_request|schedule|workflow_run/);
  });

  it('has read-only top-level permissions', () => {
    assert.match(t, /^permissions:\s*\n\s+contents: read\s*\n(?=\S)/m);
  });

  it('has two jobs: build and deploy', () => {
    assert.deepEqual(Object.keys(j).sort(), ['build', 'deploy']);
  });

  it('only the deploy job adds pages: write and id-token: write', () => {
    assert.match(j.deploy, /^\s{4}permissions:\s*\n\s+pages: write\s*\n\s+id-token: write\s*$/m);
    assert.doesNotMatch(j.build, /pages:|id-token:|permissions:/);
    assert.equal((t.match(/pages: write/g) ?? []).length, 1);
    assert.equal((t.match(/id-token: write/g) ?? []).length, 1);
  });

  it('deploy uses the github-pages environment, needs build and runs deploy-pages', () => {
    assert.match(j.deploy, /^\s{4}needs: build\s*$/m);
    assert.match(j.deploy, /environment:\s*\n\s+name: github-pages/);
    assert.match(j.deploy, /uses: actions\/deploy-pages@/);
    assert.doesNotMatch(j.deploy, /actions\/checkout/);
  });

  it('build checks out without persisted credentials and sets up Node 22', () => {
    assert.match(j.build, /uses: actions\/checkout@\S+.*\n\s+with:\s*\n\s+persist-credentials: false/);
    assert.match(j.build, /uses: actions\/setup-node@\S+.*\n\s+with:\s*\n\s+node-version: 22/);
  });

  it('build runs validator, indexer, install, typecheck, test, build, dist checks, then upload', () => {
    const order = [
      'node scripts/validate-marketplace.mjs',
      'npm ci --ignore-scripts',
      'npm run index',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'npm run test:dist',
      'actions/upload-pages-artifact@',
    ].map((needle) => {
      const at = j.build.indexOf(needle);
      assert.ok(at >= 0, `pages.yml build job is missing ${needle}`);
      return at;
    });
    assert.deepEqual(order, [...order].sort((a, b) => a - b), 'build steps are out of order');
    assert.match(j.build, /path: site\/dist/);
  });

  it('uses a Pages concurrency group that does not cancel a running deployment', () => {
    assert.match(topLevel(t), /^concurrency:\s*\n\s+group: pages\s*\n\s+cancel-in-progress: false\s*$/m);
  });
});

describe('site.yml shape (AC-57, AC-58)', () => {
  const t = read('.github/workflows/site.yml');
  const j = jobs(t);

  it('runs only on pull_request with read-only permissions', () => {
    assert.match(t, /^on:\s*\n\s+pull_request:\s*\n(?=\S)/m);
    assert.doesNotMatch(topLevel(t), /push:|workflow_dispatch|schedule/);
    assert.match(t, /^permissions:\s*\n\s+contents: read\s*\n(?=\S)/m);
    assert.equal((t.match(/^\s*permissions:/gm) ?? []).length, 1);
    assert.doesNotMatch(t, /: write/);
  });

  it('never deploys', () => {
    assert.doesNotMatch(t, /deploy-pages|upload-pages-artifact|environment:|pages: write/);
  });

  it('runs Node 22, the indexer, the site checks and the audit summary', () => {
    const all = Object.values(j).join('\n');
    assert.match(all, /uses: actions\/checkout@\S+.*\n\s+with:\s*\n\s+persist-credentials: false/);
    assert.match(all, /node-version: 22/);
    for (const needle of [
      'npm ci --ignore-scripts', 'npm run index', 'npm run typecheck', 'npm test', 'npm run build',
      'npm run test:dist', 'node scripts/audit-summary.mjs',
    ]) {
      assert.ok(all.includes(needle), `site.yml is missing ${needle}`);
    }
  });
});

describe('both site workflows (AC-60, AC-61)', () => {
  for (const f of WORKFLOWS) {
    describe(f, () => {
      const t = read(f);
      it('has no pull_request_target, secrets, untrusted expressions or caches', () => {
        assert.doesNotMatch(t, /pull_request_target/);
        assert.doesNotMatch(t, /secrets\./);
        assert.doesNotMatch(t, /\$\{\{\s*(github\.event|github\.head_ref)/);
        assert.doesNotMatch(t, /cache:/);
      });
      it('uses only the four allowed actions', () => {
        const uses = [...t.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
        assert.ok(uses.length >= 2);
        for (const u of uses) {
          assert.ok(ALLOWED_ACTIONS.includes(u.split('@')[0]), `${f}: action ${u} is not allowed`);
        }
      });
      it('pins every action to a full commit SHA with the release tag in a comment', () => {
        const lines = t.split(/\r?\n/).filter((l) => /^\s*-?\s*uses:/.test(l));
        for (const l of lines) {
          assert.match(l, /uses: \S+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, `${f}: ${l.trim()}`);
        }
      });
      it('keeps checkout and setup-node on the major of validate.yml', () => {
        for (const m of t.matchAll(/uses: actions\/(?:checkout|setup-node)@\S+ # (v\d+)\./g)) {
          assert.equal(m[1], 'v7');
        }
      });
      it('installs with npm ci and without install scripts', () => {
        assert.match(t, /run: npm ci --ignore-scripts/);
        assert.doesNotMatch(t, /npm install/);
      });
    });
  }
});

describe('site package policy (AC-62, AC-63)', () => {
  const pkg = JSON.parse(read('site/package.json'));
  const RUNTIME = ['dompurify', 'marked', 'minisearch', 'react', 'react-dom'];
  const DEV_ALLOWED = [
    '@types/react', '@types/react-dom', '@vitejs/plugin-react', 'typescript', 'vite', 'vitest',
    'jsdom', 'happy-dom', '@testing-library/react', '@testing-library/dom', '@testing-library/user-event',
    '@testing-library/jest-dom',
  ];
  it('lists exact versions only', () => {
    for (const set of [pkg.dependencies, pkg.devDependencies]) {
      for (const [name, v] of Object.entries(set ?? {})) {
        assert.match(v, /^\d+\.\d+\.\d+$/, `${name}@${v} is not an exact version`);
      }
    }
    for (const k of ['optionalDependencies', 'peerDependencies', 'overrides']) assert.equal(pkg[k], undefined, k);
  });
  it('has exactly the allowed runtime set', () => {
    assert.deepEqual(Object.keys(pkg.dependencies).sort(), RUNTIME);
  });
  it('keeps dev dependencies inside the allowed list', () => {
    for (const name of Object.keys(pkg.devDependencies)) assert.ok(DEV_ALLOWED.includes(name), `${name} is not allowed`);
  });
  it('commits site/package-lock.json', () => {
    assert.ok(existsSync(path.join(REPO_ROOT, 'site/package-lock.json')));
  });
});

describe('docs match the site (AC-69, AC-70)', () => {
  const readme = read('README.md');
  const en = JSON.parse(read('site/src/i18n/en.json'));
  const KNOWN = ['marketplace', 'install', 'update', 'list', 'uninstall', 'enable', 'disable', 'validate'];

  it('every command shown on the site also appears in the README with a known subcommand', () => {
    const commands = Object.values(en)
      .filter((v) => typeof v === 'string' && /^(claude plugin |\/reload-plugins)/.test(v))
      .map((v) => v.replace('{plugin}', '<plugin>'));
    assert.ok(commands.length >= 6);
    for (const c of commands) {
      assert.ok(readme.includes(c), `README does not contain site command: ${c}`);
      const m = /^claude plugin ([a-z-]+)/.exec(c);
      if (m) assert.ok(KNOWN.includes(m[1]), `unknown subcommand in ${c}`);
    }
  });

  it('README names the site folder, both workflows, the spec doc and the base URL', () => {
    for (const needle of [
      '`site/`', 'pages.yml', 'site.yml', 'docs/SITE-SPEC.md',
      'https://ochubey.github.io/home-ai-marketplace-learning/',
    ]) {
      assert.ok(readme.includes(needle), `README is missing ${needle}`);
    }
  });

  it('docs/SITE-SPEC.md exists and covers the required topics', () => {
    const t = read('docs/SITE-SPEC.md');
    for (const needle of [
      'schemaVersion', 'index.json', 'releases.json', 'stats.json', '#/whats-new', '#/getting-started',
      'npm run index', 'Content-Security-Policy', 'frame-ancestors', 'site/package-lock.json', 'Settings > Pages',
    ]) {
      assert.ok(t.includes(needle), `SITE-SPEC.md is missing ${needle}`);
    }
  });

  it('no doc uses the forbidden words', () => {
    for (const f of ['README.md', 'CONTRIBUTING.md', 'docs/SITE-SPEC.md']) {
      assert.doesNotMatch(read(f), /lock ?file/i, f);
    }
  });
});
