# EPP-3 setup

Negative case: an unrelated prompt must not load any paved-path skill.

Fixture: none. Start a session in an empty scratch directory with the plugin loaded from the working tree.

Manual check: the transcript contains no Skill call for any `engineering-paved-path:*` skill. A single such call fails the case.
