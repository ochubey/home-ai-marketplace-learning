---
max_turns: 20
allowed_tools: [Read, Glob, Grep, Agent]
---

Use the sdd-engineering:spec-creator agent to write a spec for this feature request. The spec directory is specs/ and you may create it.

Feature request: the greeting tool must accept an optional name and print "Hello, <name>!". It must print "Hello, world!" when no name is given. A name longer than 40 characters has to be rejected with an error message and a non-zero exit code. It would be nice, but is not needed, to support a --shout flag that prints the greeting in upper case.
