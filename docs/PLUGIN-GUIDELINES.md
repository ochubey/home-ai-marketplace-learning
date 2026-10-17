# Plugin guidelines

## What makes a good plugin boundary

One plugin serves one purpose. Decide the boundary with four questions:

- **Audience**: who uses it (all engineers, one team, one role)? A plugin for everyone and a plugin for one team should be separate.
- **Permissions**: what does it need (tools, MCP servers, hooks)? Keep powerful permissions out of plugins whose audience does not need them.
- **Owner**: one named code owner who reviews changes and answers questions.
- **Update cadence**: components that change at different speeds belong in different plugins, so a fast-moving part does not force releases of a stable one.

If two parts have a different audience, permissions, owner or cadence, split them and use `dependencies`.

## Naming

- Lowercase kebab-case: `research-tools`, `architecture-review`.
- Short and descriptive of the purpose, not of the team.
- Must not start with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`.
- The same name in the folder `plugins/<name>/`, the catalog entry and `plugin.json`.

## Portable content

Plugins contain only portable content. Do not put project-specific paths, module names, repository
names or machine-specific absolute paths into agents, skills, commands or hooks. Refer to the
project through what the user supplies at run time. Credentials never appear in a plugin; see
[SECURITY.md](SECURITY.md).
