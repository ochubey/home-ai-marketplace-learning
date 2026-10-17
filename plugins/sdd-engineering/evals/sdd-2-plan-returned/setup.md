# SDD-2 setup

Positive case: an approved synthetic spec becomes a plan that is returned in the reply and written nowhere.

Fixture: create a scratch git repository with the two files below and commit them. Start a session there.

`greet.js`:

```js
const name = process.argv[2];
console.log(`Hello, ${name ?? 'world'}!`);
```

`specs/01-greeting.md`:

```md
# Spec: Greeting
Spec ID: SPEC-01
Status: approved

## Acceptance criteria (EARS)
- AC-1 WHEN a name is given, the tool shall print "Hello, <name>!". Verify: run with a name and compare the output.
- AC-2 WHEN no name is given, the tool shall print "Hello, world!". Verify: run without a name and compare the output.
- AC-3 IF the name is longer than 40 characters, THEN the tool shall print an error and exit non-zero. Verify: run with 41 characters and check the exit code.
```

Run `git status --porcelain` after the run.

Manual check: the output is empty, and the reply holds the plan text.
