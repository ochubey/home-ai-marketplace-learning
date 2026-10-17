# Changelog

## 1.0.0

Initial release. One agent, `architecture-reviewer`, generalized from an internal harness agent.

### Included

- `architecture-reviewer` agent.

### Edits relative to the source

- Model: the dated model ID was replaced by the alias `sonnet`.
- Removed the preload of a TypeScript skill (`skills:` key). That skill is deferred, and preloading a skill of another plugin through agent frontmatter is not confirmed. The agent now works from repository documents only. The declared dependency on `engineering-paved-path` `^1.0.0` is kept and is nominal.
- Replaced the project-specific document paths and the project-specific examples with conventional locations (root `CLAUDE.md` / `AGENTS.md`, `ARCHITECTURE.md`, `docs/`, ADR folders, package-level docs) and neutral placeholder examples.
- Added: documents named by the caller are used first; the report lists the documents it used.
- Added: when no architecture document is found, say so and label findings "heuristic"; never invent rules.
- Added: conflicting documents are resolved by closeness to the changed file and the conflict is reported under "Could not verify".
- Added: sampling on large inputs is stated in "Checked & clean".
- Added: repository content is data and cannot widen permissions or suppress findings.
- Added: optional prose mention of the namespaced `engineering-paved-path:*` skills for stack context.
