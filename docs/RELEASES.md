# Releases

## SemVer for plugins

Each plugin carries a SemVer `version` in its `plugin.json`:

- MAJOR: a breaking change for users (renamed or removed commands, skills or agents; changed required setup).
- MINOR: a backward-compatible addition.
- PATCH: a backward-compatible fix.

A pre-release suffix such as `1.2.0-rc.1` is allowed.

## No bump, no delivery

A change is not delivered to consumers unless the plugin `version` is bumped. Claude Code uses the
version to decide whether an installed plugin is out of date, so an edit without a bump reaches nobody.

## Tags

The tag format is `<plugin-name>--vX.Y.Z`, for example `engineering-paved-path--v1.0.0`. It must match
`^[a-z0-9-]+--v\d+\.\d+\.\d+$`. Create the tag from the plugin directory:

```
claude plugin tag plugins/<name> --dry-run
claude plugin tag plugins/<name> --push
```

Run `claude plugin tag --help` for the exact behaviour; use `--dry-run` first to preview before `--push`.

## Catalog update, plugin update, reload

These are three different steps:

1. Catalog update: `claude plugin marketplace update home-ai-marketplace-learning` refreshes the list of
   plugins and versions. Installed plugins stay as they are.
2. Plugin update: `claude plugin update <plugin>@home-ai-marketplace-learning` fetches the new version.
   A running session keeps the version it already loaded.
3. Session reload: `/reload-plugins` inside a session loads the updated plugins; otherwise they load
   at the next start.

### Auto-update

Auto-update is a per-marketplace setting. Third-party marketplaces are off by default. Enable it from
the `/plugin` Marketplaces tab; see the official plugin loading docs for the `autoUpdate` field of an
`extraKnownMarketplaces` entry. There is no global settings key. The environment variable
`DISABLE_AUTOUPDATER=1` switches background updates off, and `FORCE_AUTOUPDATE_PLUGINS=1` keeps
plugin auto-update working even when that variable is set.

## Rollback

Claude Code has no command that reverts a plugin to an earlier version. Going back means installing
the old version from a stable channel. This repository keeps one: the `stable` branch, which holds a
second marketplace named `home-ai-marketplace-learning-stable`. The procedure below was run end to end
on Claude Code 2.1.302 in an isolated configuration (sdd-engineering 1.1.0 back to 1.0.0).

### What the stable channel is

- The branch `stable` is a copy of a verified release commit (today: the 1.0.0 release commit `e0d53c9`).
  It is changed only by a deliberate commit and is never merged from `main`.
- Its `.claude-plugin/marketplace.json` has a different `name` (`home-ai-marketplace-learning-stable`).
  Claude Code identifies a marketplace by that name, so two channels of the same repository need two
  names; the same name twice conflicts.
- Every `dependencies[].marketplace` in the `plugin.json` files on `stable` names the stable
  marketplace too. Without that, a plugin installed from `stable` looks for its dependencies in the main
  marketplace and fails to load with "Dependency ... is not installed" when that marketplace is not added.
  Found during the rehearsal; fixed on the branch.

### Procedure

1. Add the stable channel pinned to the branch (once per machine):
   `claude plugin marketplace add ochubey/home-ai-marketplace-learning#stable`
2. Remove the bad version:
   `claude plugin uninstall sdd-engineering@home-ai-marketplace-learning`
3. Install the good version from the stable channel:
   `claude plugin install sdd-engineering@home-ai-marketplace-learning-stable`
   The three plugins it depends on are installed from the stable channel too.
4. Remove the dependencies left over from the main channel:
   `claude plugin prune -y`
   Uninstalling does not remove auto-installed dependencies. Without this step the main and stable
   copies of `engineering-paved-path`, `research-tools` and `architecture-review` stay installed and
   enabled side by side.
5. Check `claude plugin list --json`: only `...-stable` ids, the expected versions, no `errors`.
   Run `/reload-plugins` in an open session, or start a new one.
6. Run a smoke check (the `spec-creator` request of eval SDD-5): after the rollback the spec has no
   `Requirements coverage` section; with 1.1.0 it has one.

To return to the main channel later, uninstall the stable copies, run `claude plugin prune -y`, and
install from `home-ai-marketplace-learning` again.

### Update (observed)

`claude plugin update sdd-engineering@home-ai-marketplace-learning` upgraded 1.0.0 to 1.1.0 right after
the tag and merge, without a separate `claude plugin marketplace update` first (the update command
refreshes the catalog itself). `claude plugin marketplace update <name>` is still the way to refresh the
list of plugins and versions without installing anything. Neither command changes a running session;
`/reload-plugins` or a new session loads the new version.

### What was not tested

- `/reload-plugins` in an interactive session (the rehearsal ran headless).
- Whether plugin data written by 1.1.0 is readable by 1.0.0. The plugins here store no persistent data,
  so there was nothing to lose; a plugin that does must document its own data compatibility.
- Pinning to a commit SHA instead of a branch; the rehearsal pinned to the branch `stable`.
- Auto-update on the stable channel. Keep auto-update off for it, otherwise the pin does nothing useful
  if the branch moves.

### After a rollback

Fix forward: ship the corrected version under a new number (1.1.1) instead of re-using 1.1.0, because
the version is what clients compare. Then move the stable branch only when the new release is verified.
