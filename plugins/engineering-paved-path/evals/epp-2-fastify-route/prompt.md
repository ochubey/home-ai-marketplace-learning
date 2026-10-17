---
max_turns: 10
allowed_tools: [Read, Glob, Grep, Skill]
---

Read app.ts in the current directory. Add a POST /notes route that creates a note from a JSON body with a required title and an optional body text, and returns the created note with status 201. Validate the input and describe the response with the framework's own schema support.
