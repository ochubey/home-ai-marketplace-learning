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

/**
 * Load every run of a label. With a <label>-manifest.json the runs are 1..manifest.runs (a run with
 * no files is then partial); without one, run1, run2, ... until the first run with no files.
 * A run is usable only with status 'ok' and both steps present; others are failed or partial.
 */
export function loadLabel(dir, label) {
  const manifest = readJson(path.join(dir, `${label}-manifest.json`));
  const requested = Number.isInteger(manifest?.runs) && manifest.runs > 0 ? manifest.runs : null;
  const runs = [];
  for (let i = 1; requested ? i <= requested : true; i++) {
    const base = path.join(dir, `${label}-run${i}`);
    const present = ['spec', 'plan', 'quality'].some((s) => existsSync(`${base}-${s}.json`));
    if (!present && !requested) break;
    const spec = readJson(`${base}-spec.json`);
    const plan = readJson(`${base}-plan.json`);
    const quality = readJson(`${base}-quality.json`);
    const s = spec ? extractMetrics(spec) : null;
    const p = plan ? extractMetrics(plan) : null;
    const combined = s && p ? combine(s, p) : null;
    const status = quality?.status === 'failed' ? 'failed' : quality?.status === 'ok' && combined ? 'ok' : 'partial';
    runs.push({
      run: i,
      status,
      passed: status === 'ok' && Boolean(quality.quality?.pass),
      spec: s,
      plan: p,
      combined,
    });
  }
  return { runs, requested };
}

export function summarizeLabel(dir, label) {
  const { runs: all, requested } = loadLabel(dir, label);
  const runs = all.filter((r) => r.status === 'ok');
  const result = {
    label,
    requested: requested ?? all.length,
    runs: runs.length,
    failed: all.filter((r) => r.status === 'failed').length,
    partial: all.filter((r) => r.status === 'partial').length,
    passed: runs.filter((r) => r.passed).length,
    steps: {},
    byModel: {},
  };
  for (const step of ['spec', 'plan', 'combined']) {
    result.steps[step] = Object.fromEntries(METRICS.map((k) => [k, stats(runs.map((r) => r[step][k]))]));
  }
  const models = new Set(runs.flatMap((r) => Object.keys(r.combined.byModel)));
  for (const model of models) {
    result.byModel[model] = stats(runs.map((r) => r.combined.byModel[model] ?? 0));
  }
  return result;
}

const fmt = (k, v) => (v === undefined || v === null || Number.isNaN(v) ? 'n/a' : k === 'total_cost_usd' ? v.toFixed(4) : Number.isInteger(v) ? String(v) : v.toFixed(1));
const row = (cells) => `| ${cells.join(' | ')} |`;

export function renderLabel(s) {
  const lines = [`## ${s.label}`, '', `Runs: n=${s.runs} usable of ${s.requested}, passed quality: ${s.passed}, failed: ${s.failed}, partial: ${s.partial}`, ''];
  for (const step of ['spec', 'plan', 'combined']) {
    lines.push(`### ${s.label} - ${step} (n=${s.runs})`, '', row(['metric', 'min', 'median', 'max']), row(['---', '---', '---', '---']));
    for (const k of METRICS) {
      const st = s.steps[step][k];
      lines.push(row([k, fmt(k, st?.min), fmt(k, st?.median), fmt(k, st?.max)]));
    }
    lines.push('');
  }
  lines.push(`### ${s.label} - cost by model (USD, spec + plan) (n=${s.runs})`, '', row(['model', 'min', 'median', 'max']), row(['---', '---', '---', '---']));
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
  const lines = [`## ${sa.label} -> ${sb.label} (combined, median)`, '', row(['metric', `${sa.label} (n=${sa.runs})`, `${sb.label} (n=${sb.runs})`, 'change', 'verdict']), row(['---', '---', '---', '---', '---'])];
  for (const [k, c] of Object.entries(compareLabels(sa, sb))) {
    const pct = Number.isFinite(c.change) ? `${c.change >= 0 ? '+' : ''}${(c.change * 100).toFixed(1)}%` : 'n/a';
    lines.push(row([k, fmt(k, c.a), fmt(k, c.b), pct, c.withinNoise ? 'within noise' : 'outside noise']));
  }
  return lines.join('\n') + '\n';
}

export const MIN_RUNS = 3;

/** Messages for a summarized label: an error when no run is usable, a warning when n is small. */
export function sampleProblems(s) {
  if (s.runs === 0) {
    return { error: `${s.label} has no usable runs (${s.failed} failed, ${s.partial} partial of ${s.requested})` };
  }
  if (s.runs < MIN_RUNS) {
    return { warning: `warning: ${s.label} has only ${s.runs} usable run(s); fewer than ${MIN_RUNS} is not enough to judge noise` };
  }
  return {};
}

function main(argv) {
  const compare = argv[0] === 'compare';
  const [dir, ...labels] = compare ? argv.slice(1) : argv;
  if (!dir || !labels.length || (compare && labels.length !== 2)) return usage();
  const sums = labels.map((l) => summarizeLabel(dir, l));
  let status = 0;
  for (const s of sums) {
    const { error, warning } = sampleProblems(s);
    if (warning) console.error(warning);
    if (error) {
      console.error(error);
      status = 1;
    }
  }
  if (status) return status;
  if (compare) process.stdout.write(renderCompare(sums[0], sums[1]));
  else for (const s of sums) process.stdout.write(renderLabel(s) + '\n');
  return 0;
}

function usage() {
  console.error('usage: summarize.mjs <out-dir> <label>...\n       summarize.mjs compare <out-dir> <labelA> <labelB>');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
