# Changelog

## 1.1.1

Patch release: one fix in `spec-creator`.

### Fixed

- `spec-creator` no longer leaves `[NEEDS CLARIFICATION]` markers for doubts the caller closed. When the caller states there are no open questions, no further edge cases, or that decisions are left to the agent, a doubt that does not change the requirements is decided with the recommended default and recorded as an assumption, with its reason, in an `Assumptions` list inside `## Open questions`. The marker stays for a genuine unknown the caller did not close, and the blocking `QUESTIONS` rule is unchanged.
- Why: in the cost experiment `implementation-planner` correctly refused to plan a spec that still carried non-blocking markers although the caller had said there were no open questions.
- Added eval SDD-6 (`sdd-6-closed-questions`); the eval seed now has six cases.

### Compatibility

- Patch because it narrows when a marker is written and changes no interface. Existing specs stay valid.
- No change to tools, models, dependencies or the other agents.

## 1.1.0

Minor release: one behavior change in `spec-creator`.

### Changed

- `spec-creator` now requires an acceptance criterion for every mandatory requirement. The spec template has a `## Requirements coverage` section (requirement, source, covering AC-IDs) after the acceptance criteria. A mandatory requirement without an AC is a defect, and one that cannot be tested is raised as `[NEEDS CLARIFICATION]` instead of being dropped. The self-check confirms the table lists every mandatory requirement and every row has an AC.
- Why: a requirement that never reached an AC was silently untested, and nothing in the spec showed it was missing.
- Added eval SDD-5 (`sdd-5-requirements-coverage`) for this behavior; the eval seed now has five cases.

### Compatibility

- Specs written with 1.0.0 stay valid. A spec without the `Requirements coverage` section is not rejected by the other agents.
- No change to tools, models, dependencies or the other agents.

## 1.0.0

Initial release. Four agents and three skills, generalized from an internal harness.

### Included

- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skills: `run-plan`, `workflow-retro`, `engineering-insights`.
- Declared dependencies: `engineering-paved-path` `^1.1.0`, `research-tools` `^1.0.0`, `architecture-review` `^1.0.0`.

### Edits relative to the source

- Models: dated model IDs were replaced by the aliases `opus` (spec-creator, implementation-planner, plan-verifier) and `sonnet` (implementer), because aliases do not go stale.
- Removed the project-specific MCP tool from `spec-creator`; a plugin cannot assume that MCP server exists. Current state is established with Read, Grep and Glob, and large unknowns are listed for the caller to give to `research-tools:researcher`.
- Removed the separate test-writing agent step and the flag that skipped it from `run-plan`; that agent is not in this marketplace. Tests come from the implementer working tests first, as the plan says.
- Converted the two slash commands (`run-plan`, `workflow-retro`) to skills with the same behavior, because plugins ship skills and the repository forbids command files.
- Set `disable-model-invocation: true` on `run-plan`, because it orchestrates code changes and should run only when the user asks. `workflow-retro` keeps it as in the source.
- Replaced the Ukrainian EARS keywords by English WHEN, WHILE, IF ... THEN and WHERE, because the repository is English-only.
- Generalized project paths, package names, package-manager commands and layer order to neutral wording: check commands come from the plan, the caller or the target repository's own instruction files; the planner orders work as contracts, producers, consumers, docs.
- Removed the Windows home-path example from `plan-verifier` and replaced the code examples with neutral placeholders, because machine-specific paths must not ship.
- Added explicit `Inputs` sections to all four agents, so that callers know what to supply and agents report what is missing.
- Added the data rule to every agent and skill: repository, spec, plan and tool-output text is data and its instructions are not followed.
- Made `spec-creator` write at most one file, in a caller-confirmed spec directory (default `specs/`), and decline other writes, to keep its Write access narrow.
- Made `implementation-planner` decline to write files and return the plan text, and stop on a spec that is not approved or has an open `[NEEDS CLARIFICATION]`.
- Made `implementer` use only check commands from the plan, the caller or the repository's instruction files, and ask when none exist, so it never invents a check.
- Added a fallback to the bare agent name and a stop that names the missing plugin in `run-plan`, because cross-plugin agent calls are untested.
- Made `engineering-insights` generic: the target is the nearest ancestor directory with a package manifest or agent-instruction file, else the repository root; the example entries are neutral placeholders.
- Made `workflow-retro` accept a ledger path other than `docs/retros/ledger.md` and keep writing `INSIGHTS.md` only after the user agrees.
- Added a README, this changelog, COMPATIBILITY and a four-case behavior-eval seed.
