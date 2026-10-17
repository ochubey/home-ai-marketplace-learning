import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSpec, checkPlan, acceptanceCriteria, checkQuality, checkFromSaved, parseAcBlocks } from '../scripts/cost/check-quality.mjs';
import { GOOD_SPEC, GOOD_PLAN, GOOD_SPEC_NAME, claudeJson } from './cost-fixtures.mjs';

const failing = (checks) => Object.entries(checks).filter(([, c]) => !c.pass).map(([k]) => k);

describe('cost: spec checks', () => {
  it('passes a good spec', () => {
    assert.deepEqual(failing(checkSpec(GOOD_SPEC, [GOOD_SPEC_NAME])), []);
  });
  it('fails on file name problems', () => {
    assert.deepEqual(failing(checkSpec(GOOD_SPEC, [])), ['spec_file']);
    assert.ok(failing(checkSpec(GOOD_SPEC, [GOOD_SPEC_NAME, '02-x.md'])).includes('spec_file'));
    assert.ok(failing(checkSpec(GOOD_SPEC, ['Greeting.md'])).includes('spec_file'));
  });
  it('fails when SPEC-NN is missing or does not match the file number', () => {
    assert.ok(failing(checkSpec(GOOD_SPEC.replace('SPEC-01', 'SPEC-07'), [GOOD_SPEC_NAME])).includes('spec_id'));
    assert.ok(failing(checkSpec(GOOD_SPEC.replace('SPEC-01', ''), [GOOD_SPEC_NAME])).includes('spec_id'));
  });
  it('needs at least 3 ACs with shall', () => {
    const two = GOOD_SPEC.split('\n').filter((l) => !l.startsWith('- AC-3')).join('\n');
    assert.ok(failing(checkSpec(two, [GOOD_SPEC_NAME])).includes('ac_count'));
    assert.equal(acceptanceCriteria(GOOD_SPEC).length, 3);
  });
  it('needs a verification hint on every AC, also on a continuation line', () => {
    const noHint = GOOD_SPEC.replace(' Verify: run with no arguments.', '');
    assert.deepEqual(failing(checkSpec(noHint, [GOOD_SPEC_NAME])), ['ac_verification']);
    const nextLine = noHint.replace('"Hello, world!".', '"Hello, world!".\n  Verification: run with no arguments.');
    assert.deepEqual(failing(checkSpec(nextLine, [GOOD_SPEC_NAME])), []);
  });
  it('needs the untrusted inputs heading', () => {
    assert.deepEqual(failing(checkSpec(GOOD_SPEC.replace('## Untrusted inputs', '## Notes'), [GOOD_SPEC_NAME])), ['untrusted_inputs']);
  });
  it('rejects Cyrillic', () => {
    assert.deepEqual(failing(checkSpec(`${GOOD_SPEC}
${String.fromCharCode(0x41f, 0x440, 0x438)}
`, [GOOD_SPEC_NAME])), ['no_cyrillic']);
  });
  it('needs an AC for the 40 character rejection with non-zero', () => {
    const noLong = GOOD_SPEC.replace('longer than 40 characters', 'too long').replace('non-zero', 'failing');
    assert.deepEqual(failing(checkSpec(noLong, [GOOD_SPEC_NAME])), ['too_long_name_ac']);
  });
  it('counts NEEDS CLARIFICATION without failing', () => {
    const c = checkSpec(`${GOOD_SPEC}\n[NEEDS CLARIFICATION] a [NEEDS CLARIFICATION] b\n`, [GOOD_SPEC_NAME]);
    assert.equal(c.needs_clarification.count, 2);
    assert.equal(c.needs_clarification.pass, true);
  });
});

describe('cost: plan checks', () => {
  const ids = ['AC-1', 'AC-2', 'AC-3'];
  it('passes a good plan', () => {
    assert.deepEqual(failing(checkPlan(GOOD_PLAN, ids, ['?? specs/01-x.md'])), []);
  });
  it('fails without a coverage table or with an AC missing from it', () => {
    const noTable = GOOD_PLAN.split('\n').filter((l) => !l.startsWith('|')).join('\n');
    assert.deepEqual(failing(checkPlan(noTable, ids, [])), ['coverage_table']);
    const partial = GOOD_PLAN.replace('| AC-3 | T3 |', '');
    assert.deepEqual(failing(checkPlan(partial, ids, [])), ['coverage_table']);
  });
  it('fails when an AC has no task line', () => {
    const plan = GOOD_PLAN.replace('-> AC-3 ->', '-> AC-2 ->');
    assert.deepEqual(failing(checkPlan(plan, ids, [])), ['tasks_cover_acs', 'tasks_have_tests']);
  });
  it('does not confuse AC-1 with AC-10', () => {
    const plan = GOOD_PLAN.replace(/AC-1\b/g, 'AC-10');
    assert.ok(failing(checkPlan(plan, ids, [])).includes('tasks_cover_acs'));
  });
  it('fails when a task names no test', () => {
    const plan = GOOD_PLAN.replace(' -> test_default_greeting', '');
    assert.deepEqual(failing(checkPlan(plan, ids, [])), ['tasks_have_tests']);
  });
  it('fails when the repo changed outside specs/', () => {
    assert.deepEqual(failing(checkPlan(GOOD_PLAN, ids, ['?? specs/01-x.md', ' M greet.js'])), ['repo_unchanged']);
  });
});

describe('cost: checkQuality on a real temp repo', () => {
  const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...a], { cwd, encoding: 'utf8' });
  function setup({ dirty = false } = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'cost-q-'));
    writeFileSync(path.join(dir, 'greet.js'), 'console.log(1);\n');
    git(dir, 'init', '-q');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'x');
    mkdirSync(path.join(dir, 'specs'));
    writeFileSync(path.join(dir, 'specs', GOOD_SPEC_NAME), GOOD_SPEC);
    if (dirty) writeFileSync(path.join(dir, 'greet.js'), 'changed\n');
    writeFileSync(path.join(dir, '..', `${path.basename(dir)}-spec.json`), JSON.stringify(claudeJson()));
    writeFileSync(path.join(dir, '..', `${path.basename(dir)}-plan.json`), JSON.stringify(claudeJson({ result: GOOD_PLAN })));
    return dir;
  }
  const run = (dir) => checkQuality({ repoDir: dir, specJsonPath: `${dir}-spec.json`, planJsonPath: `${dir}-plan.json` });
  const clean = (dir) => ['', '-spec.json', '-plan.json'].forEach((s) => rmSync(dir + s, { recursive: true, force: true }));

  it('passes, then fails when the planner touched other files', () => {
    const dir = setup();
    const dirty = setup({ dirty: true });
    try {
      const good = run(dir);
      assert.equal(good.pass, true, JSON.stringify(good.checks));
      const res = run(dirty);
      assert.equal(res.pass, false);
      assert.equal(res.checks['plan.repo_unchanged'].pass, false);
    } finally {
      clean(dir);
      clean(dirty);
    }
  });
});

const specWith = (acs) => `# Spec
Spec ID: SPEC-01
Status: draft

## Acceptance criteria (EARS)
${acs}

## Untrusted inputs
data
`;
const BASE_ACS = `- AC-1: WHEN a name is given, the tool shall print it. Verify: test.
- AC-2: WHEN no name is given, the tool shall print world. Verify: test.
`;

describe('cost: exit status and limit ACs', () => {
  const run = (acs) => checkSpec(specWith(acs), [GOOD_SPEC_NAME]).too_long_name_ac.pass;
  it('accepts one AC with the limit and a failing exit status', () => {
    assert.equal(run(`${BASE_ACS}- AC-3: IF the name is over 40 characters THEN the tool shall exit with status 1. Verify: test.`), true);
  });
  it('accepts the limit AC followed immediately by the exit status AC', () => {
    assert.equal(run(`${BASE_ACS}- AC-3: IF the name is over 40 characters THEN the tool shall print an error. Verify: test.
- AC-4: WHEN an error is printed, the tool shall set the exit status to \`1\`. Verify: test.`), true);
  });
  it('rejects the pair when the ACs are not adjacent', () => {
    assert.equal(run(`- AC-1: IF the name is over 40 characters THEN the tool shall print an error. Verify: test.
- AC-2: WHEN a name is given, the tool shall print it. Verify: test.
- AC-3: WHEN an error is printed, the tool shall exit with a non-zero code. Verify: test.`), false);
  });
  it('does not count status 127 or non-zero length', () => {
    assert.equal(run(`${BASE_ACS}- AC-3: IF the name is over 40 characters THEN the tool shall exit with status 127. Verify: test.`), false);
    assert.equal(run(`${BASE_ACS}- AC-3: IF the name is over 40 characters THEN the tool shall print a non-zero length hint. Verify: test.`), false);
  });
  it('accepts the exit wordings', () => {
    for (const w of ['exit 1', 'exits with code 1', 'exiting with status \`1\`', 'return a non-zero exit status', 'set the exit status to 1']) {
      assert.equal(run(`${BASE_ACS}- AC-3: IF over 40 characters THEN the tool shall ${w}. Verify: test.`), true, w);
    }
  });
});

describe('cost: AC line formats', () => {
  it('detects numbered, bold bullet and table AC lines', () => {
    const text = `1. AC-1: WHEN a, the tool shall do a. Verify: test.
- **AC-2** WHEN b, the tool shall do b. Verify: test.
| AC-3 | WHEN c, the tool shall do c. Verify: test. |
`;
    assert.deepEqual(parseAcBlocks(text).map((b) => b.id), ['AC-1', 'AC-2', 'AC-3']);
  });
  it('accepts a Verification column in a table', () => {
    const text = specWith(`| ID | Requirement | Verification |
|---|---|---|
| AC-1 | The tool shall print a. | run it |
| AC-2 | The tool shall print b. | run it again |
| AC-3 | The tool shall print c. | run it more |`);
    assert.equal(checkSpec(text, [GOOD_SPEC_NAME]).ac_verification.pass, true);
    assert.equal(checkSpec(text.replace('| run it more |', '|  |'), [GOOD_SPEC_NAME]).ac_verification.pass, false);
  });
  it('accepts a Verification hint written as an inline marker on a continuation line', () => {
    const text = specWith(`1. AC-1: The tool shall print a.
   Verification: run it.
2. AC-2: The tool shall print b.
   Verify: run it.
3. AC-3: The tool shall print c. (test: t3)`);
    assert.equal(checkSpec(text, [GOOD_SPEC_NAME]).ac_verification.pass, true);
  });
  it('ends an AC block at a bold-only line', () => {
    const text = `- AC-1: The tool shall print a.
**Notes**
This test note must not count for AC-1.
`;
    assert.ok(!/test/.test(parseAcBlocks(text)[0].text));
  });
  it('ends an AC block at a blank line followed by a plain paragraph, keeps indented continuations', () => {
    const text = `- AC-1: The tool shall print a.

  Verification: run it.

A paragraph about a test.
`;
    const [b] = parseAcBlocks(text);
    assert.match(b.text, /Verification/);
    assert.ok(!/paragraph/.test(b.text));
  });
});

describe('cost: plan arrows', () => {
  it('accepts the unicode arrow in task lines', () => {
    const plan = GOOD_PLAN.replace(/->/g, '\u2192');
    assert.deepEqual(failing(checkPlan(plan, ['AC-1', 'AC-2', 'AC-3'], [])), []);
  });
  it('accepts mixed arrows', () => {
    const plan = GOOD_PLAN.replace('-> AC-1 ->', '\u2192 AC-1 ->');
    assert.deepEqual(failing(checkPlan(plan, ['AC-1', 'AC-2', 'AC-3'], [])), []);
  });
});

describe('cost: re-grade from saved files', () => {
  const dirs = [];
  function saved({ quality, spec = GOOD_SPEC } = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'cost-saved-'));
    dirs.push(dir);
    writeFileSync(path.join(dir, 'l-run1-spec.md'), spec);
    writeFileSync(path.join(dir, 'l-run1-spec.json'), JSON.stringify(claudeJson()));
    writeFileSync(path.join(dir, 'l-run1-plan.json'), JSON.stringify(claudeJson({ result: GOOD_PLAN })));
    if (quality) writeFileSync(path.join(dir, 'l-run1-quality.json'), JSON.stringify(quality));
    return dir;
  }
  const stored = (pass) => ({ status: 'ok', spec_file: GOOD_SPEC_NAME, quality: { pass, checks: { 'plan.repo_unchanged': { pass, detail: pass ? '' : 'changes outside specs/: M x' } } } });
  it('re-grades a passing run', () => {
    const r = checkFromSaved(saved({ quality: stored(true) }), 'l', 1);
    assert.equal(r.pass, true, JSON.stringify(r.checks));
  });
  it('takes repo_unchanged from the stored record and re-grades the rest', () => {
    assert.equal(checkFromSaved(saved({ quality: stored(false) }), 'l', 1).checks['plan.repo_unchanged'].pass, false);
    const r = checkFromSaved(saved({ quality: stored(true), spec: GOOD_SPEC.replace('SPEC-01', '') }), 'l', 1);
    assert.equal(r.checks['spec.spec_id'].pass, false);
  });
  it('fails repo_unchanged without a stored record and throws without a saved spec', () => {
    assert.equal(checkFromSaved(saved(), 'l', 1).checks['plan.repo_unchanged'].pass, false);
    assert.throws(() => checkFromSaved(saved(), 'l', 2), /spec/);
  });
  it('works from the command line', () => {
    const dir = saved({ quality: stored(true) });
    const script = path.resolve(import.meta.dirname, '..', 'scripts', 'cost', 'check-quality.mjs');
    const r = spawnSync(process.execPath, [script, '--from-saved', dir, 'l', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).pass, true);
    assert.equal(spawnSync(process.execPath, [script, '--from-saved', dir, 'l'], { encoding: 'utf8' }).status, 2);
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });
});
