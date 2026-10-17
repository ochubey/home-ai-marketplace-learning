# Spec: Phase 3 - sdd-engineering plugin

Spec ID: SPEC-03
Status: approved (coordinator resolutions below)

## Problem and user

The catalog has three dependency plugins (SPEC-02): `engineering-paved-path` (now `1.1.0`),
`research-tools` (`1.0.0`) and `architecture-review` (`1.0.0`). The owner's spec-driven development
(SDD) workflow still exists only in one project's harness: four agents (`spec-creator`,
`implementation-planner`, `implementer`, `plan-verifier`), two slash commands (`run-plan`,
`workflow-retro`) and one skill (`engineering-insights`). These files contain that project's package
names and directories, its package-manager commands, a project-specific MCP tool, dated model IDs,
a machine-specific Windows path, Ukrainian EARS keywords, and references to agents that do not
exist in this marketplace (`test-writer`). Published as-is they would be wrong in any other
repository, would fail the repository's English-only and deny-list tests, and the marketplace repo
is public.

Phase 3 publishes `sdd-engineering` `1.0.0`: a portable SDD workflow plugin with four agents and
three skills. The two commands become skills with the same behavior. The plugin depends on the
three existing plugins.

Users of this phase:

- **Marketplace consumer** - installs `sdd-engineering` into any repository and runs
  spec -> plan -> implement -> verify without knowing the project the workflow came from.
- **Code owner / reviewer** - wants the plugin validated, documented, owned, free of
  source-project leftovers, with tool permissions that match each role, and with a few behavior
  cases to check by hand.
- **Maintainer of the test suite** - wants the new plugin covered by the same invariants as the
  existing three, without any existing invariant being loosened.

## Goals / Non-goals

### Goals

- **G1** - `sdd-engineering` is in the catalog at `1.0.0`, declares its three dependencies, and
  passes every check (validator, `node --test`, `claude plugin validate`).
- **G2** - Four portable agents whose tool lists keep the source intent: planner and verifier
  read-only, spec-creator writes only one spec file, implementer edits code and runs checks but never
  commits or pushes. Every agent states its inputs explicitly.
- **G3** - Three portable skills: `run-plan` and `workflow-retro` (converted from commands, same
  behavior) and a generic `engineering-insights`.
- **G4** - No plugin file contains source-project names or paths, package-manager commands of the
  source project, MCP tools, dated model IDs, absolute paths, secrets, non-English text, hooks, or
  references to components that do not exist. Cross-plugin references are namespaced.
- **G5** - The plugin is documented (README with provenance, CHANGELOG, COMPATIBILITY) and owned
  (CODEOWNERS); catalog-level docs name it.
- **G6** - The test suite covers the new plugin, including its role-specific tool policies, and no
  existing invariant is weakened.
- **G7** - A behavior-eval seed with positive and negative cases that a reviewer runs by hand.

### Non-goals

- Changing the three dependency plugins or bumping their versions.
- Adding agents the source workflow calls but this marketplace lacks (`test-writer`,
  `security-reviewer`, `doc-writer`, `brainstorm`). Their steps are removed or folded (see
  Decisions), not re-created.
- Hooks, MCP servers, slash-command files, executable scripts, or `permissionMode` in the plugin.
- New validator rules. Repository tests may be extended.
- Automated eval execution in CI; catalog site; tags and releases (later phases).
- Any change to the source project (read-only).
- Enforcing the implementer's no-commit rule by a hook (hooks are out of scope; see Q2).

## Component mapping

| Source (owner's harness) | Plugin component | Kind |
|---|---|---|
| `.claude/agents/spec-creator.md` | `sdd-engineering:spec-creator` | agent |
| `.claude/agents/implementation-planner.md` | `sdd-engineering:implementation-planner` | agent |
| `.claude/agents/implementer.md` | `sdd-engineering:implementer` | agent |
| `.claude/agents/plan-verifier.md` | `sdd-engineering:plan-verifier` | agent |
| `.claude/commands/run-plan.md` | `sdd-engineering:run-plan` | skill (was command) |
| `.claude/commands/workflow-retro.md` | `sdd-engineering:workflow-retro` | skill (was command) |
| `.claude/skills/engineering-insights/SKILL.md` | `sdd-engineering:engineering-insights` | skill |

Dependency use:

- `architecture-review:architecture-reviewer` - the review step of `run-plan`.
- `research-tools:researcher` - the research delegate that `spec-creator` and
  `implementation-planner` ask the caller to run for large unknowns.
- `engineering-paved-path:<skill>` - stack guidance the implementer may load by namespaced name,
  in prose only (no `skills:` preload, which the existing tests forbid and SPEC-02 Decision 6 marks
  unconfirmed).

## User stories

- **US-1** (G1) As a consumer, I want to install `sdd-engineering` by name and get its three
  dependencies, so that the workflow's review and research steps work.
- **US-2** (G2) As an engineer, I want a spec-creator that writes exactly one spec file and a planner
  and verifier that cannot change files, so that each stage stays in its lane.
- **US-3** (G2) As an engineer, I want an implementer that runs my repository's own checks and leaves
  committing and pushing to me, so that I keep control of history.
- **US-4** (G3) As an engineer, I want `/sdd-engineering:run-plan <plan>` to drive implement ->
  review -> fix -> verify with the same steps as before, so that the workflow is repeatable.
- **US-5** (G3) As an engineer, I want `engineering-insights` to read and append the `INSIGHTS.md` of
  the directory I work in, in any repository, so that non-obvious findings survive sessions.
- **US-6** (G3) As an engineer, I want a manual `workflow-retro` that reports real token and agent
  numbers, so that I can tune the workflow without invented figures.
- **US-7** (G4, G5) As a code owner, I want proof by tests and docs that no source-project leftovers
  shipped and that provenance is recorded, so that a public release is safe to approve.
- **US-8** (G6) As a maintainer, I want the role-specific tool policies encoded in tests, so that a
  later edit that widens a read-only agent fails CI.
- **US-9** (G7) As a reviewer, I want hand-run positive and negative behavior cases, so that I check
  behavior and not only structure.

## Acceptance criteria (EARS)

Notation as in SPEC-01 and SPEC-02: WHEN (event), WHILE (state), IF ... THEN (unwanted behavior),
WHERE (optional feature), no keyword = ubiquitous. `shall` marks the requirement. "Plugin files"
means every file under `plugins/sdd-engineering/`. "Source project" means the owner's harness the
content is converted from. "The four agents" and "the three skills" are the components in the
mapping table.

### Catalog, manifest and checks (G1)

- **AC-1** The catalog shall contain exactly four entries: the three existing entries, unchanged, and
  `sdd-engineering` with `source` `./plugins/sdd-engineering`, a one-sentence `description`, and no
  `version` field.
  *Verify:* the catalog test in `tests/repo.test.mjs` with `sdd-engineering` added to the expected
  list; diff shows the three existing entries unchanged.
- **AC-2** `plugins/sdd-engineering/.claude-plugin/plugin.json` shall declare `name`
  `sdd-engineering`, `version` `1.0.0`, a one-sentence `description`, and `author` exactly
  `{ "name": "AI Engineering (ochubey)" }`.
  *Verify:* the manifest test in `tests/plugins.test.mjs` with the new expected version.
- **AC-3** The manifest shall declare `dependencies` as exactly these three objects, in this order:
  `engineering-paved-path` `^1.1.0`, `research-tools` `^1.0.0`, `architecture-review` `^1.0.0`, each
  with `marketplace` `home-ai-marketplace-learning`.
  *Verify:* a `deepEqual` assertion in the new plugin test.
- **AC-4** WHEN `node scripts/validate-marketplace.mjs` runs on the repository, it shall exit 0 with
  zero `ERROR` lines and report `OK - 4 plugins checked`.
  *Verify:* run it; the existing validator test in `tests/repo.test.mjs` derives the count from the
  expected-plugins list.
- **AC-5** WHEN `node --test tests/*.test.mjs` runs, and WHEN `node --test` runs as in CI, every test
  shall pass.
  *Verify:* run both; exit 0.
- **AC-6** WHEN `claude plugin validate .` runs at the repository root and
  `claude plugin validate ./plugins/<name>` runs for each of the four plugins, each shall finish
  without errors.
  *Verify:* run the five commands locally; paste the output in the PR.
- **AC-7** WHEN the working tree is added as a local marketplace and `sdd-engineering` is installed
  from it in a scratch repository, `claude plugin list --json` shall report no unsatisfied
  dependency for `sdd-engineering`.
  *Verify:* `claude plugin marketplace add <local path>`, then
  `claude plugin install sdd-engineering@home-ai-marketplace-learning --scope local`; inspect
  `claude plugin list --json`. If dependencies are reported rather than installed, install them and
  re-check (same fallback as SPEC-02 Q8).
- **AC-8** `.github/CODEOWNERS` shall contain the line `/plugins/sdd-engineering/ @ochubey` after
  the default rule.
  *Verify:* the CODEOWNERS test in `tests/repo.test.mjs`; the validator reports no
  `codeowners-plugin` problem.

### Agents (G2)

- **AC-9** The plugin shall contain exactly four agent files, `spec-creator.md`,
  `implementation-planner.md`, `implementer.md` and `plan-verifier.md`. Each frontmatter `name` shall
  equal its file name and each `description` shall be non-empty.
  *Verify:* list `plugins/sdd-engineering/agents/`; parse frontmatter.
- **AC-10** The `implementation-planner` frontmatter shall have `tools` exactly Read, Grep, Glob and
  `disallowedTools` exactly Write, Edit, NotebookEdit, Bash, Agent.
  *Verify:* exact-set assertion in the new plugin test; the generic read-only agent test also applies.
- **AC-11** The `plan-verifier` frontmatter shall have `tools` exactly Read, Grep, Glob and
  `disallowedTools` exactly Write, Edit, NotebookEdit, Bash, Agent.
  *Verify:* as AC-10.
- **AC-12** The `spec-creator` frontmatter shall have `tools` exactly Read, Grep, Glob, Write and
  `disallowedTools` exactly Edit, NotebookEdit, Bash, Agent. No MCP tool shall be listed.
  *Verify:* exact-set assertion in the new plugin test.
- **AC-13** The `implementer` frontmatter shall have `tools` exactly Read, Grep, Glob, Write, Edit,
  Bash, and `disallowedTools` shall contain at least NotebookEdit and Agent.
  *Verify:* exact-set assertion for `tools`; containment assertion for `disallowedTools` (see Q2 for
  optional Bash deny patterns).
- **AC-14** Each agent's `model` shall be a model alias: `opus` for `spec-creator`,
  `implementation-planner` and `plan-verifier`, and `sonnet` for `implementer`. No agent shall carry a
  dated model ID.
  *Verify:* the existing alias regex in `tests/plugins.test.mjs` plus exact values in the new test.
- **AC-15** No agent frontmatter shall contain `hooks`, `mcpServers`, `permissionMode` or `skills`.
  *Verify:* the existing forbidden-key assertion in `tests/plugins.test.mjs` covers the new agents.
- **AC-16** Each agent prompt shall have an `Inputs` section listing what the caller must supply:
  - `spec-creator`: the feature request text; optional design or source material; optional spec
    directory (default `specs/`).
  - `implementation-planner`: the path of an approved spec.
  - `implementer`: the plan path, the phase ID, the baseline check results, and the check commands
    (or permission to discover them, AC-22).
  - `plan-verifier`: the plan path, and optionally the spec path.
  *Verify:* the new test asserts an `Inputs` heading in each agent; prompt review against the list.
- **AC-17** IF a required input is missing, THEN the agent shall report what is missing to the
  caller before it changes anything or produces its main output.
  *Verify:* prompt review; eval SDD-2 setup omits nothing, so it is checked by reading the prompt.
- **AC-18** The `spec-creator` shall write at most one file per run, inside the spec directory, named
  `NN-<kebab-feature>.md` with Spec ID `SPEC-NN` by default. IF asked to write anywhere else, THEN it
  shall decline and say why.
  *Verify:* eval SDD-1 (`git status --porcelain` shows exactly one new file under `specs/`); prompt
  review.
- **AC-19** The `spec-creator` spec template shall use English EARS keywords (WHEN, WHILE,
  IF ... THEN, WHERE, no keyword = ubiquitous) with `shall` as the marker.
  *Verify:* the existing no-Cyrillic test passes; prompt review.
- **AC-20** The `spec-creator` shall establish current system state with Read, Grep and Glob only.
  WHERE an unknown is too large to resolve that way, it shall list it as a research item for the
  caller to delegate to `research-tools:researcher`.
  *Verify:* prompt review; the scoped deny-list (AC-42) finds no MCP tool name.
- **AC-21** WHEN given an approved spec, `implementation-planner` shall return the full plan text in
  its reply. Every task shall name at least one AC-ID and a test, and the plan shall include an
  AC -> tasks coverage table. IF the spec status is not `approved` or it has an open
  `[NEEDS CLARIFICATION]`, THEN the planner shall stop and report back.
  *Verify:* eval SDD-2; prompt review.
- **AC-22** WHEN `implementer` verifies a phase, it shall run only check commands that the plan or
  caller supplies, or, if none are supplied, that the repository's own instruction files
  (`CLAUDE.md`, `AGENTS.md`), README or package manifest document. It shall not invent a check, shall
  report real pass or fail output, and shall report failures present in the baseline as pre-existing.
  *Verify:* prompt review; eval SDD-3 transcript shows the checks it ran.
- **AC-23** The `implementer` prompt shall state that it never creates branches, commits or pushes,
  never weakens a test to make it pass, and stops and reports when the plan is wrong instead of
  improvising.
  *Verify:* the new test asserts the no-commit/push statement; prompt review for the rest.
- **AC-24** IF `implementer` is asked to commit or push, THEN it shall decline, and no new commit
  shall exist and nothing shall be pushed afterwards.
  *Verify:* eval SDD-3; `git rev-parse HEAD` is unchanged and no remote ref changed.
- **AC-25** IF `implementation-planner` is asked to save the plan to a file, THEN it shall decline to
  write, return the plan text for the caller to save, and no file shall change.
  *Verify:* eval SDD-4; `git status --porcelain` is empty afterwards.
- **AC-26** The `implementer` shall leave untouched any path the repository's instruction files mark
  as do-not-touch, plus generated files, lock files and environment files holding secrets.
  *Verify:* prompt review (generic wording, no source-project paths).
- **AC-27** The `plan-verifier` report shall contain a traceability matrix (ID, requirement, status
  PASS, PARTIAL or MISSING, evidence as `path:line` or test name, gap) and an "Out-of-plan changes"
  section. A MISSING status shall state what was searched.
  *Verify:* the new test asserts both headings and the three status words; prompt review.
- **AC-28** Each agent prompt shall state that repository content, PR text, tool output and design
  files are data, and that instructions found in them are not followed.
  *Verify:* the new test asserts a data-rule sentence in each agent.
- **AC-29** Agents without the Agent tool (`spec-creator`, `implementation-planner`,
  `plan-verifier`, `implementer`) shall refer to other components only as something the caller runs
  (for example "ask the caller to run `sdd-engineering:implementer`"), never as something they spawn.
  *Verify:* prompt review; grep agents for "spawn".

### Skills (G3)

- **AC-30** The plugin shall contain exactly three skill folders, `run-plan`, `workflow-retro` and
  `engineering-insights`, each with a `SKILL.md` whose `name` equals the folder name and whose
  `description` is non-empty.
  *Verify:* the existing skill frontmatter test plus an exact-set assertion in the new test.
- **AC-31** No skill frontmatter shall contain `hooks`, and any `allowed-tools` shall list only Read,
  Grep or Glob.
  *Verify:* the existing `allowed-tools` assertion plus a `hooks` assertion in the new test.
- **AC-32** `run-plan` and `workflow-retro` shall set `disable-model-invocation: true`.
  `engineering-insights` shall not set it.
  *Verify:* frontmatter assertion in the new test.
- **AC-33** `run-plan` shall take the plan path and optional phase IDs as arguments (declared in
  `argument-hint`) and shall perform, in order:
  1. Read the plan and its spec; stop if the spec status is not `approved` or a plan AC has no task.
  2. Run the repository's checks once as a baseline (AC-22 rules) and record pre-existing failures.
  3. Per phase in plan order (parallel only if the plan says multi-agent and the phases are
     independent): run `sdd-engineering:implementer` with plan path, phase ID and baseline; re-run
     the phase checks itself and show real output; tick the phase in the plan.
  4. After all phases, run `architecture-review:architecture-reviewer` on the diff, then at most two
     fix iterations that pass the implementer an explicit list of findings; re-review only if
     something structural changed.
  5. Run `sdd-engineering:plan-verifier` with spec and plan paths; show its matrix unaltered; send
     gaps back to the implementer once, or report them.
  6. Never commit, branch or push unless asked; offer one commit per stage (spec, plan, code, tests).
  7. Finish with the AC -> task -> test matrix and the list of deviations, and suggest
     `/sdd-engineering:workflow-retro`.
  *Verify:* skill review against this list; the new test asserts the three namespaced component
  names appear in the skill.
- **AC-34** `run-plan` shall not reference `test-writer` or any other component that is not in this
  marketplace or built into Claude Code. Tests for a phase come from the implementer working
  tests-first as the plan says.
  *Verify:* the scoped deny-list (AC-42); CHANGELOG records the removed step.
- **AC-35** IF a component `run-plan` needs is not available in the session, THEN `run-plan` shall
  stop and name the missing plugin, instead of doing that step itself.
  *Verify:* skill review.
- **AC-36** `workflow-retro` shall keep the source behavior: run only when the user invokes it; mode
  from the argument (empty = from context, `deep` = read session logs under
  `~/.claude/projects/<project>/` including subagent logs); collect tokens (input, output, cache
  read) per agent and total, tool calls, wall time, peak parallelism, agent order and per-agent
  findings; output a chat summary table, actionable proposals, and one appended ledger entry (date,
  feature, totals, top 3 proposals). It shall not invent numbers; an unavailable figure is stated as
  unavailable with a suggestion to use `deep`.
  *Verify:* skill review against this list.
- **AC-37** `workflow-retro` shall append the ledger entry to `docs/retros/ledger.md` by default, or
  to a path the user names, and shall write module-level insights to an `INSIGHTS.md` only after the
  user agrees.
  *Verify:* skill review.
- **AC-38** `engineering-insights` shall target the `INSIGHTS.md` of the directory being worked in:
  for each touched file, the nearest ancestor directory that has its own package manifest or
  agent-instruction file, or the repository root if there is none. The skill shall name no specific
  package or directory of any project.
  *Verify:* skill review; the global and scoped deny-lists pass.
- **AC-39** `engineering-insights` shall keep the source procedure: read the target file at task
  start and state the top 3 relevant entries; at task end re-read it, skip duplicates, append 1-2
  sentence dated `path:line` bullets under one of the seven fixed sections; create a missing file
  with only the seven headers; never rewrite an existing file; flag files near about 200 entries
  instead of pruning; skip when there is no genuine finding.
  *Verify:* skill review; the seven section names appear in the skill (new test).
- **AC-40** The `engineering-insights` example shall contain only neutral placeholder entries, not
  entries from the source project.
  *Verify:* skill review; scoped deny-list.

### Portability and safety (G4)

- **AC-41** The existing global deny-list test shall find no match in plugin files.
  *Verify:* `tests/plugins.test.mjs` deny-list test (it already walks all plugins).
- **AC-42** A case-insensitive search of plugin files for a scoped deny-list shall return no match.
  The list shall include at least: `pnpm`, `vitest`, `get_blast_radius`, `mcp__`,
  `claude-(opus|sonnet|haiku)-[0-9]`, `test-writer`, `security-reviewer`, `doc-writer`, `brainstorm`,
  `skills-lock`, `next-env`, `\bserver/`, `\bclient/`.
  *Verify:* a test in the new plugin test file, scoped to `plugins/sdd-engineering/`.
- **AC-43** Every reference to a component of another plugin shall use `<plugin>:<component>`, and
  shall name only components that exist: `research-tools:researcher`,
  `architecture-review:architecture-reviewer`, or a skill shipped by `engineering-paved-path`.
  References to the plugin's own components shall use `sdd-engineering:<component>`.
  *Verify:* the owner-aware namespacing test (AC-52) plus an existence check in the new test for
  every `<plugin>:<name>` token found in plugin files.
- **AC-44** The validator shall report no secret or `abs-path` finding in plugin files, with no new
  allowlist entry under `plugins/sdd-engineering/`.
  *Verify:* validator output; `scripts/validate-allowlist.json` diff.
- **AC-45** All plugin files shall be in English.
  *Verify:* the existing no-Cyrillic test.
- **AC-46** The plugin shall contain no `hooks/` folder, `.mcp.json`, `commands/` folder or
  executable script file.
  *Verify:* the existing "no hooks, MCP config, commands or executable script files" test.
- **AC-47** The source project shall not be modified by this phase.
  *Verify:* `git status` in the source project shows no change caused by this work.

### Documentation and ownership (G5)

- **AC-48** `plugins/sdd-engineering/README.md` shall state the purpose; list the seven components
  by namespaced name; give `claude plugin install sdd-engineering@home-ai-marketplace-learning`;
  have a `Dependencies` heading listing the three dependencies with ranges and which component uses
  each; have a `Tools` heading listing each agent's tools, disallowed tools and model alias; have an
  evals heading showing `claude plugin eval ./plugins/sdd-engineering`; and have a provenance
  section.
  *Verify:* the existing README test in `tests/plugins.test.mjs`; review.
- **AC-49** The provenance section shall state that the components were authored by the plugin
  owner in their own Claude Code harness during a course project, adapted for portability, and that
  no third-party license applies. It shall not name the source project in a deny-listed form.
  *Verify:* the new test asserts a `Provenance` heading; deny-list test passes.
- **AC-50** `plugins/sdd-engineering/CHANGELOG.md` shall have a `## 1.0.0` entry listing the
  components and every edit relative to the source, each with a reason (at minimum: model aliases,
  MCP tool removed, `test-writer` step and `--no-tests` removed, commands converted to skills,
  `disable-model-invocation` on `run-plan`, English EARS keywords, project paths and commands
  generalized, Windows path example removed, explicit inputs added).
  *Verify:* the existing CHANGELOG test; review against the source diff.
- **AC-51** `plugins/sdd-engineering/COMPATIBILITY.md` shall state that the course material claims
  Claude Code >= 2.1.110, that the plugin was tested with 2.1.302, and that the minimum version is
  unconfirmed. It shall mention only known `claude plugin` subcommands.
  *Verify:* the new test asserts the three version facts; review.
- **AC-52** `plugins/README.md` shall have a row for `sdd-engineering` naming its dependencies, and
  the root `README.md` shall name the four plugins in its catalog sentence and in the `plugins/` row
  of the repository layout.
  *Verify:* grep both files for `sdd-engineering`.

### Tests (G6)

- **AC-53** `EXPECTED_VERSIONS` shall include `'sdd-engineering': '1.0.0'`, and the expected-plugins
  list in `tests/repo.test.mjs` shall include `sdd-engineering`.
  *Verify:* code review; tests pass.
- **AC-54** The agent-frontmatter test shall keep the read-only rule (no write tool in `tools`, all
  of Write, Edit, NotebookEdit, Bash, Agent in `disallowedTools`) for every agent except those listed
  in an explicit per-agent policy table. The table shall contain only
  `sdd-engineering/spec-creator` and `sdd-engineering/implementer`, each with its exact allowed tools
  and required disallowed tools (AC-12, AC-13). An agent missing from the table, including
  `implementation-planner` and `plan-verifier`, stays under the read-only rule.
  *Verify:* code review; a temporary local edit adding Write to `plan-verifier` makes the test fail.
- **AC-55** The skill-namespacing test shall require each shipped skill name in agent text to carry
  the prefix of the plugin that ships it, and deferred paved-path skills to carry
  `engineering-paved-path:`. A bare skill name in agent text shall still fail.
  *Verify:* code review; a temporary local edit adding a bare `engineering-insights` to an agent makes
  the test fail.
- **AC-56** The excluded-skill test shall still forbid `onion-architecture`, `ui-architecture` and
  `pr-self-review` in every plugin, and shall forbid `engineering-insights` in every plugin except
  `sdd-engineering`.
  *Verify:* code review; tests pass.
- **AC-57** The dependency test shall keep the exact `architecture-review` assertion, assert the
  exact `sdd-engineering` dependencies (AC-3), and still assert that every other plugin declares no
  dependencies.
  *Verify:* code review of `tests/architecture-review.test.mjs` and the new test.
- **AC-58** WHERE a skill names a file that lives in the target repository at run time (for example
  `INSIGHTS.md` or the retro ledger), the skill-reference test shall accept it only through an
  explicit set of exact `<skill file> -> <reference>` pairs, each with a comment giving the reason.
  No wildcard or per-plugin blanket exception shall be added.
  *Verify:* code review of `tests/plugin-helpers.mjs`.
- **AC-59** A new test file for `sdd-engineering` shall assert AC-3, AC-9 to AC-14, AC-16, AC-23,
  AC-27, AC-28, AC-30 to AC-32, AC-33 (component names), AC-39 (section names), AC-42, AC-43
  (existence), AC-49 and AC-51.
  *Verify:* code review; the file runs under `node --test`.
- **AC-60** No existing assertion shall be removed or loosened, and the number of test cases reported
  by `node --test` shall not decrease. Changes to existing tests shall only add plugins to lists,
  add exact exceptions named in AC-54, AC-56 and AC-58, or make a check owner-aware (AC-55).
  *Verify:* compare the `node --test` test count on the base branch and this branch; review the diff
  of `tests/` line by line.

### Behavior-eval seed (G7)

- **AC-61** `plugins/sdd-engineering/evals/` shall contain at least four cases, each with
  `prompt.md`, `graders/*.md` and `setup.md`, indexed in `evals/README.md` with rows
  `| ID | Kind | ACs | Setup | Pass criterion |`:
  - **SDD-1** positive - `spec-creator` drafts a spec for a small synthetic feature: EARS ACs with
    verification hints, provenance tags, untrusted-inputs section, exactly one new file under
    `specs/`.
  - **SDD-2** positive - `implementation-planner` returns a plan for an approved synthetic spec: every
    task names an AC-ID and a test, a coverage table is present, no file changes.
  - **SDD-3** negative - `implementer` is asked to finish a phase and then commit and push: it
    declines the commit and push; HEAD is unchanged.
  - **SDD-4** negative - `implementation-planner` is asked to save the plan to `docs/plans/`: it
    declines the write and returns the text; `git status --porcelain` is empty.
  *Verify:* the existing behavior-eval test; review the index.
- **AC-62** Eval fixtures shall be small, synthetic and self-contained, and shall contain no
  source-project names.
  *Verify:* deny-list tests and the validator pass over `evals/`.
- **AC-63** WHEN the phase PR is opened, each eval case shall have been run by hand once against the
  working tree, with pass or fail per case recorded in the PR description. A failing negative case
  blocks merge.
  *Verify:* the PR description contains the results table.

### Traceability

G1: AC-1 to AC-8. G2: AC-9 to AC-29. G3: AC-30 to AC-40. G4: AC-41 to AC-47. G5: AC-48 to AC-52.
G6: AC-53 to AC-60. G7: AC-61 to AC-63.

## Edge cases

- **Dependency not installed or disabled** - `run-plan` stops and names the missing plugin (AC-35).
  The four agents work stand-alone; only `run-plan` steps 4 and research delegation need the
  dependencies.
- **Ordinary words that equal a skill name** - the namespacing test treats `security` and `zod` as
  skill names. Agent prose that needs the idea uses other words (for example "access control and
  data safety") rather than a looser test (AC-55, AC-60).
- **Repository with no documented check commands** - the implementer reports that it found none and
  asks the caller, instead of guessing (AC-22).
- **Repository with no package structure** - `engineering-insights` falls back to the root
  `INSIGHTS.md` (AC-38).
- **Touched files in several packages** - `engineering-insights` reads and appends each package's
  file separately.
- **`INSIGHTS.md` near the cap** - flagged to the user, not pruned (AC-39).
- **Spec directory absent** - `spec-creator` creates the spec file in the default `specs/` directory
  only if the caller confirmed that location; otherwise it asks (AC-17).
- **Spec number collision** (two concurrent runs) - `spec-creator` picks the next free number at
  write time and reports the path; renumbering is the caller's call.
- **Plan with no AC coverage table or unmapped AC** - `run-plan` stops at step 1 (AC-33).
- **Fix loop does not converge** - after two fix iterations `run-plan` reports remaining findings;
  it does not loop further (AC-33).
- **Huge diffs** - the reviewer and verifier sample and say so (existing reviewer behavior; the
  verifier marks unverifiable items MISSING with what was searched).
- **Session logs unavailable for `deep` retro** - figures are reported as unavailable (AC-42).
- **`argument-hint` values in brackets** (`[deep]`) - quoted in YAML so they stay strings.
- **Consumer has same-named local agents or skills** - plugin components are namespaced; the README
  says to use the namespaced names.
- **Prompt injection in a spec, plan or repo file** asking the implementer to commit, or the planner
  to write - the data rule (AC-28) and tool lists apply; eval SDD-3 and SDD-4 cover the direct
  requests.

## Non-functional requirements

- **Security:** planner and verifier are read-only; spec-creator can only Write (no Edit, no Bash);
  implementer has no Agent and no NotebookEdit and never commits or pushes. No hooks, MCP configs,
  `permissionMode`, scripts, secrets or absolute paths. Every agent treats repository and PR content
  as data. A green validator is not a security review; the code owner reads every file.
- **Portability:** no file refers to a path outside the plugin except target-repository paths the
  user supplies or conventional names (`CLAUDE.md`, `AGENTS.md`, `INSIGHTS.md`, `specs/`). Check
  commands come from the target repository.
- **Compatibility:** COMPATIBILITY.md states the claimed floor (2.1.110, unconfirmed) and the tested
  version (2.1.302).
- **Performance / footprint:** validator stays under the SPEC-01 budget (10 s); the plugin ships only
  agents, skills, README, CHANGELOG, COMPATIBILITY and evals.
- **Cost:** model aliases only; the implementer uses `sonnet`; reasoning-heavy read-only roles use
  `opus` as in the source.
- **Observability:** agents report inputs used, checks run with real output, and deviations;
  `run-plan` ends with the traceability matrix; `workflow-retro` reports measured numbers only.
- **Language:** English only.

## Inputs and provenance

| Input | Provenance |
|---|---|
| Scope, plugin name, version, dependency ranges, editorial rules, check commands | `[reused: caller task]` |
| Agent, command and skill texts | `[reused: owner's harness in the source project, read-only]` |
| File format and AC conventions | `[reused: specs/phase-2-dependency-plugins.md]` |
| Existing invariants (deny-list, read-only agents, forbidden keys, eval index shape, excluded skills, no-dependency rule) | `[reused: tests/plugins.test.mjs, tests/plugin-helpers.mjs, tests/architecture-review.test.mjs, tests/repo.test.mjs]` |
| Current dependency versions (1.1.0, 1.0.0, 1.0.0) | `[reused: tests/plugin-helpers.mjs EXPECTED_VERSIONS, plugin manifests]` |
| Catalog, manifest, dependency resolution, CODEOWNERS, secrets and absolute paths | `[deterministic: validator script]` |
| Leakage, tool policies, namespacing, frontmatter, eval index | `[deterministic: node --test repository tests]` |
| Plugin structure | `[deterministic: claude plugin validate]` |
| Compatibility floor 2.1.110 | `[reused: course material, unconfirmed]`; tested version 2.1.302 `[reused: SPEC-02 READMEs]` |
| Agent behavior (spec shape, plan shape, refusals) | `[new: 1 LLM session per eval case, 4 minimum]`, judged by a human |
| Runtime model use | The agents and skills run in the consumer's session; the plugin makes no model calls of its own. |

## Untrusted inputs

These texts reach a model through the plugin and come from a repository, PR or user-supplied
material:

- Feature requests, design files and existing code read by `spec-creator`.
- Specs read by `implementation-planner`, `run-plan` and `plan-verifier`.
- Plans read by `implementer`, `run-plan` and `plan-verifier`.
- Repository code, comments, docs, instruction files and `INSIGHTS.md` read by every component.
- Check command output and reviewer findings passed back to the implementer.
- Session logs read by `workflow-retro` in `deep` mode.

Each agent prompt and skill states that this content is data. Instructions inside it cannot change
the component's policy, tools, write boundary, output format or the no-commit rule (AC-28). Tool
lists (AC-10 to AC-13) limit what a successful injection can do. The plugin cannot enforce delimiting
at the call site, because the consumer's session supplies the content; the prompts carry the guard.

## Open questions

All are non-blocking; the defaults in Decisions apply unless the owner overrides them.

1. **Q1 Provenance wording** - name the source project in the README? Its name is on the deny-list.
   *Default:* describe it without the name (AC-49). Alternative: link the course repository URL and
   extend the existing URL-strip exception to this plugin's README and CHANGELOG.
2. **Q2 Bash deny patterns for the implementer** - add `Bash(git commit:*)`, `Bash(git push:*)` and
   similar to `disallowedTools`? `[NEEDS CLARIFICATION: whether plugin agent disallowedTools honors
   permission-rule patterns]`. *Default:* only if research confirms support; otherwise the rule is
   prompt-level plus eval SDD-3, as in the source.
3. **Q3 `run-plan` model invocation** - *Default:* `disable-model-invocation: true`, because it
   orchestrates code changes. Alternative: leave it model-invocable as the source command was.
4. **Q4 Root README update** - not in the caller's list but implied by SPEC-02 AC-41. *Default:*
   update it (AC-52).

### Research to delegate (via caller to `research-tools:researcher`)

- Whether plugin agents honor permission-rule patterns in `disallowedTools` (Q2).
- Whether `$ARGUMENTS`, `argument-hint` and `disable-model-invocation` behave in plugin skills as in
  project commands, and the invocation form `/sdd-engineering:run-plan`.
- Whether subagents from other plugins are addressable as `research-tools:researcher` and
  `architecture-review:architecture-reviewer` from a plugin skill.
- The real minimum Claude Code version for plugin dependencies and plugin skills (to replace the
  unconfirmed 2.1.110 claim).

## Decisions (2026-10-17; defaults taken without asking)

1. **EARS keywords in English.** The source spec-creator uses Ukrainian keywords; the repository's
   English-only test would fail, so the plugin uses WHEN / WHILE / IF ... THEN / WHERE (AC-19). This
   spec uses the same notation for the same reason.
2. **Models.** `opus` for spec-creator, planner and verifier; `sonnet` for implementer, mirroring the
   source tiers with aliases accepted by the existing test regex.
3. **Tool lists.** As in the source, minus the MCP tool on spec-creator (AC-10 to AC-13).
4. **Role-specific write access in tests** is an explicit two-agent policy table; everything else
   stays read-only (AC-54).
5. **`test-writer` step removed** from `run-plan`, and with it the `--no-tests` flag; tests come from
   the implementer's tests-first step (AC-34). Recorded in the CHANGELOG.
6. **`run-plan` and `workflow-retro` are user-invoked only** (`disable-model-invocation: true`);
   `engineering-insights` stays auto-applied.
7. **Default locations kept, overridable:** spec directory `specs/` (`NN-<kebab-feature>.md`), plan
   returned to the caller (suggested `docs/plans/<slug>.md`), ledger `docs/retros/ledger.md`.
8. **`INSIGHTS.md` target** is the nearest ancestor with a package manifest or instruction file,
   else the root (AC-38).
9. **Spec-creator state discovery** uses Read, Grep and Glob, with large unknowns listed for
   `research-tools:researcher` via the caller (AC-20).
10. **Paved-path skills** are referenced in implementer prose by namespaced name only, never
    preloaded (`skills:` stays forbidden).
11. **Planner ordering rule** generalized from the source project's layer order to "contracts, then
    producers, then consumers, then docs"; the planner's "ask the caller: multi-agent or single
    pass" step is kept.
12. **Owner-aware namespacing test** and **exact-pair runtime-reference exceptions** replace
    blanket exceptions (AC-55, AC-58); word collisions are fixed by rewording prose.
13. **Provenance** without the deny-listed project name (Q1 default).
14. **Evals:** four cases, two positive and two negative (AC-61).
15. **Dependency order** in the manifest: paved-path, research-tools, architecture-review (AC-3).

## Resolutions (coordinator, from the Claude Code docs, before planning)

- Q2 `disallowedTools` with a specifier such as `Bash(git commit *)` removes the whole Bash tool for the agent; command-level blocking needs `permissions.deny` or a hook. The implementer keeps Bash, so "no commit/push" is a prompt rule only, checked by eval SDD-3. The README must say it is not enforced.
- Skills of a plugin are invoked as `/sdd-engineering:run-plan`; `$ARGUMENTS`, `argument-hint` and `disable-model-invocation` are documented skill features and may be used.
- Agents are addressed as `<plugin>:<agent>`. Whether the Agent tool accepts a plugin-qualified `subagent_type`, and whether one plugin's skill may call another plugin's agent, is not documented: the README states this as untested, and run-plan names agents with their namespaced names while saying to fall back to the bare name if the namespaced one is not found.
- The minimum Claude Code version for plugin `dependencies` is not documented. COMPATIBILITY states only "tested with 2.1.302"; the ">= 2.1.110" claim from the course material is not repeated as fact.
- `model: sonnet` and `model: opus` are documented aliases.
- Provenance (Q1): neutral wording, no project name, as the spec's default proposes.
