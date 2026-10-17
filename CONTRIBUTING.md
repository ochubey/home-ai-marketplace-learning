# Contributing

This marketplace accepts plugin changes by pull request to `main`. A green `validate` check is a
structural gate, not a security review.

## Catalog entries

Every entry in `.claude-plugin/marketplace.json` has a `name` and a `source` of the exact form
`./plugins/<name>`. Remote sources (GitHub or URL) are not used in this marketplace.

The plugin's own `.claude-plugin/plugin.json` is the source of truth for `version` and `dependencies`.
A catalog entry may repeat `version`, but only if it equals the one in `plugin.json`; omitting it is recommended.

## Plugin folder structure

```
plugins/<name>/
  .claude-plugin/plugin.json     required
  agents/  skills/  commands/  hooks/  .mcp.json   optional components
  README.md                      recommended
  CHANGELOG.md                   recommended: one entry per released version
  evals/                         optional: behavior-eval cases (evals/<case>/prompt.md + graders/*.md)
```

A folder under `plugins/` without a catalog entry fails validation.

## plugin.json fields

| Field | Status | Rule |
|---|---|---|
| `name` | required | kebab-case, equals the catalog entry name. Must not start with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-`. |
| `version` | required | SemVer `MAJOR.MINOR.PATCH`, optional pre-release or build suffix, no `v` prefix. |
| `description` | recommended | One sentence for the catalog. |
| `dependencies` | optional | Other plugins of this marketplace, see below. |

## Dependencies

Each item of `dependencies` is one of:

- `"name"`
- `"name@marketplace"`, where the marketplace is `home-ai-marketplace-learning`
- `{ "name": "...", "marketplace": "home-ai-marketplace-learning", "version": "^1.0.0" }` (`marketplace` and `version` optional)

Rules: the name must be a plugin in this catalog; a marketplace qualifier must be this marketplace; no
self-dependency; no cycles. The `version` range is checked for syntax only. The validator does not check
that the referenced plugin's version satisfies it.

## Run the checks locally

Node 22, no packages to install:

```
node scripts/validate-marketplace.mjs
node --test
claude plugin validate .
```

Run `claude plugin validate .` without `--strict`: warnings do not fail the check.

The validator scans tracked files plus new files that are not ignored by git, so run it before you
`git add`. It prints one line per problem and exits 1 if there is any:

```
ERROR <file>[:<line>] [<rule-id>] <message> - fix: <hint>
```

### Rule IDs

| Rule | Meaning and fix |
|---|---|
| `catalog-missing` | `.claude-plugin/marketplace.json` is absent. Create it. |
| `json-invalid` | A JSON file does not parse. Fix the syntax. |
| `json-bom` | A JSON file starts with a UTF-8 BOM. Save it without BOM. |
| `catalog-field` | `name`, `owner.name` or `plugins` is missing or wrong in the catalog. Add or fix it. |
| `entry-name` | A catalog entry name is not valid kebab-case or uses a reserved prefix. Rename it. |
| `entry-duplicate` | Two entries share one name. Keep one. |
| `entry-source` | `source` is not `./plugins/<name>`. Use the relative form. |
| `plugin-dir-missing` | The source folder does not exist. Create it or fix `source`. |
| `plugin-manifest-missing` | The folder has no `.claude-plugin/plugin.json`. Add it. |
| `plugin-orphan` | A folder under `plugins/` has no catalog entry. Add the entry or remove the folder. |
| `plugin-name-mismatch` | `plugin.json` name differs from the catalog name. Make them equal. |
| `plugin-version` | `version` is missing or not SemVer. Use `MAJOR.MINOR.PATCH`. |
| `catalog-version-mismatch` | Catalog `version` differs from `plugin.json`. Remove it or align it. |
| `dep-format` | A dependency item has an unsupported shape. Use one of the three forms. |
| `dep-marketplace` | A dependency names another marketplace. Depend on this marketplace only. |
| `dep-unknown` | A dependency is not in this catalog. Add that plugin first or remove the dependency. |
| `dep-self` | A plugin depends on itself. Remove the dependency. |
| `dep-cycle` | Dependencies form a cycle (`a -> b -> a`). Break the cycle. |
| `dep-range` | A dependency `version` is not a valid range. Fix the range syntax. |
| `codeowners-missing` | `.github/CODEOWNERS` is absent. Create it. |
| `codeowners-default` | No default `*` rule with an owner. Add `* @ochubey`. |
| `codeowners-plugin` | A plugin has no CODEOWNERS rule more specific than the default. Add a `/plugins/<name>/ @owner` line. |
| `secret-github` | GitHub token pattern found. Remove it and rotate the token. |
| `secret-aws` | AWS access key id found. Remove it and rotate the key. |
| `secret-anthropic` | Anthropic API key pattern found. Remove it and rotate the key. |
| `secret-openai` | OpenAI API key pattern found. Remove it and rotate the key. |
| `secret-slack` | Slack token pattern found. Remove it and rotate the token. |
| `secret-private-key` | Private key block found. Remove it and rotate the key. |
| `secret-generic-assign` | A hard-coded credential assignment. Use a documented placeholder slot instead. |
| `secret-env-file` | A `.env` file is present. Delete it, ignore it, commit `.env.example` instead. |
| `abs-path` | A machine-specific absolute path (a home directory). Use a placeholder such as `/path/to/clone`. |
| `allowlist-invalid` | `scripts/validate-allowlist.json` has a schema error. Fix the entry. |
| `allowlist-stale` | An allowlist entry suppresses nothing. Remove or correct it. |
| `internal-error` | The validator itself failed. Report it to the maintainer. |

Secret findings print the rule, file, line, the first 4 characters and the length, never the full value.
Values containing `example`, `your`, `xxx`, `<`, `${` or `...` are treated as placeholders by the secret rules.

### Allowlist

A document that must show a forbidden pattern as an example (for instance `docs/SECURITY.md`) needs an
entry in `scripts/validate-allowlist.json`:

```
{ "entries": [ { "path": "docs/SECURITY.md", "rule": "abs-path", "contains": "<text of the line>", "reason": "<why>" } ] }
```

An entry suppresses a finding only when `path`, `rule` and `contains` all match. An entry that suppresses
nothing fails as `allowlist-stale`. Every allowlist change needs the code owner's explicit review.

## Ownership

Add one line per plugin to `.github/CODEOWNERS`, after the default rule (the last matching rule wins):

```
/plugins/<name>/ @owner
```

## Pull request checklist

The pull request template carries this list; tick every item before asking for review.

- [ ] Files are placed as described above.
- [ ] `version` is bumped in `plugin.json` for every changed plugin (see [docs/RELEASES.md](docs/RELEASES.md)).
- [ ] Dependencies are listed in `plugin.json`.
- [ ] CODEOWNERS has a line for every new plugin.
- [ ] No secrets and no absolute paths.
- [ ] The validator, `node --test` and `claude plugin validate .` pass locally.
- [ ] The PR targets `main`.

## Branch protection (applied manually)

Branch protection is a GitHub repository setting and is not enforced by files. Configure it on `main`:
require a pull request, require review from Code Owners, require the `validate` status check to pass.

## Commits

Use Conventional Commits with a scope, for example `feat(plugins): add research-tools` or
`docs(security): clarify rotation steps`. All content is written in English.
