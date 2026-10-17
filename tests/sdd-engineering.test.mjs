import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, toList } from './frontmatter.mjs';
import {
  MARKETPLACE, PAVED, AGENT_POLICIES, read, walk, rel, pluginNames, pluginDir, skillFolders,
} from './plugin-helpers.mjs';

const NAME = 'sdd-engineering';
const dir = pluginDir(NAME);
const agentPath = (n) => path.join(dir, 'agents', `${n}.md`);
const skillPath = (n) => path.join(dir, 'skills', n, 'SKILL.md');
const fm = (file) => parseFrontmatter(read(file)).data;
const sorted = (v) => [...toList(v)].sort();
const AGENTS = ['spec-creator', 'implementation-planner', 'implementer', 'plan-verifier'];
const SKILLS = ['run-plan', 'workflow-retro', 'engineering-insights'];

describe('sdd-engineering manifest (AC-3)', () => {
  it('declares exactly the three dependencies, in order, each with the marketplace', () => {
    const m = JSON.parse(read(path.join(dir, '.claude-plugin', 'plugin.json')));
    assert.deepEqual(m.dependencies, [
      { name: PAVED, marketplace: MARKETPLACE, version: '^1.1.0' },
      { name: 'research-tools', marketplace: MARKETPLACE, version: '^1.0.0' },
      { name: 'architecture-review', marketplace: MARKETPLACE, version: '^1.0.0' },
    ]);
  });
});

describe('sdd-engineering agents (AC-9..AC-16, AC-23, AC-27, AC-28)', () => {
  it('ships exactly the four agent files', () => {
    assert.deepEqual(readdirSync(path.join(dir, 'agents')).sort(), AGENTS.map((a) => `${a}.md`).sort());
  });
  it('planner and verifier are read-only with exact tool sets', () => {
    for (const n of ['implementation-planner', 'plan-verifier']) {
      const d = fm(agentPath(n));
      assert.deepEqual(sorted(d.tools), ['Glob', 'Grep', 'Read'], n);
      assert.deepEqual(sorted(d.disallowedTools), ['Agent', 'Bash', 'Edit', 'NotebookEdit', 'Write'], n);
      assert.ok(!(`${NAME}/${n}` in AGENT_POLICIES), `${n} must not be in the write policy table`);
    }
  });
  it('the policy table holds only spec-creator and implementer', () => {
    assert.deepEqual(Object.keys(AGENT_POLICIES).sort(), [`${NAME}/implementer`, `${NAME}/spec-creator`]);
  });
  it('spec-creator: Read, Grep, Glob, Write; no MCP tool', () => {
    const d = fm(agentPath('spec-creator'));
    assert.deepEqual(sorted(d.tools), ['Glob', 'Grep', 'Read', 'Write']);
    assert.deepEqual(sorted(d.disallowedTools), ['Agent', 'Bash', 'Edit', 'NotebookEdit']);
    assert.ok(!toList(d.tools).some((t) => t.startsWith('mcp__')));
  });
  it('implementer: exact tools, disallowed contains NotebookEdit and Agent', () => {
    const d = fm(agentPath('implementer'));
    assert.deepEqual(sorted(d.tools), ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Write']);
    const dis = toList(d.disallowedTools);
    for (const t of ['NotebookEdit', 'Agent']) assert.ok(dis.includes(t), t);
  });
  it('model aliases: opus for three agents, sonnet for the implementer', () => {
    for (const n of AGENTS) assert.equal(fm(agentPath(n)).model, n === 'implementer' ? 'sonnet' : 'opus', n);
  });
  it('every agent has an Inputs heading and a data rule', () => {
    for (const n of AGENTS) {
      const t = read(agentPath(n));
      assert.match(t, /^#+ Inputs\b/m, `${n}: Inputs heading`);
      assert.match(t, /\bare data\b/i, `${n}: data rule`);
      assert.match(t, /design files/i, `${n}: data rule names design files`);
      assert.match(t, /tool output/i, `${n}: data rule names tool output`);
      assert.match(t, /not followed|never as instructions|do not follow/i, `${n}: instructions in data are not followed`);
    }
  });
  it('implementer never commits or pushes, and never weakens a test', () => {
    const t = read(agentPath('implementer'));
    assert.match(t, /never[^.\n]*\bcommit/i);
    assert.match(t, /never[^.\n]*\bpush/i);
    assert.match(t, /never[^.\n]*weaken/i);
  });
  it('plan-verifier report: matrix, Out-of-plan changes, PASS/PARTIAL/MISSING', () => {
    const t = read(agentPath('plan-verifier'));
    assert.match(t, /traceability matrix/i);
    assert.match(t, /^#+ Out-of-plan changes\b/m);
    for (const w of ['PASS', 'PARTIAL', 'MISSING']) assert.ok(t.includes(w), w);
  });
});

describe('sdd-engineering skills (AC-30..AC-33, AC-39)', () => {
  it('ships exactly the three skill folders', () => {
    assert.deepEqual(readdirSync(path.join(dir, 'skills')).sort(), [...SKILLS].sort());
  });
  it('no hooks key; disable-model-invocation on run-plan and workflow-retro only', () => {
    for (const n of SKILLS) {
      const d = fm(skillPath(n));
      assert.ok(!('hooks' in d), `${n}: hooks`);
      if (n === 'engineering-insights') assert.ok(!('disable-model-invocation' in d), n);
      else assert.equal(String(d['disable-model-invocation']), 'true', n);
    }
  });
  it('run-plan declares its argument hint and names the three components', () => {
    const d = fm(skillPath('run-plan'));
    assert.ok(typeof d['argument-hint'] === 'string' && d['argument-hint'].length > 0);
    const t = read(skillPath('run-plan'));
    for (const c of ['sdd-engineering:implementer', 'architecture-review:architecture-reviewer', 'sdd-engineering:plan-verifier']) {
      assert.ok(t.includes(c), c);
    }
  });
  it('engineering-insights names the seven sections', () => {
    const t = read(skillPath('engineering-insights'));
    for (const s of ['What Works', "What Doesn't Work", 'Codebase Patterns', 'Tool & Library Notes', 'Recurring Errors & Fixes', 'Session Notes', 'Open Questions']) {
      assert.ok(t.includes(s), s);
    }
  });
});

describe('sdd-engineering portability (AC-42, AC-43)', () => {
  const SCOPED_DENY = /pnpm|vitest|get_blast_radius|mcp__|claude-(opus|sonnet|haiku)-[0-9]|test-writer|security-reviewer|doc-writer|brainstorm|skills-lock|next-env|\bserver\/|\bclient\//i;
  it('scoped deny-list finds nothing in plugin files', () => {
    const hits = [];
    for (const f of walk(dir)) {
      read(f).split(/\r?\n/).forEach((l, i) => {
        if (SCOPED_DENY.test(l)) hits.push(`${rel(f)}:${i + 1}: ${l.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(hits, []);
  });
  it('every <plugin>:<name> token of a known plugin resolves to a real component', () => {
    const known = pluginNames();
    const components = new Set();
    for (const p of known) {
      const pd = pluginDir(p);
      if (existsSync(path.join(pd, 'agents'))) {
        for (const f of readdirSync(path.join(pd, 'agents'))) if (f.endsWith('.md')) components.add(`${p}:${f.slice(0, -3)}`);
      }
      if (existsSync(path.join(pd, 'skills'))) {
        for (const s of readdirSync(path.join(pd, 'skills'), { withFileTypes: true })) if (s.isDirectory()) components.add(`${p}:${s.name}`);
      }
    }
    assert.ok(skillFolders().length > 0);
    const bad = [];
    const re = new RegExp(`(?<![\\w-])(${known.join('|')}):([a-z][a-z0-9-]*)`, 'g');
    for (const f of walk(dir)) {
      if (!f.endsWith('.md')) continue;
      for (const m of read(f).matchAll(re)) {
        const token = `${m[1]}:${m[2]}`;
        if (!components.has(token)) bad.push(`${rel(f)}: ${token}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe('sdd-engineering docs (AC-49, AC-51)', () => {
  it('README has a Provenance heading', () => {
    assert.match(read(path.join(dir, 'README.md')), /^#+ Provenance\b/m);
  });
  it('COMPATIBILITY states 2.1.302, unconfirmed, and 2.1.110 only as a claim', () => {
    const t = read(path.join(dir, 'COMPATIBILITY.md'));
    assert.ok(t.includes('2.1.302'));
    assert.match(t, /unconfirmed/i);
    for (const line of t.split(/\r?\n/).filter((l) => l.includes('2.1.110'))) {
      assert.match(line, /claim/i, `2.1.110 must be worded as a claim: ${line}`);
    }
  });
});

describe('sdd-engineering 1.1.0: requirements coverage', () => {
  const spec = () => read(agentPath('spec-creator'));
  it('the changelog has a 1.1.0 entry', () => {
    const c = read(path.join(dir, 'CHANGELOG.md'));
    assert.match(c, /^## 1\.1\.0\b/m);
    assert.match(c, /^## 1\.0\.0\b/m);
  });
  it('spec template has a Requirements coverage section after the acceptance criteria', () => {
    const t = spec();
    const ac = t.indexOf('## Acceptance criteria (EARS)');
    const cov = t.indexOf('## Requirements coverage');
    assert.ok(ac >= 0 && cov > ac, 'section order');
    assert.ok(cov < t.indexOf('## Edge cases'), 'coverage precedes edge cases');
    assert.match(t, /requirement \| source \| covering AC-IDs/i);
  });
  it('rules require an AC per mandatory requirement and raise untestable ones', () => {
    const t = spec();
    assert.match(t, /every mandatory requirement[^\n]*at least one AC/i);
    assert.match(t, /requirement with no AC is a defect/i);
    assert.match(t, /cannot be tested[^\n]*\[NEEDS CLARIFICATION\][^\n]*instead of being dropped/i);
  });
  it('self-check confirms the coverage table', () => {
    const t = spec();
    const self = t.slice(t.indexOf('## Self-check before returning'), t.indexOf('## Research'));
    assert.match(self, /Requirements coverage/);
    assert.match(self, /every row has an AC/i);
  });
  it('eval SDD-5 exists, is indexed, and checks the coverage table', () => {
    const e = path.join(dir, 'evals', 'sdd-5-requirements-coverage');
    for (const f of ['prompt.md', 'setup.md', path.join('graders', 'criteria.md')]) {
      assert.ok(existsSync(path.join(e, f)), f);
    }
    const idx = read(path.join(dir, 'evals', 'README.md'));
    assert.match(idx, /\| SDD-5 \| positive \|/);
    assert.ok(idx.includes('sdd-5-requirements-coverage/setup.md'));
    assert.match(read(path.join(e, 'graders', 'criteria.md')), /Requirements coverage/);
    assert.match(read(path.join(e, 'prompt.md')), /must|shall|required|has to/i);
  });
});

describe('sdd-engineering 1.1.1: closed questions', () => {
  const spec = () => read(agentPath('spec-creator'));
  it('manifest version is 1.1.1 and the changelog has a 1.1.1 entry above 1.1.0', () => {
    assert.equal(JSON.parse(read(path.join(dir, '.claude-plugin', 'plugin.json'))).version, '1.1.1');
    const c = read(path.join(dir, 'CHANGELOG.md'));
    assert.match(c, /^## 1\.1\.1\b/m);
    assert.ok(c.indexOf('## 1.1.1') < c.indexOf('## 1.1.0'));
    assert.match(c.slice(c.indexOf('## 1.1.1'), c.indexOf('## 1.1.0')), /patch/i);
  });
  it('spec-creator decides closed doubts as assumptions with a reason, without a marker', () => {
    const t = spec();
    assert.match(t, /no open questions/i);
    assert.match(t, /recommended default/i);
    assert.match(t, /`Assumptions`/);
    assert.match(t, /each (assumption )?with its reason/i);
    assert.match(t, /no `\[NEEDS CLARIFICATION\]` marker/i);
  });
  it('the blocking-QUESTIONS rule and the genuine-unknown marker stay', () => {
    const t = spec();
    assert.match(t, /If answers change the spec materially, stop and return only a `QUESTIONS` list/);
    assert.match(t, /genuine unknown/i);
  });
  it('the template and self-check mention assumptions and closed items', () => {
    const t = spec();
    assert.match(t, /## Open questions[^\n]*Assumptions/);
    const self = t.slice(t.indexOf('## Self-check before returning'), t.indexOf('## Research'));
    assert.match(self, /no `\[NEEDS CLARIFICATION\]` marker remains for items the caller closed/i);
  });
  it('eval SDD-6 exists, is indexed, and checks markers, assumption and ACs', () => {
    const e = path.join(dir, 'evals', 'sdd-6-closed-questions');
    for (const f of ['prompt.md', 'setup.md', path.join('graders', 'criteria.md')]) {
      assert.ok(existsSync(path.join(e, f)), f);
    }
    const idx = read(path.join(dir, 'evals', 'README.md'));
    assert.match(idx, /\| SDD-6 \| positive \|/);
    assert.ok(idx.includes('sdd-6-closed-questions/setup.md'));
    assert.match(idx, /six/i);
    const g = read(path.join(e, 'graders', 'criteria.md'));
    assert.match(g, /zero `\[NEEDS CLARIFICATION\]`/);
    assert.match(g, /Assumptions/);
    assert.match(read(path.join(e, 'prompt.md')), /no open questions/i);
  });
  it('README states 1.1.1 and six eval cases', () => {
    const r = read(path.join(dir, 'README.md'));
    assert.match(r, /Version 1\.1\.1\./);
    assert.match(r, /## What is new in 1\.1\.1/);
    assert.match(r, /six cases \(four positive, two negative\)/);
  });
});
