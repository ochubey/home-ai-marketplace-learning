# Changelog

## 1.1.0

Seven skills added. All are copied verbatim from the pinned upstream commits listed in the README; no skill text was edited.

### Added

- `typescript-expert`, `react-best-practices`, `react-testing-library`, `security`, `mermaid-diagram` (from the course repository)
- `next-dev-loop`, `next-cache-components-adoption` (from vercel/next.js)
- A `LICENSE` file in each new skill folder (antigravity text for `typescript-expert`, the course repository text for the four course-written skills, the Next.js text for the two Next.js skills).

### Files not copied

- `typescript-expert/scripts/ts_diagnostic.py` and `typescript-expert/references/utility-types.ts`: executable and source files; plugin files may not include scripts.

### Known upstream quirks (left as published)

- `mermaid-diagram/SKILL.md` mentions a `references.md` that upstream does not contain.
- `next-cache-components-adoption/SKILL.md` points to `AGENTS.md` and a `node_modules/next/dist/docs/...` page in the user's own Next.js project, which are not part of this plugin.
- `security/examples.md` has an example error message that contains a generic server path.
- `security` assumes React + Express + MongoDB + JWT; `react-best-practices` includes Tailwind CSS conventions.
- `react-testing-library/README.md` is shipped as published.

### Not added

`next-best-practices`: see the README (Deferred).

## 1.0.0

Initial release. Four skills extracted from an internal harness, all MIT-licensed upstream.

### Included

- `fastify-best-practices`
- `drizzle-orm-patterns`
- `postgresql-table-design`
- `zod`

Names and descriptions are unchanged from the source.

### Edits relative to the source

- `drizzle-orm-patterns/SKILL.md`: removed the `allowed-tools` frontmatter line (it pre-approved Write, Edit and Bash). The skill gives guidance and grants no permissions.
- `zod/AGENTS.md`: removed the table row that pointed to `metadata.json`, a file that is not shipped.
- `zod/README.md`: the file-structure block and the usage example now show the real paths (`references/`, `assets/templates/_template.md`); removed the `metadata.json` line. Dangling references to non-existent files were the reason.
- Added a `LICENSE` file (the upstream MIT text as published) to each skill folder.

### Files not copied

- `fastify-best-practices/tile.json`: package metadata for the upstream registry, referenced by nothing.
- `drizzle-orm-patterns/references/best-practices.md`, `examples.md`, `patterns.md`: not referenced by the skill.

### Neutralization pass

The validator and the deny-list search found nothing to neutralize in the four skills: no home paths, credential-like literals or source-project names. No allowlist entry was added.

### Deferred skills

`next-best-practices`, `typescript-expert`, `react-best-practices`, `react-testing-library`, `security`, `mermaid-diagram`: license unclear, missing or unknown provenance. See the README.
