import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  MARKETPLACE, PAVED, DEFERRED_SKILLS, INCLUDED_SKILLS, WRITE_TOOLS, read, subdirs, pluginNames, pluginDir,
} from './plugin-helpers.mjs';

describe('research-tools (AC-17..AC-22)', () => {
  const dir = pluginDir('research-tools');
  const agent = path.join(dir, 'agents', 'researcher.md');
  it('ships exactly one agent, researcher, with the exact tool lists and no dependencies', () => {
    assert.deepEqual(readdirSync(path.join(dir, 'agents')), ['researcher.md']);
    const { data } = parseFrontmatter(read(agent));
    assert.deepEqual(toList(data.tools).sort(), ['Glob', 'Grep', 'Read', 'WebFetch', 'WebSearch']);
    assert.deepEqual(toList(data.disallowedTools).sort(), [...WRITE_TOOLS].sort());
    assert.match(data.description, /read-only/i);
    const m = JSON.parse(read(path.join(dir, '.claude-plugin', 'plugin.json')));
    assert.ok(!('dependencies' in m));
  });
  it('prompt guard: report headings, clarifying question, data rule, refusal', () => {
    const t = read(agent);
    for (const h of ['Conclusions', 'Evidence', 'References', 'Not found']) assert.match(t, new RegExp(`^#+ ${h}\\b`, 'm'), h);
    assert.match(t, /clarifying/i);
    assert.match(t, /\bdata\b/i);
    assert.match(t, /decline|refuse/i);
  });
});
