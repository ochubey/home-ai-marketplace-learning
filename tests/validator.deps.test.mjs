import { describe, it } from 'node:test';
import { check, withPlugins, assertOk, assertProblem } from './helpers.mjs';

const two = (depsA, depsB) =>
  withPlugins([
    { name: 'alpha', dependencies: depsA },
    { name: 'beta', dependencies: depsB },
  ]);

describe('T6 dependencies (AC-23)', () => {
  it('accepts the three item forms', () => {
    assertOk(check(two(['beta', 'beta@home-ai-marketplace-learning'], [])));
    assertOk(check(two([{ name: 'beta' }], [])));
    assertOk(check(two([{ name: 'beta', marketplace: 'home-ai-marketplace-learning', version: '^1.2.0' }], [])));
  });

  it('fails an unknown dependency with the chain', () => {
    assertProblem(check(two(['zzz'], [])), 'dep-unknown', 'alpha -> zzz');
  });

  it('fails a self dependency', () => {
    assertProblem(check(two(['alpha'], [])), 'dep-self', 'alpha -> alpha');
  });

  it('fails a cycle once with the chain', () => {
    const r = check(two(['beta'], ['alpha']));
    assertProblem(r, 'dep-cycle', 'alpha -> beta -> alpha');
    const n = r.stdout.split('\n').filter((l) => l.includes('[dep-cycle]')).length;
    if (n !== 1) throw new Error(`expected one cycle report, got ${n}`);
  });

  it('fails a longer cycle', () => {
    const r = check(
      withPlugins([
        { name: 'alpha', dependencies: ['beta'] },
        { name: 'beta', dependencies: ['gamma'] },
        { name: 'gamma', dependencies: ['alpha'] },
      ]),
    );
    assertProblem(r, 'dep-cycle', 'alpha -> beta -> gamma -> alpha');
  });

  it('fails a foreign marketplace qualifier', () => {
    assertProblem(check(two(['beta@other-market'], [])), 'dep-marketplace', 'other-market');
    assertProblem(check(two([{ name: 'beta', marketplace: 'other-market' }], [])), 'dep-marketplace');
  });

  it('fails malformed items and a non-array value', () => {
    assertProblem(check(two([42], [])), 'dep-format');
    assertProblem(check(two([{ marketplace: 'x' }], [])), 'dep-format');
    assertProblem(check(two('beta', [])), 'dep-format');
    assertProblem(check(two([''], [])), 'dep-format');
  });

  it('checks range syntax only', () => {
    const good = ['*', 'x', '1.2.3', '^1.2.3', '~1.2', '>=1.0.0', '<=2', '>1', '<2.0.0', '=1.0.0', '1.x', '1.2.*', '1.2.3 - 2.3.4', '>=1.2.3 <2.0.0', '^1.0.0 || ^2.0.0', '>= 1.0.0'];
    for (const version of good) {
      assertOk(check(two([{ name: 'beta', version }], [])));
    }
    for (const version of ['^^1', 'abc', '>>1', '1.2.3.4', '', 5]) {
      assertProblem(check(two([{ name: 'beta', version }], [])), 'dep-range');
    }
  });
});
