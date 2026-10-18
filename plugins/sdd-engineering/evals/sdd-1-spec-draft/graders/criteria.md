---
type: llm
weight: 1
---

The response passes only if all of the following hold:

- The reply names exactly one new spec file under `specs/`, named `NN-<kebab-feature>.md`, and the spec text says `Spec ID: SPEC-NN`.
- The acceptance criteria are written in English EARS form with `shall`, including an IF ... THEN criterion for the name that is too long.
- Every acceptance criterion has a verification hint.
- The spec has provenance tags and an "Untrusted inputs" section.
- Anything the request does not answer is either marked `[NEEDS CLARIFICATION]` or recorded as an explicit assumption with a reason; nothing is silently invented.
