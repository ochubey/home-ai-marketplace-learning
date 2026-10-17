import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const VALIDATOR = path.join(REPO_ROOT, 'scripts', 'validate-marketplace.mjs');
export const MARKETPLACE_NAME = 'home-ai-marketplace-learning';

const created = [];
process.on('exit', () => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});

export function json(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

export function marketplaceJson(entries = [], extra = {}) {
  return json({
    name: MARKETPLACE_NAME,
    owner: { name: 'AI Engineering (ochubey)' },
    plugins: entries,
    ...extra,
  });
}

export function entry(name, extra = {}) {
  return { name, source: `./plugins/${name}`, ...extra };
}

/** Files of a valid, empty marketplace skeleton. */
export function skeleton() {
  return {
    '.claude-plugin/marketplace.json': marketplaceJson(),
    '.github/CODEOWNERS': '* @owner\n',
  };
}

/**
 * Files of a marketplace with plugins.
 * spec: { name, version?, dependencies?, entry?, manifest?, owned? }
 */
export function withPlugins(specs, extraFiles = {}) {
  const files = skeleton();
  const entries = [];
  let owners = '* @owner\n';
  for (const spec of specs) {
    const version = 'version' in spec ? spec.version : '1.0.0';
    entries.push(entry(spec.name, spec.entry ?? {}));
    const manifest = { name: spec.name, ...(version === undefined ? {} : { version }), ...(spec.manifest ?? {}) };
    if (spec.dependencies !== undefined) manifest.dependencies = spec.dependencies;
    files[`plugins/${spec.name}/.claude-plugin/plugin.json`] = json(manifest);
    if (spec.owned !== false) owners += `/plugins/${spec.name}/ @owner\n`;
  }
  files['.claude-plugin/marketplace.json'] = marketplaceJson(entries);
  files['.github/CODEOWNERS'] = owners;
  return { ...files, ...extraFiles };
}

/** Writes a temp repo. A null value in `files` removes the default/skeleton file. */
export function makeRepo(files = {}, { base = skeleton() } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'marketplace-test-'));
  created.push(root);
  const all = { ...base, ...files };
  for (const [rel, content] of Object.entries(all)) {
    if (content === null) continue;
    const abs = path.join(root, ...rel.split('/'));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

export function runValidator(root) {
  const r = spawnSync(process.execPath, [VALIDATOR, '--root', root], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Build a temp repo from `files` (merged over the skeleton) and validate it. */
export function check(files = {}, opts) {
  return runValidator(makeRepo(files, opts));
}

export function hasProblem(r, rule, ...subs) {
  return r.stdout
    .split('\n')
    .some((l) => l.startsWith('ERROR ') && l.includes(`[${rule}]`) && subs.every((s) => l.includes(s)));
}

export function assertProblem(r, rule, ...subs) {
  assert.ok(hasProblem(r, rule, ...subs), `expected [${rule}] ${subs.join(' | ')} in output:\n${r.stdout}${r.stderr}`);
  assert.equal(r.status, 1);
}

export function assertNoProblem(r, rule) {
  assert.ok(!hasProblem(r, rule), `unexpected [${rule}] in output:\n${r.stdout}${r.stderr}`);
}

export function assertOk(r) {
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /validate-marketplace: OK - \d+ plugins checked, \d+ files scanned/);
}
