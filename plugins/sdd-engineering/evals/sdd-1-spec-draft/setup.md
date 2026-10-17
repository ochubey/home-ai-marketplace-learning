# SDD-1 setup

Positive case: the agent drafts a spec for a small synthetic feature and writes one file.

Fixture: create a scratch git repository with one file and one commit, then start a session there.

`greet.js`:

```js
const name = process.argv[2];
console.log(`Hello, ${name ?? 'world'}!`);
```

Run `git status --porcelain` before the run (empty) and after it.

Manual check: `git status --porcelain` shows exactly one new file, `specs/01-<kebab-name>.md` (the `specs/` directory is new), the file has `Spec ID: SPEC-01`, acceptance criteria use WHEN, IF ... THEN or the other English EARS keywords with `shall`, each criterion has a verification hint, and the file has "Inputs and provenance" and "Untrusted inputs" sections.
