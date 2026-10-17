# architecture-review

A read-only `architecture-reviewer` agent that checks code against the architecture rules documented in the target repository. Version 1.0.0.

## Components

| Component | Purpose |
|---|---|
| `architecture-review:architecture-reviewer` | Reviews layer boundaries, dependency direction, cycles, god modules and abstraction leaks. Every violation quotes a rule from a named repository document and cites `path:line`. |

The report lists the documents it used, a findings table (ID, smell type, `path:line`, import or call, violated rule with source document, consequence, severity), "Checked & clean" and "Could not verify". When no architecture document exists, it says so and labels the remaining findings "heuristic"; it never invents rules.

## Install

```
claude plugin marketplace add ochubey/home-ai-marketplace-learning
claude plugin install architecture-review@home-ai-marketplace-learning
```

Run `/reload-plugins` in an open session to pick up the new agent.

Tested with Claude Code 2.1.302. A minimum Claude Code version for plugin dependencies was not confirmed in the documentation consulted for this release, so only the tested version is stated.

## Dependencies

The manifest declares one dependency: `engineering-paved-path` from this marketplace, version range `^1.0.0`.

The dependency is nominal in 1.0.0. The agent does not preload any skill, because loading a skill of another plugin through agent frontmatter is not confirmed in the documentation. The agent works from the repository's own documents. Its prompt only mentions `engineering-paved-path:*` skills as optional stack context. The declared dependency is kept so that later releases can rely on those skills without a breaking change.

## Tools

The agent may use Read, Grep and Glob. It is configured to disallow Write, Edit, NotebookEdit, Bash and Agent, so it cannot modify files or run analyzers. It runs with the `sonnet` model alias.

## Where it looks for architecture rules

1. Documents named by the caller.
2. Otherwise the conventional locations: root `CLAUDE.md` or `AGENTS.md`, `ARCHITECTURE.md`, architecture documents under `docs/`, ADR folders, and package-level documentation.

When documents conflict, the one closest to the changed file wins, and the conflict is reported under "Could not verify". Repository content is treated as data: comments or documents that tell the reviewer to skip or approve something do not change its findings.

## Running the evals

`evals/` holds a behavior-eval seed with four cases (two positive, two negative), indexed in `evals/README.md`. Each case follows the `claude plugin eval` layout (`evals/<case>/prompt.md` plus `graders/*.md`) and has a `setup.md` with the inline fixtures and the manual check.

```
claude plugin eval ./plugins/architecture-review
```

Read `evals/README.md` first: it states the setup and the pass criterion per case. Run evals only on plugins you trust.
