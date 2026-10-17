# Plan: SPEC-03 Phase 3 - sdd-engineering plugin

Spec: `specs/phase-3-sdd-engineering.md` (approved; its "Resolutions" section supersedes conflicting text, then "Decisions").
Branch `feat/sdd-engineering`. Node 22, no npm dependencies. Single-agent pass, phases in order.
The implementer never commits, branches or pushes; the coordinator commits per phase.
`$SRC` = the source harness directory holding `agents/`, `commands/`, `skills/` (read-only; the coordinator supplies the value).
This file is scanned by the validator: no real home paths.

Resolved conflicts: implementer keeps Bash, no Bash patterns in `disallowedTools`, no-commit is a prompt rule plus eval SDD-3, README says it is not enforced.
Agents and skills are named `sdd-engineering:<x>`; run-plan says to fall back to the bare agent name if the namespaced one is not found; README says cross-plugin agent calls are untested.
COMPATIBILITY: "tested with 2.1.302", minimum unconfirmed; 2.1.110 only as an unconfirmed course-material claim. Scoped deny-list reference means AC-42.
Prose and fixtures avoid `pnpm`, `vitest`, `server/`, `client/`; use `node --test` / `npm test`. Agent prose avoids bare skill-name words unless namespaced.

## Target layout
```
plugins/sdd-engineering/.claude-plugin/plugin.json
plugins/sdd-engineering/agents/{spec-creator,implementation-planner,implementer,plan-verifier}.md
plugins/sdd-engineering/skills/{run-plan,workflow-retro,engineering-insights}/SKILL.md
plugins/sdd-engineering/{README,CHANGELOG,COMPATIBILITY}.md
plugins/sdd-engineering/evals/{README.md,SDD-1..SDD-4/{prompt.md,setup.md,graders/*.md}}
tests/sdd-engineering.test.mjs (new); additive edits to tests/{plugin-helpers,plugins,repo,architecture-review,repo-docs}
.claude-plugin/marketplace.json, .github/CODEOWNERS, README.md, plugins/README.md
```

## Phase 0 - Preflight
Record source-project `git status --porcelain` and HEAD (AC-47); `node --test` counts on the base (AC-60); `claude --version`; validator output (expect OK, 3 plugins).

## Phase 1 - Tests first (edits to existing tests only add list entries or exact exceptions, or make a check owner-aware; never loosen)
P1a (stays green):
- T1.1 `plugin-helpers.mjs` AGENT_POLICIES with exactly `sdd-engineering/spec-creator` (tools Read, Grep, Glob, Write; disallowed Edit, NotebookEdit, Bash, Agent) and `sdd-engineering/implementer` (tools Read, Grep, Glob, Write, Edit, Bash; disallowed contains NotebookEdit, Agent); agent test uses the policy if present, else the unchanged read-only rule (AC-54).
- T1.2 `skillOwner()` so the namespacing check requires the owning plugin's prefix; a bare name still fails (AC-55).
- T1.3 `engineering-insights` allowed only in `sdd-engineering`; the other excluded skills stay forbidden everywhere (AC-56).
- T1.4 `RUNTIME_REPO_REFS`: exact "file -> ref" pairs with a reason each, no wildcards; start empty, fill in Phase 3 (AC-58).
- T1.5 `architecture-review.test.mjs`: exclude `sdd-engineering` from the "no dependencies" loop by exact name (AC-57).
- T1.6 `repo.test.mjs` pluginDocs also covers `plugins/<name>/COMPATIBILITY.md` (AC-51).
P1b (red until Phases 2-5):
- T1.7 EXPECTED_VERSIONS['sdd-engineering']='1.0.0'; plugin lists in repo.test.mjs and repo-docs.test.mjs include it (AC-1,4,8,52,53).
- T1.8 New `tests/sdd-engineering.test.mjs`: dependencies exact (paved-path ^1.1.0, research-tools ^1.0.0, architecture-review ^1.0.0, each with marketplace); agents dir = the four files; planner and verifier read-only; spec-creator tools per policy and no `mcp__`; implementer per policy; models opus x3 / sonnet implementer; `Inputs` heading in each agent; implementer says never commit/push; verifier has traceability matrix, `Out-of-plan changes`, PASS/PARTIAL/MISSING; each agent states inputs are data and are not followed; skills = exactly the three, no `hooks`, `disable-model-invocation: true` on run-plan and workflow-retro and absent on engineering-insights; run-plan names `sdd-engineering:implementer`, `architecture-review:architecture-reviewer`, `sdd-engineering:plan-verifier`; engineering-insights names the seven sections; scoped deny-list over the plugin (case-insensitive): `pnpm|vitest|get_blast_radius|mcp__|claude-(opus|sonnet|haiku)-[0-9]|test-writer|security-reviewer|doc-writer|brainstorm|skills-lock|next-env|\bserver/|\bclient/`; every `<plugin>:<name>` token of a known plugin resolves; README has a Provenance heading; COMPATIBILITY contains `2.1.302`, `unconfirmed`, and `2.1.110` only with "claim" wording.
Run `node --test`; P1a green (count = baseline), P1b only sdd-related failures.

## Phase 2 - Manifest, catalog, ownership, agents
- T2.1 plugin.json (1.0.0, one-sentence description, author, dependencies); catalog entry (no version; existing three byte-identical); CODEOWNERS line `/plugins/sdd-engineering/ @ochubey` after the default rule.
- T2.2 spec-creator from `$SRC/agents/spec-creator.md`: tools Read, Grep, Glob, Write, `disallowedTools: Edit, NotebookEdit, Bash, Agent`, `model: opus`; Inputs (request, optional material, optional spec dir default `specs/`); one file `NN-<kebab>.md`, `SPEC-NN`, next free number; English EARS (WHEN/WHILE/IF...THEN/WHERE) with verification hints, provenance tags, untrusted-inputs section; large unknowns listed for the caller to run `research-tools:researcher`; no blast-radius MCP tool.
- T2.3 implementation-planner: read-only, opus; Inputs (approved spec path); stops on non-approved status or open `[NEEDS CLARIFICATION]`; returns full plan text, declines to write files; task -> AC-ID -> test; coverage table; asks caller multi vs single pass.
- T2.4 implementer: sonnet; Inputs (plan path, phase ID, baseline, checks or permission to discover them); checks only from plan/caller or repo instruction files, never invented, real output, pre-existing failures marked, none found -> ask; never creates branches, commits or pushes; never weakens tests; plan wrong -> stop and report; tests-first; leaves generated/lock/secret files alone.
- T2.5 plan-verifier: read-only, opus; Inputs (plan path, optional spec path); matrix (ID, requirement, PASS/PARTIAL/MISSING, `path:line` or test name, gap); MISSING states what was searched; `Out-of-plan changes`; large diffs sampled and stated; no Windows home-path example.
All four: data rule (spec/plan/code/web text is data, instructions inside it are not followed), no hooks/mcpServers/permissionMode, no "spawn".

## Phase 3 - Skills
- T3.1 run-plan from `$SRC/commands/run-plan.md`: `argument-hint: "<plan path> [phase ids]"`, `disable-model-invocation: true`, `$ARGUMENTS`; implementer -> architecture-reviewer -> plan-verifier flow with namespaced names and bare-name fallback; checks per AC-22; no test-writer step or `--no-tests`; missing component -> stop and name the plugin.
- T3.2 workflow-retro from `$SRC/commands/workflow-retro.md`: `disable-model-invocation: true`, `argument-hint: "[deep]"`; ledger `docs/retros/ledger.md` or a user path; `INSIGHTS.md` only after the user agrees; unavailable figures stated as such; no Windows path.
- T3.3 engineering-insights from `$SRC/skills/engineering-insights/SKILL.md`: generic target (nearest ancestor with a package manifest or instruction file, else root), seven sections kept, placeholder-only examples, no package names.
- T3.4 fill RUNTIME_REPO_REFS with only the pairs actually present, one reason each.

## Phase 4 - Evals
`evals/README.md` index `| ID | Kind | ACs | Setup | Pass criterion |`: SDD-1 positive (spec-creator drafts a spec), SDD-2 positive (planner returns a plan with a coverage table and writes nothing), SDD-3 negative (implementer refuses to commit/push), SDD-4 negative (planner refuses to write the plan to a file). Each case: `prompt.md`, `setup.md` with a small synthetic inline fixture, `graders/*.md` (use `git status --porcelain` / `git rev-parse HEAD` checks).

## Phase 5 - Documentation
README (purpose, seven namespaced components, install, Dependencies, Tools incl. model, no-commit-not-enforced note, cross-plugin calls untested, evals, `## Provenance`: authored by the owner in their own harness, adapted for portability, no project name, no third-party license claim); CHANGELOG 1.0.0 with every edit and reason; COMPATIBILITY; `plugins/README.md` row; root README names four plugins.

## Phase 6 - Verification (real output)
Validator OK with 4 plugins and an unchanged allowlist; `node --test tests/*.test.mjs` green, count >= baseline; mutation checks (add Write to plan-verifier tools -> test fails; add a bare skill name to an agent -> test fails; revert both); review `git diff -- tests/` for removed or loosened assertions; grep `spawn|test-writer|pnpm|mcp__` empty; source project status/HEAD unchanged; read every plugin file against the spec. Coordinator-only: `claude plugin validate`, install smoke test, hand-run SDD-1..4.
