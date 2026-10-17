# plugins/

Each plugin lives in its own folder `plugins/<name>/`, where `<name>` matches the plugin name in
`.claude-plugin/marketplace.json` and in the plugin's own `.claude-plugin/plugin.json`.

Plugins today:

| Plugin | What it is |
|---|---|
| [engineering-paved-path](engineering-paved-path/) | Shared engineering skills: Fastify, Drizzle ORM, PostgreSQL, Zod, TypeScript, React, security, Mermaid, Next.js. |
| [research-tools](research-tools/) | A read-only `researcher` agent. |
| [architecture-review](architecture-review/) | A read-only `architecture-reviewer` agent; depends on `engineering-paved-path`. |
| [sdd-engineering](sdd-engineering/) | A spec-driven development workflow: four agents (spec, plan, implement, verify) and three skills; depends on `engineering-paved-path`, `research-tools` and `architecture-review`. |

A folder here without a catalog entry fails validation.
