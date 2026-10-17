# home-ai-marketplace-learning

Internal Claude Code plugin marketplace of the AI Engineering team (maintainer: ochubey).
The catalog is empty for now; plugins are added in later phases.

## Use the marketplace

All commands run in your shell. `<plugin>` is a plugin name from the catalog.

Add the marketplace (default scope is `user`; `--scope project` writes it to the shared project settings,
`--scope local` keeps it for you in one repository):

```
claude plugin marketplace add ochubey/home-ai-marketplace-learning
claude plugin marketplace add ochubey/home-ai-marketplace-learning --scope project
```

A local clone works too: `claude plugin marketplace add /path/to/clone`.

Install a plugin (scope is `user`, `project` or `local`; the default is `user`):

```
claude plugin install <plugin>@home-ai-marketplace-learning --scope project
```

Refresh the catalog (this refreshes the listing only and leaves installed plugins at their current versions):

```
claude plugin marketplace update home-ai-marketplace-learning
```

Update an installed plugin (restart Claude Code or run `/reload-plugins` to apply):

```
claude plugin update <plugin>@home-ai-marketplace-learning
```

Reload plugins in a running Claude Code session (type this inside the session, not in the shell):

```
/reload-plugins
```

List what is installed:

```
claude plugin list --json
```

### Auto-update

Auto-update is a per-marketplace switch. It is off by default for this marketplace. There is no global
settings key for it. To turn it on, run `/plugin` in a session, open the Marketplaces tab, select
`home-ai-marketplace-learning` and choose Enable auto-update. A project can also pre-register the
marketplace for its collaborators through an `extraKnownMarketplaces` entry in
`.claude/settings.json`. Details and environment variables are in [docs/RELEASES.md](docs/RELEASES.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md),
[docs/SECURITY.md](docs/SECURITY.md) and [docs/RELEASES.md](docs/RELEASES.md).

## Repository layout

| Path | What belongs there |
|---|---|
| `.claude-plugin/` | `marketplace.json`, the catalog Claude Code reads. |
| `.github/` | `CODEOWNERS`, the pull request template and `workflows/validate.yml` (the `validate` check). |
| `.gitignore` | Local-only files that must never be committed (`.env`, editor and OS files, local settings). |
| `README.md` | This file: consumer commands and the layout. |
| `CONTRIBUTING.md` | Plugin structure, manifest fields, dependency rules, validator usage, PR checklist. |
| `docs/` | `PLUGIN-GUIDELINES.md`, `SECURITY.md`, `RELEASES.md`, and `temp/` for temporary research notes. `SITE-SPEC.md` and `COST-BASELINE.md` arrive in later phases. |
| `plugins/` | One folder per plugin: `plugins/<name>/`. Empty for now. |
| `scripts/` | The dependency-free validator (`validate-marketplace.mjs`, `lib/`) and `validate-allowlist.json`. |
| `tests/` | Node test suite for the validator and for this repository's own files (`node --test`). |
| `specs/` | The approved spec and plan for each phase. |

The catalog site and its Pages workflow also arrive in a later phase.
