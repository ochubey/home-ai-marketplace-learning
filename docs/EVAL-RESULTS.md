# Eval results

Behavior evals of the plugins, run on GitHub Actions with `claude plugin eval` (workflow `evals.yml`, manual, approval required). This document records what ran, what passed, what had to be fixed in the cases themselves, and what is not covered. Date of the runs: 2026-10-18. Claude Code 2.1.302; models reached through OpenRouter (`sonnet` and `haiku` aliases); one run per case unless stated; no no-plugin comparison arm (`--ablation none`).

## Result

| Plugin | Case | Kind | Result | Run |
|---|---|---|---|---|
| sdd-engineering | SDD-1 spec draft | positive | passed 3 of 3 runs | 39124352214 |
| sdd-engineering | SDD-2 plan returned | positive | passed | 39123111791 |
| sdd-engineering | SDD-3 no commit | negative | passed | 39123111791 |
| sdd-engineering | SDD-4 no plan file | negative | passed (judge votes 2 of 3 PASS) | 39123111791 |
| sdd-engineering | SDD-5 requirements coverage | positive | passed | 39123111791 |
| sdd-engineering | SDD-6 closed questions | positive | passed | 39123111791 |
| engineering-paved-path | EPP-1 zod schema | positive | passed | 39128157722 |
| engineering-paved-path | EPP-3 unrelated prompt | negative | passed | 39129356406 |
| research-tools | RT-2 vague request | negative | passed | 39130312702 |

Nine cases of the seventeen written have a recorded passing run on the current code; SDD-1 to SDD-4 also have one on the 1.0.0 code of the stable channel. The clean full run of the six sdd-engineering cases first ended with five of six (SDD-1 failed); after the criterion fix described below SDD-1 was run three times and passed each time. The other cases were run once.

## Rollback smoke eval (stable channel, 1.0.0)

Run 39131867105: the workflow input `plugin_ref=stable` replaced the code of every plugin by the code of the `stable` branch (sdd-engineering 1.0.0, engineering-paved-path 1.1.0, research-tools 1.0.0, architecture-review 1.0.0; recorded in `results.json` under `suite.plugins` and in the Job Summary line `Plugins under test`) and ran the six `sdd-*` cases, whose files stay those of `main`.

| Case | Result on 1.0.0 |
|---|---|
| SDD-1 spec draft | passed |
| SDD-2 plan returned | passed |
| SDD-3 no commit | passed |
| SDD-4 no plan file | passed |
| SDD-5 requirements coverage | not evaluated: API error 402, no credits left |
| SDD-6 closed questions | not evaluated: API error 402, no credits left |

SDD-1 to SDD-4 are the smoke set of the rollback: they pass on the rolled-back 1.0.0 code. SDD-5 and SDD-6 test behavior added in 1.1.0 and 1.1.1; the plan was to show that they fail on 1.0.0 (so the evals tell the versions apart), but the credit ran out before they ran, so that contrast is **not shown**. A manual check made earlier (a headless `spec-creator` run on the rolled-back install) found no `Requirements coverage` section in the spec, which is the same observation without the eval harness.

## Not covered

- EPP-2 (needs an `app.ts` fixture), RT-1, RT-3, RT-4 and AR-1 to AR-4 (need fixture repositories) have no scaffold and were not run.
- No run used the no-plugin arm, so the score says what the plugin does, not what it adds over plain Claude.
- One run per case (three for SDD-1): this shows that a case can pass, not how often. Language-model answers vary; the cost experiment saw a 2-in-10 failure rate for a different reason.
- The LLM judge (haiku) reads only the final reply and returns three votes; SDD-4 passed with two of three. The judge's reasoning is not stored, only the votes.
- Whether tool calls made inside a subagent appear in the trace is unconfirmed. The `tool_used` graders did count calls of the main session (Skill 1 time in EPP-1, 0 in EPP-3; Bash, Write, Read, Grep, Glob 0 times in the negative cases). SDD-3 and SDD-4 therefore prove that the main session did not commit or write, and the judge's reading of the reply says the same for the agent; a subagent's own Bash call is not independently shown.
- The implementer's "do not commit or push" rule is a prompt rule, not enforced; SDD-3 passing is evidence of behavior in one run, not a guarantee.

## What went wrong before the results (and what it changed)

The first runs failed for reasons in the harness or the cases, not in the plugins. All were fixed in the repository:

| Run | Cost | Cause | Fix |
|---|---|---|---|
| 1 | 0.0001 | A granted shell tool needs a sandbox; the runner had none | install `bubblewrap` and `socat`, lift the user-namespace restriction |
| 2 | 0.10 | Only the plugin under test is loaded, so the dependencies of sdd-engineering were missing | cases list sibling plugins; the target is the `plugins/` directory |
| 3 | 0.28 | The judge read a summary, not the spec | prompts ask for the full text |
| full run | 1.79 | SDD-3 and SDD-4 tested the main session instead of the agent; SDD-2 asked every setup task to name a test | prompts forbid the main session to do the action; criterion relaxed |
| clean full run | 1.62 | SDD-1 judge failed 3 of 3 although each listed line was met; the explicit assumptions required since 1.1.1 may read as "guessed" | criterion reworded to accept assumptions with a reason |
| EPP-1 | 0 | OpenRouter refused (402): it reserves credit for the maximum answer size | `CLAUDE_CODE_MAX_OUTPUT_TOKENS` set to 32000 |
| EPP-1 (again) | 0.15 | A judge cannot see tool calls; criteria about them scored a correct answer 0 | `tool_used` graders for tool calls (also in EPP-3, RT-2) |

Two criteria (SDD-1, SDD-2) were changed after a failure was seen. They were changed because the criterion did not match the documented behavior of the plugin, not to make a number pass, but that is a judgment and a reader should know it.

## Cost

About 5.9 USD was spent through OpenRouter on the runs above and the stable smoke run (0.92); the balance of the key is now too low to run more (the failed runs cost almost nothing; the two full runs 1.79 and 1.62; SDD-1 three runs 0.87; the last three cases 0.34; the stable smoke run 0.92, where the last two cases were refused for lack of credit). Local checks of the same cases on the author's own login are not included. A case costs 0.09 to 0.41 USD per run at default settings.

## Reproduce

Actions, workflow `evals`, inputs: plugin, case glob, runs (1 to 3), cost ceiling (at most 5), threshold. The environment `evals` holds the key and asks for approval. Locally, from the `plugins` directory:

```
claude plugin eval . --eval-dir <plugin>/evals --case "<glob>" --runs 1 --ablation none --no-publish --trust-plugin --scaffold --max-cost-usd 2 --judge-model haiku --allow-tools Write Edit "Bash(node --test:*)"
```

Without `--runs 1 --ablation none` the cost is about six times higher.
