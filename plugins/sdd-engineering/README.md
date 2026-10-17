# sdd-engineering

A spec-driven development (SDD) workflow for any repository: write a spec, plan it, implement it phase by phase, review it and verify it against the plan. Version 1.0.0.

## Components

Use the namespaced names; they avoid clashes with agents or skills of the same name in your own repository.

| Component | Kind | Purpose |
|---|---|---|
| `sdd-engineering:spec-creator` | agent | Turns a feature request into one spec file with EARS acceptance criteria. Asks what and why, never how. |
| `sdd-engineering:implementation-planner` | agent | Turns an approved spec into a phased plan; every task names an AC-ID and a test. Returns the plan text; does not write files. |
| `sdd-engineering:implementer` | agent | Implements one phase of a plan, tests first, and runs the repository's own checks. |
| `sdd-engineering:plan-verifier` | agent | Read-only check of the code against the plan; returns a PASS, PARTIAL or MISSING traceability matrix. |
| `sdd-engineering:run-plan` | skill | `/sdd-engineering:run-plan <plan path> [phase ids]` drives implement, review, fix and verify. User-invoked only. |
| `sdd-engineering:workflow-retro` | skill | `/sdd-engineering:workflow-retro [deep]` reports measured tokens and agent handoffs of a finished run. User-invoked only. |
| `sdd-engineering:engineering-insights` | skill | Reads and appends the `INSIGHTS.md` of the directory you work in. Applies automatically. |

Typical flow: `spec-creator`, then you approve the spec, then `implementation-planner`, then you save the plan, then `/sdd-engineering:run-plan <plan path>`.

## Install

```
claude plugin marketplace add ochubey/home-ai-marketplace-learning
claude plugin install sdd-engineering@home-ai-marketplace-learning
```

Run `/reload-plugins` in an open session to pick up the new components. See [COMPATIBILITY.md](COMPATIBILITY.md) for the tested Claude Code version.

## Dependencies

The manifest declares three dependencies from this marketplace:

| Dependency | Range | Used by |
|---|---|---|
| `engineering-paved-path` | `^1.1.0` | `sdd-engineering:implementer` may load its skills by namespaced name for stack guidance. Nothing is preloaded. |
| `research-tools` | `^1.0.0` | `sdd-engineering:spec-creator` and `sdd-engineering:implementation-planner` list large unknowns for the caller to hand to `research-tools:researcher`. |
| `architecture-review` | `^1.0.0` | `sdd-engineering:run-plan` runs `architecture-review:architecture-reviewer` on the diff. |

The four agents work on their own. Only `run-plan` needs the review agent and stops, naming the missing plugin, when it is not available.

## Tools

| Agent | Tools | Disallowed tools | Model |
|---|---|---|---|
| `spec-creator` | Read, Grep, Glob, Write | Edit, NotebookEdit, Bash, Agent | `opus` |
| `implementation-planner` | Read, Grep, Glob | Write, Edit, NotebookEdit, Bash, Agent | `opus` |
| `implementer` | Read, Grep, Glob, Write, Edit, Bash | NotebookEdit, Agent | `sonnet` |
| `plan-verifier` | Read, Grep, Glob | Write, Edit, NotebookEdit, Bash, Agent | `opus` |

The planner and the verifier cannot change files. The spec creator can only write; its prompt limits it to one spec file in the spec directory (default `specs/`).

The implementer keeps Bash to run checks, and Claude Code does not offer a command-level block in an agent's tool list: a specifier such as `Bash(git commit *)` in `disallowedTools` would remove the whole Bash tool. So the rule that the implementer never commits, branches or pushes is a prompt rule only. It is not enforced by the plugin; eval SDD-3 checks it by hand. If you need enforcement, add a deny rule to your own Claude Code permissions or a hook in your own settings.

## Cross-plugin calls

`run-plan` names `architecture-review:architecture-reviewer` and `sdd-engineering:implementer`. Whether the Agent tool accepts a plugin-qualified agent name from inside another plugin's skill is untested in this release, so `run-plan` tells the session to fall back to the bare agent name if the namespaced one is not found.

## Running the evals

`evals/` holds a behavior-eval seed with four cases (two positive, two negative), indexed in `evals/README.md`. Each case follows the `claude plugin eval` layout and has a `setup.md` with the inline fixture and the manual check.

```
claude plugin eval ./plugins/sdd-engineering
```

Read `evals/README.md` first. Run evals only on plugins you trust.

## Provenance

The components were authored by the plugin owner in their own Claude Code harness during a course project, then adapted for portability: project names, paths, commands and tools were replaced by generic wording. No third-party license applies to this content. [CHANGELOG.md](CHANGELOG.md) lists every edit made during the adaptation, with the reason.
