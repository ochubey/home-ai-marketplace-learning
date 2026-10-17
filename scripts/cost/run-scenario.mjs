#!/usr/bin/env node
// Runs the spec -> plan scenario N times against a fresh fixture repo and saves the raw JSON.
// The claude binary defaults to `claude`; CLAUDE_BIN overrides it (used by the tests).
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkQuality, listSpecFiles } from './check-quality.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const FIXTURE = path.join(HERE, 'fixture');
const REQUEST = path.join(HERE, 'request.txt');
const STEP_TIMEOUT_MS = 15 * 60 * 1000;
const PLUGINS = ['sdd-engineering', 'engineering-paved-path', 'research-tools', 'architecture-review'];

const USAGE = 'usage: run-scenario.mjs <label> <runs> --out <dir> [--plugins <dir>] [--model sonnet] [--budget 2]';

export function parseArgs(argv) {
  const opts = { model: 'sonnet', budget: 2, plugins: path.join(REPO_ROOT, 'plugins') };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (!['out', 'plugins', 'model', 'budget'].includes(key)) throw new Error(`unknown option ${a}\n${USAGE}`);
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`option ${a} needs a value\n${USAGE}`);
      opts[key] = v;
    } else positional.push(a);
  }
  if (positional.length !== 2) throw new Error(`expected <label> <runs>\n${USAGE}`);
  const [label, runsRaw] = positional;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(label)) throw new Error(`invalid label "${label}"`);
  if (!/^\d+$/.test(runsRaw) || Number(runsRaw) < 1) throw new Error(`runs must be a positive integer, got "${runsRaw}"`);
  if (!opts.out) throw new Error(`--out is required\n${USAGE}`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(opts.model)) throw new Error(`invalid model "${opts.model}"`);
  const budget = Number(opts.budget);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error(`budget must be a positive number, got "${opts.budget}"`);
  return {
    label,
    runs: Number(runsRaw),
    out: path.resolve(opts.out),
    plugins: path.resolve(opts.plugins),
    model: opts.model,
    budget,
  };
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** The claude calls must never run with the marketplace repo as cwd. */
export function assertSafeCwd(dir, repoRoot = REPO_ROOT) {
  const real = realpathSync(dir);
  if (isInside(real, realpathSync(repoRoot))) {
    throw new Error('refusing to run claude inside the marketplace repo; the cwd must be a temp fixture repo');
  }
}

export function buildClaudeArgs({ model, plugins, budget, prompt }) {
  return [
    '-p', '--model', model, '--output-format', 'json', '--no-session-persistence',
    '--setting-sources', 'project',
    ...PLUGINS.flatMap((p) => ['--plugin-dir', path.join(plugins, p)]),
    '--permission-mode', 'acceptEdits',
    '--max-budget-usd', String(budget),
    prompt,
  ];
}

export const specPrompt = (request) =>
  `Use the sdd-engineering:spec-creator agent to write a spec in specs/ for this feature request: ${request}`;
export const planPrompt = (file) =>
  `Use the sdd-engineering:implementation-planner agent to plan the spec in specs/${file}. Run it as a single-agent pass. Reply with the plan text exactly as the agent returned it, without summarizing or shortening it.`;

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'user.name=cost', '-c', 'user.email=cost@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
    cwd, encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
}

function freshRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'cost-fixture-'));
  cpSync(FIXTURE, dir, { recursive: true });
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'fixture']);
  return dir;
}

/** Run one claude step. Returns { ok, failure, raw, stderr }; the raw output is always kept. */
function claudeStep(cwd, args) {
  assertSafeCwd(cwd);
  const bin = process.env.CLAUDE_BIN || 'claude';
  const r = spawnSync(bin, args, {
    cwd, input: '', encoding: 'utf8', timeout: STEP_TIMEOUT_MS, maxBuffer: 256 * 1024 * 1024,
  });
  const raw = r.stdout ?? '';
  const stderr = (r.stderr ?? '') + (r.error ? `\n${r.error.message}` : '');
  let failure = null;
  let json = null;
  try { json = JSON.parse(raw); } catch { /* handled below */ }
  if (r.error) failure = `spawn error: ${r.error.message}`;
  else if (r.status !== 0) failure = `exit code ${r.status}`;
  else if (!json) failure = 'output is not JSON';
  else if (json.is_error) failure = `is_error (${json.subtype ?? 'unknown'})`;
  else if (json.subtype && json.subtype !== 'success') failure = `subtype ${json.subtype} (for example budget exceeded)`;
  return { ok: !failure, failure, raw, stderr };
}

/** Harness step simulating human approval of the spec. */
export function approveSpec(file) {
  const text = readFileSync(file, 'utf8');
  if (!/^Status:/m.test(text)) return false;
  writeFileSync(file, text.replace(/^Status:.*$/m, 'Status: approved'));
  return true;
}

export function runScenario({ label, runs, out, plugins, model, budget }, log = console.error) {
  mkdirSync(out, { recursive: true });
  const request = readFileSync(REQUEST, 'utf8').trim();
  const records = [];
  for (let i = 1; i <= runs; i++) {
    const base = path.join(out, `${label}-run${i}`);
    const started = Date.now();
    const repo = freshRepo();
    let failure = null;
    const save = (suffix, step) => {
      writeFileSync(`${base}-${suffix}.json`, step.raw);
      if (step.stderr.trim()) writeFileSync(`${base}-${suffix}.stderr.txt`, step.stderr);
    };

    const spec = claudeStep(repo, buildClaudeArgs({ model, plugins, budget, prompt: specPrompt(request) }));
    save('spec', spec);
    if (!spec.ok) failure = `spec step: ${spec.failure}`;

    let planSaved = false;
    if (!failure) {
      const files = listSpecFiles(repo);
      if (files.length !== 1) failure = `spec step wrote ${files.length} files under specs/`;
      else {
        if (!approveSpec(path.join(repo, 'specs', files[0]))) failure = 'spec has no Status: line to approve';
        else {
          const plan = claudeStep(repo, buildClaudeArgs({ model, plugins, budget, prompt: planPrompt(files[0]) }));
          save('plan', plan);
          planSaved = true;
          if (!plan.ok) failure = `plan step: ${plan.failure}`;
        }
      }
    }

    const wallMs = Date.now() - started;
    const quality = checkQuality({
      repoDir: repo,
      specJsonPath: `${base}-spec.json`,
      planJsonPath: planSaved ? `${base}-plan.json` : null,
    });
    const record = { run: i, label, status: failure ? 'failed' : 'ok', failure, wall_ms: wallMs, quality };
    writeFileSync(`${base}-quality.json`, JSON.stringify(record, null, 2) + '\n');
    records.push(record);
    rmSync(repo, { recursive: true, force: true });
    log(`${label} run ${i}/${runs}: ${record.status}${failure ? ` (${failure})` : ''}, quality ${quality.pass ? 'pass' : 'fail'}, ${wallMs} ms`);
  }
  return records;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const records = runScenario(opts);
    process.exitCode = records.every((r) => r.status === 'ok') ? 0 : 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 2;
  }
}
