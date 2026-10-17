# Plan: SPEC-01 Phase 1 - marketplace skeleton

Spec: `specs/phase-1-skeleton.md` (SPEC-01, approved)
Branch: `feat/skeleton`, Conventional Commits, one commit per phase or smaller.
Runtime: Node 22, zero npm dependencies, no root `package.json`.
Execution: single-agent pass, phases in order.

Note: this file is scanned by the validator. It must contain no literal tokens, PEM headers or
real home paths. Write path examples as `/Users/<name>/`.

## Approved decisions applied

1. `plugin.json` `dependencies` items: `"name"`, `"name@marketplace"`, or `{ "name", "marketplace"?, "version"? }`. Names must resolve in this catalog; a marketplace qualifier must equal this marketplace's name. `version` must pass a range-syntax regex; no satisfaction check.
2. Catalog entry `version` allowed only if equal to the `plugin.json` version; CONTRIBUTING recommends omitting it.
3. Branch protection is documented in CONTRIBUTING and applied manually later.
4. CODEOWNERS default owner: `@ochubey`.
5. A folder under `plugins/` without a catalog entry fails. A UTF-8 BOM in a validated JSON file fails.
6. No root `package.json`. Commands: `node scripts/validate-marketplace.mjs` and `node --test`.
7. `docs/SITE-SPEC.md` and `docs/COST-BASELINE.md` are not created; README layout says they arrive later.
8. Official actions pinned by major tag; confirm the current latest major of `actions/checkout` and `actions/setup-node` at implementation time.

## Target layout

```
.claude-plugin/marketplace.json
.github/CODEOWNERS
.github/pull_request_template.md
.github/workflows/validate.yml
docs/PLUGIN-GUIDELINES.md  docs/SECURITY.md  docs/RELEASES.md  docs/temp/README.md
plugins/README.md
scripts/validate-marketplace.mjs   (CLI entry + exported validate({root}) -> {problems, stats})
scripts/lib/{files,json,catalog,manifest,semver,deps,codeowners,scan,allowlist,report}.mjs
scripts/validate-allowlist.json
tests/helpers.mjs  tests/validator.*.test.mjs  tests/repo.test.mjs
specs/phase-1-skeleton.md  specs/phase-1-skeleton.plan.md
README.md  CONTRIBUTING.md  .gitignore
```

## Validator contract

- Entry: `node scripts/validate-marketplace.mjs [--root <dir>]`; default root resolved from the script location, not cwd. `main()` runs only when executed directly.
- Imports: only `node:` built-ins. No network.
- Problem model `{ file, line?, rule, message, hint }`; checks append, never throw or exit early (AC-28). Unexpected errors become one `internal-error` problem.
- Output, sorted by file, line, rule: `ERROR <file>[:<line>] [<rule-id>] <message> - fix: <hint>`; summary `validate-marketplace: OK - <P> plugins checked, <F> files scanned` or `validate-marketplace: FAILED - <N> problems, <P> plugins checked, <F> files scanned`. Exit 0 pass, 1 on any problem.
- Rule IDs: catalog `catalog-missing json-invalid json-bom catalog-field`; entries `entry-name entry-duplicate entry-source plugin-dir-missing plugin-manifest-missing plugin-orphan`; manifest `plugin-name-mismatch plugin-version catalog-version-mismatch`; deps `dep-unknown dep-self dep-cycle dep-marketplace dep-range dep-format`; CODEOWNERS `codeowners-missing codeowners-default codeowners-plugin`; scan `secret-github secret-aws secret-anthropic secret-openai secret-slack secret-private-key secret-generic-assign secret-env-file abs-path`; allowlist `allowlist-invalid allowlist-stale`.
- Scan file set: if `<root>/.git` exists, `git ls-files -z --cached --others --exclude-standard` (skip deleted); else recursive walk skipping `.git` and `node_modules`. POSIX-normalised, sorted. NUL byte in first 8 KiB = binary, skipped and not counted.
- Tests build fixtures at runtime in temp dirs (`tests/helpers.mjs`: `makeRepo`, `runValidator`). Token-like strings are assembled by concatenation so the repo's own scan never trips. No committed fixture trees.

## Phase 1 - Validator and self-tests (TDD)

Commits: `test(validator): ...` / `feat(validator): ...`. For each task write the tests first (red), then implement.

- [ ] T1 Test harness `tests/helpers.mjs` + stub validator exiting 1. AC-15: runs with plain node, no package.json/node_modules; scripts import only `node:` builtins (static scan of import specifiers).
- [ ] T2 `report.mjs` + CLI skeleton. AC-16, AC-28: empty valid catalog exits 0 printing "0 plugins checked, N files scanned"; two independent problems both reported with file, rule, hint, exit 1; output identical across two runs.
- [ ] T3 `files.mjs`, `json.mjs`. AC-17: CRLF accepted; BOM fails `json-bom`; binary skipped and not counted; git mode lists untracked-not-ignored files and skips gitignored `.env` (skip test if git missing); walk mode normalises separators.
- [ ] T4 `catalog.mjs`. AC-3, 17, 18, 19: missing/invalid marketplace.json; `name` kebab-case; `owner.name`; `plugins` array; entry name kebab-case and not starting with `claude-`, `anthropic-`, `anthropics-`, `cc-plugin-`; no duplicate names; `source` must equal `./plugins/<entry.name>` (rejects `..`, absolute, outside plugins/, object/URL sources with "relative sources only"); source dir exists with `.claude-plugin/plugin.json`; every dir under `plugins/` has an entry (files like `plugins/README.md` ignored).
- [ ] T5 `manifest.mjs`, `semver.mjs`. AC-20, 21, 22: plugin.json valid and BOM-free; `name` equals entry name (message names both); `version` required, semver.org 2.0.0 regex (pre-release ok, no `v` prefix); catalog `version`, if present, equals plugin version.
- [ ] T6 `deps.mjs`. AC-23: normalise the three item forms else `dep-format`; foreign marketplace qualifier `dep-marketplace`; unknown `dep-unknown` with chain `a -> zzz`; self `dep-self`; cycles via three-colour DFS reported once per cycle with chain `a -> b -> a`; range regex accepts `* x` exact, `^ ~ >= <= > < =`, x-wildcards, hyphen ranges, space-joined comparators, `||`; `^^1` fails `dep-range`.
- [ ] T7 `codeowners.mjs`. AC-13, 24: read `.github/CODEOWNERS` only; default rule `*` or `/**` with an owner required; for each plugin the LAST matching rule for `plugins/<name>/.claude-plugin/plugin.json` must be a non-default rule with an owner (GitHub semantics); glob subset: leading `/`, trailing `/`, `*`, `**`, `?`; empty catalog passes with default rule only.
- [ ] T8 `scan.mjs`. AC-25, 26. Rules per line in order, overlapping span reported once by first rule: `secret-private-key` `-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----`; `secret-github` `\bgh[pousr]_[A-Za-z0-9]{36,255}\b` and `\bgithub_pat_[A-Za-z0-9_]{22,}\b`; `secret-aws` `\b(?:AKIA|ASIA)[A-Z0-9]{16}\b`; `secret-anthropic` `\bsk-ant-[A-Za-z0-9_-]{20,}` (before OpenAI); `secret-openai` `\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}`; `secret-slack` `\bxox[abprs]-[A-Za-z0-9-]{10,}`; `secret-generic-assign` `(api_key|secret|token|passwd|password)\s*[:=]\s*["']([^"'\s]{16,})["']` (case-insensitive); `abs-path` `(?:^|[\s"'`(=:,\[])(\/Users\/[^\/\s<>]+\/|\/home\/[^\/\s<>]+\/|[A-Za-z]:\\Users\\[^\\\s<>]+)`; `secret-env-file` for `.env` / `.env.*` except `.env.example|.sample|.template`. Placeholder heuristic (secret rules only): skip values containing example, your, xxx, `<`, `${`, `...` (case-insensitive). Mask: print rule, file:line, first 4 chars and length only. docs/temp is NOT exempt. URLs containing `/home/` pass.
- [ ] T9 `allowlist.mjs` + `scripts/validate-allowlist.json`. AC-27: entries `{path, rule, contains, reason}`; suppress only when path, rule and contains all match; schema errors `allowlist-invalid`; entry suppressing nothing `allowlist-stale`; allowlist file exempt only for matches equal to its own `contains` values.
- [ ] T10 Performance: generated 50-plugin repo validates in under 10 s, exit 0.

## Phase 2 - Catalog skeleton

Commit `feat(catalog): add empty marketplace manifest`.

- [ ] T11 (tests first in `tests/repo.test.mjs`) `.claude-plugin/marketplace.json` with `name: "home-ai-marketplace-learning"`, `owner: { "name": "AI Engineering (ochubey)" }`, short `metadata.description`, `plugins: []`; `plugins/README.md`; `.gitignore` (`.env`, `.env.*`, `!.env.example`, `.DS_Store`, `node_modules/`, `.claude/settings.local.json`). Run `claude plugin validate .` (non-strict; empty-catalog warning expected). AC-1, 2.

## Phase 3 - Documentation

Commits `docs: add README and CONTRIBUTING`, `docs: add plugin guidelines, security and releases`. First run `claude plugin --help` and subcommand helps; record known subcommands in `KNOWN_PLUGIN_SUBCOMMANDS` in `tests/repo.test.mjs`. Docs use placeholders (`<plugin>`, `/path/to/clone`), never real home paths.

- [ ] T12 README: add marketplace (`claude plugin marketplace add ochubey/home-ai-marketplace-learning`, scopes), install `<plugin>@home-ai-marketplace-learning --scope project`, `marketplace update`, `plugin update`, `/reload-plugins`, `plugin list --json`; auto-update is per marketplace (extraKnownMarketplaces entry or `/plugin` Marketplaces toggle; no global key); "Repository layout" naming every top-level entry plus later-phase files. AC-4, 5.
- [ ] T13 CONTRIBUTING: source is `./plugins/<name>`; plugin.json is source of truth for version/dependencies; folder structure; required/optional fields; three dependency forms and rules; local commands (`node scripts/validate-marketplace.mjs`, `node --test`, `claude plugin validate .` non-strict); scan covers tracked plus new not-ignored files; rule-ID table with fix hints; allowlist format and review rule; CODEOWNERS line per plugin; PR checklist; branch protection settings (manual); Conventional Commits. Do not promise range satisfaction checks. AC-3, 6, 27.
- [ ] T14 PLUGIN-GUIDELINES: boundary criteria (audience, permissions, owner, update cadence), naming, portability. AC-7.
- [ ] T15 SECURITY: no secrets/credentials/absolute paths; MCP credentials only as placeholder slots; after an unsafe release: stop distribution, publish fixed version, rotate credentials, notify consumers; green validation is not a security review. Include one example that truly matches a rule (fake Linux home path) with a matching allowlist entry; do not use sample keys containing "EXAMPLE". AC-8, 27.
- [ ] T16 RELEASES: SemVer meaning for plugins; tag `<plugin-name>--vX.Y.Z` (example `engineering-paved-path--v1.0.0`); `claude plugin tag [path] [--push] [--dry-run]`; no bump = not delivered; catalog update vs plugin update vs `/reload-plugins`; auto-update per marketplace and env vars `DISABLE_AUTOUPDATER`, `FORCE_AUTOUPDATE_PLUGINS=1`; rollback only by reinstalling from a stable channel pinned to a ref/SHA (verify syntax against current docs/help first); never mention a rollback, lockfile or install-preview command. AC-9, 10.
- [ ] T17 `docs/temp/README.md` (temporary research docs, deleted when the plugin is built; still scanned). AC-11.
- [ ] T17a English-only guard: no Cyrillic in tracked text files. AC-12.

## Phase 4 - Ownership and PR flow

Commit `chore(github): add CODEOWNERS and pull request template`.

- [ ] T18 `.github/CODEOWNERS`: `* @ochubey` plus a commented template line `# /plugins/<name>/ @owner`. Real-repo validator run passes. AC-13, 24.
- [ ] T19 `.github/pull_request_template.md` checkboxes: files placed per CONTRIBUTING; version bumped; dependencies in plugin.json; CODEOWNERS updated; no secrets/absolute paths; local validator, `node --test` and `claude plugin validate .` pass; PR targets `main`. AC-14.

## Phase 5 - CI workflow

Commit `ci: add validate workflow`.

- [ ] T20 `.github/workflows/validate.yml`: `name: validate`; `on: pull_request` (no branch filter) and `push: branches: [main]`; `permissions: contents: read`; one job `validate` on `ubuntu-latest`, `timeout-minutes: 5`; steps `actions/checkout@v<major>` (`persist-credentials: false`), `actions/setup-node@v<major>` (`node-version: 22`, no cache), `node scripts/validate-marketplace.mjs`, `node --test`. No `secrets.`, no `pull_request_target`, no event-interpolation in `run:`, no site/pages jobs. Text/regex checks in `tests/repo.test.mjs`. AC-29..32.

## Phase 6 - Final verification (T21)

1. `node scripts/validate-marketplace.mjs` exit 0, "0 plugins checked".
2. `node --test` green (only `tests/*.test.mjs` discovered).
3. `claude plugin validate .` (no `--strict`); record warnings.
4. grep for "plugin rollback" in README.md, CONTRIBUTING.md, docs/ returns nothing.
5. `git ls-files docs/temp` lists the note; top-level entries match README layout; all English.
6. Post-merge manual (ask the user first): `marketplace add`, `validate` check on PR and push, CODEOWNERS view clean.

## Commit / PR flow

Work only on `feat/skeleton`; commit locally in phase order; the implementer does not push or open the PR. The token may lack the `workflow` scope: if pushing `.github/workflows/validate.yml` is rejected, the user adds that file through the GitHub web UI.

## Coverage (AC -> tasks)

AC-1,2: T11,T21 | AC-3: T4,T13 | AC-4,5: T12 | AC-6: T13 | AC-7: T14 | AC-8: T15 | AC-9,10: T16 | AC-11: T17 | AC-12: T17a | AC-13: T7,T18 | AC-14: T19 | AC-15: T1 | AC-16: T2,T10 | AC-17: T3,T4 | AC-18,19: T4 | AC-20..22: T5 | AC-23: T6 | AC-24: T7,T18 | AC-25,26: T8 | AC-27: T9,T13,T15 | AC-28: T2 | AC-29..32: T20.

## Spec ambiguities resolved in this plan

"Tracked text file" = tracked plus new not-ignored files in a git checkout, else walk; AC-24 "more specific" = GitHub last-match semantics; AC-3 strict form wins over the looser edge-case wording; `.env.example|sample|template` allowed; `claude plugin validate .` runs non-strict because an empty catalog only warns; the placeholder heuristic is a narrow documented exemption, and SECURITY.md carries one truly matching example with an allowlist entry; AC-12 is partly automated (Cyrillic guard) plus review; owner shape `AI Engineering (ochubey)` without email.
