# EPP-1 setup

Positive case: a Zod task should load `engineering-paved-path:zod`.

Fixture: none. Start a session in an empty scratch directory with the plugin loaded from the working tree.

Manual check: the transcript shows a Skill call for `engineering-paved-path:zod`, and the answer uses `safeParse` and `z.infer`.
