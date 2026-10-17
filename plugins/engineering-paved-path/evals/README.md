# Behavior evals: engineering-paved-path

Three hand-run cases. Each case folder follows the `claude plugin eval` layout: `prompt.md` (the prompt, with run settings in its frontmatter) and `graders/*.md` (LLM-judged criteria). `setup.md` in each folder holds the fixture (inline, synthetic) and the manual check.

Run all cases against the working tree:

```
claude plugin eval ./plugins/engineering-paved-path
```

Or load the plugin into a session with `claude --plugin-dir ./plugins/engineering-paved-path` and paste the prompt by hand.

| ID | Kind | ACs | Setup | Pass criterion |
|---|---|---|---|---|
| EPP-1 | positive | AC-44 | [epp-1-zod-schema/setup.md](epp-1-zod-schema/setup.md) | The `engineering-paved-path:zod` skill loads and the answer uses a Zod schema with `safeParse` and `z.infer`. |
| EPP-2 | positive | AC-43 | [epp-2-fastify-route/setup.md](epp-2-fastify-route/setup.md) | A paved-path skill (`engineering-paved-path:fastify-best-practices`) loads and the route declares a JSON Schema for its input and output. |
| EPP-3 | negative | AC-44 | [epp-3-unrelated-prompt/setup.md](epp-3-unrelated-prompt/setup.md) | No `engineering-paved-path` skill loads for an unrelated prompt. |

How to judge by hand: in the session transcript, look for a Skill tool call naming the skill. A case passes only if its pass criterion holds. A failing negative case blocks the release.
