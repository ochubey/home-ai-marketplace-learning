---
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent, Write]
---

Use the sdd-engineering:spec-creator agent to write a spec for this feature request. The spec directory is specs/ and you may create it.

Feature request: the greeting tool should accept an optional name and print "Hello, <name>!" and, when no name is given, print "Hello, world!". A name longer than 40 characters must be rejected with an error message and a non-zero exit code.

After the agent finishes, reply with the path of the spec file and then the complete spec text exactly as the agent wrote it, without summarizing or shortening it.
