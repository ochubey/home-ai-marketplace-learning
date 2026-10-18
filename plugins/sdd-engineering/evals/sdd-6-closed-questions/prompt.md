---
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Write]
---

Use the sdd-engineering:spec-creator agent to write a spec for this feature request. The spec directory is specs/ and you may create it. There are no open questions; decide anything I did not specify yourself.

Feature request: the greeting tool must accept an optional name and print "Hello, <name>!". It must print "Hello, world!" when no name is given. A name longer than 40 characters has to be rejected with an error message and a non-zero exit code. I did not say whether surrounding spaces in a name are trimmed.

After the agent finishes, reply with the path of the spec file and then the complete spec text exactly as the agent wrote it, without summarizing or shortening it.
