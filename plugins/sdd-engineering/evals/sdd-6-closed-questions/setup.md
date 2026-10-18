# SDD-6 setup

Positive case: the caller closes all questions but leaves one detail unspecified (trimming of surrounding spaces in a name). The agent decides it and records an assumption instead of a marker.

Fixture: create a scratch git repository with one file and one commit, then start a session there.

`greet.js`:

```js
const name = process.argv[2];
console.log(`Hello, ${name ?? 'world'}!`);
```

Run `git status --porcelain` before the run (empty) and after it.

Manual check: exactly one new file, `specs/01-<kebab-name>.md`. Run `grep -c "NEEDS CLARIFICATION" specs/01-*.md`: it prints 0. The `## Open questions` section has an `Assumptions` list with an entry on trimming surrounding spaces and a reason. The three mandatory requirements (optional name, default "Hello, world!", rejection of names over 40 characters) each have at least one AC in the Requirements coverage table.
