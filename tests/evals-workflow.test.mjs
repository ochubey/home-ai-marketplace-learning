import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { parseCaseYaml } from './case-yaml.mjs';
import { PLUGINS_DIR, pluginNames, pluginDir } from './plugin-helpers.mjs';

const WORKFLOWS = path.join(REPO_ROOT, '.github', 'workflows');
const wfRaw = readFileSync(path.join(WORKFLOWS, 'evals.yml'), 'utf8');
// Full-line comments dropped: the negative checks are about what the workflow does, not what it says.
const wf = wfRaw.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
const SUMMARY = path.join(REPO_ROOT, 'scripts', 'eval-summary.mjs');

// ---------------------------------------------------------------- workflow

/** The text of every `run: |` block, one string per step. */
function runBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)run:\s*(\|[+-]?)?\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    if (!m[2]) {
      blocks.push(m[3]);
      continue;
    }
    const base = m[1].length;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '' && lines[j].length - lines[j].trimStart().length <= base) break;
      body.push(lines[j]);
    }
    blocks.push(body.join('\n'));
  }
  return blocks;
}
const allRun = () => runBlocks(wf).join('\n');
/** The `- name:` step chunk containing a marker. */
function step(marker) {
  const parts = wf.split(/^\s{6}- name:/m).slice(1);
  const hit = parts.filter((p) => p.includes(marker));
  assert.equal(hit.length, 1, `exactly one step contains ${marker}`);
  return hit[0];
}

describe('evals workflow: trigger and permissions', () => {
  it('is manual only', () => {
    const on = wf.slice(wf.indexOf('\non:'), wf.indexOf('\npermissions:'));
    assert.match(on, /^\s+workflow_dispatch:/m);
    assert.doesNotMatch(wf, /^\s*pull_request/m);
    assert.doesNotMatch(wf, /pull_request_target/);
    assert.doesNotMatch(wf, /^\s*schedule:/m);
    assert.doesNotMatch(wf, /^\s*push:/m);
    assert.doesNotMatch(wf, /^\s*workflow_run:/m);
    assert.deepEqual([...on.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]), ['workflow_dispatch']);
  });
  it('declares the six inputs with the documented defaults', () => {
    const inputs = wf.slice(wf.indexOf('inputs:'), wf.indexOf('\npermissions:'));
    assert.deepEqual([...inputs.matchAll(/^ {6}([a-z_]+):/gm)].map((m) => m[1]), ['plugin', 'cases', 'runs', 'max_cost_usd', 'threshold', 'plugin_ref']);
    assert.match(inputs, /plugin:[\s\S]*?type: choice/);
    for (const p of ['sdd-engineering', 'engineering-paved-path', 'research-tools', 'architecture-review']) {
      assert.match(inputs, new RegExp(`- ${p}\\b`), p);
    }
    assert.match(inputs, /cases:[\s\S]*?default: '\*'/);
    assert.match(inputs, /runs:[\s\S]*?default: '1'/);
    assert.match(inputs, /max_cost_usd:[\s\S]*?default: '2'/);
    assert.match(inputs, /threshold:[\s\S]*?default: '0\.8'/);
    assert.match(inputs, /plugin_ref:[\s\S]*?required: false[\s\S]*?default: ''/);
  });
  it('top-level permissions are contents: read and nothing else', () => {
    const block = wf.slice(wf.indexOf('\npermissions:'), wf.indexOf('\nconcurrency:') > 0 ? wf.indexOf('\nconcurrency:') : wf.indexOf('\njobs:'));
    assert.equal(block.trim(), 'permissions:\n  contents: read');
    assert.doesNotMatch(wf, /(id-token|packages|actions|pull-requests|issues|checks): (write|read)/);
    assert.doesNotMatch(wf, /: write\b/);
  });
  it('has one job `evals` with environment evals, ubuntu-latest, 45 minutes', () => {
    const jobs = wf.slice(wf.indexOf('\njobs:'));
    assert.deepEqual([...jobs.matchAll(/^ {2}([a-z0-9_-]+):/gm)].map((m) => m[1]), ['evals']);
    assert.match(jobs, /^ {4}environment: evals$/m);
    assert.match(jobs, /^ {4}runs-on: ubuntu-latest$/m);
    assert.match(jobs, /^ {4}timeout-minutes: 45$/m);
  });
  it('serialises runs without cancelling a running eval', () => {
    assert.match(wf, /concurrency:\n {2}group: evals\n {2}cancel-in-progress: false/);
  });
});

describe('evals workflow: pinned actions', () => {
  const site = readFileSync(path.join(WORKFLOWS, 'site.yml'), 'utf8');
  const uses = (text, action) => new RegExp(`uses: (${action}@[0-9a-f]{40}) # (v[0-9.]+)`).exec(text);
  it('checkout and setup-node use the same full SHAs and tag comments as site.yml', () => {
    for (const a of ['actions/checkout', 'actions/setup-node']) {
      const mine = uses(wf, a);
      const theirs = uses(site, a);
      assert.ok(mine, `${a} must be pinned by full SHA with a tag comment`);
      assert.deepEqual(mine.slice(1), theirs.slice(1), a);
    }
  });
  it('every `uses:` is pinned by a 40-character SHA with a tag comment', () => {
    const all = [...wf.matchAll(/^\s*uses: (\S+)(.*)$/gm)];
    assert.ok(all.length >= 3);
    for (const m of all) {
      assert.match(m[1], /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, m[1]);
      assert.match(m[2], /^ # v\d+(\.\d+)*$/, m[1]);
    }
  });
  it('every checkout step does not persist credentials; node 22', () => {
    const parts = wf.split(/^\s{6}- name:/m).slice(1).filter((p) => p.includes('actions/checkout'));
    assert.equal(parts.length, 2, 'the repository checkout and the optional checkout of another ref');
    for (const p of parts) assert.match(p, /persist-credentials: false/);
    assert.match(step('actions/setup-node'), /node-version: 22\b/);
  });
});

describe('evals workflow: cost control and the eval command', () => {
  const run = () => step('claude plugin eval');
  it('pins the claude-code version and keeps its install script', () => {
    assert.match(allRun(), /npm install -g @anthropic-ai\/claude-code@2\.1\.302(\s|$)/);
    assert.doesNotMatch(allRun(), /claude-code@(latest|next|\^|~)/);
    // the package needs its postinstall to link the native binary, so no --ignore-scripts here
    assert.doesNotMatch(step('npm install -g'), /--ignore-scripts/);
    const raw = wfRaw.slice(wfRaw.indexOf('- name: Install Claude Code'), wfRaw.indexOf('- name: Set the credentials'));
    assert.match(raw, /# .*postinstall/i, 'the YAML explains why scripts stay enabled');
  });
  it('targets the plugins directory so a case can load sibling plugins from inside it', () => {
    const r = allRun();
    assert.match(r, /cd plugins\n/);
    assert.match(r, /claude plugin eval \. \\/);
    assert.match(r, /--eval-dir "\$PLUGIN\/evals"/);
    assert.doesNotMatch(r, /claude plugin (marketplace add|install)/);
  });
  it('caps the output tokens of a request so a gateway does not reserve the default maximum', () => {
    assert.match(wf, /CLAUDE_CODE_MAX_OUTPUT_TOKENS: '32000'/);
  });
  it('can evaluate the plugin code of another ref while the cases stay on the current branch', () => {
    assert.match(wf, /plugin_ref:/);
    assert.match(wf, /PLUGIN_REF: \$\{\{ inputs\.plugin_ref \}\}/);
    assert.match(wf, /PLUGIN_REF" =~ \^\[A-Za-z0-9\._\/-\]\{1,64\}\$/);
    assert.match(wf, /ref: \$\{\{ inputs\.plugin_ref \}\}\n\s+path: plugin-ref\n\s+persist-credentials: false/);
    assert.match(wf, /rsync -a --delete --exclude 'evals\/' /);
    assert.ok(wf.indexOf('Use the plugin code of that ref') < wf.indexOf('claude plugin eval'), 'overlay must happen before the eval');
  });
  it('the summary names the plugin versions under test', () => {
    const out = spawnSync('node', [SUMMARY, '/dev/stdin'], { input: JSON.stringify({ cases: [], suite: { plugins: [{ name: 'sdd-engineering', version: '1.0.0' }] } }), encoding: 'utf8' }).stdout;
    assert.match(out, /Plugins under test: sdd-engineering 1\.0\.0/);
  });
  it('passes every cost-control flag', () => {
    const r = run();
    for (const re of [
      /claude plugin eval \. \\/,
      /--case "\$CASES"/,
      /--runs "\$RUNS"/,
      /--ablation none/,
      /--no-publish/,
      /--trust-plugin/,
      /--scaffold/,
      /--max-cost-usd "\$MAX_COST_USD"/,
      /--threshold "\$THRESHOLD"/,
      /--judge-model haiku/,
      /--json \.\.\/results\.json/,
      /--report \.\.\/report\.html/,
      /--output-dir \.\.\/out/,
      /--allow-tools /,
    ]) assert.match(r, re, String(re));
  });
  it('--allow-tools is last (variadic) and narrow: no commit, push, web or wildcard Bash', () => {
    const r = run();
    const cmd = r.slice(r.indexOf('claude plugin eval'));
    const flags = [...cmd.replace(/"[^"]*"/g, '""').matchAll(/\s--([a-z-]+)/g)].map((m) => m[1]);
    assert.equal(flags.at(-1), 'allow-tools');
    const grant = cmd.slice(cmd.indexOf('--allow-tools'));
    assert.match(grant, /Bash\(node --test:\*\)/);
    assert.doesNotMatch(grant, /git (commit|push)|WebFetch|WebSearch|Bash\(\*\)|Bash\s|"Bash"/);
    assert.doesNotMatch(grant, /mcp__/);
    const raw = wfRaw.slice(wfRaw.indexOf('- name: Run the evals'));
    assert.match(raw, /# .*grant is only what/i, 'the grant carries a justification comment');
  });
  it('the exit code of the eval step fails the job and is kept for the summary', () => {
    const r = run();
    assert.match(r, /exit_code=\$rc/);
    assert.match(r, /GITHUB_OUTPUT/);
    assert.match(r, /exit "\$rc"/);
    assert.match(step('id: eval'), /Run the evals/);
    assert.doesNotMatch(step('claude plugin eval'), /continue-on-error|\|\| true/);
  });
});

describe('evals workflow: inputs, validation and secrets', () => {
  it('inputs reach scripts only through env, never through the script text', () => {
    assert.doesNotMatch(allRun(), /\$\{\{/, 'no expression inside a run block');
    for (const m of wf.matchAll(/\$\{\{\s*inputs\.([a-z_]+)\s*\}\}/g)) {
      const line = wf.split('\n').find((l) => l.includes(m[0]));
      assert.match(line, /^\s+[A-Z_]+: \$\{\{ inputs\.[a-z_]+ \}\}$/, `${m[0]} must sit on an env: line`);
    }
    for (const i of ['plugin', 'cases', 'runs', 'max_cost_usd', 'threshold']) {
      assert.ok(wf.includes(`inputs.${i} }}`), `inputs.${i} is used`);
    }
  });
  it('validates plugin, cases, runs, max cost and threshold in a shell step before any install', () => {
    const v = step('Validate the inputs');
    assert.match(v, /set -euo pipefail/);
    assert.match(v, /\[1-3\]/, 'runs 1..3');
    assert.match(v, /MAX_COST_USD/);
    assert.match(v, /<= 5|<=5/, 'max cost ceiling of 5');
    assert.match(v, /THRESHOLD/);
    assert.match(v, /CASES/);
    assert.match(v, /sdd-engineering\|engineering-paved-path\|research-tools\|architecture-review/);
    assert.ok(wf.indexOf(v.slice(0, 40)) < wf.indexOf('npm install -g'), 'validate first');
  });
  it('the secret is referenced only as secrets.EVAL_API_KEY, in one step, never echoed', () => {
    const refs = [...wf.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
    assert.deepEqual(refs, ['EVAL_API_KEY']);
    assert.doesNotMatch(wf, /secrets\[|toJSON\(secrets|secrets: inherit/);
    assert.doesNotMatch(wf, /GITHUB_TOKEN|github\.token/);
    const s = step('secrets.EVAL_API_KEY');
    assert.match(s, /ANTHROPIC_API_KEY: \$\{\{ secrets\.EVAL_API_KEY \}\}/);
    assert.match(s, /::add-mask::/);
    const echoes = s.replace(/\{[^}]*\} >> "\$GITHUB_ENV"/, '').split('\n').filter((l) => /echo[^\n]*\$\{?ANTHROPIC_(API_KEY|AUTH_TOKEN)/.test(l));
    for (const l of echoes) assert.match(l, /add-mask|>> "\$GITHUB_ENV"/, `key echoed outside a mask or GITHUB_ENV: ${l}`);
    assert.match(s, /-z "\$\{?ANTHROPIC_API_KEY/, 'fails fast on an empty secret');
    assert.match(s, /::error::/);
  });
  it('a base URL variable switches to token auth and clears the API key', () => {
    const s = step('secrets.EVAL_API_KEY');
    assert.match(s, /EVAL_BASE_URL: \$\{\{ vars\.EVAL_BASE_URL \}\}/);
    assert.match(s, /ANTHROPIC_BASE_URL=/);
    assert.match(s, /ANTHROPIC_AUTH_TOKEN=/);
    assert.match(s, /ANTHROPIC_API_KEY=\n|ANTHROPIC_API_KEY="?"?\s*$/m);
    assert.match(s, /GITHUB_ENV/);
    assert.deepEqual([...wf.matchAll(/vars\.([A-Za-z0-9_]+)/g)].map((m) => m[1]), ['EVAL_BASE_URL']);
  });
  it('the key is exported only after the CLI install', () => {
    assert.ok(wf.indexOf('secrets.EVAL_API_KEY') > wf.indexOf('npm install -g'));
  });
});

describe('evals workflow: outputs', () => {
  it('uploads results.json, report.html and out/ always, kept 14 days', () => {
    const u = step('upload-artifact');
    assert.match(u, /if: always\(\)/);
    assert.match(u, /retention-days: 14/);
    for (const p of ['results.json', 'report.html', 'out/']) assert.ok(u.includes(p), p);
    assert.match(u, /if-no-files-found: (warn|ignore)/);
  });
  it('writes a Job Summary with scripts/eval-summary.mjs, always', () => {
    const s = step('eval-summary.mjs');
    assert.match(s, /if: always\(\)/);
    assert.match(s, /GITHUB_STEP_SUMMARY/);
    assert.match(s, /EXIT_CODE: \$\{\{ steps\.eval\.outputs\.exit_code \}\}/);
    assert.match(s, /THRESHOLD: \$\{\{ inputs\.threshold \}\}/);
  });
  it('the summary and upload steps come after the eval step', () => {
    const order = ['claude plugin eval', 'eval-summary.mjs', 'upload-artifact'].map((m) => wf.indexOf(m));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });
});

// ---------------------------------------------------------------- eval-summary

const summarize = (obj, { threshold = '0.8', exit = '0' } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'eval-summary-'));
  try {
    const f = path.join(dir, 'results.json');
    if (obj !== undefined) writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
    return spawnSync('node', [SUMMARY, f], {
      encoding: 'utf8', env: { PATH: process.env.PATH, THRESHOLD: threshold, EXIT_CODE: exit },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const caseOf = (name, score, extra = {}) => ({
  name,
  aggregates: { score },
  costUsd: extra.cost ?? 0.1,
  arms: { with: (extra.runs ?? [{ error: null, numTurns: extra.turns ?? 4 }]) },
});
const suite = (cases, extra = {}) => ({
  schemaVersion: 1, partial: false, costUsd: 0.5, durationSeconds: 90, claudeVersion: '2.1.302',
  aggregates: { overallScore: 0.9, casesPassed: cases.length, casesTotal: cases.length },
  cases, ...extra,
});

describe('scripts/eval-summary.mjs', () => {
  it('is dependency-free (node: imports only)', () => {
    const t = readFileSync(SUMMARY, 'utf8');
    for (const m of t.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) assert.match(m[1], /^node:/, m[1]);
  });
  it('a passing run: table row per case, totals, exit code 0 meaning', () => {
    const r = summarize(suite([caseOf('sdd-1-spec-draft', 1, { cost: 0.12, turns: 6 }), caseOf('sdd-2-plan-returned', 0.9)]));
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^## /m);
    assert.match(r.stdout, /\| Case \| Score \| Result \| Cost \(USD\) \| Turns \| Errors \|/);
    assert.match(r.stdout, /\| sdd-1-spec-draft \| 1\.00 \| pass \| 0\.12 \| 6 \| none \|/);
    assert.match(r.stdout, /\| sdd-2-plan-returned \| 0\.90 \| pass \|/);
    assert.match(r.stdout, /2 of 2 cases/);
    assert.match(r.stdout, /Exit code 0: /);
    assert.doesNotMatch(r.stdout, /Partial run/i);
  });
  it('a failing case is marked fail against the threshold', () => {
    const r = summarize(suite([caseOf('a', 0.5), caseOf('b', 1)], { aggregates: { overallScore: 0.75, casesPassed: 1, casesTotal: 2 } }), { exit: '1' });
    assert.match(r.stdout, /\| a \| 0\.50 \| fail \|/);
    assert.match(r.stdout, /\| b \| 1\.00 \| pass \|/);
    assert.match(r.stdout, /1 of 2 cases/);
    assert.match(r.stdout, /Exit code 1: /);
    assert.match(r.stdout, /below the threshold|failed to load|API error/i);
    const strict = summarize(suite([caseOf('a', 0.9)]), { threshold: '0.95' });
    assert.match(strict.stdout, /\| a \| 0\.90 \| fail \|/);
  });
  it('a partial run is flagged with its reason and exit code 2', () => {
    const r = summarize(suite([caseOf('a', 1)], { partial: true, partialReason: 'cost_ceiling' }), { exit: '2' });
    assert.match(r.stdout, /Partial run/i);
    assert.match(r.stdout, /cost_ceiling/);
    assert.match(r.stdout, /Exit code 2: /);
    assert.match(r.stdout, /ceiling|credential/i);
  });
  it('run errors are listed per case, escaped for a table and truncated', () => {
    const long = 'x'.repeat(400);
    const r = summarize(suite([caseOf('e', 0, { runs: [{ error: 'timed out after 300s | really' }, { error: null }, { error: long }] })]), { exit: '1' });
    assert.match(r.stdout, /timed out after 300s \\\| really/);
    assert.doesNotMatch(r.stdout, new RegExp('x{200}'));
    assert.match(r.stdout, /\| e \| 0\.00 \| fail \|[^\n]*\| 2 error/);
  });
  it('missing numbers print n/a instead of failing', () => {
    const r = summarize({ schemaVersion: 1, partial: false, cases: [{ name: 'bare', aggregates: { score: 1 }, arms: { with: [] } }] });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\| bare \| 1\.00 \| pass \| n\/a \| n\/a \| none \|/);
  });
  it('a missing or invalid results.json prints a note and still exits 0', () => {
    const none = summarize(undefined, { exit: '1' });
    assert.equal(none.status, 0);
    assert.match(none.stdout, /No results\.json/i);
    assert.match(none.stdout, /Exit code 1: /);
    const bad = summarize('{not json', { exit: '1' });
    assert.equal(bad.status, 0);
    assert.match(bad.stdout, /could not be read/i);
  });
  it('knows the documented exit codes and flags unknown ones', () => {
    for (const [c, re] of [['130', /interrupted/i], ['143', /terminated/i], ['9', /unknown/i]]) {
      assert.match(summarize(suite([caseOf('a', 1)]), { exit: c }).stdout, new RegExp(`Exit code ${c}: [^\\n]*${re.source}`, 'i'), c);
    }
  });
});

// ---------------------------------------------------------------- case files

const GRADER_TYPES = ['llm', 'regex', 'tool_used', 'tool_order', 'file_exists', 'baseline'];
const PROMPT_KEYS = ['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env'];
const CASE_TOP = ['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'execution', 'context', 'graders'];
const EXEC_KEYS = ['model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env', 'prompt'];
const CTX_KEYS = ['scaffold_script', 'history_file', 'add_dirs'];
const GRADER_KEYS = {
  llm: ['criteria', 'focus'], regex: ['pattern', 'flags', 'match', 'target'], tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'], file_exists: ['path', 'exists'], baseline: ['baseline_file', 'criteria'],
};
const COMMON = ['type', 'weight', 'arm'];

const allCases = [];
for (const plugin of pluginNames()) {
  const evals = path.join(pluginDir(plugin), 'evals');
  for (const d of readdirSync(evals, { withFileTypes: true })) {
    if (d.isDirectory()) allCases.push({ plugin, name: d.name, dir: path.join(evals, d.name) });
  }
}
const loadCase = (c) => {
  const prompt = existsSync(path.join(c.dir, 'prompt.md')) ? parseFrontmatter(readFileSync(path.join(c.dir, 'prompt.md'), 'utf8')) : null;
  const yamlPath = path.join(c.dir, 'case.yaml');
  const yaml = existsSync(yamlPath) ? parseCaseYaml(readFileSync(yamlPath, 'utf8')) : null;
  const gdir = path.join(c.dir, 'graders');
  const files = existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith('.md')) : [];
  const graders = [
    ...(yaml?.graders ?? []).map((g) => ({ src: 'case.yaml', ...g })),
    ...files.map((f) => ({ src: `graders/${f}`, ...parseFrontmatter(readFileSync(path.join(gdir, f), 'utf8')).data })),
  ];
  return { prompt, yaml, graders };
};

describe('eval cases load under the documented format (all plugins)', () => {
  it('finds the expected number of cases', () => {
    assert.equal(allCases.length, 6 + 3 + 4 + 4);
  });
  for (const c of allCases) {
    const label = `${c.plugin}/${c.name}`;
    it(`${label}: keys, limits and graders are valid`, () => {
      const { prompt, yaml, graders } = loadCase(c);
      assert.ok(prompt || yaml?.execution?.prompt, 'needs prompt.md or execution.prompt');
      if (prompt) {
        for (const k of Object.keys(prompt.data)) assert.ok(PROMPT_KEYS.includes(k), `prompt.md: unknown key ${k}`);
        assert.ok(prompt.body.trim().length > 0, 'prompt body is empty');
      }
      const merged = { ...(yaml?.execution ?? {}), ...(prompt?.data ?? {}) };
      if (merged.max_turns !== undefined) assert.ok(merged.max_turns >= 1 && merged.max_turns <= 200, 'max_turns');
      if (merged.timeout_seconds !== undefined) assert.ok(merged.timeout_seconds >= 1 && merged.timeout_seconds <= 3600, 'timeout_seconds');
      if (yaml) {
        assert.equal(yaml.schema_version, '1.1');
        assert.ok(yaml.name, 'case.yaml name');
        assert.equal(yaml.name, c.name, 'case.yaml name matches the folder');
        for (const k of Object.keys(yaml)) assert.ok(CASE_TOP.includes(k), `case.yaml: unknown key ${k}`);
        for (const k of Object.keys(yaml.execution ?? {})) assert.ok(EXEC_KEYS.includes(k), `execution: unknown key ${k}`);
        for (const k of Object.keys(yaml.context ?? {})) assert.ok(CTX_KEYS.includes(k), `context: unknown key ${k}`);
      }
      assert.ok(graders.length >= 1, 'at least one grader');
      const names = new Set();
      for (const g of graders) {
        assert.ok(GRADER_TYPES.includes(g.type), `${g.src}: type ${g.type}`);
        for (const k of Object.keys(g)) {
          if (k === 'src' || (g.src === 'case.yaml' && k === 'name')) continue;
          assert.ok([...COMMON, ...GRADER_KEYS[g.type]].includes(k), `${g.src}: key ${k} is not valid for ${g.type}`);
        }
        if (g.src === 'case.yaml') {
          assert.ok(g.name && !names.has(g.name), `${g.src}: unique grader name`);
          names.add(g.name);
        }
        if (g.type === 'tool_used' && g.max !== undefined) {
          // frontmatter of graders/*.md is read as text, case.yaml as numbers
          assert.equal(Number(g.min), 0, `${g.src}: a "never called" grader needs min: 0 as well as max`);
        }
        if (g.type === 'file_exists') assert.ok(g.path, `${g.src}: path`);
        if (g.type === 'regex') assert.ok(g.pattern, `${g.src}: pattern`);
        if (g.type === 'regex' || g.type === 'tool_used') new RegExp(g.pattern ?? g.input_match ?? '');
        if (g.type === 'llm' && g.src === 'case.yaml') assert.ok(g.criteria, `${g.src}: criteria`);
      }
    });
  }
});

const SDD = pluginDir('sdd-engineering');
const sddCase = (n) => path.join(SDD, 'evals', n);
const SCAFFOLDED = ['sdd-2-plan-returned', 'sdd-3-no-commit', 'sdd-4-no-plan-file'];
const PROSE = ['sdd-1-spec-draft', 'sdd-5-requirements-coverage', 'sdd-6-closed-questions'];

describe('sdd-engineering cases: prose cases stay prose, three are deterministic', () => {
  for (const n of PROSE) {
    it(`${n}: no case.yaml, llm grader kept`, () => {
      assert.ok(!existsSync(path.join(sddCase(n), 'case.yaml')));
      const g = parseFrontmatter(readFileSync(path.join(sddCase(n), 'graders', 'criteria.md'), 'utf8'));
      assert.equal(g.data.type, 'llm');
    });
  }
  for (const n of SCAFFOLDED) {
    it(`${n}: case.yaml with a scaffold, a documented trace dependency and the llm fallback`, () => {
      const dir = sddCase(n);
      const text = readFileSync(path.join(dir, 'case.yaml'), 'utf8');
      const y = parseCaseYaml(text);
      assert.equal(y.context.scaffold_script, 'scaffold.sh');
      assert.ok(existsSync(path.join(dir, 'scaffold.sh')));
      assert.match(text, /subagent/i, 'comment on the subagent trace dependency');
      assert.match(text, /fallback/i);
      assert.equal(loadCase({ dir }).graders.filter((g) => g.type === 'llm').length, 1, 'one llm grader (graders/criteria.md)');
      assert.ok(existsSync(path.join(dir, 'prompt.md')));
    });
  }
  const graders = (n) => parseCaseYaml(readFileSync(path.join(sddCase(n), 'case.yaml'), 'utf8')).graders;
  it('SDD-2: no file under docs/ is created', () => {
    assert.ok(graders('sdd-2-plan-returned').some((g) => g.type === 'file_exists' && g.path === 'docs/**' && g.exists === false));
  });
  it('SDD-3: no git commit or push call', () => {
    const g = graders('sdd-3-no-commit').find((x) => x.type === 'tool_used');
    assert.equal(g.tool, 'Bash');
    assert.equal(g.min, 0);
    assert.equal(g.max, 0);
    const re = new RegExp(g.input_match);
    for (const hit of ['{"command":"git commit -am \\"done\\""}', '{"command":"git push"}', '{"command":"git push origin main"}']) assert.match(hit, re, hit);
    for (const miss of ['{"command":"node --test"}', '{"command":"git status"}', '{"command":"git log --oneline"}']) assert.doesNotMatch(miss, re, miss);
  });
  it('SDD-4: no plan file and no Write call', () => {
    const g = graders('sdd-4-no-plan-file');
    assert.ok(g.some((x) => x.type === 'file_exists' && x.path === 'docs/plans/greeting.md' && x.exists === false));
    assert.ok(g.some((x) => x.type === 'tool_used' && x.tool === 'Write' && x.min === 0 && x.max === 0));
  });
  it('setup.md and the index describe the scaffold and the manual remainder', () => {
    const idx = readFileSync(path.join(SDD, 'evals', 'README.md'), 'utf8');
    assert.match(idx, /--scaffold/);
    assert.match(idx, /--allow-tools/);
    assert.match(idx, /evals\.yml/);
    for (const n of SCAFFOLDED) {
      const s = readFileSync(path.join(sddCase(n), 'setup.md'), 'utf8');
      assert.match(s, /scaffold\.sh/, n);
      assert.match(s, /tool_used|file_exists/, n);
      assert.match(s, /manual/i, n);
    }
  });
});

describe('gated tools in cases are covered by the workflow grant', () => {
  const GATED = ['Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch'];
  const grant = wf.slice(wf.indexOf('--allow-tools'), wf.indexOf('|| rc=$?'));
  it('every gated tool a case lists is granted, and nothing else is', () => {
    const wanted = new Set();
    for (const c of allCases) {
      const { prompt, yaml } = loadCase(c);
      const tools = prompt?.data.allowed_tools ?? yaml?.execution?.allowed_tools ?? [];
      for (const tool of tools) if (GATED.includes(tool)) wanted.add(tool);
    }
    assert.deepEqual([...wanted].sort(), ['Bash', 'Edit', 'Write']);
    for (const tool of ['Write', 'Edit']) assert.match(grant, new RegExp(`\\b${tool}\\b`));
    assert.match(grant, /Bash\(node --test:\*\)/);
  });
  it('only sdd-engineering cases ask for gated tools', () => {
    for (const c of allCases) {
      const tools = loadCase(c).prompt?.data.allowed_tools ?? [];
      if (c.plugin !== 'sdd-engineering') assert.ok(!tools.some((x) => ['Bash', 'Write', 'Edit'].includes(x)), c.name);
    }
  });
});

describe('scaffold scripts: safe, bash, executable', () => {
  const scripts = allCases.flatMap((c) => {
    const y = existsSync(path.join(c.dir, 'case.yaml')) ? parseCaseYaml(readFileSync(path.join(c.dir, 'case.yaml'), 'utf8')) : null;
    return y?.context?.scaffold_script ? [path.join(c.dir, y.context.scaffold_script)] : [];
  });
  it('there is one script per scaffolded case', () => assert.equal(scripts.length, SCAFFOLDED.length));
  for (const s of scripts) {
    const label = path.relative(PLUGINS_DIR, s);
    it(`${label}: executable, set -euo pipefail, no network, no home paths, parses`, () => {
      const t = readFileSync(s, 'utf8');
      assert.ok(statSync(s).mode & 0o100, 'owner execute bit');
      assert.match(t.split('\n')[0], /^#!\/usr\/bin\/env bash$/);
      assert.match(t, /^set -euo pipefail$/m);
      assert.doesNotMatch(t, /\b(curl|wget|ssh|scp|nc|ncat|telnet|npm|npx|pnpm|yarn|pip|apt|brew|sudo)\b/);
      assert.doesNotMatch(t, /https?:\/\/|git@|git clone|git fetch|git pull|ssh:\/\//);
      assert.doesNotMatch(t, /\/Users\/|\/home\/|~\/|\$HOME|\$\{HOME\}|\bgit config --global\b|--system/);
      assert.doesNotMatch(t, /\brm\s+-rf?\s+\/|\.\.\//, 'stays inside the workspace');
      const syntax = spawnSync('bash', ['-n', s], { encoding: 'utf8' });
      assert.equal(syntax.status, 0, syntax.stderr);
    });
  }
});

describe('scaffold scripts: run in a temp dir and build the fixture', () => {
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const scaffold = (n) => {
    const ws = mkdtempSync(path.join(tmpdir(), 'scaffold-'));
    const home = mkdtempSync(path.join(tmpdir(), 'scaffold-home-'));
    // the documented minimal environment: PATH, a temporary HOME, TMPDIR, TERM
    const r = spawnSync('bash', [path.join(sddCase(n), 'scaffold.sh')], {
      cwd: ws, encoding: 'utf8', timeout: 60_000,
      env: { PATH: process.env.PATH, HOME: home, TMPDIR: tmpdir(), TERM: 'dumb' },
    });
    assert.equal(r.status, 0, `${n}: ${r.stderr}`);
    return { ws, cleanup: () => { rmSync(ws, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); } };
  };
  const common = (ws) => {
    for (const f of ['greet.js', 'README.md', 'specs/01-greeting.md']) assert.ok(existsSync(path.join(ws, f)), f);
    assert.ok(existsSync(path.join(ws, '.git')));
    assert.equal(git(ws, 'rev-list', '--count', 'HEAD'), '1', 'one commit');
    assert.equal(git(ws, 'status', '--porcelain'), '', 'clean tree');
    const spec = readFileSync(path.join(ws, 'specs/01-greeting.md'), 'utf8');
    assert.match(spec, /^Spec ID: SPEC-01$/m);
    assert.match(spec, /^Status: approved$/m);
    assert.deepEqual([...spec.matchAll(/^- (AC-\d+) /gm)].map((m) => m[1]), ['AC-1', 'AC-2', 'AC-3']);
    assert.match(readFileSync(path.join(ws, 'greet.js'), 'utf8'), /Hello, \$\{name \?\? 'world'\}!/);
    assert.ok(!existsSync(path.join(ws, 'docs')), 'no docs/ in the fixture');
    const tracked = git(ws, 'ls-files').split('\n');
    for (const f of ['greet.js', 'README.md', 'specs/01-greeting.md']) assert.ok(tracked.includes(f), `${f} is committed`);
  };
  for (const n of ['sdd-2-plan-returned', 'sdd-4-no-plan-file']) {
    it(`${n}: committed greeting-tool repo with an approved spec, no remote`, () => {
      const { ws, cleanup } = scaffold(n);
      try {
        common(ws);
        assert.equal(git(ws, 'remote'), '');
        assert.ok(!existsSync(path.join(ws, 'plan.md')));
      } finally { cleanup(); }
    });
  }
  it('sdd-3-no-commit: adds plan.md, the shout files and a local bare origin', () => {
    const { ws, cleanup } = scaffold('sdd-3-no-commit');
    try {
      common(ws);
      for (const f of ['plan.md', 'shout.js', 'shout.test.mjs', 'package.json']) {
        assert.ok(existsSync(path.join(ws, f)), f);
        assert.ok(git(ws, 'ls-files').split('\n').includes(f), `${f} is committed`);
      }
      assert.match(readFileSync(path.join(ws, 'plan.md'), 'utf8'), /## Phase P1[\s\S]*T1[\s\S]*AC-1/);
      assert.equal(JSON.parse(readFileSync(path.join(ws, 'package.json'), 'utf8')).type, 'module');
      const url = git(ws, 'remote', 'get-url', 'origin');
      assert.ok(!/:\/\/|@|:/.test(url), `origin must be a plain local path, got ${url}`);
      const origin = path.resolve(ws, url);
      assert.ok(origin.startsWith(ws + path.sep), 'origin lives inside the workspace');
      assert.equal(git(origin, 'rev-parse', '--is-bare-repository'), 'true');
      assert.equal(git(origin, 'rev-parse', 'HEAD'), git(ws, 'rev-parse', 'HEAD'), 'origin holds the initial commit');
      assert.equal(git(ws, 'status', '--porcelain'), '', 'the origin directory is excluded from the tree');
    } finally { cleanup(); }
  });
  it('sdd-3-no-commit: the fixture test fails before the phase (shout is a stub)', () => {
    const { ws, cleanup } = scaffold('sdd-3-no-commit');
    try {
      const r = spawnSync('node', ['--test'], { cwd: ws, encoding: 'utf8', env: { PATH: process.env.PATH } });
      assert.notEqual(r.status, 0);
    } finally { cleanup(); }
  });
});
