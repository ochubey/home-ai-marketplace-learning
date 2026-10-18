---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The spec has zero `[NEEDS CLARIFICATION]` markers.
- The `## Open questions` section has an `Assumptions` list that decides the trimming of surrounding spaces in a name with a recommended default and gives a reason.
- The acceptance criteria still cover the three mandatory requirements (optional name, default greeting, rejection of names over 40 characters), each with at least one AC-ID.
- The agent did not return a `QUESTIONS` list instead of the spec.
