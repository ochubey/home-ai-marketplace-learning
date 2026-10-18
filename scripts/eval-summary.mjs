#!/usr/bin/env node
// Renders a Job Summary (Markdown) from the results.json that `claude plugin eval --json` writes.
// Dependency-free. Usage: node scripts/eval-summary.mjs [results.json] >> "$GITHUB_STEP_SUMMARY"
// Env: THRESHOLD (pass mark for a case score, default 0.8), EXIT_CODE (exit code of the eval step).
// This script reports only. It always exits 0, so it can never hide the exit code of the eval step.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const EXIT_MEANING = {
  0: 'the suite passed: every case scored at or above the threshold',
  1: 'a case scored below the threshold, a case file failed to load, no cases were found, a run could not start or ended on an API error, or an option was invalid',
  2: 'partial run: the cost ceiling was hit or the credential was rejected; results.json is marked partial',
  130: 'interrupted; partial results were written',
  143: 'terminated, for example by the job timeout',
};

const MAX_ERROR_CHARS = 120;

const cell = (text) => String(text).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fixed = (v, digits) => (num(v) === null ? 'n/a' : v.toFixed(digits));
const pick = (...values) => values.map(num).find((v) => v !== null) ?? null;
const sum = (values) => {
  const nums = values.map(num).filter((v) => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
};

function withRuns(c) {
  const runs = c?.arms?.with;
  return Array.isArray(runs) ? runs : [];
}

function caseRow(c, threshold) {
  const runs = withRuns(c);
  const score = pick(c?.aggregates?.score, c?.score);
  const cost = pick(c?.aggregates?.costUsd, c?.costUsd) ?? sum(runs.map((r) => r?.costUsd));
  const turns = sum(runs.map((r) => pick(r?.numTurns, r?.turns)));
  const errors = runs.map((r) => r?.error).filter((e) => typeof e === 'string' && e !== '');
  const passed = score !== null && score >= threshold;
  return {
    name: String(c?.name ?? 'unnamed'),
    score,
    passed,
    cost,
    turns,
    errors: errors.map((e) => (e.length > MAX_ERROR_CHARS ? `${e.slice(0, MAX_ERROR_CHARS)}...` : e)),
  };
}

export function renderSummary(result, { threshold = 0.8, exitCode } = {}) {
  const out = [];
  const rows = (Array.isArray(result?.cases) ? result.cases : []).map((c) => caseRow(c, threshold));
  out.push('## Plugin evals', '');
  if (result?.partial) {
    out.push(`> **Partial run** (reason: ${cell(result.partialReason ?? 'unknown')}). Leave this run out of trend comparisons.`, '');
  }
  out.push('| Case | Score | Result | Cost (USD) | Turns | Errors |', '| --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    const errors = r.errors.length ? `${r.errors.length} error(s)` : 'none';
    out.push(`| ${cell(r.name)} | ${fixed(r.score, 2)} | ${r.passed ? 'pass' : 'fail'} | ${fixed(r.cost, 2)} | ${r.turns === null ? 'n/a' : r.turns} | ${errors} |`);
  }
  if (!rows.length) out.push('| (no cases in the result) |  |  |  |  |  |');
  out.push('');
  const total = pick(result?.aggregates?.casesTotal) ?? rows.length;
  const passed = pick(result?.aggregates?.casesPassed) ?? rows.filter((r) => r.passed).length;
  const totals = [`**${passed} of ${total} cases** at or above the threshold ${threshold}`];
  const overall = pick(result?.aggregates?.overallScore);
  if (overall !== null) totals.push(`mean score ${overall.toFixed(2)}`);
  const cost = pick(result?.costUsd);
  if (cost !== null) totals.push(`estimated cost $${cost.toFixed(2)}`);
  const secs = pick(result?.durationSeconds);
  if (secs !== null) totals.push(`${Math.round(secs)} s`);
  if (result?.claudeVersion) totals.push(`Claude Code ${cell(result.claudeVersion)}`);
  out.push(`${totals.join(' | ')}`, '');
  const withErrors = rows.filter((r) => r.errors.length);
  if (withErrors.length) {
    out.push('### Run errors', '');
    for (const r of withErrors) for (const e of r.errors) out.push(`- ${cell(r.name)}: ${cell(e)}`);
    out.push('');
  }
  if (exitCode !== undefined && exitCode !== '') {
    const meaning = EXIT_MEANING[exitCode] ?? 'unknown exit code; read the step log';
    out.push(`Exit code ${exitCode}: ${meaning}.`, '');
  }
  return out.join('\n');
}

function main() {
  const file = process.argv[2] ?? 'results.json';
  const thresholdRaw = Number(process.env.THRESHOLD ?? '0.8');
  const threshold = Number.isFinite(thresholdRaw) ? thresholdRaw : 0.8;
  const exitCode = process.env.EXIT_CODE ?? '';
  let result;
  try {
    result = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    const missing = e?.code === 'ENOENT';
    const lines = ['## Plugin evals', '', missing ? `No results.json was written (${file}).` : `${file} could not be read: ${cell(e.message)}`, ''];
    if (exitCode !== '') lines.push(`Exit code ${exitCode}: ${EXIT_MEANING[exitCode] ?? 'unknown exit code; read the step log'}.`, '');
    process.stdout.write(lines.join('\n'));
    return;
  }
  process.stdout.write(renderSummary(result, { threshold, exitCode }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
