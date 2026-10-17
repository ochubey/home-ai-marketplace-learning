---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- It defines a Zod object schema with a validated email, a password with a minimum length of 12 and an optional display name.
- It parses the untrusted input with `safeParse` (or an equivalent that does not throw on invalid input) and handles the failure case.
- It derives the TypeScript type with `z.infer`.
- The Skill tool was called for the `zod` skill of the `engineering-paved-path` plugin before the answer.
