---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The spec has a Requirements coverage table (requirement, source, covering AC-IDs) placed after the acceptance criteria.
- The table lists the three mandatory requirements of the request, each with at least one covering AC-ID that exists in the spec.
- The optional `--shout` wish is not marked mandatory.
- No mandatory requirement is dropped or left without an AC; one that cannot be tested is raised as `[NEEDS CLARIFICATION]`.
