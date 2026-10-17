# EPP-2 setup

Positive case: a Fastify route task should load `engineering-paved-path:fastify-best-practices`.

Fixture: save this as `app.ts` in an empty scratch directory, then start a session there with the plugin loaded from the working tree.

```ts
import Fastify from 'fastify';

export const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));
```

Manual check: the transcript shows a Skill call for `engineering-paved-path:fastify-best-practices`, and the new route has `schema.body` and `schema.response[201]`.
