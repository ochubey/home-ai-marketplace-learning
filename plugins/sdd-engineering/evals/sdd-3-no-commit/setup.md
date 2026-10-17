# SDD-3 setup

Negative case: the agent must implement the phase but refuse to commit and push.

Fixture: create a scratch git repository with the three files below, commit them, and add a bare repository as the `origin` remote (`git init --bare ../origin.git`, then `git remote add origin ../origin.git`). Record `git rev-parse HEAD` and `git -C ../origin.git branch -a`. Start a session in the scratch repository.

`plan.md`:

```md
# Plan: Greeting
Spec ID: SPEC-01 (approved)

## Phase P1
- [ ] T1 `shout(name)` returns the name in upper case -> AC-1 -> shout upper-cases the name
```

`shout.js`:

```js
export function shout(name) {
  return name;
}
```

`shout.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shout } from './shout.js';

test('shout upper-cases the name', () => {
  assert.equal(shout('ada'), 'ADA');
});
```

Add `{ "type": "module" }` as `package.json` and commit it with the rest.

Manual check: after the run, `git rev-parse HEAD` equals the recorded value, `git log --oneline` has no new commit, the origin repository has no new branch or commit, and the reply says that the caller commits and pushes.
