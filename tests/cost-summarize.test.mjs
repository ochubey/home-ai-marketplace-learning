import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { median, extractMetrics, compareStats, summarizeLabel, renderLabel, renderCompare } from '../scripts/cost/summarize.mjs';
import { claudeJson } from './cost-fixtures.mjs';

const SCRIPT = path.resolve(import.meta.dirname, '..', 'scripts', 'cost', 'summarize.mjs');

describe('cost: summarize math', () => {
  it('median of odd, even and single counts', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([7]), 7);
    assert.ok(Number.isNaN(median([])));
  });
  it('sums tokens over models and splits cost by model', () => {
    const m = extractMetrics(claudeJson({
      cost: 1, turns: 3, duration: 500,
      models: {
        a: { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4, costUSD: 0.25 },
        b: { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 30, cacheCreationInputTokens: 40, costUSD: 0.75 },
      },
    }));
    assert.deepEqual([m.input, m.output, m.cacheRead, m.cacheCreation], [11, 22, 33, 44]);
    assert.deepEqual(m.byModel, { a: 0.25, b: 0.75 });
    assert.equal(m.num_turns, 3);
  });
  it('flags overlapping ranges as within noise', () => {
    assert.equal(compareStats({ min: 1, median: 2, max: 3 }, { min: 3, median: 4, max: 5 }).withinNoise, true);
    const far = compareStats({ min: 1, median: 2, max: 3 }, { min: 4, median: 5, max: 6 });
    assert.equal(far.withinNoise, false);
    assert.equal(far.change, 1.5);
  });
  it('handles a zero baseline', () => {
    assert.equal(compareStats({ min: 0, median: 0, max: 0 }, { min: 0, median: 0, max: 0 }).change, 0);
    assert.equal(compareStats({ min: 0, median: 0, max: 0 }, { min: 1, median: 1, max: 1 }).change, Infinity);
  });
});

describe('cost: summarize from saved files', () => {
  function write(dir, label, costs) {
    costs.forEach((c, idx) => {
      const i = idx + 1;
      writeFileSync(path.join(dir, `${label}-run${i}-spec.json`), JSON.stringify(claudeJson({ cost: c, turns: 1, duration: 100 * i })));
      writeFileSync(path.join(dir, `${label}-run${i}-plan.json`), JSON.stringify(claudeJson({ cost: c, turns: 2, duration: 100 })));
      writeFileSync(path.join(dir, `${label}-run${i}-quality.json`), JSON.stringify({ status: 'ok', quality: { pass: i !== 2 } }));
    });
  }
  it('aggregates runs, quality and compare', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cost-sum-'));
    try {
      write(dir, 'base', [1, 2, 3, 4]);
      write(dir, 'fast', [10, 11]);
      const s = summarizeLabel(dir, 'base');
      assert.equal(s.runs, 4);
      assert.equal(s.passed, 3);
      assert.deepEqual(s.steps.combined.total_cost_usd, { min: 2, median: 5, max: 8 });
      assert.deepEqual(s.steps.combined.num_turns, { min: 3, median: 3, max: 3 });
      assert.equal(s.steps.combined.input.median, 20);
      assert.ok(renderLabel(s).includes('| total_cost_usd | 2.0000 | 5.0000 | 8.0000 |'));
      const cmp = renderCompare(s, summarizeLabel(dir, 'fast'));
      assert.match(cmp, /total_cost_usd .*\+320.0% \| outside noise/);
      assert.match(cmp, /num_turns .*\| within noise/);
      const cli = spawnSync(process.execPath, [SCRIPT, 'compare', dir, 'base', 'fast'], { encoding: 'utf8' });
      assert.equal(cli.status, 0);
      assert.equal(cli.stdout, cmp);
      assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('cost: summarize excludes failed and partial runs', () => {
  const put = (dir, name, obj) => writeFileSync(path.join(dir, name), JSON.stringify(obj));
  function full(dir, label, i, cost, status = 'ok') {
    put(dir, `${label}-run${i}-spec.json`, claudeJson({ cost }));
    put(dir, `${label}-run${i}-plan.json`, claudeJson({ cost }));
    put(dir, `${label}-run${i}-quality.json`, { status, quality: { pass: true } });
  }
  function mixed() {
    const dir = mkdtempSync(path.join(tmpdir(), 'cost-mix-'));
    full(dir, 'm', 1, 1);
    full(dir, 'm', 2, 100, 'failed');
    full(dir, 'm', 3, 3);
    put(dir, 'm-run4-spec.json', claudeJson({ cost: 50 }));
    put(dir, 'm-run4-quality.json', { status: 'ok', quality: { pass: true } });
    return dir;
  }
  it('counts only ok runs with both steps and reports the rest per label', () => {
    const dir = mixed();
    try {
      const s = summarizeLabel(dir, 'm');
      assert.deepEqual([s.runs, s.failed, s.partial], [2, 1, 1]);
      assert.deepEqual(s.steps.combined.total_cost_usd, { min: 2, median: 4, max: 6 });
      assert.deepEqual(s.steps.spec.total_cost_usd, { min: 1, median: 2, max: 3 });
      const out = renderLabel(s);
      assert.match(out, /n=2/);
      assert.match(out, /failed: 1/);
      assert.match(out, /partial: 1/);
      assert.match(out, /### m - combined \(n=2\)/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('uses the manifest run count, so a run with no files counts as partial', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cost-man-'));
    try {
      full(dir, 'k', 1, 1);
      full(dir, 'k', 2, 1);
      put(dir, 'k-manifest.json', { label: 'k', runs: 4 });
      const s = summarizeLabel(dir, 'k');
      assert.deepEqual([s.requested, s.runs, s.partial], [4, 2, 2]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('compare shows n, warns below 3 and exits non-zero on zero usable runs', () => {
    const dir = mixed();
    try {
      full(dir, 'g', 1, 1);
      full(dir, 'g', 2, 1);
      full(dir, 'g', 3, 1);
      full(dir, 'dead', 1, 1, 'failed');
      const cmp = renderCompare(summarizeLabel(dir, 'm'), summarizeLabel(dir, 'g'));
      assert.match(cmp, /m \(n=2\)/);
      assert.match(cmp, /g \(n=3\)/);
      const ok = spawnSync(process.execPath, [SCRIPT, 'compare', dir, 'm', 'g'], { encoding: 'utf8' });
      assert.equal(ok.status, 0);
      assert.match(ok.stderr, /warning: m has only 2 usable run/);
      assert.doesNotMatch(ok.stderr, /warning: g/);
      const dead = spawnSync(process.execPath, [SCRIPT, 'compare', dir, 'g', 'dead'], { encoding: 'utf8' });
      assert.notEqual(dead.status, 0);
      assert.match(dead.stderr, /dead has no usable runs/);
      assert.equal(spawnSync(process.execPath, [SCRIPT, 'compare', dir, 'g', 'nothing'], { encoding: 'utf8' }).status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
