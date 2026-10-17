---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- It adds a `POST /notes` route to the Fastify app in `app.ts`.
- The route declares a JSON Schema for the request body (required `title`, optional text) and for the 201 response.
- It replies with status 201.
- A paved-path skill, `engineering-paved-path:fastify-best-practices`, was loaded through the Skill tool.
