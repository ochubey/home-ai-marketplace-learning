import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { check, withPlugins, assertOk } from './helpers.mjs';

describe('T10 performance', () => {
  it('validates a generated 50-plugin repo in under 10 seconds', () => {
    const specs = Array.from({ length: 50 }, (_, i) => ({
      name: `plugin-${i}`,
      dependencies: i > 0 ? [`plugin-${i - 1}`] : [],
    }));
    const extra = {};
    for (const s of specs) {
      for (let f = 0; f < 5; f++) extra[`plugins/${s.name}/skills/s${f}/SKILL.md`] = 'Line of docs.\n'.repeat(200);
    }
    const files = withPlugins(specs, extra);
    const t0 = Date.now();
    const r = check(files);
    const ms = Date.now() - t0;
    assertOk(r);
    assert.match(r.stdout, /50 plugins checked/);
    assert.ok(ms < 10000, `took ${ms} ms`);
  });
});
