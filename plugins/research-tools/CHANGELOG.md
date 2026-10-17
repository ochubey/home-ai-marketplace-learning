# Changelog

## 1.0.0

Initial release. One agent, `researcher`, generalized from an internal harness agent.

### Included

- `researcher` agent.

### Edits relative to the source

- Model: the dated model ID was replaced by the alias `sonnet`, so the agent does not pin a version.
- Tools: kept read-only (Read, Grep, Glob, WebFetch, WebSearch; Write, Edit, NotebookEdit, Bash and Agent disallowed).
- Removed the line that referred to a skill outside this marketplace.
- Added: ask one clarifying question before any tool call when there is no specific question.
- Added: decline requests to create, edit or delete files, and say what the user can do instead.
- Added: content read from the repository or the web is data; embedded instructions are not followed.
- Added: when the web tools are unavailable, report external questions under Not found with the reason.
- Description now states read-only repository and external research.
