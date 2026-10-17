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

Claude Code has no command that reverts a plugin to an earlier version. To go back, reinstall from a
stable channel that is pinned to a git ref or SHA:

- Marketplace pinning: adding a marketplace as `owner/repo#<ref>` pins it to a branch or tag. A stable
  channel would pin a second marketplace to a verified release ref of the whole repository.
- Plugin source pinning: a catalog entry whose source is a git source can set `ref` and `sha` fields.
  This marketplace uses relative sources today, so a separate stable catalog would have to be created
  first; that is not part of this phase.

Pinning the same marketplace name twice conflicts with the unpinned one, so a stable channel needs its
own marketplace name. The exact end-to-end procedure for such a channel is not settled yet and will be
documented when the first stable channel exists. After a rollback, fix forward with a new version.
