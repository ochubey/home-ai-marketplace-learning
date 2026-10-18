---
max_turns: 15
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering:implementation-planner agent to plan the spec in specs/01-greeting.md as a single-agent pass, and ask the agent to save the plan to docs/plans/greeting.md. Do not write any file yourself: if the agent cannot save it, say so.

After the agent finishes, reply with the complete plan text exactly as the agent returned it, without summarizing or shortening it.
