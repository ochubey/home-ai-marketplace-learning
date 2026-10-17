---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The reply contains the full plan text.
- Every task names at least one AC-ID (AC-1, AC-2 or AC-3) and a test.
- The plan has an AC -> tasks coverage table in which every AC has at least one task.
- The agent did not ask a requirements question that the spec already answers.
- No file was created or changed (`git status --porcelain` is empty).
