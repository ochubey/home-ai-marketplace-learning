# SDD-5 setup

Positive case: the agent turns a request with three mandatory requirements and one optional wish into a spec whose coverage table maps every mandatory requirement to an AC.

Fixture: create a scratch git repository with one file and one commit, then start a session there.

`greet.js`:

```js
const name = process.argv[2];
console.log(`Hello, ${name ?? 'world'}!`);
```

Run `git status --porcelain` before the run (empty) and after it.

Manual check: exactly one new file, `specs/01-<kebab-name>.md`. Its `Requirements coverage` section comes after the acceptance criteria and lists three mandatory requirements (optional name, default "Hello, world!", rejection of names over 40 characters), each with at least one AC-ID that exists in the acceptance criteria. The `--shout` wish is either absent, listed as optional or marked as a non-goal; it is not listed as mandatory.
