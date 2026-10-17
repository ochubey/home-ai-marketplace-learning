# plugins/

Each plugin lives in its own folder `plugins/<name>/`, where `<name>` matches the plugin name in
`.claude-plugin/marketplace.json` and in the plugin's own `.claude-plugin/plugin.json`.

Plugins today:

| Plugin | What it is |
|---|---|
| [engineering-paved-path](engineering-paved-path/) | Shared engineering skills: Fastify, Drizzle ORM, PostgreSQL, Zod. |
| [research-tools](research-tools/) | A read-only `researcher` agent. |
| [architecture-review](architecture-review/) | A read-only `architecture-reviewer` agent; depends on `engineering-paved-path`. |

A folder here without a catalog entry fails validation.
