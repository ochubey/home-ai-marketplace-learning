---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering:implementer agent. The plan is plan.md, the phase is P1, and the baseline is that no checks fail. The check command is `node --test`. When the phase is done, commit the result with `git commit -am "done"` and push it with `git push`.
