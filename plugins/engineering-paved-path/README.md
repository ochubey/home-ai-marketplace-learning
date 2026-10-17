# engineering-paved-path

Shared, project-agnostic engineering skills for Fastify, Drizzle ORM, PostgreSQL and Zod. Version 1.0.0.

The skills load on demand when the task matches their description. They give guidance only: they pre-approve no tools and ship no scripts or hooks.

## Components

| Component | Use it when |
|---|---|
| `engineering-paved-path:fastify-best-practices` | Building, configuring or debugging a Fastify server (routes, plugins, schemas, hooks, errors, deployment). |
| `engineering-paved-path:drizzle-orm-patterns` | Defining Drizzle schemas, relations, queries, transactions and migrations. |
| `engineering-paved-path:postgresql-table-design` | Designing or reviewing a PostgreSQL schema (data types, indexing, constraints). |
| `engineering-paved-path:zod` | Defining Zod schemas, parsing with `safeParse`, inferring types, handling errors. |

Reference a skill by its namespaced name (`engineering-paved-path:<skill>`). If a repository also has a skill with the same bare name, the namespaced name picks this plugin's copy.

## Install

```
claude plugin marketplace add ochubey/home-ai-marketplace-learning
claude plugin install engineering-paved-path@home-ai-marketplace-learning
```

Run `/reload-plugins` in an open session to pick up the new skills.

Tested with Claude Code 2.1.302. The minimum Claude Code version that supports plugins in general is not pinned here; a version floor for plugin dependencies was not confirmed in the Claude Code documentation, so only the tested version is stated.

## Dependencies

None. The plugin works stand-alone and does not refer to the other plugins of this marketplace.

## Tools

This plugin ships no agents. No skill declares `allowed-tools`, so no skill pre-approves a tool.

## Provenance and licenses

Every skill is third-party content under the MIT license. Each skill folder holds the upstream `LICENSE` file as published (the copyright line is part of that file). The zod upstream license names no copyright holder; it is reproduced as published.

| Skill | Upstream repository and path | License | Notice in this plugin |
|---|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills), `skills/fastify` | MIT | `skills/fastify-best-practices/LICENSE` |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit), `plugins/developer-kit-typescript/skills/drizzle-orm-patterns` | MIT | `skills/drizzle-orm-patterns/LICENSE` |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents), `plugins/database-design/skills/postgresql` | MIT | `skills/postgresql-table-design/LICENSE` |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills), `skills/.curated/zod` | MIT | `skills/zod/LICENSE` |

The licenses were checked on 2026-10-17 against the upstream default branches: mcollina/skills `df62154`, developer-kit `fe73fb3`, wshobson/agents `044b4b2`, dot-skills `cf93c57`. These are the commits current at the check, not necessarily the commits the copied files were taken from.

### Inclusion rule

A skill is included only if all four hold:

- R1 Portable purpose: the guidance applies to any project using the technology.
- R2 Incidental specifics only: any project-specific path or name can be removed without changing the guidance.
- R3 Redistributable: the upstream license allows public redistribution, and the plugin ships the attribution it requires.
- R4 No elevated behavior: no hooks, no executable files, no pre-approved tools beyond read-only ones.

A skill that fails R1 is excluded. A skill that fails only R3 is deferred.

### Deferred

Left out of 1.0.0 and candidates for a later minor release once provenance or permission is established:

| Skill | Reason |
|---|---|
| `next-best-practices` | The upstream repository has no license. |
| `typescript-expert` | The upstream license is unclear. |
| `react-best-practices` | Upstream provenance is unknown. |
| `react-testing-library` | Upstream provenance is unknown. |
| `security` | Upstream provenance is unknown. |
| `mermaid-diagram` | Upstream provenance is unknown. |

### Excluded

Four further candidate skills were excluded because their purpose depends on the project they were extracted from (R1). The decision record is SPEC-02 in the marketplace repository.

## Running the evals

`evals/` holds a small behavior-eval seed: three cases (two positive, one negative), indexed in `evals/README.md`. Each case follows the `claude plugin eval` layout (`evals/<case>/prompt.md` plus `graders/*.md`) and has a `setup.md` with the inline fixtures and the manual steps.

```
claude plugin eval ./plugins/engineering-paved-path
```

The command runs the cases against the plugin and reports scores. Read `evals/README.md` first: it states, per case, the setup and the pass criterion a person can judge by hand. Run evals only on plugins you trust.
