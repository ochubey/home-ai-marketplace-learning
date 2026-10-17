import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, assertSafeCwd, buildClaudeEnv, REPO_ROOT } from '../scripts/cost/run-scenario.mjs';
import { GOOD_SPEC, GOOD_PLAN, GOOD_SPEC_NAME, claudeJson } from './cost-fixtures.mjs';

const RUNNER = path.join(REPO_ROOT, 'scripts', 'cost', 'run-scenario.mjs');

describe('cost: runner argument parsing', () => {
  it('parses defaults and options', () => {
    const o = parseArgs(['base', '3', '--out', 'results']);
    assert.equal(o.label, 'base');
    assert.equal(o.runs, 3);
    assert.equal(o.model, 'sonnet');
    assert.equal(o.budget, 2);
    assert.equal(o.plugins, path.join(REPO_ROOT, 'plugins'));
    assert.ok(path.isAbsolute(o.out));
    const p = parseArgs(['x', '1', '--out', 'o', '--model', 'opus', '--budget', '0.5', '--plugins', 'pp']);
    assert.deepEqual([p.model, p.budget], ['opus', 0.5]);
  });
  it('rejects bad input', () => {
    assert.throws(() => parseArgs(['base']), /expected/);
    assert.throws(() => parseArgs(['base', '0', '--out', 'o']), /runs/);
    assert.throws(() => parseArgs(['base', 'x', '--out', 'o']), /runs/);
    assert.throws(() => parseArgs(['base', '1']), /--out/);
    assert.throws(() => parseArgs(['base', '1', '--out']), /needs a value/);
    assert.throws(() => parseArgs(['base', '1', '--out', 'o', '--bogus', 'v']), /unknown option/);
    assert.throws(() => parseArgs(['base', '1', '--out', 'o', '--budget', '-1']), /budget/);
    assert.throws(() => parseArgs(['../x', '1', '--out', 'o']), /label/);
  });
});

describe('cost: runner environment', () => {
  const base = { PATH: '/bin', CLAUDECODE: '1', ANTHROPIC_MODEL: 'a', CLAUDE_CODE_SUBAGENT_MODEL: 'b', OTHER: 'c' };
  it('filters the overrides without mutating the input', () => {
    assert.deepEqual(buildClaudeEnv(base), { PATH: '/bin', OTHER: 'c' });
    assert.equal(base.ANTHROPIC_MODEL, 'a');
  });
  it('keeps model overrides on request but still drops CLAUDECODE', () => {
    assert.deepEqual(buildClaudeEnv(base, { keepOverrides: true }), { PATH: '/bin', ANTHROPIC_MODEL: 'a', CLAUDE_CODE_SUBAGENT_MODEL: 'b', OTHER: 'c' });
  });
  it('parses --keep-env-overrides as a flag', () => {
    assert.equal(parseArgs(['x', '1', '--out', 'o', '--keep-env-overrides']).keepEnvOverrides, true);
    assert.equal(parseArgs(['x', '1', '--out', 'o']).keepEnvOverrides, false);
  });
});

describe('cost: runner refusal logic', () => {
  it('refuses the marketplace repo and its subdirectories, allows a temp dir', () => {
    assert.throws(() => assertSafeCwd(REPO_ROOT), /refusing/);
    assert.throws(() => assertSafeCwd(path.join(REPO_ROOT, 'scripts')), /refusing/);
    const tmp = mkdtempSync(path.join(tmpdir(), 'cost-safe-'));
    try {
      assert.doesNotThrow(() => assertSafeCwd(tmp));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('cost: runner end to end with a fake claude', () => {
  const FAKE = (specText, planText) => `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const prompt = args[args.length - 1];
const envSeen = Object.fromEntries(['CLAUDECODE', 'CLAUDE_CODE_SUBAGENT_MODEL', 'ANTHROPIC_MODEL', 'KEEP_ME'].map((k) => [k, process.env[k] ?? null]));
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ args, cwd: process.cwd(), env: envSeen }) + '\\n');
const mode = process.env.FAKE_MODE || 'ok';
const payload = (result, extra) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result,
  total_cost_usd: 0.5, num_turns: 2, duration_ms: 1000,
  modelUsage: { m: { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4, costUSD: 0.5 } }, ...extra });
if (prompt.includes('spec-creator')) {
  if (mode === 'budget') { console.log(payload('stopped', { subtype: 'error_max_budget_usd', is_error: true })); process.exit(1); }
  fs.mkdirSync('specs', { recursive: true });
  if (mode === 'throw') { fs.mkdirSync('specs/${GOOD_SPEC_NAME}'); console.log(payload('spec dir')); process.exit(0); }
  fs.writeFileSync('specs/${GOOD_SPEC_NAME}', ${JSON.stringify(specText)});
  console.log(payload('spec written'));
} else {
  const spec = fs.readFileSync('specs/${GOOD_SPEC_NAME}', 'utf8');
  const approved = /^Status: approved$/m.test(spec);
  console.log(payload(approved ? ${JSON.stringify(planText)} : 'spec was not approved'));
}
`;

  function setup(specText = GOOD_SPEC, planText = GOOD_PLAN) {
    const root = mkdtempSync(path.join(tmpdir(), 'cost-run-'));
    const bin = path.join(root, 'fake-claude');
    writeFileSync(bin, FAKE(specText, planText));
    chmodSync(bin, 0o755);
    return { root, bin, log: path.join(root, 'calls.log'), out: path.join(root, 'out') };
  }
  const run = (ctx, args, env = {}) =>
    spawnSync(process.execPath, [RUNNER, ...args], {
      encoding: 'utf8', cwd: REPO_ROOT,
      env: { ...process.env, CLAUDE_BIN: ctx.bin, FAKE_LOG: ctx.log, ...env },
    });

  it('runs both steps, approves the spec, saves JSON and a passing quality record', () => {
    const ctx = setup();
    try {
      const r = run(ctx, ['lbl', '2', '--out', ctx.out]);
      assert.equal(r.status, 0, r.stderr);
      for (const i of [1, 2]) {
        for (const s of ['spec', 'plan', 'quality']) assert.ok(existsSync(path.join(ctx.out, `lbl-run${i}-${s}.json`)), `${s} ${i}`);
        const q = JSON.parse(readFileSync(path.join(ctx.out, `lbl-run${i}-quality.json`), 'utf8'));
        assert.equal(q.status, 'ok');
        assert.equal(q.quality.pass, true, JSON.stringify(q.quality.checks));
        assert.ok(q.wall_ms >= 0);
        const plan = JSON.parse(readFileSync(path.join(ctx.out, `lbl-run${i}-plan.json`), 'utf8'));
        assert.equal(plan.result, GOOD_PLAN);
      }
      const calls = readFileSync(ctx.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(calls.length, 4);
      for (const c of calls) {
        assert.ok(!c.cwd.startsWith(REPO_ROOT), 'claude ran inside the marketplace repo');
        assert.ok(!c.args.includes('--dangerously-skip-permissions'));
        const flag = (f) => c.args[c.args.indexOf(f) + 1];
        assert.equal(flag('--model'), 'sonnet');
        assert.equal(flag('--output-format'), 'json');
        assert.equal(flag('--permission-mode'), 'acceptEdits');
        assert.equal(flag('--max-budget-usd'), '2');
        assert.equal(flag('--setting-sources'), 'project');
        assert.ok(c.args.includes('-p') && c.args.includes('--no-session-persistence'));
        const dirs = c.args.flatMap((a, k) => (a === '--plugin-dir' ? [c.args[k + 1]] : []));
        assert.deepEqual(dirs.map((d) => path.basename(d)), ['sdd-engineering', 'engineering-paved-path', 'research-tools', 'architecture-review']);
      }
      assert.match(calls[0].args.at(-1), /^Use the sdd-engineering:spec-creator agent to write a spec in specs\/ for this feature request: /);
      assert.equal(calls[1].args.at(-1), `Use the sdd-engineering:implementation-planner agent to plan the spec in specs/${GOOD_SPEC_NAME}. Run it as a single-agent pass. Reply with the plan text exactly as the agent returned it, without summarizing or shortening it.`);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('records a budget failure without losing the raw output', () => {
    const ctx = setup();
    try {
      const r = run(ctx, ['bad', '1', '--out', ctx.out], { FAKE_MODE: 'budget' });
      assert.equal(r.status, 1);
      const raw = JSON.parse(readFileSync(path.join(ctx.out, 'bad-run1-spec.json'), 'utf8'));
      assert.equal(raw.subtype, 'error_max_budget_usd');
      const q = JSON.parse(readFileSync(path.join(ctx.out, 'bad-run1-quality.json'), 'utf8'));
      assert.equal(q.status, 'failed');
      assert.match(q.failure, /spec step/);
      assert.equal(q.quality.pass, false);
      assert.ok(!existsSync(path.join(ctx.out, 'bad-run1-plan.json')));
      assert.equal(readFileSync(ctx.log, 'utf8').trim().split('\n').length, 1);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('records a failure when claude exits non-zero with non-JSON output', () => {
    const ctx = setup();
    const bin = path.join(ctx.root, 'broken');
    writeFileSync(bin, '#!/usr/bin/env node\nconsole.log("oops"); process.exit(3);\n');
    chmodSync(bin, 0o755);
    try {
      const r = run(ctx, ['brk', '1', '--out', ctx.out], { CLAUDE_BIN: bin });
      assert.equal(r.status, 1);
      assert.equal(readFileSync(path.join(ctx.out, 'brk-run1-spec.json'), 'utf8').trim(), 'oops');
      const q = JSON.parse(readFileSync(path.join(ctx.out, 'brk-run1-quality.json'), 'utf8'));
      assert.match(q.failure, /exit code 3/);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('refuses to call claude when the temp dir lies inside the marketplace repo', () => {
    const ctx = setup();
    const inside = mkdtempSync(path.join(REPO_ROOT, 'cost-tmp-'));
    try {
      const r = run(ctx, ['ref', '1', '--out', ctx.out], { TMPDIR: inside });
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /refusing/);
      assert.ok(!existsSync(ctx.log), 'claude must not have been called');
    } finally {
      rmSync(inside, { recursive: true, force: true });
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('saves the generated spec and records its name', () => {
    const ctx = setup();
    try {
      assert.equal(run(ctx, ['sv', '1', '--out', ctx.out]).status, 0);
      const saved = readFileSync(path.join(ctx.out, 'sv-run1-spec.md'), 'utf8');
      assert.match(saved, /SPEC-01/);
      const q = JSON.parse(readFileSync(path.join(ctx.out, 'sv-run1-quality.json'), 'utf8'));
      assert.equal(q.spec_file, GOOD_SPEC_NAME);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('refuses stale run files for the label and writes nothing', () => {
    const ctx = setup();
    try {
      mkdirSync(ctx.out, { recursive: true });
      writeFileSync(path.join(ctx.out, 'old-run2-plan.json'), '{}');
      const r = run(ctx, ['old', '1', '--out', ctx.out]);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /old-run2-plan\.json/);
      assert.match(r.stderr, /already/);
      assert.ok(!existsSync(ctx.log));
      assert.ok(!existsSync(path.join(ctx.out, 'old-manifest.json')));
      assert.ok(!existsSync(path.join(ctx.out, 'old-run1-quality.json')));
      assert.equal(run(ctx, ['other', '1', '--out', ctx.out]).status, 0);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('writes a manifest with env var names only', () => {
    const ctx = setup();
    try {
      assert.equal(run(ctx, ['mf', '2', '--out', ctx.out, '--model', 'opus'], { ANTHROPIC_MODEL: 'secret-model-value' }).status, 0);
      const raw = readFileSync(path.join(ctx.out, 'mf-manifest.json'), 'utf8');
      const m = JSON.parse(raw);
      assert.equal(m.label, 'mf');
      assert.equal(m.runs, 2);
      assert.equal(m.model, 'opus');
      assert.ok(m.env_names_set.includes('ANTHROPIC_MODEL'));
      assert.ok(!raw.includes('secret-model-value'));
      assert.ok('plugin_commit' in m);
      assert.equal(m.keep_env_overrides, false);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('records a thrown exception as a failed run, continues, and removes the temp repo', () => {
    const ctx = setup();
    try {
      const r = run(ctx, ['thr', '2', '--out', ctx.out], { FAKE_MODE: 'throw' });
      assert.equal(r.status, 1);
      for (const i of [1, 2]) {
        const q = JSON.parse(readFileSync(path.join(ctx.out, `thr-run${i}-quality.json`), 'utf8'));
        assert.equal(q.status, 'failed');
        assert.match(q.failure, /exception/);
        assert.equal(q.quality.pass, false);
      }
      const calls = readFileSync(ctx.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.equal(calls.length, 2);
      for (const c of calls) assert.ok(!existsSync(c.cwd), 'temp repo must be removed');
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('removes the temp dir when the safe-cwd check fails, before git init', () => {
    const ctx = setup();
    const inside = mkdtempSync(path.join(REPO_ROOT, 'cost-tmp-'));
    try {
      const r = run(ctx, ['sc', '1', '--out', ctx.out], { TMPDIR: inside });
      assert.match(r.stderr, /refusing/);
      assert.deepEqual(readdirSync(inside), []);
      const q = JSON.parse(readFileSync(path.join(ctx.out, 'sc-run1-quality.json'), 'utf8'));
      assert.equal(q.status, 'failed');
    } finally {
      rmSync(inside, { recursive: true, force: true });
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('drops CLAUDECODE and model overrides by default, keeps them with --keep-env-overrides', () => {
    const ctx = setup();
    const env = { CLAUDECODE: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku', ANTHROPIC_MODEL: 'opus', KEEP_ME: 'yes' };
    try {
      assert.equal(run(ctx, ['e1', '1', '--out', ctx.out], env).status, 0);
      assert.equal(run(ctx, ['e2', '1', '--out', ctx.out, '--keep-env-overrides'], env).status, 0);
      const calls = readFileSync(ctx.log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      assert.deepEqual(calls[0].env, { CLAUDECODE: null, CLAUDE_CODE_SUBAGENT_MODEL: null, ANTHROPIC_MODEL: null, KEEP_ME: 'yes' });
      assert.equal(calls[2].env.CLAUDE_CODE_SUBAGENT_MODEL, 'haiku');
      assert.equal(calls[2].env.ANTHROPIC_MODEL, 'opus');
      assert.equal(calls[2].env.CLAUDECODE, null, 'CLAUDECODE is always dropped');
      assert.equal(JSON.parse(readFileSync(path.join(ctx.out, 'e2-manifest.json'), 'utf8')).keep_env_overrides, true);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });

  it('exits 2 on bad arguments', () => {
    const ctx = setup();
    try {
      assert.equal(run(ctx, ['x']).status, 2);
    } finally {
      rmSync(ctx.root, { recursive: true, force: true });
    }
  });
});
