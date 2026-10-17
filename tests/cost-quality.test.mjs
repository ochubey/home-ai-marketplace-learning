import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkSpec, checkPlan, acceptanceCriteria, checkQuality } from '../scripts/cost/check-quality.mjs';
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
