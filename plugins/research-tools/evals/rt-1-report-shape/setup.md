# RT-1 setup

Positive case: report shape on a two-file repository.

Fixture: create a scratch directory with these two files and start a session there.

`src/greeter.ts`:

```ts
export function formatGreeting(name: string): string {
  return `Hello, ${name}!`;
}
```

`src/main.ts`:

```ts
import { formatGreeting } from './greeter';

console.log(formatGreeting('world'));
```

Manual check: all four section headings are present, and both citations point to lines that exist and show the cited code.
