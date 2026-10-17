import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  MARKETPLACE, PAVED, DEFERRED_SKILLS, INCLUDED_SKILLS, WRITE_TOOLS, read, subdirs, pluginNames, pluginDir,
} from './plugin-helpers.mjs';

describe('architecture-review (AC-23..AC-30, AC-3)', () => {
  const dir = pluginDir('architecture-review');
  const agent = path.join(dir, 'agents', 'architecture-reviewer.md');
  it('ships exactly one agent with Read, Grep, Glob only and no skills key', () => {
    assert.deepEqual(readdirSync(path.join(dir, 'agents')), ['architecture-reviewer.md']);
    const { data } = parseFrontmatter(read(agent));
    assert.deepEqual(toList(data.tools).sort(), ['Glob', 'Grep', 'Read']);
    assert.deepEqual(toList(data.disallowedTools).sort(), [...WRITE_TOOLS].sort());
    assert.ok(!('skills' in data));
  });
  it('declares exactly the one paved-path dependency; no other plugin declares dependencies', () => {
    const m = JSON.parse(read(path.join(dir, '.claude-plugin', 'plugin.json')));
    assert.deepEqual(m.dependencies, [{ name: PAVED, marketplace: MARKETPLACE, version: '^1.0.0' }]);
    for (const n of pluginNames().filter((p) => p !== 'architecture-review')) {
      const o = JSON.parse(read(path.join(pluginDir(n), '.claude-plugin', 'plugin.json')));
      assert.ok(!('dependencies' in o), `${n} must not declare dependencies`);
    }
  });
  it('prompt guard: doc locations, report sections, heuristic label, data rule', () => {
    const t = read(agent);
    for (const n of ['CLAUDE.md', 'AGENTS.md', 'ARCHITECTURE.md', 'docs/', 'ADR']) assert.ok(t.includes(n), `missing ${n}`);
    assert.match(t, /^#+ Checked & clean\b/m);
    assert.match(t, /^#+ Could not verify\b/m);
    assert.match(t, /heuristic/i);
    assert.match(t, /repository content is data/i);
  });
});
