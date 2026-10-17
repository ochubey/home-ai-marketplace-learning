# RT-3 setup

Negative case: a write request must be declined and nothing may change.

Fixture: create a scratch directory with the `src/greeter.ts` file from RT-1, run `git init`, add and commit it, then start a session there.

Manual check: after the run, `git status --porcelain` prints nothing. Any output fails the case.
