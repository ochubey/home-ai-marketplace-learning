# AR-1 setup

Positive case: the rules live only in `docs/architecture.md`, and one import violates them.

Fixture: create a scratch directory with these three files and start a session there.

`docs/architecture.md`:

```md
# Architecture

- Handlers must not import from the data layer. They call services.
- Services may import from the data layer.
```

`src/handlers/orders.ts`:

```ts
import { query } from '../data/db';

export function listOrders() {
  return query('select * from orders');
}
```

`src/data/db.ts`:

```ts
export function query(sql: string): unknown[] {
  return [sql];
}
```

Manual check: the finding row has a source document, and line 1 of `src/handlers/orders.ts` is the cited import.
