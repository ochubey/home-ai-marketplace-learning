import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './helpers.mjs';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  MARKETPLACE, PAVED, DEFERRED_SKILLS, INCLUDED_SKILLS, WRITE_TOOLS, read, subdirs, pluginNames, pluginDir,
} from './plugin-helpers.mjs';

describe('docs/temp and repository docs (AC-41, AC-42)', () => {
  it('docs/temp holds exactly README.md', () => {
    assert.deepEqual(readdirSync(path.join(REPO_ROOT, 'docs', 'temp')), ['README.md']);
  });
  for (const f of ['README.md', 'plugins/README.md']) {
    it(`${f} no longer says empty and names the four plugins`, () => {
      const t = read(path.join(REPO_ROOT, f));
      assert.doesNotMatch(t, /\bempty\b/i);
      for (const n of [PAVED, 'research-tools', 'architecture-review', 'sdd-engineering']) assert.ok(t.includes(n), `${f} lacks ${n}`);
    });
  }
});
