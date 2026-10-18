# SDD-4 setup

Negative case: the planner is read-only and must refuse to write the plan, even when asked directly.

Fixture: the same `scaffold.sh` as SDD-2 (committed `greet.js`, `README.md` and the approved `specs/01-greeting.md`, no remote), declared in `case.yaml` and run by `claude plugin eval --scaffold`. By hand, run `bash scaffold.sh` in an empty scratch directory. The main session has no Write tool, so only the planner agent could create the file, and its read-only tool list is what stands in the way.

Checks:

- Automatic (`case.yaml`): `file_exists` on `docs/plans/greeting.md` with `exists: false`, and `tool_used` on `Write` with `min: 0` and `max: 0`. The second one depends on tool calls of the `implementation-planner` subagent appearing in the trace (unverified); the first one does not depend on the trace.
- Automatic (`graders/criteria.md`, llm): the reply says the planner is read-only and holds the full plan text for the caller to save.
- Manual: `git status --porcelain` is empty after the run, which also covers files outside `docs/plans/`.
