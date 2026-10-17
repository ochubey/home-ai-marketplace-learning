# Security

A green `validate` check is a structural gate, not a security review. Reviewers still read every change.

## Never commit

- Secrets and credentials: API keys, tokens, passwords, private keys, `.env` files.
- Machine-specific absolute paths, such as a user home directory. Use placeholders like `/path/to/clone` or `<plugin>`.

The validator rejects likely secrets and home-directory paths in every text file, including `docs/temp/`.
A path example that really is a home directory looks like this and is allowed only through the
reviewed allowlist `scripts/validate-allowlist.json`: `/home/jdoe/projects/app`.

## MCP credentials

A plugin that bundles an MCP server must not contain credentials. Show only documented placeholder
slots, for example an environment variable name such as `SERVICE_TOKEN` that the user fills in locally.

## After an unsafe release

If a released plugin version exposes a secret or otherwise unsafe content:

1. Stop distribution: remove the affected plugin entry from the catalog, or revert the commit that introduced the content.
2. Publish a fixed version: bump `version`, fix the content, tag it (see [RELEASES.md](RELEASES.md)).
3. Rotate any exposed credentials. Treat them as compromised even if the repository is private.
4. Notify consumers: tell users of the plugin to update and reload, and say what was exposed.

Removing a secret from the latest commit does not remove it from git history; rotation is mandatory.
