import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
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
