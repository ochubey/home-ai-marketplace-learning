// Fixtures for the site indexer tests. Repositories are built in temp dirs at test time, so hostile
// Markdown, placeholder env values and symlinks never become tracked files.
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { json, marketplaceJson, entry, MARKETPLACE_NAME, REPO_ROOT } from './helpers.mjs';

export { REPO_ROOT, MARKETPLACE_NAME };
export const INDEXER = path.join(REPO_ROOT, 'scripts', 'build-index.mjs');

const created = [];
process.on('exit', () => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

export function tempDir(prefix = 'site-index-') {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

/** Writes `files` (relative POSIX path -> content) into a new temp repo. */
export function writeRepo(files, { symlinks = {} } = {}) {
  const root = tempDir('site-index-repo-');
  for (const [rel, content] of Object.entries(files)) {
    if (content === null) continue;
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  for (const [rel, target] of Object.entries(symlinks)) {
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    symlinkSync(target, abs, 'dir');
  }
  return root;
}

export function manifest(name, extra = {}) {
  return json({ name, version: '1.0.0', description: `${name} description`, author: { name: 'Fixture Author' }, ...extra });
}

/** A minimal valid repo: the given plugins (name -> extra files and manifest extras). */
export function simpleRepoFiles(plugins = {}) {
  const files = {};
  const entries = [];
  for (const [name, spec] of Object.entries(plugins)) {
    entries.push(entry(name));
    files[`plugins/${name}/.claude-plugin/plugin.json`] = manifest(name, spec.manifest ?? {});
    for (const [rel, content] of Object.entries(spec.files ?? {})) files[`plugins/${name}/${rel}`] = content;
  }
  files['.claude-plugin/marketplace.json'] = marketplaceJson(entries, { metadata: { description: 'Fixture marketplace.' } });
  return files;
}

export const HOSTILE_SKILL = [
  '---',
  'name: hostile',
  'description: A skill with hostile content',
  '---',
  '# Hostile',
  '',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[click](javascript:alert(1))',
  'text </script> more text',
  '<!-- a comment -->',
  'null byte here: \u0000 end',
  '',
].join('\n');

export const CHANGELOG_MIXED = [
  '# Changelog',
  '',
  '## Unreleased',
  '- not a release',
  '',
  '## 1.2.0 - 2026-10-01',
  'Dated with a dash.',
  '',
  '## 1.1.0 (2026-09-01)',
  'Dated with parentheses.',
  '',
  '## 1.0.0',
  'Undated.',
  '',
  '```',
  '## 9.9.9',
  '```',
  '',
  '## Notes',
  'Not a version heading.',
  '',
  '## 0.9.0-rc.1',
  'Pre-release.',
  '',
].join('\n');

const M = MARKETPLACE_NAME;

/** Three plugins; alpha has every kind of artifact and awkward cases. */
export function fullRepoFiles() {
  const files = simpleRepoFiles({
    alpha: {
      manifest: {
        version: '1.2.0',
        dependencies: ['beta', { name: 'gamma', marketplace: M, version: '^1.0.0' }, { name: 'outside' }],
      },
      files: {
        'README.md': '# Alpha\n\nAlpha readme with <b>html</b>.\n',
        'CHANGELOG.md': CHANGELOG_MIXED,
        'skills/spec-writing/SKILL.md':
          '---\nname: spec-writing\ndescription: Writes specs\nallowed-tools: Read, Grep\nargument-hint: "<topic>"\ndisable-model-invocation: true\nsecret-key: not-allowlisted\n---\n# Spec writing\n\nUnique-body-word: quasar.\n',
        'skills/spec-writing/references/a.md': '# ref\n',
        'skills/spec-writing/assets/x.txt': 'x\n',
        'skills/no-name/SKILL.md': '---\ndescription: Has no name\n---\nBody of no-name.\n',
        'skills/no-desc/SKILL.md': '---\nname: no-desc\n---\nBody of no-desc.\n',
        'skills/no-fm/SKILL.md': 'Just a body, no frontmatter.\n',
        'skills/evil-name/SKILL.md': '---\nname: ../../evil\ndescription: Name tries to escape\n---\nEvil body.\n',
        'skills/hostile/SKILL.md': HOSTILE_SKILL,
        'skills/Bad Name/SKILL.md': '---\nname: bad\n---\nBad.\n',
        'agents/reviewer.md':
          '---\nname: reviewer\ndescription: Reviews things\ntools:\n  - Read\n  - Grep\ndisallowedTools: Write, Edit\nmodel: sonnet\nextra: dropped\n---\nAgent body.\n',
        'commands/deploy.md': '---\ndescription: Deploys\nargument-hint: "<env>"\n---\nCommand body.\n',
        'hooks/hooks.json': json({
          hooks: {
            PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo HOOK_COMMAND_LITERAL' }] }],
            SessionStart: [{ hooks: [{ type: 'command', command: 'echo HOOK_COMMAND_TWO' }] }],
          },
        }),
        '.mcp.json': json({
          mcpServers: {
            files: { command: 'npx', args: ['-y', 'PLACEHOLDER_ARG'], env: { API_TOKEN: 'PLACEHOLDER_ENV' } },
            remote: { type: 'http', url: 'https://example.invalid/mcp', headers: { Authorization: 'PLACEHOLDER_HEADER' } },
          },
        }),
      },
    },
    beta: { files: { 'README.md': '# Beta\n', 'skills/zod/SKILL.md': '---\nname: zod\ndescription: Zod schemas\n---\nZod body.\n' } },
    gamma: { manifest: { dependencies: ['beta@' + M] }, files: { 'agents/helper.md': '---\nname: helper\ndescription: Helps\n---\nHelper.\n' } },
  });
  return files;
}

/** Runs the indexer; returns status, output text and helpers to read the generated files. */
export function runIndexer(root, { out = tempDir('site-index-out-'), args = [] } = {}) {
  const r = spawnSync(process.execPath, [INDEXER, '--root', root, '--out', out, ...args], { encoding: 'utf8' });
  const read = (rel) => readFileSync(path.join(out, ...rel.split('/')), 'utf8');
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    out,
    read,
    readJson: (rel) => JSON.parse(read(rel)),
    has: (rel) => existsSync(path.join(out, ...rel.split('/'))),
  };
}

export function gitAvailable() {
  return spawnSync('git', ['--version']).status === 0;
}

/** Initialises a git repo in `root` with one commit; returns the short SHA. */
export function gitCommit(root) {
  const run = (...a) =>
    execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', ...a], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: root },
    }).trim();
  run('init', '-q');
  run('add', '-A');
  run('commit', '-q', '-m', 'fixture');
  return run('rev-parse', '--short=7', 'HEAD');
}
