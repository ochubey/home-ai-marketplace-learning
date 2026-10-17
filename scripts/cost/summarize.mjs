#!/usr/bin/env node
// Summarizes saved scenario JSONs as Markdown tables.
//   summarize.mjs <out-dir> <label>...
//   summarize.mjs compare <out-dir> <labelA> <labelB>
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOKEN_KEYS = {
  input: 'inputTokens',
  output: 'outputTokens',
  cacheRead: 'cacheReadInputTokens',
  cacheCreation: 'cacheCreationInputTokens',
};
export const METRICS = ['total_cost_usd', 'num_turns', 'duration_ms', 'input', 'output', 'cacheRead', 'cacheCreation'];

export function median(values) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stats(values) {
  return values.length ? { min: Math.min(...values), median: median(values), max: Math.max(...values) } : null;
}

/** Metrics of one claude JSON: cost, turns, duration, tokens summed over models, cost per model. */
export function extractMetrics(json) {
  const m = { total_cost_usd: json.total_cost_usd ?? 0, num_turns: json.num_turns ?? 0, duration_ms: json.duration_ms ?? 0 };
  for (const k of Object.keys(TOKEN_KEYS)) m[k] = 0;
  const byModel = {};
  for (const [model, u] of Object.entries(json.modelUsage ?? {})) {
    for (const [k, src] of Object.entries(TOKEN_KEYS)) m[k] += u[src] ?? 0;
    byModel[model] = (byModel[model] ?? 0) + (u.costUSD ?? 0);
  }
  return { ...m, byModel };
}

export function combine(a, b) {
  const out = { byModel: { ...a.byModel } };
  for (const k of METRICS) out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  for (const [model, c] of Object.entries(b.byModel)) out.byModel[model] = (out.byModel[model] ?? 0) + c;
  return out;
}

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/** Load every run of a label (run1, run2, ... until the first run with no files). */
export function loadLabel(dir, label) {
  const runs = [];
  for (let i = 1; ; i++) {
    const base = path.join(dir, `${label}-run${i}`);
    if (!['spec', 'plan', 'quality'].some((s) => existsSync(`${base}-${s}.json`))) break;
    const spec = readJson(`${base}-spec.json`);
    const plan = readJson(`${base}-plan.json`);
    const quality = readJson(`${base}-quality.json`);
    const s = spec ? extractMetrics(spec) : null;
    const p = plan ? extractMetrics(plan) : null;
    runs.push({
      run: i,
      passed: Boolean(quality && quality.status === 'ok' && quality.quality?.pass),
      spec: s,
      plan: p,
      combined: s && p ? combine(s, p) : s ?? p,
    });
  }
  return runs;
}

export function summarizeLabel(dir, label) {
  const runs = loadLabel(dir, label);
  const result = { label, runs: runs.length, passed: runs.filter((r) => r.passed).length, steps: {}, byModel: {} };
  for (const step of ['spec', 'plan', 'combined']) {
    const withStep = runs.filter((r) => r[step]);
    result.steps[step] = Object.fromEntries(METRICS.map((k) => [k, stats(withStep.map((r) => r[step][k]))]));
  }
  const models = new Set(runs.flatMap((r) => (r.combined ? Object.keys(r.combined.byModel) : [])));
  for (const model of models) {
    result.byModel[model] = stats(runs.filter((r) => r.combined).map((r) => r.combined.byModel[model] ?? 0));
  }
  return result;
}

const fmt = (k, v) => (v === undefined || v === null || Number.isNaN(v) ? 'n/a' : k === 'total_cost_usd' ? v.toFixed(4) : Number.isInteger(v) ? String(v) : v.toFixed(1));
const row = (cells) => `| ${cells.join(' | ')} |`;

export function renderLabel(s) {
  const lines = [`## ${s.label}`, '', `Runs: ${s.runs}, passed quality: ${s.passed}`, ''];
  for (const step of ['spec', 'plan', 'combined']) {
    lines.push(`### ${s.label} - ${step}`, '', row(['metric', 'min', 'median', 'max']), row(['---', '---', '---', '---']));
    for (const k of METRICS) {
      const st = s.steps[step][k];
      lines.push(row([k, fmt(k, st?.min), fmt(k, st?.median), fmt(k, st?.max)]));
    }
    lines.push('');
  }
  lines.push(`### ${s.label} - cost by model (USD, spec + plan)`, '', row(['model', 'min', 'median', 'max']), row(['---', '---', '---', '---']));
  for (const [model, st] of Object.entries(s.byModel)) {
    lines.push(row([model, fmt('total_cost_usd', st.min), fmt('total_cost_usd', st.median), fmt('total_cost_usd', st.max)]));
  }
  return lines.join('\n') + '\n';
}

export const COMPARE_METRICS = ['total_cost_usd', 'num_turns', 'duration_ms'];

/** Relative change of the median (combined steps) from a to b; 'within noise' when the ranges overlap. */
export function compareStats(a, b) {
  const rel = a.median === 0 ? (b.median === 0 ? 0 : Infinity) : (b.median - a.median) / a.median;
  const overlap = a.min <= b.max && b.min <= a.max;
  return { change: rel, withinNoise: overlap };
}

export function compareLabels(sa, sb) {
  const out = {};
  const metrics = [...COMPARE_METRICS, 'input', 'output', 'cacheRead', 'cacheCreation'];
  for (const k of metrics) {
    const a = sa.steps.combined[k];
    const b = sb.steps.combined[k];
    if (a && b) out[k] = { a: a.median, b: b.median, ...compareStats(a, b) };
  }
  return out;
}

export function renderCompare(sa, sb) {
  const lines = [`## ${sa.label} -> ${sb.label} (combined, median)`, '', row(['metric', sa.label, sb.label, 'change', 'verdict']), row(['---', '---', '---', '---', '---'])];
  for (const [k, c] of Object.entries(compareLabels(sa, sb))) {
    const pct = Number.isFinite(c.change) ? `${c.change >= 0 ? '+' : ''}${(c.change * 100).toFixed(1)}%` : 'n/a';
    lines.push(row([k, fmt(k, c.a), fmt(k, c.b), pct, c.withinNoise ? 'within noise' : 'outside noise']));
  }
  return lines.join('\n') + '\n';
}

function main(argv) {
  if (argv[0] === 'compare') {
    const [, dir, a, b] = argv;
    if (!dir || !a || !b) return usage();
    process.stdout.write(renderCompare(summarizeLabel(dir, a), summarizeLabel(dir, b)));
    return 0;
  }
  const [dir, ...labels] = argv;
  if (!dir || !labels.length) return usage();
  for (const label of labels) process.stdout.write(renderLabel(summarizeLabel(dir, label)) + '\n');
  return 0;
}

function usage() {
  console.error('usage: summarize.mjs <out-dir> <label>...\n       summarize.mjs compare <out-dir> <labelA> <labelB>');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
