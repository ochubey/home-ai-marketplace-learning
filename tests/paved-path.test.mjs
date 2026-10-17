import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  MARKETPLACE, PAVED, DEFERRED_SKILLS, INCLUDED_SKILLS, WRITE_TOOLS, read, subdirs, pluginNames, pluginDir,
} from './plugin-helpers.mjs';

describe('engineering-paved-path (AC-9, AC-10, AC-13, AC-16)', () => {
  const skills = path.join(pluginDir(PAVED), 'skills');
  it('ships exactly the four license-confirmed skills, each with a LICENSE', () => {
    assert.deepEqual(subdirs(skills), [...INCLUDED_SKILLS].sort());
    for (const s of INCLUDED_SKILLS) {
      assert.ok(existsSync(path.join(skills, s, 'SKILL.md')), `${s}/SKILL.md`);
      assert.match(read(path.join(skills, s, 'LICENSE')), /^MIT License/);
    }
  });
  it('none of the six deferred skills exists', () => {
    for (const s of DEFERRED_SKILLS) assert.ok(!existsSync(path.join(skills, s)), `${s} must not ship`);
  });
  it('declares no dependencies and has no agents', () => {
    const m = JSON.parse(read(path.join(pluginDir(PAVED), '.claude-plugin', 'plugin.json')));
    assert.ok(!('dependencies' in m));
    assert.ok(!existsSync(path.join(pluginDir(PAVED), 'agents')));
  });
  it('README documents provenance for every skill and the deferred list', () => {
    const t = read(path.join(pluginDir(PAVED), 'README.md'));
    for (const s of INCLUDED_SKILLS) assert.ok(t.includes(`${PAVED}:${s}`), `${s} not listed by namespaced name`);
    for (const s of DEFERRED_SKILLS) assert.ok(t.includes(s), `deferred ${s} not listed`);
    assert.match(t, /\bMIT\b/);
  });
  it('drizzle-orm-patterns lost its allowed-tools line', () => {
    const { data } = parseFrontmatter(read(path.join(skills, 'drizzle-orm-patterns', 'SKILL.md')));
    assert.ok(!('allowed-tools' in data));
  });
});
