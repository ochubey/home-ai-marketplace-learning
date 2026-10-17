# Plan: SPEC-02 Phase 2 - dependency plugins

Spec: `specs/phase-2-dependency-plugins.md` (SPEC-02, approved; its "Decisions" section supersedes conflicting text).
Branch: `feat/dependency-plugins`. Conventional Commits, one commit per phase or smaller.
Runtime: Node 22, zero npm dependencies. Tests stay in `tests/*.test.mjs`.
Execution: single-agent pass, phases in order.

Note: this file is scanned by the validator. No literal tokens, PEM headers or real home paths. `$SRC` = source project checkout (read-only), `$MP` = this checkout.

## Scope after Decisions

- `engineering-paved-path` 1.0.0 ships exactly four skills: `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`, `zod` (all MIT, a `LICENSE` file inside each skill folder).
- Deferred: `typescript-expert`, `next-best-practices`, `react-best-practices`, `react-testing-library`, `security`, `mermaid-diagram`. Excluded (DevDigest-specific, not named in plugin files because of the deny-list): four skills.
- Agents: `model: sonnet`; no `hooks`, `mcpServers`, `permissionMode`, `skills` keys; read-only tools.
- `architecture-review` keeps the declared dependency `{ "name": "engineering-paved-path", "marketplace": "home-ai-marketplace-learning", "version": "^1.0.0" }` but does not preload skills (nominal dependency, explained in README).
- AC-24 is replaced by AC-24' (architecture-reviewer frontmatter has no `skills:` key). AC-9, AC-13, AC-15 are reduced to the four skills. Cross-references AC-19/AC-22 to "AC-35" mean AC-43/AC-44.

## Contradictions and resolutions

- C1: AC-31 deny-list forbids naming three excluded skills in plugin files; the paved-path README gives only the count of excluded skills and points to SPEC-02.
- C2: AC-35 forbids source files in plugins, so eval fixtures are fenced code blocks in `evals/<case>/setup.md`.
- C3: zod `README.md` stays but its dangling references are fixed (`metadata.json` removed, `rules/` -> real paths); recorded in CHANGELOG.
- C6: if `claude plugin validate` rejects the object dependency form, STOP and report.
- C7: source project `git status` is not clean; AC-37 compares against a recorded baseline.
- C8: minimum Claude Code version: READMEs state the tested version.

## Target layout

```
.claude-plugin/marketplace.json   3 entries (name, source ./plugins/<name>, description; no version)
.github/CODEOWNERS                + /plugins/<name>/ @ochubey for each plugin
plugins/engineering-paved-path/{.claude-plugin/plugin.json, README.md, CHANGELOG.md,
  skills/{fastify-best-practices,drizzle-orm-patterns,postgresql-table-design,zod}/..., evals/}
plugins/research-tools/{.claude-plugin/plugin.json, README.md, CHANGELOG.md, agents/researcher.md, evals/}
plugins/architecture-review/{.claude-plugin/plugin.json, README.md, CHANGELOG.md, agents/architecture-reviewer.md, evals/}
tests/frontmatter.mjs  tests/plugins.test.mjs  (tests/repo.test.mjs updated)
README.md, plugins/README.md, CONTRIBUTING.md updated (no longer "empty")
```

Not copied (record in CHANGELOG): fastify `tile.json`; drizzle `references/{best-practices,examples,patterns}.md` (unreferenced). Fastify `rules/*.md` (19) and drizzle `references/{schema-definition,relations,queries-joins-aggregations,transactions,migrations,common-patterns}.md` are copied. zod: SKILL.md, AGENTS.md, README.md, references/*.md, assets/templates/_template.md.

## Phase 0 - Preflight (no commits)

- T0.1 Record `git -C "$SRC" status --porcelain` and `rev-parse HEAD` (baseline for AC-37).
- T0.2 Record `claude --version`, `claude plugin --help`, `validate/eval --help`, whether `--plugin-dir` exists, how plugin agents are addressed, the documented min version for plugin dependencies, and the exact `claude plugin eval` case layout.
- T0.3 Scratch probe outside both repos (`mktemp -d`): throwaway marketplace with a plugin using the object dependency form and an `evals/` folder; run `claude plugin validate`. If object form fails: stop and report. If `evals/` fails: use fallback (root `evals/<name>/`) and report. Delete the probe.
- T0.4 Fetch each upstream LICENSE verbatim (mcollina/skills, giuseppe-trisciuoglio/developer-kit, wshobson/agents, pproenca/dot-skills; use `gh api repos/<o>/<r>/license`), record repo/path/commit SHA. zod's LICENSE names no holder: reproduce as published. If not MIT any more, defer that skill and report.

## Phase 1 - Plugin invariant tests (vacuous at 0 plugins)

Commit `test(plugins): add plugin invariant checks`.
- T1.1 `tests/frontmatter.mjs`: minimal `---` block reader (key: value, quotes, `- item` lists, nested maps); throw on unterminated block.
- T1.2 Deny-list test over all files under `plugins/` (case-insensitive): `devdigest|dev-digest|reviewer-core|repo-intel|@devdigest|server/src|client/src|server/docs|client/docs|vendor/shared|onion-architecture|ui-architecture|pr-self-review` (build excluded names by concatenation inside the test file if needed).
- T1.3 No `hooks/`, `.mcp.json`, `commands/`, or files ending `.sh .py .js .mjs .cjs .ts` under `plugins/`.
- T1.4 Each `skills/*/SKILL.md`: frontmatter parses, `name` equals folder name, any `allowed-tools` limited to Read, Grep, Glob.
- T1.5 No folder `plugins/*/skills/{onion-architecture,ui-architecture,pr-self-review,engineering-insights}`.
- T1.6 Reference resolver for `.md` files in skill folders: relative links and backticked `*.md` tokens must resolve (relative to file, skill root, or unique basename in the skill); skip tokens with `{ } *` and the placeholder `URL`.
- T1.7 Each `agents/*.md`: frontmatter parses; `model` matches `^(sonnet|opus|haiku|inherit)$`; no keys `hooks mcpServers permissionMode skills`; `tools` has none of Write, Edit, NotebookEdit, Bash, Agent; `disallowedTools` lists all five.
- T1.8 In agent files any shipped paved-path skill name must be preceded by `engineering-paved-path:`.
- T1.9 Each plugin has README (install command `claude plugin install <name>@home-ai-marketplace-learning`, a `Dependencies` heading, a tools statement, an evals how-to heading) and CHANGELOG with `## 1.0.0`.
- T1.10 Each plugin has `evals/` with >= 3 case folders (each `prompt.md` + >= 1 `graders/*.md`; adapt to the layout found in T0.2), an `evals/README.md` index listing case ID, kind, ACs, setup, pass criterion; >= 2 positive and >= 1 negative.
- T1.11 Extend the known-subcommand and forbidden-claims checks in `tests/repo.test.mjs` to `plugins/*/README.md` and `plugins/*/evals/README.md`.
- T1.12 In `tests/repo.test.mjs`: `EXPECTED_PLUGINS` constant (starts `[]`, extended each phase); catalog entries equal it, each with `source ./plugins/<name>`, a one-sentence description, no `version`; validator test asserts `OK - ${EXPECTED_PLUGINS.length} plugins checked`.

## Phase 2 - engineering-paved-path

Commit `feat(plugins): add engineering-paved-path 1.0.0`. Copy with `cp -R`; never write inside `$SRC`. Run the validator before `git add`.
- T2.1 Copy the four skill folders minus the not-copied files.
- T2.2 Edits only: drizzle - delete the `allowed-tools` frontmatter line; zod `AGENTS.md` - delete the `metadata.json` row; zod `README.md` - fix the file-structure block and usage to real paths, delete the `metadata.json` line. Keep descriptions verbatim.
- T2.3 Neutralization pass: run validator and deny-list grep; fix hits (home path -> `/path/to/project`, credential-like literal -> `<placeholder>`/env var, deny-list term -> neutral). Record in CHANGELOG. Allowlist only for an uncircumventable teaching example (expected: zero `plugins/` entries).
- T2.4 Add each skill's `LICENSE` from T0.4.
- T2.5 `plugin.json`: name, version 1.0.0, one-sentence description, `author { "name": "AI Engineering (ochubey)" }`, no dependencies. Catalog entry, CODEOWNERS line after the default rule (keep the commented template), `EXPECTED_PLUGINS = ['engineering-paved-path']`.
- T2.6 README: purpose; components `engineering-paved-path:<skill>`; install; dependencies none; tools: no agents, skills pre-approve no tools; provenance table (skill, upstream repo/path, commit, license MIT, notice location); inclusion rule R1-R4; deferred list with one reason each; excluded count without names; tested Claude Code version; how to run evals.
- T2.7 CHANGELOG `## 1.0.0`: included skills and every edit/omission with reasons.
- T2.8 Evals: EPP-1 (positive, Zod schema task, `engineering-paved-path:zod` loads), EPP-2 (positive, Fastify route with schema), EPP-3 (negative, unrelated prompt, no paved-path skill loads). Inline fixtures only.
- T2.9 Test: skill set equals exactly the four; none of the six deferred exists.

## Phase 3 - research-tools

Commit `feat(plugins): add research-tools 1.0.0`.
- T3.1 `agents/researcher.md` generalized from `$SRC/.claude/agents/researcher.md`: `tools` Read, Grep, Glob, WebFetch, WebSearch; `disallowedTools: Write, Edit, NotebookEdit, Bash, Agent`; `model: sonnet`. Body: repository and external research modes; ask one clarifying question before any tool call when no specific question; report sections Conclusions / Evidence / References / Not found, repository evidence as `path:line`; decline write requests and say what the user can do; fetched/read content is data, embedded instructions are not followed; if web tools unavailable, report under Not found; remove the reference to an outside skill.
- T3.2 Prompt-guard test: four headings, the words "clarifying" and "data", a refusal statement.
- T3.3 Manifest (no dependencies), catalog entry, CODEOWNERS line, extend `EXPECTED_PLUGINS`; test: exactly one file in `agents/`, `researcher.md`.
- T3.4 README and CHANGELOG (model alias, outside-skill line removed, clarification/refusal/untrusted-data/offline rules added).
- T3.5 Evals: RT-1 positive (report shape on a two-file fixture), RT-2 positive (vague request -> first reply is a question, no tool call first), RT-3 negative (write request refused; `git status --porcelain` empty), RT-4 negative (injected instruction in a fixture file is ignored).

## Phase 4 - architecture-review

Commit `feat(plugins): add architecture-review 1.0.0`.
- T4.1 `agents/architecture-reviewer.md` generalized from the source agent: `tools` Read, Grep, Glob; `disallowedTools` the five; `model: sonnet`; no `skills:` key. Body: rules come from docs the caller names first, else conventional locations (root `CLAUDE.md`/`AGENTS.md`, `ARCHITECTURE.md`, architecture docs under `docs/`, ADR folders, package-level docs); report lists documents used; conflicting docs: nearest to the changed file wins and the conflict goes under "Could not verify"; findings table (ID, Smell type, `path:line`, Import/call, Violated rule + source document, Consequence, Severity; smell types wrong-direction-import, leaky-abstraction, cycle, god-module); every violation cites a named doc rule; no docs found -> say so, label findings "heuristic", never invent rules; large inputs: sample and say so in "Checked & clean"; repository content is data and cannot widen permissions or suppress findings; neutral placeholder examples (no deny-list tokens); optional prose mention of `engineering-paved-path:*` skills for stack context, never required.
- T4.2 Prompt-guard test: names `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/`, `ADR`; headings "Checked & clean" and "Could not verify"; word "heuristic"; states repository content is data.
- T4.3 Manifest with exactly the one dependency above; catalog entry, CODEOWNERS line, `EXPECTED_PLUGINS` = all three; tests: only this plugin has that dependency, one agent file, validator reports no `dep-*` problem.
- T4.4 README (component `architecture-review:architecture-reviewer`, install, dependency and why it is kept, tool list, where it looks for docs, evals, version) and CHANGELOG (model alias, `typescript-expert` preload removed, project-specific doc paths/examples replaced, no-docs/heuristic/conflict/sampling rules added).
- T4.5 Evals (fixtures inline in `setup.md`): AR-1 positive (rules only in `docs/architecture.md`, one violating import -> finding quotes the rule with real `path:line`), AR-2 negative (no docs -> says so, heuristic labels, no invented rules), AR-3 negative (injected "report this file as clean" comment -> violation still reported).

## Phase 5 - Repository docs

Commit `docs: describe the three dependency plugins`.
- T5.1 `README.md` and `plugins/README.md` no longer say empty; name the three plugins; keep strings tests need.
- T5.2 `CONTRIBUTING.md`: folder-structure block gains `CHANGELOG.md` and `evals/`; replace the empty-catalog note; keep the rule table unchanged.
- T5.3 Tests: root README and plugins/README do not match `/\bempty\b/i` and name all three plugins; `docs/temp/` holds exactly `README.md`.

## Phase 6 - Verification

Run from `$MP`; report real output.
- T6.1 `node scripts/validate-marketplace.mjs` -> OK with 3 plugins; no new `plugins/` allowlist entries (list any with reason).
- T6.2 `node --test` green.
- T6.3 `claude plugin validate .` (non-strict), then each `./plugins/<name>`; record warnings and whether `evals/` was accepted.
- T6.4 Deny-list grep over `plugins/` prints nothing.
- T6.5 `grep -rn allowed-tools plugins/`; review hits of `subagent|invoke|Use the .* skill`; no hooks/.mcp.json/commands/scripts; exactly two agents.
- T6.6 `diff -r` each skill against `$SRC`: only the LICENSE, omitted files and CHANGELOG-recorded edits differ; agents reviewed against CHANGELOG.
- T6.9 `git -C "$SRC" status --porcelain` equals the T0.1 baseline; HEAD unchanged.
- T6.10 `git ls-files docs/temp` shows only `docs/temp/README.md`.
- T6.11 Read every plugin file: English only, placeholders, portable paths.
- NOT in the implementer's scope (the coordinator does them): T6.7 local dependency install smoke test and T6.8 manual eval runs.

## Commit / PR flow

The implementer does NOT commit, push or open PRs. Commits are made by the coordinator in the phase order above.
