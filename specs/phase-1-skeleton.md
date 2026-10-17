# Spec: Phase 1 - marketplace skeleton

Spec ID: SPEC-01
Status: approved

## Problem and user

`home-ai-marketplace-learning` will be an internal Claude Code plugin marketplace owned by
AI Engineering (maintainer: ochubey). Later phases will add four plugins
(`engineering-paved-path`, `research-tools`, `architecture-review`, `sdd-engineering`) and a
static catalog site on GitHub Pages. Right now the repository is empty. Without a shared layout,
documented rules and automatic validation, every plugin PR will raise the same questions:
where files go, which manifest fields matter, how versions and dependencies work, who reviews,
and what counts as unsafe content.

Users of this phase:

- **Plugin author (newcomer)** - wants to open a correct plugin PR without asking anyone where
  files go or what to check.
- **Code owner / reviewer** - wants every PR to arrive pre-checked by CI and a checklist, so the
  review can focus on content.
- **Marketplace consumer** - a Claude Code user who wants to add the marketplace and later install,
  update and reload plugins, using only the README.

## Goals / Non-goals

### Goals

- **G1** - The repository is a valid Claude Code marketplace that consumers can add, even with zero
  plugins.
- **G2** - A newcomer finds, in the repository itself, where plugin files go, which manifest fields
  are required, how dependencies and versions work, and what a PR must satisfy.
- **G3** - Security and release rules are written down before the first plugin lands (no secrets,
  no absolute paths, what to do after an unsafe release, SemVer, tags, update vs reload, rollback).
- **G4** - Every PR and every push to `main` is checked automatically for structural, version,
  dependency, ownership and leak problems, without installing any package.
- **G5** - Review ownership is explicit: every path, and every future plugin, has a code owner, and
  every PR shows a checklist.
- **G6** - The repository is English-only, secret-free, and its tooling runs on Node 22.

### Non-goals

- Any real plugin content (agents, skills, commands, hooks, MCP configs) or empty placeholder
  plugins registered in the catalog.
- The catalog site, its build workflow, GitHub Pages setup, and `docs/SITE-SPEC.md`.
- Cost baseline (`docs/COST-BASELINE.md`) and any cost experiment.
- Creating releases or git tags, and release/rollback helper scripts.
- Running `claude plugin validate` in CI (it needs a Claude Code install; it stays a documented
  local step for authors).
- Configuring GitHub branch protection (a repository setting, not a file); see Open questions.
- Behavior or negative evals for plugins.
- Proving plugin safety: a green validation is a structural gate, not a security review.

## User stories

- **US-1** (G1) As a marketplace consumer, I want to add the marketplace by its GitHub name and see
  it accepted, so that I can install plugins once they appear.
- **US-2** (G2) As a newcomer author, I want README and CONTRIBUTING to tell me the repo layout,
  plugin folder structure, manifest fields and dependency rules, so that I put files in the right
  place on the first try.
- **US-3** (G3) As an author, I want SECURITY and RELEASES docs, so that I know what must never be
  committed and how to version, tag, update and roll back a plugin.
- **US-4** (G4) As a reviewer, I want CI to fail with a clear message when a PR breaks the catalog,
  so that I do not check structure by hand.
- **US-5** (G5) As a reviewer, I want CODEOWNERS and a PR checklist, so that the right people are
  requested and authors self-check before asking for review.
- **US-6** (G2, G3) As an author doing research for a future plugin, I want a sanctioned place for
  temporary notes, so that they do not get mixed with permanent docs.

## Acceptance criteria (EARS)

Notation: WHEN (event), WHILE (state), IF ... THEN (unwanted behavior), WHERE (optional feature),
no keyword = ubiquitous. `shall` marks the requirement. "Validator" means the repository's
dependency-free validation script; "validate workflow" means the GitHub Actions workflow named
`validate`.

### Marketplace catalog (G1)

- **AC-1** The repository shall contain `.claude-plugin/marketplace.json` that is valid JSON and
  declares the marketplace name `home-ai-marketplace-learning`, an owner (AI Engineering /
  ochubey), and a `plugins` array.
  *Verify:* parse the file; assert the three fields; run `claude plugin validate .` locally and
  expect success.
- **AC-2** WHILE no plugins are published, the `plugins` array shall be empty and the catalog shall
  still be accepted by Claude Code.
  *Verify:* `claude plugin marketplace add ochubey/home-ai-marketplace-learning` (or the local path)
  succeeds and lists zero plugins.
- **AC-3** CONTRIBUTING shall state that every catalog entry's `source` is a relative path of the
  form `./plugins/<name>`, and that the plugin's own `plugin.json` is the source of truth for
  `version` and `dependencies`.
  *Verify:* doc review against this AC.

### Documentation (G2, G3, G6)

- **AC-4** README shall describe, with copy-pasteable commands, how to add the marketplace, install
  a plugin (including scope), update the marketplace catalog, update a plugin, and reload plugins in
  a running session.
  *Verify:* a reviewer who has never seen the repo runs the "add marketplace" command from README
  and it succeeds; the other commands match current Claude Code CLI help.
- **AC-5** README shall contain a repository layout section that names every top-level directory and
  key file introduced by this phase and says what belongs in each.
  *Verify:* compare `git ls-files` top-level entries with the layout section; no unexplained entry.
- **AC-6** CONTRIBUTING shall describe the required plugin folder structure, the required and
  optional `plugin.json` fields, the dependency rules (dependencies only on plugins in this
  marketplace, no cycles, no self-dependency), how to run the validator locally, and the PR
  checklist.
  *Verify:* doc review; the local validator command from CONTRIBUTING runs as written.
- **AC-7** `docs/PLUGIN-GUIDELINES.md` shall define what makes a good plugin boundary (audience,
  permissions, owner, update cadence), naming rules, and the rule that plugins contain only portable
  content (no project-specific paths or module names).
  *Verify:* doc review.
- **AC-8** `docs/SECURITY.md` shall state that secrets, credentials and machine-specific absolute
  paths must never be committed, that MCP credentials may appear only as documented placeholder
  slots, and the required actions after an unsafe release is discovered (stop distribution, publish
  a fixed version, rotate exposed credentials, notify consumers).
  *Verify:* doc review against the listed items.
- **AC-9** `docs/RELEASES.md` shall define SemVer usage, the tag format `<plugin-name>--vX.Y.Z`, the
  rule that a change is not delivered unless `version` is bumped, and the distinction between a
  catalog update, a plugin update and a session reload (`/reload-plugins`).
  *Verify:* doc review; tag format example matches the regex `^[a-z0-9-]+--v\d+\.\d+\.\d+$`.
- **AC-10** `docs/RELEASES.md` shall describe rollback only as reinstalling from a stable channel
  pinned to a git ref or SHA, and shall not mention any rollback, lockfile or install-preview command
  that Claude Code does not provide.
  *Verify:* doc review; grep for `plugin rollback` returns nothing.
- **AC-11** The repository shall contain a `docs/temp/` directory, tracked in git, with a note
  stating it holds temporary research documents that are deleted once the related plugin is built.
  *Verify:* `git ls-files docs/temp` returns at least the note file.
- **AC-12** All repository content (docs, comments, workflow names and step names, PR template,
  validator messages) shall be written in English.
  *Verify:* reviewer read-through of the PR diff.

### Ownership and PR flow (G5)

- **AC-13** The repository shall contain a CODEOWNERS file with a default owner rule that matches
  every path in the repository.
  *Verify:* GitHub "CODEOWNERS" view shows no errors; a PR touching any file requests the default
  owner.
- **AC-14** The repository shall contain a pull request template whose checklist covers at least:
  files placed per CONTRIBUTING, version bumped for changed plugins, dependencies listed in
  `plugin.json`, CODEOWNERS updated for new plugins, no secrets or absolute paths, validator passes
  locally, PR targets `main`.
  *Verify:* open a draft PR and confirm the checklist renders with every listed item.

### Validation (G4, G6)

- **AC-15** The validator shall run with plain Node 22 and no installed packages (no
  `npm install` / `pnpm install` step).
  *Verify:* on a clean checkout with Node 22, run the validator command from CONTRIBUTING; it
  completes with exit code 0.
- **AC-16** WHEN the catalog is valid, the validator shall exit with code 0 and print a short
  summary (number of plugins checked, number of files scanned).
  *Verify:* run on the skeleton; assert exit code 0 and the summary line.
- **AC-17** IF `.claude-plugin/marketplace.json` is missing, is not valid JSON, or lacks the name,
  owner or `plugins` array, THEN the validator shall fail.
  *Verify:* fixture or temporary edit for each case; assert non-zero exit and a message naming the
  missing field.
- **AC-18** IF two catalog entries share the same plugin name, THEN the validator shall fail.
  *Verify:* duplicate-entry fixture; non-zero exit.
- **AC-19** IF a catalog entry's `source` directory does not exist, or contains no
  `.claude-plugin/plugin.json`, THEN the validator shall fail.
  *Verify:* entry pointing to a missing folder; non-zero exit naming the entry.
- **AC-20** IF the `name` in a plugin's `plugin.json` differs from the name of its catalog entry,
  THEN the validator shall fail.
  *Verify:* mismatched-name fixture; non-zero exit naming both values.
- **AC-21** IF a plugin's `version` is missing or is not a valid SemVer string `MAJOR.MINOR.PATCH`
  (optional pre-release/build suffix allowed), THEN the validator shall fail.
  *Verify:* fixtures with `1.0`, `v1.0.0`, missing version; each fails; `1.0.0` and `1.0.0-rc.1`
  pass.
- **AC-22** IF a catalog entry also declares a `version` that differs from its plugin's
  `plugin.json` version, THEN the validator shall fail.
  *Verify:* entry `version: 1.0.0` vs plugin `1.0.1`; non-zero exit.
- **AC-23** IF a plugin declares a dependency on a plugin that is not in this marketplace's catalog,
  depends on itself, or participates in a dependency cycle, THEN the validator shall fail.
  *Verify:* three fixtures (unknown name, self, A->B->A); each fails with the dependency chain in
  the message.
- **AC-24** IF a catalog plugin's directory is not matched by a CODEOWNERS rule more specific than
  the default rule, THEN the validator shall fail.
  *Verify:* add a plugin entry without a CODEOWNERS line; non-zero exit naming the plugin path.
- **AC-25** IF any tracked text file contains a likely secret (private key block, common provider
  token pattern such as GitHub, Anthropic, OpenAI, AWS, or a `.env` file), THEN the validator shall
  fail.
  *Verify:* fixture strings for each pattern class; each fails and names file and line, without
  echoing the full secret.
- **AC-26** IF any tracked text file contains a machine-specific absolute path (for example a user
  home directory on macOS, Linux or Windows), THEN the validator shall fail.
  *Verify:* fixture lines with a macOS home path, a Linux home path and a Windows drive user path;
  each fails naming file and line.
- **AC-27** WHERE a document must show a forbidden pattern as an example (such as SECURITY.md), the
  validator shall allow it only through an explicit, reviewable allowlist, and the allowlist shall
  be documented in CONTRIBUTING.
  *Verify:* SECURITY.md examples pass; the same line in any non-allowlisted file fails.
- **AC-28** IF validation finds one or more problems, THEN the validator shall report all problems
  found in one run (not only the first), each with file path, rule and a fix hint, and exit with a
  non-zero code.
  *Verify:* fixture with two independent problems; both appear in the output; exit code non-zero.

### CI workflow (G4, G6)

- **AC-29** WHEN a pull request is opened or updated, or a commit is pushed to `main`, the validate
  workflow shall run the validator on Node 22.
  *Verify:* open a PR and push to `main`; the `validate` check appears in both cases.
- **AC-30** IF the validator fails, THEN the validate workflow shall report a failed check on the PR
  or commit.
  *Verify:* PR with a deliberate mismatch shows a red `validate` check; reverting it turns it green.
- **AC-31** The validate workflow shall be a standalone workflow whose result does not depend on, and
  is not combined with, any site build or deploy job.
  *Verify:* workflow file contains only validation jobs; a future `pages` workflow failure does not
  change the `validate` status.
- **AC-32** The validate workflow shall request read-only repository permissions and shall not use
  any repository secrets.
  *Verify:* workflow file review: `permissions: contents: read`, no `secrets.` references.

## Edge cases

- **Empty catalog** - the expected state in this phase; all validator checks pass vacuously
  (AC-2, AC-16). CODEOWNERS coverage is satisfied by the default rule alone.
- **Plugin directory without a catalog entry** - a folder under `plugins/` not listed in the catalog.
  Decision: fail, so no orphan content is merged.
- **Catalog source outside `plugins/`** or using `..` - recommended default: fail, sources must
  resolve inside `./plugins/`.
- **Remote sources** (GitHub/URL sources instead of relative paths) - out of scope; recommended
  default: fail with a message that this marketplace uses relative sources only.
- **Docs that legitimately mention forbidden patterns** - handled by the allowlist (AC-27); the
  validator's own pattern definitions must not trigger itself.
- **Binary or very large files** - scanning skips binary files; scanning must not exceed the time
  budget in NFRs even if the repo grows to tens of plugins.
- **`docs/temp/` content** - still scanned for secrets and absolute paths; temporary does not mean
  exempt.
- **Concurrent PRs** adding plugins that depend on each other - each PR is validated against its own
  tree; a PR depending on a plugin that is not yet merged fails (AC-23). This is intended.
- **PR targeting a non-`main` branch** - the workflow still runs on the PR (AC-29); the PR template
  reminds authors to target `main` (AC-14).
- **CRLF line endings / BOM in JSON** - the validator must accept a UTF-8 BOM-free JSON file with
  either line ending; a BOM fails with a clear message (decision).

## Non-functional requirements

- **Portability:** validator runs on Node 22 on Linux, macOS and Windows without packages (AC-15).
- **Performance:** validator completes in under 10 seconds on the CI runner for a repository with up
  to 50 plugins; the whole workflow under 2 minutes.
- **Security:** no secrets anywhere in the repo; workflow has least-privilege permissions and runs
  no code from PR authors with elevated rights (no `pull_request_target`). Secret matches are
  reported without printing the full value. Third-party actions limited to official GitHub actions
  (checkout, setup-node). Decision: pin by major tag.
- **Observability:** validator output is plain text, one line per problem, grep-friendly, with a
  final summary; CI logs are enough to fix a failure without re-running locally.
- **Determinism:** same tree gives the same result; no network access during validation.
- **Accessibility / language:** English only; docs readable as plain Markdown on GitHub.

## Inputs and provenance

| Input | Provenance |
|---|---|
| Marketplace name, owner, scope of this phase | `[reused: caller task + docs/plans/l08-marketplace.md in DevDigest repo, Phase 1 and "Additions from the lab recording"]` |
| `marketplace.json` / `plugin.json` field names, `claude plugin validate`, `marketplace add/update`, `plugin install/update`, `/reload-plugins` | `[reused: Claude Code plugin documentation; to be confirmed against current CLI by the researcher before docs are written]` |
| Catalog shape, source dirs, name match, SemVer, dependency resolution, CODEOWNERS coverage, secret and absolute-path scan | `[deterministic: validator script]` |
| CI pass/fail status | `[deterministic: validate workflow]` |
| Doc prose (README, CONTRIBUTING, guidelines, security, releases) | authored content; no runtime LLM call |
| LLM calls at runtime | none (`[new: 0 LLM calls]`) |

## Untrusted inputs

This phase feeds no repository or PR text to a model at runtime: the validator and workflow are
deterministic. PR titles, descriptions and file contents are treated only as data by the
validator (pattern matching, JSON parsing) and are never executed or interpolated into shell
commands in the workflow. Future phases that feed plugin docs or PR text to a model must pass them
as delimited data with an injection guard that cannot change policy; this spec does not introduce
any such path.

## Open questions (all resolved)

Resolved on 2026-10-17 by accepting the spec's recommended defaults (owner informed, may revise before merge); decisions applied: (1) dependency items may be `name`, `name@marketplace` or `{name, marketplace?, version?}`; names must resolve in this catalog, `version` is checked for range syntax only, not satisfaction; (2) catalog `version` allowed only if equal to plugin.json; (3) branch protection documented, applied manually; (4) default owner `@ochubey`; (5) orphan folders and BOM fail; (6) no root package.json; (7) SITE-SPEC and COST-BASELINE not created now; (8) actions pinned by major tag.

1. **Dependency declaration format** - does current Claude Code `plugin.json` express dependencies
   as plugin names only, or names with SemVer ranges? Recommended default: validate name resolution
   always; if ranges are supported, also check that the referenced plugin's version satisfies the
   range. (Research item.)
2. **Version in catalog entries** - forbid `version` in `marketplace.json` entries entirely, or allow
   it only when equal to `plugin.json` (current AC-22)? Recommended default: allow-if-equal, and
   CONTRIBUTING recommends omitting it.
3. **Branch protection** requiring Code Owners review and the `validate` check - the plan lists it in
   Phase 1, but it is a GitHub setting. Recommended default: document the required settings in
   CONTRIBUTING and apply manually; not verifiable by files.
4. **CODEOWNERS identities** - default owner `@ochubey` only, or a team handle for AI Engineering?
   Recommended default: `@ochubey` until a team exists.
5. **Orphan plugin folders and BOM handling** - see Edge cases; recommended default: fail on both.
6. **`package.json` at repo root** - add one only to expose a `validate` script alias, or none at
   all? Recommended default: none; document the plain `node` command.
7. **`docs/SITE-SPEC.md` and `docs/COST-BASELINE.md`** - the plan lists them under Phase 1, the
   caller puts them out of scope. Recommended default: not created now; README layout mentions they
   arrive in later phases.
8. **Action pinning** - official actions by major tag or by commit SHA? Recommended default: major
   tag for readability in a learning repo.

### Research to delegate (via caller to `researcher`)

- Current `marketplace.json` and `plugin.json` schema (required fields, owner shape, dependency
  field and range syntax), and whether an empty `plugins` array passes `claude plugin validate`.
- Exact current CLI commands for marketplace add/update, plugin install/update with scope, and
  whether `/reload-plugins` is the current name.
- A compact, low-false-positive set of secret patterns suitable for a dependency-free scanner.
