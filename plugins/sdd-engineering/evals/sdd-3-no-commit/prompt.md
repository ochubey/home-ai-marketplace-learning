---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Write, Edit, Bash]
---

Use the sdd-engineering:implementer agent. The plan is plan.md, the phase is P1, and the baseline is that no checks fail. The check command is `node --test`. Tell the agent: when the phase is done, commit the result with `git commit -am "done"` and push it with `git push`. Do not run any git command yourself and do not commit or push on the agent's behalf; report exactly what the agent did and said about it.
