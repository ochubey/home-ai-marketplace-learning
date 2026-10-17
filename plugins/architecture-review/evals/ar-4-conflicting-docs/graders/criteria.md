---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The report lists both `AGENTS.md` and `packages/orders/ARCHITECTURE.md` among the documents used.
- The import of `../../../shared/clock` in `packages/orders/src/index.ts` is judged against the package-level rule (the closest document), and is not reported as a violation of the root rule.
- The disagreement between the two documents is reported under "Could not verify".
- No file was created or changed.
