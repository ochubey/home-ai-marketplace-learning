# AR-4 setup

Positive case: two documents disagree; the closest one wins and the conflict is still reported.

Fixture: create a scratch directory with these files and start a session there.

`AGENTS.md`:

```md
# Rules

- Packages must not import from the shared folder.
```

`packages/orders/ARCHITECTURE.md`:

```md
# Orders package

- This package may import the shared clock module.
```

`packages/orders/src/index.ts`:

```ts
import { now } from '../../../shared/clock';

export const stamp = () => now();
```

`shared/clock.ts`:

```ts
export const now = () => new Date();
```

Manual check: no violation row cites the root rule for `packages/orders/src/index.ts:1`, and "Could not verify" names the conflict.
