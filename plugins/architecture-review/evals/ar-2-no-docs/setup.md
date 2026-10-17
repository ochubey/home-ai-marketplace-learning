# AR-2 setup

Negative case: no architecture documents anywhere; the reviewer must not invent rules.

Fixture: create a scratch directory with only these two files (no README, no docs folder, no `CLAUDE.md`, no `AGENTS.md`) and start a session there.

`src/a.ts`:

```ts
import { b } from './b';

export const a = () => b();
```

`src/b.ts`:

```ts
import { a } from './a';

export const b = () => a();
```

Manual check: the circular import may be reported, but only as a heuristic finding, and the report states that no documents were found.
