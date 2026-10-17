import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { check, assertOk, assertProblem, assertNoProblem } from './helpers.mjs';

// Token-like values are assembled by concatenation so this file never trips the scan.
const gh = 'ghp' + '_' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6';
const ghPat = 'github' + '_pat_' + 'aB3dE6gH9jK2mN5pQ8sT1v';
const aws = 'AKIA' + 'QWERTYUIOPASDFGH';
const anthropic = 'sk' + '-ant-' + 'api03-aB3dE6gH9jK2mN5pQ8sT1vW4';
const openai = 'sk' + '-proj-' + 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6';
const slack = 'xox' + 'b-' + '1234567890-aB3dE6gH9j';
const pem = '-----BEGIN ' + 'RSA PRIVATE KEY' + '-----';
const generic = 'Zq9fLm2Xp7Rt4Vb8Nc';

const hit = (rule, text, secret) => {
  const r = check({ 'notes.md': `first line\n${text}\n` });
  assertProblem(r, rule, 'notes.md:2');
  if (secret) assert.ok(!r.stdout.includes(secret), `secret echoed:\n${r.stdout}`);
  return r;
};

describe('T8 secret scan (AC-25)', () => {
  it('detects provider token classes by rule', () => {
    hit('secret-github', `use ${gh} here`, gh);
    hit('secret-github', `use ${ghPat} here`, ghPat);
    hit('secret-aws', `key ${aws}`, aws);
    hit('secret-anthropic', `key ${anthropic}`, anthropic);
    hit('secret-openai', `key ${openai}`, openai);
    hit('secret-slack', `hook ${slack}`, slack);
    hit('secret-private-key', pem);
    hit('secret-generic-assign', 'pass' + 'word = "' + generic + '"', generic);
    hit('secret-generic-assign', 'api_' + 'key: \'' + generic + '\'', generic);
  });

  it('masks: prints first 4 chars and length only', () => {
    const r = hit('secret-github', gh, gh);
    assert.match(r.stdout, /ghp_/);
    assert.match(r.stdout, new RegExp(`${gh.length} chars`));
  });

  it('reports an overlapping span once, by the first rule', () => {
    const r = hit('secret-anthropic', anthropic + 'aB3dE6gH9jK2mN5pQ8s');
    assert.ok(!r.stdout.includes('[secret-openai]'));
  });

  it('flags env files except example, sample and template', () => {
    assertProblem(check({ '.env': 'A=1\n' }), 'secret-env-file', '.env');
    assertProblem(check({ 'sub/.env.local': 'A=1\n' }), 'secret-env-file', 'sub/.env.local');
    for (const ok of ['.env.example', '.env.sample', '.env.template']) assertOk(check({ [ok]: 'A=\n' }));
  });

  it('skips placeholders in secret rules', () => {
    assertOk(check({ 'a.md': 'token = "your-token-goes-here-now"\n' }));
    assertOk(check({ 'a.md': 'password: "<replace-me-with-a-password>"\n' }));
    assertOk(check({ 'a.md': 'secret = "${SECRET_VALUE_FROM_ENV}"\n' }));
    assertOk(check({ 'a.md': 'ghp' + '_' + 'x'.repeat(36) + '\n' }));
  });

  it('does not exempt docs/temp', () => {
    assertProblem(check({ 'docs/temp/n.md': gh + '\n' }), 'secret-github', 'docs/temp/n.md:1');
  });

  it('does not flag short or ordinary values', () => {
    assertOk(check({ 'a.md': 'password = "short"\nsk-ant is a prefix\nghp_ alone\n' }));
  });
});

describe('T8 absolute paths (AC-26)', () => {
  it('detects macOS, Linux and Windows home paths', () => {
    const mac = '/Users/' + 'alice/dev/project';
    const lin = '/home/' + 'bob/work';
    const win = 'C:' + '\\Users\\' + 'carol\\docs';
    assertProblem(check({ 'a.md': `see ${mac}\n` }), 'abs-path', 'a.md:1');
    assertProblem(check({ 'a.md': `x\ncd "${lin}"\n` }), 'abs-path', 'a.md:2');
    assertProblem(check({ 'a.md': `${win}\n` }), 'abs-path', 'a.md:1');
    assertProblem(check({ 'a.md': `path=${mac}\n` }), 'abs-path');
    assertProblem(check({ 'a.md': `${lin}\n` }), 'abs-path');
  });

  it('allows placeholders and URLs', () => {
    assertOk(check({ 'a.md': 'use /Users/<name>/dev and /home/<user>/x\n' }));
    assertOk(check({ 'a.md': 'https://example.com/home/alice/page\n' }));
    assertOk(check({ 'a.md': 'use /path/to/clone and ~/dev\n' }));
  });
});
