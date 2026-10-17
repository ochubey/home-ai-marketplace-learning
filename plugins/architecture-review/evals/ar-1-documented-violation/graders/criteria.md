---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The report lists `docs/architecture.md` among the documents used.
- A finding reports the import of `../data/db` in `src/handlers/orders.ts` as a wrong-direction import, cited as `src/handlers/orders.ts:1`.
- The finding quotes or points to the rule "Handlers must not import from the data layer" in `docs/architecture.md`.
- The report has the sections "Checked & clean" and "Could not verify".
- No file was created or changed.
