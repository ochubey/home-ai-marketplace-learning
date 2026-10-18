import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  PLUGINS_DIR, MARKETPLACE, PAVED, DEFERRED_SKILLS, INCLUDED_SKILLS, EXCLUDED_SKILLS, WRITE_TOOLS, DENY_LIST, rel, read, walk, subdirs,
  pluginNames, pluginDir, allPluginFiles, skillFolders, agentFiles,
  COURSE_REPO_URL, EXPECTED_VERSIONS, VERBATIM_DENY_EXCEPTIONS, VERBATIM_DANGLING_REFS,
  AGENT_POLICIES, EXCLUDED_SKILL_OWNERS, RUNTIME_REPO_REFS, ownerOf, skillOwner,
} from './plugin-helpers.mjs';

describe('plugin file invariants (AC-31, AC-35)', () => {
  it('no plugin file contains a source-project name (deny-list)', () => {
    const hits = [];
    for (const f of allPluginFiles()) {
      const lines = read(f).split(/\r?\n/);
      const docs = /^plugins\/engineering-paved-path\/(README|CHANGELOG)\.md$/.test(rel(f));
      lines.forEach((l, i) => {
        const line = docs ? l.split(COURSE_REPO_URL).join('') : l;
        if (VERBATIM_DENY_EXCEPTIONS.has(`${rel(f)}:${i + 1}`)) return;
        if (DENY_LIST.test(line)) hits.push(`${rel(f)}:${i + 1}: ${l.trim().slice(0, 100)}`);
      });
      if (DENY_LIST.test(rel(f))) hits.push(`${rel(f)}: path`);
    }
    assert.deepEqual(hits, []);
  });

  it('no hooks, MCP config, commands or executable script files', () => {
    const bad = [];
    for (const f of walk(PLUGINS_DIR)) {
      const r = rel(f);
      // The one exception: an eval case may ship `scaffold.sh`, which builds its fixture and runs only
      // when the operator passes --scaffold to `claude plugin eval` (checked in evals-workflow.test.mjs).
      if (/^plugins\/[^/]+\/evals\/[^/]+\/scaffold\.sh$/.test(r)) continue;
      if (/\/hooks\//.test(r) || /\/commands\//.test(r) || path.basename(r) === '.mcp.json' || /\.(sh|py|js|mjs|cjs|ts)$/.test(r)) bad.push(r);
    }
    assert.deepEqual(bad, []);
  });

  it('no excluded skill folder exists in any plugin', () => {
    const found = skillFolders().filter(
      (s) => EXCLUDED_SKILLS.includes(path.basename(s)) && EXCLUDED_SKILL_OWNERS[path.basename(s)] !== ownerOf(s),
    );
    assert.deepEqual(found.map(rel), []);
  });
});

describe('skill frontmatter (AC-11, AC-14)', () => {
  for (const dir of skillFolders()) {
    const name = path.basename(dir);
    it(`${rel(dir)}: SKILL.md frontmatter is valid, name matches folder, tools are read-only`, () => {
      const skill = path.join(dir, 'SKILL.md');
      assert.ok(existsSync(skill), 'SKILL.md missing');
      const { data } = parseFrontmatter(read(skill));
      assert.equal(data.name, name);
      assert.ok(typeof data.description === 'string' && data.description.length > 0, 'description missing');
      for (const t of toList(data['allowed-tools'])) {
        assert.ok(['Read', 'Grep', 'Glob'].includes(t), `allowed-tools has ${t}`);
      }
    });
  }
});

describe('skill reference resolution (AC-12)', () => {
  const MD_LINK = /\]\(([^)\s]+)\)/g;
  const MD_TOKEN = /`([^`\s]+\.md)`/g;
  for (const dir of skillFolders()) {
    it(`${rel(dir)}: relative links and backticked .md names resolve`, () => {
      const files = walk(dir);
      const mdFiles = files.filter((f) => f.endsWith('.md'));
      const baseCount = new Map();
      for (const f of files) baseCount.set(path.basename(f), (baseCount.get(path.basename(f)) ?? 0) + 1);
      const unresolved = [];
      for (const f of mdFiles) {
        const text = read(f);
        const refs = [];
        for (const m of text.matchAll(MD_LINK)) {
          const t = m[1].split('#')[0];
          if (t === '' || /^[a-z][a-z0-9+.-]*:/i.test(t)) continue;
          refs.push(t);
        }
        for (const m of text.matchAll(MD_TOKEN)) refs.push(m[1]);
        for (const ref of refs) {
          if (/[{}*]/.test(ref) || ref.includes('URL')) continue;
          const candidates = [path.resolve(path.dirname(f), ref), path.resolve(dir, ref)];
          const ok = candidates.some((c) => c.startsWith(dir) && existsSync(c) && statSync(c).isFile()) || baseCount.get(path.basename(ref)) === 1;
          if (!ok && !VERBATIM_DANGLING_REFS.has(`${rel(f)} -> ${ref}`) && !RUNTIME_REPO_REFS.has(`${rel(f)} -> ${ref}`)) unresolved.push(`${rel(f)} -> ${ref}`);
        }
      }
      assert.deepEqual(unresolved, []);
    });
  }
});

describe('agent frontmatter (AC-18, AC-23, AC-34, AC-36)', () => {
  const shippedSkills = new Set([
    ...INCLUDED_SKILLS,
    ...DEFERRED_SKILLS,
    ...skillFolders().map((s) => path.basename(s)),
  ]);
  for (const file of agentFiles()) {
    const text = read(file);
    it(`${rel(file)}: frontmatter is valid and read-only`, () => {
      const { data } = parseFrontmatter(text);
      assert.equal(data.name, path.basename(file, '.md'));
      assert.ok(typeof data.description === 'string' && data.description.length > 0);
      assert.match(String(data.model), /^(sonnet|opus|haiku|inherit)$/);
      for (const key of ['hooks', 'mcpServers', 'permissionMode', 'skills']) assert.ok(!(key in data), `forbidden key ${key}`);
      const tools = toList(data.tools);
      assert.ok(tools.length > 0, 'tools missing');
      const disallowed = toList(data.disallowedTools);
      const policy = AGENT_POLICIES[`${ownerOf(file)}/${path.basename(file, '.md')}`];
      if (policy) {
        assert.deepEqual([...tools].sort(), [...policy.tools].sort(), 'tools differ from the agent policy');
        for (const t of policy.disallowed) assert.ok(disallowed.includes(t), `disallowedTools lacks ${t}`);
      } else {
        for (const t of WRITE_TOOLS) assert.ok(!tools.includes(t), `tools includes ${t}`);
        for (const t of WRITE_TOOLS) assert.ok(disallowed.includes(t), `disallowedTools lacks ${t}`);
      }
    });
    it(`${rel(file)}: paved-path skill names are namespaced`, () => {
      const bad = [];
      for (const skill of shippedSkills) {
        // `zod` is also an ordinary lowercase word only in code, never in agent prose
        const re = new RegExp(`(?<!${skillOwner(skill)}:)(?<![\\w-])${skill}(?![\\w-])`, 'g');
        if (re.test(text)) bad.push(skill);
      }
      assert.deepEqual(bad, []);
    });
  }
});

describe('plugin manifests, README and CHANGELOG (AC-2, AC-38, AC-39)', () => {
  for (const name of pluginNames()) {
    const dir = pluginDir(name);
    it(`${name}: manifest fields`, () => {
      const m = JSON.parse(read(path.join(dir, '.claude-plugin', 'plugin.json')));
      assert.equal(m.name, name);
      assert.equal(m.version, EXPECTED_VERSIONS[name], 'unexpected version for ' + name);
      assert.match(m.description, /^(?:[^.!?]|\.(?=\S))+[.!?]$/, 'description must be one sentence');
      assert.deepEqual(m.author, { name: 'AI Engineering (ochubey)' });
    });
    it(`${name}: README has install command, Dependencies heading, tools statement, evals how-to`, () => {
      const t = read(path.join(dir, 'README.md'));
      assert.ok(t.includes(`claude plugin install ${name}@${MARKETPLACE}`), 'install command missing');
      assert.match(t, /^#+ Dependencies\b/m);
      assert.match(t, /^#+ Tools\b/m);
      assert.match(t, /^#+ .*\bevals?\b/im);
      assert.ok(t.includes('claude plugin eval'), 'evals how-to must show claude plugin eval');
    });
    it(`${name}: CHANGELOG has an entry for its version`, () => {
      const v = EXPECTED_VERSIONS[name].replace(/\./g, '\\.');
      assert.match(read(path.join(dir, 'CHANGELOG.md')), new RegExp(`^## ${v}\\b`, 'm'));
    });
  }
});

describe('behavior-eval seed (AC-43, AC-44, AC-45)', () => {
  for (const name of pluginNames()) {
    const evals = path.join(pluginDir(name), 'evals');
    it(`${name}: >= 3 cases, each with prompt.md and a grader; index lists them`, () => {
      const cases = subdirs(evals);
      assert.ok(cases.length >= 3, `only ${cases.length} cases`);
      const index = read(path.join(evals, 'README.md'));
      for (const c of cases) {
        assert.ok(existsSync(path.join(evals, c, 'prompt.md')), `${c}/prompt.md missing`);
        const graders = existsSync(path.join(evals, c, 'graders'))
          ? readdirSync(path.join(evals, c, 'graders')).filter((f) => f.endsWith('.md'))
          : [];
        assert.ok(graders.length >= 1, `${c}: no graders/*.md`);
        assert.ok(index.includes(c), `index does not list ${c}`);
      }
      const rows = index
        .split(/\r?\n/)
        .filter((l) => /^\|\s*[A-Z]+-\d+\s*\|/.test(l))
        .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
      assert.equal(rows.length, cases.length, 'index rows must match case folders');
      for (const r of rows) {
        assert.ok(r.length >= 5 && r.every(Boolean), `index row incomplete: ${r.join(' | ')}`);
        assert.match(r[1], /^(positive|negative)$/);
      }
      assert.ok(rows.filter((r) => r[1] === 'positive').length >= 2, '>= 2 positive cases');
      assert.ok(rows.filter((r) => r[1] === 'negative').length >= 1, '>= 1 negative case');
    });
  }
});

describe('frontmatter reader', () => {
  it('parses scalars, quotes, lists and nested maps', () => {
    const { data, body } = parseFrontmatter('---\nname: a\ndescription: "x: y"\ntools:\n  - Read\n  - Grep\nmetadata:\n  tags: a, b\nmodel: sonnet\n---\nbody\n');
    assert.equal(data.name, 'a');
    assert.equal(data.description, 'x: y');
    assert.deepEqual(data.tools, ['Read', 'Grep']);
    assert.deepEqual(data.metadata, { tags: 'a, b' });
    assert.equal(data.model, 'sonnet');
    assert.equal(body.trim(), 'body');
  });
  it('throws on an unterminated or missing block', () => {
    assert.throws(() => parseFrontmatter('---\nname: a\nbody'), /unterminated/);
    assert.throws(() => parseFrontmatter('name: a\n'), /does not start/);
  });
});
