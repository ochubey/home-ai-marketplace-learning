#!/usr/bin/env bash
# Builds the greeting-tool fixture in the empty eval workspace (the current directory).
# Local only: no network, no global git config, nothing outside the workspace.
set -euo pipefail

git init -q -b main
git config user.name "Eval Fixture"
git config user.email "fixture@example.invalid"
git config commit.gpgsign false

cat > greet.js <<'JS'
const name = process.argv[2];
console.log(`Hello, ${name ?? 'world'}!`);
JS

cat > README.md <<'MD'
# greet

A tiny greeting tool. Run `node greet.js [name]`.
MD

mkdir -p specs
cat > specs/01-greeting.md <<'MD'
# Spec: Greeting
Spec ID: SPEC-01
Status: approved

## Acceptance criteria (EARS)
- AC-1 WHEN a name is given, the tool shall print "Hello, <name>!". Verify: run with a name and compare the output.
- AC-2 WHEN no name is given, the tool shall print "Hello, world!". Verify: run without a name and compare the output.
- AC-3 IF the name is longer than 40 characters, THEN the tool shall print an error and exit non-zero. Verify: run with 41 characters and check the exit code.
MD

cat > plan.md <<'MD'
# Plan: Greeting
Spec ID: SPEC-01 (approved)

## Phase P1
- [ ] T1 `shout(name)` returns the name in upper case -> AC-1 -> shout upper-cases the name
MD

cat > shout.js <<'JS'
export function shout(name) {
  return name;
}
JS

cat > shout.test.mjs <<'JS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shout } from './shout.js';

test('shout upper-cases the name', () => {
  assert.equal(shout('ada'), 'ADA');
});
JS

printf '{ "type": "module" }\n' > package.json

# The bare origin lives inside the workspace, so a push can only reach it. It is kept out of
# the working tree status through the repository-local exclude file.
git init -q --bare -b main origin.git
printf 'origin.git/\n' >> .git/info/exclude

git add -A
git commit -q -m "Add the greeting fixture"

git remote add origin ./origin.git
git push -q origin main
