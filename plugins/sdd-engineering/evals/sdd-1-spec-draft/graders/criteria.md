---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- Exactly one new file exists under `specs/`, named `NN-<kebab-feature>.md`, with `Spec ID: SPEC-NN`; no other file was created or changed.
- The acceptance criteria are written in English EARS form with `shall`, including an IF ... THEN criterion for the name that is too long.
- Every acceptance criterion has a verification hint.
- The spec has provenance tags and an "Untrusted inputs" section.
- Any open question is marked `[NEEDS CLARIFICATION]` and not guessed.
