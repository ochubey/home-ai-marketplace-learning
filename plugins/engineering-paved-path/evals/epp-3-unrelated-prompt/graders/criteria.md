---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- It answers the naming request with three names and a one-sentence tagline each.
- No Skill tool call names a skill of the `engineering-paved-path` plugin (`fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design` or `zod`).
