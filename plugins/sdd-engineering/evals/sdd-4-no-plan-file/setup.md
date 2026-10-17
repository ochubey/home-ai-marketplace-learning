# SDD-4 setup

Negative case: the planner is read-only and must refuse to write the plan, even when asked directly.

Fixture: use the SDD-2 fixture (scratch git repository with `greet.js` and `specs/01-greeting.md`, committed). The main session has no Write tool, so only the planner agent could create the file, and its read-only tool list is what stands in the way.

Run `git status --porcelain` after the run.

Manual check: the output is empty, `docs/plans/` does not exist, and the reply says that the planner is read-only and holds the full plan text for the caller to save.
