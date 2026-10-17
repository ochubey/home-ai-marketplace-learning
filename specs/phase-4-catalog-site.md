# Spec: Phase 4 - catalog site on GitHub Pages

Spec ID: SPEC-04
Status: approved (coordinator resolutions below)

## Problem and user

The marketplace has four plugins (`engineering-paved-path` 1.1.0, `research-tools` 1.0.0,
`architecture-review` 1.0.0, `sdd-engineering` 1.0.0) with skills and agents. The only way to see
them today is to read `marketplace.json`, the plugin READMEs and the file tree on GitHub. A user who
wants "a skill for X" can only grep the repository. The root README says the catalog site and its
Pages workflow come in a later phase. This is that phase.

Phase 4 ships a static catalog site, published with GitHub Pages at
`https://ochubey.github.io/home-ai-marketplace-learning/` (public repository, Free plan, no backend).
It covers keyword search over every artifact, detail pages with deep links, a copyable install
command, dependency display, a release feed built from the CHANGELOGs, and a getting-started page.

Users of this phase:

- **Marketplace consumer** - looks for a plugin, skill or agent by keyword, reads what it does,
  sees what it depends on, and copies the install commands.
- **Plugin author / code owner** - wants the site to show exactly what is in the repository: no
  invented metadata, no stale copy, no way for plugin Markdown to run script on the site.
- **Maintainer of the repository** - wants the site to be deployed automatically from `main`,
  built and tested on pull requests, and kept apart from the dependency-free validator and the
  existing test suite.

## Goals / Non-goals

### Goals

- **G1 Data** - A dependency-free, deterministic build-time indexer turns `.claude-plugin/`, the
  plugin manifests and `plugins/` into the site's data files. All facts are computed by code from
  real repository files.
- **G2 Discovery** - Keyword search over name, description and body of every artifact, results as
  cards, facets by kind and plugin, and a Cmd+K / Ctrl+K command palette.
- **G3 Detail and install** - Plugin and artifact detail pages with hash-route deep links,
  rendered Markdown, dependency display, and a Copy install command.
- **G4 Releases and onboarding** - A home page with real catalog stats, a "What's new" feed built
  from the CHANGELOGs, a getting-started page, and an empty-catalog state.
- **G5 Content safety** - Plugin Markdown and metadata are treated as untrusted: sanitized before
  rendering, no external requests at runtime, and output that works under a strict Content
  Security Policy.
- **G6 Usability** - Dark-first theme with a light option, colored artifact kinds, keyboard and
  screen-reader access, sufficient contrast, reduced motion, phone-width layout, and every UI string
  in one English translations file.
- **G7 Delivery** - A Pages workflow (build and deploy from `main` and on manual dispatch) and a
  separate pull-request workflow (build, typecheck, test, `npm audit` report), both least-privilege,
  with exactly pinned npm packages and actions and a committed npm lockfile.
- **G8 Repository invariants** - The validator stays dependency-free and unchanged in behavior;
  every existing test keeps passing without being weakened; repository docs describe the site.

### Non-goals

- Download, install or view counts, ratings, authors per artifact, keywords or tags that the
  repository does not contain. No backend, no analytics, no cookies.
- LLM or embedding-based search. Search is keyword search only.
- A dependency graph visualization. Dependencies are shown as lists with links.
- Languages other than English. One translations file exists; no language switcher.
- Rendering images from plugin Markdown, or fetching anything from a third-party origin at runtime.
- A custom domain, a 404 page for path routing (hash routing makes it unnecessary), server-side
  rendering or a service worker.
- Changes to plugins, plugin versions, CHANGELOG content or the catalog.
- New validator rules or changes to validator behavior. The validator may scan the new files as it
  already scans every tracked file (Decision 6).
- Making the site checks required in branch protection (owner may do it later, see Owner steps).
- Copying code from the design reference.

## Definitions

- **Artifact** - one catalog item of a kind: `plugin`, `skill`, `agent`, `command`, `hook` or `mcp`.
  A skill is `plugins/<p>/skills/<name>/SKILL.md`; an agent is `plugins/<p>/agents/<name>.md`; a
  command is `plugins/<p>/commands/<name>.md`; a hook is one hooks configuration of a plugin
  (`plugins/<p>/hooks/hooks.json` or `hooks` in `plugin.json`); an mcp artifact is one server name
  declared in `plugins/<p>/.mcp.json` or `mcpServers` in `plugin.json`. Today the catalog has no
  commands, hooks or MCP servers; the indexer still recognizes them so the site does not need a
  change when one is added.
- **Kind order** - `plugin`, `skill`, `agent`, `command`, `hook`, `mcp`.
- **Artifact ID** - `<plugin>` for a plugin, `<plugin>/<kind>/<name>` otherwise. Every segment
  matches `^[a-z0-9][a-z0-9-]*$`.
- **Data files** - the indexer output: `index.json`, `releases.json`, `stats.json` and the
  `bodies/` folder. They are generated, never committed.
- **Base URL** - `https://ochubey.github.io/home-ai-marketplace-learning/`; Vite `base` is
  `/home-ai-marketplace-learning/`.
- **Install commands** - exactly these two lines, with `<plugin>` replaced by the plugin name:
  `claude plugin marketplace add ochubey/home-ai-marketplace-learning` and
  `claude plugin install <plugin>@home-ai-marketplace-learning`.
- **Site checks** - `npm ci`, the site typecheck, the site tests and the production build, run in
  `site/`.

## Routes (external contract)

| Hash route | Screen |
|---|---|
| `#/` (or empty hash) | Home |
| `#/search?q=<text>&kind=<kind>[,<kind>]&plugin=<name>[,<name>]` | Search results |
| `#/plugins/<plugin>` | Plugin detail |
| `#/plugins/<plugin>/<kind>/<name>` | Artifact detail (kind is not `plugin`) |
| `#/whats-new[?plugin=<name>]` | What's new |
| `#/getting-started` | Getting started |
| anything else | Not found |

## Data contract (external contract)

Served under the base URL at `data/index.json`, `data/releases.json`, `data/stats.json` and
`data/bodies/<artifact ID>.md`. Every JSON file carries `schemaVersion: 1`.

- `index.json` - `marketplace` (`name`, `owner`, `description`), `source` (`repoUrl`, `commit`
  short SHA or null, `commitDate` ISO or null), `plugins[]` and `artifacts[]`.
  - A plugin record: `id`, `name`, `version`, `description`, `author` (as in `plugin.json`, or
    null), `dependencies[]` (`name`, `marketplace` or null, `range` or null, `inCatalog` boolean),
    `usedBy[]` (names of catalog plugins that depend on it), `counts` per kind, `hasReadme`,
    `sourcePath`.
  - An artifact record: `id`, `kind`, `plugin`, `name`, `namespacedName` (`<plugin>:<name>`),
    `description` (or null), `frontmatter` (only the allowlisted display keys, Decision 12),
    `sourcePath`, `supportingFiles[]` (repository-relative paths in the artifact folder), `hasBody`,
    `searchText` (plain text of the body, capped, Decision 9).
- `releases.json` - `releases[]` with `plugin`, `version`, `date` (ISO or null), `isCurrent`
  (equals the manifest version), `body` (Markdown of that CHANGELOG section).
- `stats.json` - `plugins`, counts per kind, `dependencyEdges`, `releases`, `commit`, `commitDate`.
- `bodies/<artifact ID>.md` - the Markdown body of the artifact (frontmatter removed), or the
  plugin README for a plugin ID. Stored as raw text, never as pre-rendered HTML.

## User stories

- **US-1** (G2) As a consumer, I want to type "spec" or "zod" and get matching cards for plugins,
  skills and agents, so that I find the right artifact without knowing the repository layout.
- **US-2** (G2) As a keyboard user, I want Cmd+K / Ctrl+K to open a palette where I can search and
  jump anywhere, so that I never need the mouse.
- **US-3** (G3) As a consumer, I want a detail page per plugin and per artifact that I can link to,
  so that I can share "this skill" with a colleague.
- **US-4** (G3) As a consumer, I want to copy the two install commands in one click and see the
  plugin's dependencies, so that installation works the first time.
- **US-5** (G4) As a consumer, I want a release feed built from the CHANGELOGs and a
  getting-started page, so that I know what changed and how to start.
- **US-6** (G1, G5) As a code owner, I want every fact on the site computed from repository files
  and every plugin text sanitized, so that the public site neither lies nor runs injected script.
- **US-7** (G6) As a user on a phone or with assistive technology, I want a readable, operable site
  in dark or light theme, so that the catalog is usable for everyone.
- **US-8** (G7) As a maintainer, I want the site deployed from `main` automatically and checked on
  every pull request with least privilege and pinned dependencies, so that delivery is safe and
  repeatable.
- **US-9** (G8) As a maintainer, I want the validator and test suite untouched in strength and free
  of site dependencies, so that Phase 1 to 3 guarantees still hold.

## Acceptance criteria (EARS)

Notation as in SPEC-01 to SPEC-03: WHEN (event), WHILE (state), IF ... THEN (unwanted behavior),
WHERE (optional feature), no keyword = ubiquitous; `shall` marks the requirement. English keywords
are used because the repository's English-only test rejects Cyrillic in tracked files (Decision 1).
"The indexer" is `scripts/build-index.mjs`. "The site" is the production build of `site/`.

### Indexer and data (G1)

- **AC-1** The indexer shall import only `node:` built-in modules and files under `scripts/`, and
  shall run with Node 22 without `npm install` anywhere.
  *Verify:* a `node --test` test parses the imports of the indexer and every module it imports and
  asserts each is `node:*` or a relative path under `scripts/`; run it in a clean clone.
- **AC-2** WHEN the indexer runs on the repository, it shall write `index.json`, `releases.json`,
  `stats.json` and one `bodies/<artifact ID>.md` per artifact that has a body, conforming to the
  data contract, and exit 0.
  *Verify:* `node --test` integration test runs the indexer into a temp output dir and asserts the
  file set and the required keys.
- **AC-3** The indexer shall list exactly the catalog plugins in catalog order, with `version`,
  `description` and `author` taken from each `plugin.json`, and shall list every skill, agent,
  command, hook and mcp artifact per the Definitions.
  *Verify:* fixture test with one plugin of each kind; repository test asserts 4 plugins and the
  skill and agent names found on disk.
- **AC-4** The indexer shall take each skill, agent and command `name` and `description` from its
  frontmatter. IF the frontmatter has no `name`, THEN the name shall be the folder or file name;
  IF it has no `description`, THEN `description` shall be null. Neither case shall stop the run.
  *Verify:* fixture tests for missing `name`, missing `description`, and missing frontmatter.
- **AC-5** The indexer shall derive artifact IDs and body file paths from repository paths, never
  from frontmatter values. IF a path segment does not match `^[a-z0-9][a-z0-9-]*$`, THEN the
  artifact shall be skipped with a warning naming the path.
  *Verify:* fixture test with frontmatter `name: ../../evil` (body written under the folder name)
  and a folder `Bad Name` (skipped, warning printed, no file outside the output dir).
- **AC-6** The indexer shall accept the three dependency forms the validator accepts (`"name"`,
  `"name@marketplace"`, `{ name, marketplace?, version? }`) and record `name`, `marketplace`,
  `range` and `inCatalog` for each. `usedBy` shall be the exact reverse of the catalog-internal
  edges.
  *Verify:* fixture tests for each form, a dependency not in the catalog (`inCatalog: false`), and
  the repository (`sdd-engineering` depends on the other three; `architecture-review` is used by
  `sdd-engineering`).
- **AC-7** The indexer shall build `releases.json` from each plugin's `CHANGELOG.md`, one release
  per `## <semver>` heading, with the section text as `body`. WHERE the heading carries an ISO date
  (`## 1.2.0 - 2026-10-01` or `## 1.2.0 (2026-10-01)`), `date` shall be that date; otherwise
  `date` shall be null. It shall not infer dates from file times or git history.
  *Verify:* fixture tests for dated, undated and non-semver headings (ignored); the repository
  produces 5 releases, all with `date: null`.
- **AC-8** IF a plugin has no `CHANGELOG.md`, no `README.md`, or an unreadable artifact file, THEN
  the indexer shall print a warning naming the file, omit only the missing part, and continue.
  *Verify:* fixture tests for each missing file; exit code 0; warning text asserted.
- **AC-9** IF `.claude-plugin/marketplace.json` is missing or not valid JSON, or a catalog entry's
  `plugin.json` is missing or invalid, THEN the indexer shall print an error naming the file, exit
  non-zero, and leave no partial set of data files in the output directory.
  *Verify:* fixture tests; assert exit code 1 and that the output dir holds no new data files.
- **AC-10** WHEN the catalog has zero plugins, the indexer shall exit 0 and write data files with
  empty `plugins`, `artifacts` and `releases` and zero counts.
  *Verify:* fixture test with `"plugins": []`.
- **AC-11** The indexer shall store Markdown exactly as found (frontmatter removed) in `bodies/`
  and as plain text in `searchText`; it shall not render HTML. Hostile content (`<script>`,
  `onerror=`, `javascript:` links, `</script>` inside text, HTML comments, null bytes) shall be
  preserved as data in the body and shall produce valid JSON.
  *Verify:* fixture test with an XSS-ish SKILL.md; assert the body equals the source minus
  frontmatter and `JSON.parse` succeeds on every JSON file.
- **AC-12** The indexer shall not follow symbolic links and shall read only files inside
  `plugins/` and `.claude-plugin/`.
  *Verify:* fixture test with a symlinked skill folder pointing outside `plugins/`; it is skipped
  with a warning.
- **AC-13** WHEN the indexer runs twice on the same tree, the outputs shall be byte-identical.
  Arrays shall be sorted (catalog order for plugins, kind order then name for artifacts, plugin
  then semver descending for releases).
  *Verify:* test runs it twice into two temp dirs and compares bytes.
- **AC-14** `source.commit` and `source.commitDate` shall come from git for the built tree;
  IF git is unavailable, THEN both shall be null and no value shall be invented.
  *Verify:* fixture test without a `.git` dir asserts nulls.
- **AC-15** The data files and the site build output shall be ignored by git, so that a full build
  leaves `git status --porcelain` unchanged.
  *Verify:* run the site build in a clean clone, then `git status --porcelain` is empty.

### Search, cards, facets and palette (G2)

- **AC-16** WHEN the user enters a query, the site shall search with MiniSearch over `name`,
  `description` and `searchText` of all artifacts (plugins included), with `name` weighted
  highest, prefix matching on, and light fuzzy matching, and shall show results as cards ordered by
  score, ties broken by kind order then name.
  *Verify:* site unit test on the search module with a fixture index: "zod" ranks the `zod` skill
  first; "spec" finds `spec-creator`; a word only in a body is found.
- **AC-17** WHILE the query is empty, the search results screen shall show all artifacts ordered by
  kind order then name.
  *Verify:* site unit test.
- **AC-18** Each card shall show the kind badge (color and text label), the name, the parent plugin
  (except for plugins), the description or a "No description" text, and for plugins the version;
  activating a card shall open its detail route.
  *Verify:* site component test; manual check.
- **AC-19** The results screen shall offer facets for kind (all six kinds) and plugin, each with
  the count of matching results for the current query. Selections shall combine as OR within a
  facet and AND across facets. A facet value with zero matches shall be shown disabled.
  *Verify:* site unit test on the facet function; manual check that `command` shows 0 and is
  disabled today.
- **AC-20** WHEN the query or a facet changes, the hash route shall update (`q`, `kind`, `plugin`),
  and WHEN a search route is opened directly, the query and facets shall be restored from it.
  *Verify:* site unit test on route parsing and serializing; manual deep-link check.
- **AC-21** WHEN a query has no results, the site shall show a no-results state that names the
  query, offers to clear the facets when any are active, and links to the full catalog.
  *Verify:* site component test.
- **AC-22** WHEN the user presses Cmd+K (macOS) or Ctrl+K (other platforms) anywhere on the site,
  a command palette shall open with focus in its input; it shall list matching artifacts and the
  actions Home, What's new, Getting started and Toggle theme.
  *Verify:* site component test dispatching the key events; manual check on macOS and one other OS.
- **AC-23** WHILE the palette is open, Arrow Up and Arrow Down shall move the active item, Enter
  shall run it, Escape shall close the palette, focus shall stay inside the palette, and WHEN it
  closes, focus shall return to the element that had it before.
  *Verify:* site component test; manual keyboard check.
- **AC-24** WHEN the user presses `/` while focus is not in a text field, focus shall move to the
  header search field.
  *Verify:* site component test.

### Detail pages, dependencies and install (G3)

- **AC-25** The plugin detail screen shall show name, version, description, author, the install
  commands with a Copy button, dependencies, "Used by", the plugin's artifacts grouped by kind, the
  rendered README, a link to its releases (`#/whats-new?plugin=<name>`) and a link to its source
  folder on GitHub.
  *Verify:* site component test with a fixture plugin; manual check on `sdd-engineering`.
- **AC-26** Each dependency shall show its name and version range; WHERE it is in the catalog, it
  shall link to its plugin detail route; otherwise it shall be shown as text marked "not in this
  catalog". A plugin with no dependencies shall say so.
  *Verify:* site component test for in-catalog, out-of-catalog and none.
- **AC-27** The artifact detail screen shall show kind, name, namespaced name, parent plugin (as a
  link), description, the allowlisted frontmatter fields, the install commands of the parent
  plugin with a Copy button, the rendered body, and supporting files as links to GitHub.
  *Verify:* site component test; manual check on `sdd-engineering/skill/run-plan` and
  `research-tools/agent/researcher`.
- **AC-28** WHERE an artifact is a hook or mcp artifact, its detail screen shall show the hook
  event names or the MCP server name and transport type only, and shall never show command lines,
  arguments, URLs with credentials or `env` values.
  *Verify:* indexer fixture test asserts that `env`, `args` and `headers` values are absent from
  `index.json`; site component test.
- **AC-29** WHEN the user activates Copy, the site shall copy exactly the install commands as two
  lines and announce "Copied" in a polite live region for at least 2 seconds.
  *Verify:* site component test with a mocked clipboard asserts the exact text; manual check.
- **AC-30** IF the clipboard is unavailable or denied, THEN the site shall select the command text
  and show a message telling the user to copy it with the keyboard.
  *Verify:* site component test with a rejecting clipboard mock.
- **AC-31** WHEN a detail route names a plugin or artifact that is not in `index.json`, the site
  shall show the not-found screen with links to Home and to search for that name.
  *Verify:* site component test; manual check with `#/plugins/nope`.
- **AC-32** WHEN the route changes, the site shall set the document title to
  `<screen or item name> - <site name>` and move focus to the main heading.
  *Verify:* site component test.

### Home, releases, getting started, states (G4)

- **AC-33** The home screen shall show the search field, a stats tile with counts from `stats.json`
  (plugins and each kind with a non-zero count), cards for all plugins, the five newest releases,
  and a link to Getting started.
  *Verify:* site component test with a fixture; manual check that numbers equal the repository.
- **AC-34** The "What's new" screen shall list every release from `releases.json` with plugin,
  version, date (or "date not recorded" when null), a "current" marker when `isCurrent`, and the
  rendered body; WHERE the route has `plugin`, only that plugin's releases shall be shown.
  Order: dated releases newest first, then undated ones by plugin name and semver descending.
  *Verify:* site unit test on ordering; component test for the filter.
- **AC-35** The getting-started screen shall show the commands to add the marketplace, install a
  plugin, refresh the catalog, update a plugin, reload plugins and list installed plugins, matching
  the commands in the root `README.md` character for character.
  *Verify:* a `node --test` test extracts every `claude plugin ...` and `/reload-plugins` string from
  the translations file and asserts each occurs in `README.md` and uses only the known subcommands
  listed in `tests/repo.test.mjs`.
- **AC-36** WHEN the catalog has zero plugins, home and search shall show an empty-catalog state
  that says the catalog is empty and links to `CONTRIBUTING.md` on GitHub, and shall not show
  sample or placeholder items.
  *Verify:* site component test with an empty fixture index.
- **AC-37** WHILE data files are loading, the site shall show a loading state with `aria-busy` on
  the main region; IF a data file fails to load or parse, THEN it shall show an error state that
  names the failed file and offers Retry.
  *Verify:* site component tests with pending, 404 and malformed-JSON fetch mocks.
- **AC-38** Every page shall show in the footer the commit and commit date the data was built from
  (or "unknown" when null) and a link to the repository.
  *Verify:* site component test.
- **AC-39** The site shall display only values present in the data files or the translations file;
  it shall not show download counts, ratings, per-artifact authors, tags or keywords.
  *Verify:* review of the components against the data contract; grep the translations file for
  "download", "rating", "stars".

### Content safety (G5)

- **AC-40** The site shall render Markdown with `marked` and sanitize the HTML with DOMPurify
  before inserting it. The output shall contain no `script`, `style`, `iframe`, `object`, `embed`,
  `form`, `input`, `svg` or `math` element, no `on*` or `style` attribute, and no URL with a scheme
  other than `http`, `https` or `mailto`.
  *Verify:* site unit test with an XSS corpus (script tags, `<img onerror>`, `javascript:` and
  `data:` links, SVG payloads, encoded entities, nested tags) asserting none survives.
- **AC-41** Links in rendered Markdown that point outside the site shall carry
  `rel="noopener noreferrer nofollow"` and a visible external-link indicator. Relative links shall
  be rewritten to the file's GitHub URL at the built commit (or `main` when the commit is unknown).
  *Verify:* site unit test for an absolute link, a relative `references/x.md` link and a
  `#anchor` link.
- **AC-42** Images in rendered Markdown shall not be loaded; each shall be replaced by its alt text
  and a link to the image URL (rewritten as in AC-41 when relative).
  *Verify:* site unit test; manual check with the browser network panel.
- **AC-43** At runtime the site shall request only same-origin files under the base URL. No fonts,
  scripts, styles, images or data shall come from another origin.
  *Verify:* a site test scans the build output for `http://` or `https://` in `src`, `href` of
  `link` and `script`, CSS `url()` and `@import`; manual check that the network panel on the
  deployed site shows only `ochubey.github.io` requests.
- **AC-44** The built `index.html` shall carry a Content Security Policy meta tag at least as strict
  as `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
  connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`,
  and the site shall work under it with no CSP violation reported.
  *Verify:* site test asserts the meta tag in the build output; manual check of the browser console
  on the deployed site on every screen.
- **AC-45** The build output shall contain no inline `<script>` without `src`, no inline event
  handler attributes, and no use of `eval` or `new Function` in the site's own code.
  *Verify:* site test scanning `dist/` HTML; grep of `site/src`.

### Usability and accessibility (G6)

- **AC-46** The site shall start in the dark theme. WHEN the user toggles the theme, the site shall
  switch between dark and light and remember the choice in `localStorage`. IF `localStorage` is
  unavailable, THEN the toggle shall still work for the session.
  *Verify:* site component test with and without a `localStorage` stub.
- **AC-47** Each kind shall have its own color token in both themes, and every kind badge shall
  also show the kind as text, so color is never the only signal.
  *Verify:* site unit test asserts six distinct tokens per theme; component test asserts the label.
- **AC-48** Body text, badge text and focus indicators shall meet WCAG 2.2 AA contrast (4.5:1 for
  text, 3:1 for large text, UI components and focus indicators) in both themes.
  *Verify:* site unit test computes contrast ratios from the theme tokens; manual spot check with a
  contrast checker.
- **AC-49** Every interactive element shall be reachable and operable with the keyboard in a
  logical order, shall show a visible focus indicator, and the page shall offer a "Skip to content"
  link as its first focusable element.
  *Verify:* manual keyboard pass over all six screens and the palette, recorded in the PR.
- **AC-50** The site shall use semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per
  screen, `lang="en"`, accessible names for icon-only buttons, and a polite live region that
  announces the result count after a search.
  *Verify:* site component tests with role queries; manual screen-reader smoke test (VoiceOver or
  NVDA) recorded in the PR.
- **AC-51** WHILE the user's system requests reduced motion, the site shall disable transitions and
  animations.
  *Verify:* site test asserts a `prefers-reduced-motion: reduce` rule in the built CSS; manual check
  with the OS setting.
- **AC-52** WHEN the viewport is 360 CSS pixels wide, every screen and the palette shall be usable
  without horizontal page scrolling, cards shall stack in one column, and long names and code
  blocks shall wrap or scroll inside their own box.
  *Verify:* manual check in browser device mode at 360x740 on all six screens, recorded in the PR.
- **AC-53** All user-visible UI strings shall come from one English translations file in `site/`;
  components shall reference strings by key, and a missing key shall fail the typecheck.
  *Verify:* typecheck with typed keys; review that components hold no literal user-facing text.

### Delivery and CI (G7)

- **AC-54** `.github/workflows/pages.yml` shall run on `push` to `main` and on `workflow_dispatch`
  only, with workflow-level permissions `contents: read`, and a deploy job that alone adds
  `pages: write` and `id-token: write` and uses the `github-pages` environment.
  *Verify:* a `node --test` workflow-shape test (as T20 does for `validate.yml`).
- **AC-55** The Pages build job shall check out with `persist-credentials: false`, set up Node 22,
  run the validator, run the indexer and the site checks, and upload the build output with
  `actions/upload-pages-artifact`; the deploy job shall depend on it and use `actions/deploy-pages`.
  A failure in any step shall stop the deployment.
  *Verify:* workflow-shape test; first deploy run log.
- **AC-56** The Pages workflow shall use a concurrency group for Pages that does not cancel an
  in-progress deployment.
  *Verify:* workflow-shape test asserts `concurrency` with `cancel-in-progress: false`.
- **AC-57** A separate workflow `.github/workflows/site.yml` shall run on `pull_request` with
  permissions `contents: read` only, set up Node 22, run the indexer and the site checks, and run
  `npm audit` in `site/`. `validate.yml` shall stay unchanged.
  *Verify:* workflow-shape test; `git diff main -- .github/workflows/validate.yml` is empty.
- **AC-58** The `npm audit` step shall write the count of findings per severity to the job summary.
  IF a high or critical finding exists in a runtime (non-dev) dependency, THEN the job shall fail;
  findings only in dev dependencies shall be reported without failing.
  *Verify:* workflow review; job summary on the phase PR run.
- **AC-59** WHEN the phase PR is opened, its description shall include the `npm audit` summary
  (counts per severity for all and for runtime dependencies) from the final commit, and any finding
  shall be listed with its package and the reason it is accepted or the fix.
  *Verify:* PR description review.
- **AC-60** Neither site workflow shall use `pull_request_target`, `secrets.*`, untrusted
  `github.event` or `github.head_ref` expressions in `run` steps, or actions outside
  `actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact` and
  `actions/deploy-pages`.
  *Verify:* workflow-shape test.
- **AC-61** Every `uses:` in the two new workflows shall be pinned to a full 40-character commit
  SHA with a trailing comment naming the exact release tag; `actions/checkout` and
  `actions/setup-node` shall be on the same major as `validate.yml` (v7).
  *Verify:* workflow-shape test asserts the SHA pattern and the comment; reviewer checks each SHA
  against the tag on GitHub.
- **AC-62** `site/package.json` shall list every dependency with an exact version (no `^`, `~`,
  ranges, tags, git or URL specifiers), `site/package-lock.json` shall be committed, and CI shall
  install with `npm ci`.
  *Verify:* a `node --test` test reads `site/package.json` and asserts the exact-version pattern
  and that the lock file exists; workflow-shape test asserts `npm ci`.
- **AC-63** Runtime dependencies shall be only `react`, `react-dom`, `minisearch`, `marked` and
  `dompurify`. Dev dependencies shall be limited to Vite and its React plugin, TypeScript, React
  type packages, Vitest and one DOM environment for Vitest (plus Testing Library only if a test
  needs it).
  *Verify:* the same test asserts the runtime set exactly and the dev set as a subset of the
  allowed list.
- **AC-64** WHEN the Pages workflow has deployed, the site shall be reachable at the base URL and
  every route in the Routes table shall load from a direct link.
  *Verify:* after the first deploy, open each route type on the live URL; record in the PR or a
  follow-up comment.

### Repository invariants and docs (G8)

- **AC-65** WHEN `node scripts/validate-marketplace.mjs` runs on the repository, it shall exit 0
  and report `OK - 4 plugins checked`, with no change to any file under `scripts/lib/` and no new
  entry in `scripts/validate-allowlist.json`.
  *Verify:* run it; `git diff main -- scripts/lib scripts/validate-allowlist.json` is empty.
- **AC-66** The validator shall scan the tracked files under `site/` (including
  `site/package-lock.json`) as it scans every tracked file, and shall report no secret or
  `abs-path` finding there. Test fixtures in `site/` and `tests/` shall not contain literals that
  match a validator rule.
  *Verify:* validator output on the branch.
- **AC-67** WHEN `node --test` runs at the repository root without `site/node_modules` present, it
  shall pass, shall run the new indexer and workflow tests, and shall not discover or run any file
  under `site/`.
  *Verify:* run in a clean clone without `npm ci`; inspect the reported file list.
- **AC-68** No existing test assertion shall be removed or loosened, and the test count reported
  by `node --test` shall not decrease. Changes to existing tests shall only add files to lists
  (for example `docs/SITE-SPEC.md` to the docs list checked by the CLI-accuracy test).
  *Verify:* compare test counts on `main` and the branch; line-by-line review of `tests/` diff.
- **AC-69** The root `README.md` repository layout shall have a `site/` row, mention the two new
  workflows in the `.github/` row, name `docs/SITE-SPEC.md` as present, and give the base URL. No
  repository doc checked by the existing tests shall contain the words "lockfile" or "lock file"
  (the existing forbidden-claims test rejects them); docs refer to `site/package-lock.json` by name.
  *Verify:* the existing T12 layout test and forbidden-claims test pass.
- **AC-70** `docs/SITE-SPEC.md` shall describe for maintainers: the data contract, the routes, how
  to run the indexer and the site locally, the content-safety model, the dependency policy, and the
  owner steps. It shall use only known `claude plugin` subcommands.
  *Verify:* review; the CLI-accuracy test covers it once added to the docs list.
- **AC-71** All new tracked files shall be in English.
  *Verify:* the existing English-only test (T17a).

### Traceability

G1: AC-1 to AC-15. G2: AC-16 to AC-24. G3: AC-25 to AC-32. G4: AC-33 to AC-39.
G5: AC-40 to AC-45. G6: AC-46 to AC-53. G7: AC-54 to AC-64. G8: AC-65 to AC-71.

## Edge cases

- **Empty catalog** - indexer writes empty data (AC-10); site shows the empty state (AC-36).
- **Kinds with no artifacts** (today: command, hook, mcp) - facet shown with 0 and disabled
  (AC-19); stats tile hides zero counts (AC-33).
- **Malformed or missing frontmatter** - fallback name, null description, run continues (AC-4).
- **Frontmatter name that differs from the folder** - ID and URL use the folder; the displayed name
  is the frontmatter name (AC-5). Existing tests already require them to match in this repository.
- **Path traversal or odd names** - IDs come from paths; non-kebab segments skipped (AC-5).
- **Symlinks** - not followed (AC-12).
- **Huge bodies** (for example the `zod` skill and its references) - only the main file is indexed;
  `searchText` capped and bodies capped with a truncation notice (Decision 9). Reference files are
  listed as supporting files and open on GitHub.
- **Hostile Markdown** in a plugin file - stored raw (AC-11), sanitized on render (AC-40), images
  not loaded (AC-42), CSP as second line (AC-44).
- **MCP config with secrets** - only server name and transport are indexed (AC-28).
- **Dependency outside the catalog or on another marketplace** - shown as text, not a link
  (AC-26). The validator rejects this in CI today, but the site does not depend on that.
- **CHANGELOG without dates, or version heading not semver** - date null, heading ignored (AC-7).
- **Manifest version without a matching CHANGELOG section** - no release is marked current; the
  indexer prints a warning.
- **Unknown or malformed hash route** - not-found screen (AC-31); unknown `kind` or `plugin` values
  in a search route are ignored.
- **Data load failure or partial deploy** - error state with Retry (AC-37).
- **Clipboard denied** (insecure context, permissions) - fallback selection (AC-30).
- **`localStorage` blocked** - theme works per session (AC-46).
- **Two pushes to `main` in quick succession** - deployments queue in the Pages concurrency group;
  the last one wins (AC-56).
- **Pages not enabled yet** - the deploy job fails with a Pages error; the owner enables Pages
  (Owner steps) and re-runs via `workflow_dispatch`.
- **Fork pull requests** - `site.yml` needs no secrets and has read-only permissions (AC-57, AC-60).
- **New advisory published for a pinned dependency** - the PR job reports it; it fails only for
  high or critical runtime findings (AC-58).
- **Very long names or code lines on a phone** - wrap or scroll inside their box (AC-52).
- **Root `node --test` and site test files** - Node's default test discovery could pick up files
  under `site/`; AC-67 requires that it does not (Decision 15).

## Non-functional requirements

- **Performance:** for the current catalog, the indexer finishes in under 5 s; the site's
  JavaScript is at most 200 KB gzip in total; a search returns in under 50 ms on a mid-range laptop;
  `index.json` is at most 1 MB uncompressed. The validator stays under its 10 s budget.
- **Security:** no backend, no secrets, no cookies, no analytics, no third-party requests. Plugin
  content is untrusted (Untrusted inputs). Least-privilege workflows with SHA-pinned actions, exact
  npm versions, a committed lock file, and `npm audit` reporting. GitHub Pages cannot send HTTP
  headers, so the CSP is a meta tag and `frame-ancestors` cannot be set (documented in
  `docs/SITE-SPEC.md`).
- **Accessibility:** WCAG 2.2 AA basics: keyboard operation, visible focus, contrast, landmarks,
  reduced motion, text labels with colors (AC-46 to AC-52).
- **Responsiveness:** usable from 360 px wide to desktop (AC-52).
- **Observability:** indexer prints warnings and errors with file paths and a summary line
  (counts per kind); the footer shows the source commit; workflow summaries show audit counts.
- **Determinism:** identical input gives identical data files (AC-13).
- **Portability:** the indexer runs on macOS, Linux and Windows with Node 22 (POSIX-normalized
  paths, as the validator does).
- **Maintainability:** the site is its own npm project in `site/`; nothing at the repository root
  needs `npm install` (the root is not a workspace).

## Inputs and provenance

| Input | Provenance |
|---|---|
| Scope, screens, stack, URL, install commands, CI shape, constraints | `[reused: caller task]` |
| Feature selection (keyword search, cards, Copy install, deep links, facets, keyboard search, release feed, repository stats; no download stats without a backend) | `[reused: course lab transcript, L08]` |
| Visual design (layout, accent color, dark-first) | `[reused: design reference Catalog.dc.html]` - not read in this session, see Open questions |
| Spec format and conventions | `[reused: specs/phase-3-sdd-engineering.md]` |
| Existing invariants (English-only, README layout, forbidden words, validate.yml shape, plugin rules) | `[reused: tests/repo.test.mjs, tests/repo-docs.test.mjs, tests/plugins.test.mjs]` |
| Validator file discovery (git ls-files with standard excludes, skips `node_modules`) and dependency forms | `[reused: scripts/lib/files.mjs, scripts/lib/deps.mjs]` |
| Catalog, versions, descriptions, authors, dependencies | `[deterministic: indexer from marketplace.json and plugin.json]` |
| Artifact list, names, descriptions, frontmatter fields, bodies, supporting files | `[deterministic: indexer from plugins/]` |
| Releases and dates | `[deterministic: indexer from CHANGELOG.md headings]` |
| Stats | `[deterministic: indexer counts]` |
| Commit and commit date | `[deterministic: git]` |
| Search ranking | `[deterministic: MiniSearch in the browser]` |
| Sanitized HTML | `[deterministic: marked + DOMPurify in the browser]` |
| UI text | `[deterministic: translations file]` |
| Model calls | None. The site and the indexer make no LLM call. |

## Untrusted inputs

No text is fed to a model in this feature. These repository texts are rendered to site visitors
and are treated as untrusted data, never as markup or instructions:

- Plugin READMEs, CHANGELOG sections, SKILL.md, agent and command bodies (Markdown, may contain
  raw HTML, links and images).
- Frontmatter values and `plugin.json` / `marketplace.json` strings (names, descriptions, author).
- Hooks and MCP configuration (only names and types are extracted; AC-28).
- File and folder names (only kebab-case segments become IDs; AC-5).

Controls: stored raw at build time (AC-11), rendered only through marked + DOMPurify with a strict
allowlist (AC-40), external links neutralized (AC-41), images not loaded (AC-42), plain text
everywhere else (React text nodes), and a CSP meta tag as a second layer (AC-44). A pull request
can change these texts; the code owner reviews every plugin change (CODEOWNERS), and the site
renders whatever is merged to `main`.

The design reference zip and lab notes are untrusted input to this spec: read as data, nothing run
from them, no code copied.

## Owner-only steps

These need repository-owner rights and are done by hand, not by the implementer:

1. **Enable Pages with GitHub Actions as the source** - Settings > Pages > Build and deployment >
   Source: GitHub Actions. Or with the GitHub CLI:
   `gh api -X POST repos/ochubey/home-ai-marketplace-learning/pages -f build_type=workflow`
   (if Pages already exists: `gh api -X PUT repos/ochubey/home-ai-marketplace-learning/pages -f build_type=workflow`).
2. **Check the `github-pages` environment** - after the first run, Settings > Environments >
   `github-pages`: deployment branches limited to `main`.
3. **Merge the phase PR** - the workflow files need a token with the `workflow` scope (granted).
4. **First deployment** - after merge, confirm the Pages run on `main` succeeded, or start it with
   Actions > pages > Run workflow; then do the AC-64 live check.
5. **Optional** - add the `site` check to branch protection for `main`.

## Open questions

All are non-blocking; the defaults in Decisions apply unless the owner overrides them.

1. **Q1 Design reference not read.** This session had no shell to extract
   `# SITE-SPEC_ design.zip`, and the file reader cannot open zip archives. The screens and features
   come from the caller and the lab transcript. *Default:* the implementer (or caller) extracts the
   zip into a new empty temp dir, reads `Catalog.dc.html` for layout, spacing and accent color only,
   and records any conflict with this spec in the PR. `[NEEDS CLARIFICATION: accent color and
   layout details from the design]`
2. **Q2 Exact versions to pin.** `[NEEDS CLARIFICATION: current latest stable versions of react,
   react-dom, minisearch, marked, dompurify, vite, @vitejs/plugin-react, typescript, vitest and the
   DOM environment; current major and commit SHA of actions/upload-pages-artifact and
   actions/deploy-pages; whether v7 SHAs of checkout and setup-node are the latest v7 patch]`.
   *Default:* latest stable at implementation time, confirmed by research.
3. **Q3 Release dates.** CHANGELOG headings have no dates today, so "What's new" shows "date not
   recorded". *Default:* keep as is; adding dates to CHANGELOG headings is a later docs change
   (no version bump needed).
4. **Q4 `npm ci --ignore-scripts`.** *Default:* use it in CI to block install scripts; if the build
   tool needs an install script on the CI runner, drop the flag and record why in the PR.
5. **Q5 Audit gate strictness.** *Default:* fail on high or critical runtime findings only (AC-58).
   Alternative: report only, never fail.

### Research to delegate (via caller to `research-tools:researcher`)

- Q2: latest stable package versions and action majors and SHAs; whether
  `actions/upload-pages-artifact` and `actions/deploy-pages` need `actions/configure-pages` when
  Pages is already set to GitHub Actions.
- Whether Node 22's default `node --test` discovery (with type stripping in recent 22.x) matches
  `.ts` test files, to choose the safest naming or root test invocation for AC-67.
- The DOMPurify configuration that removes SVG and MathML and enforces the URL scheme allowlist
  with the pinned version (AC-40).
- Whether Vite's production output needs any inline script or style that the CSP in AC-44 would
  block (for example the module preload polyfill).

## Decisions (2026-10-17; defaults taken without asking)

1. **English EARS keywords** (WHEN, WHILE, IF ... THEN, WHERE) instead of Ukrainian, because the
   repository's English-only test (T17a) rejects Cyrillic in every tracked file, specs included.
2. **Spec file name** `specs/phase-4-catalog-site.md` follows the repository's `phase-N-*`
   convention, as the caller asked.
3. **Hash routing without a router library**; route table above is the contract.
4. **Data under `data/`** in the build output; written by the indexer into the site's static
   folder before the Vite build; git-ignored (AC-15).
5. **Sanitizing happens in the browser**, because the indexer must stay dependency-free and
   DOMPurify needs a DOM. The indexer stores raw Markdown only.
6. **The validator scans `site/`.** It already lists tracked files with standard git excludes, so
   `node_modules`, the build output and the data files are skipped and site sources and the lock
   file are checked for secrets and home paths. No validator change, no allowlist entry.
7. **Two new workflows:** `pages.yml` (push to `main`, `workflow_dispatch`; build and deploy) and
   `site.yml` (pull requests; checks and audit). `validate.yml` is unchanged; its test forbids
   Pages and deploy words in it.
8. **No path filter on `site.yml`**, so it reports on every PR and can become a required check
   later without hanging.
9. **Body and search caps:** only the main artifact file is indexed (SKILL.md, agent or command
   file, plugin README); `searchText` capped at 20,000 characters; bodies capped at 200 KB with a
   truncation notice and a GitHub link.
10. **Search tuning:** fields `name` (boost 3), `description` (boost 2), `searchText` (boost 1);
    prefix on; fuzzy 0.2. Plugin names are searchable as their own artifacts.
11. **Facets:** kind and plugin only; the repository has no tags, keywords or categories.
12. **Frontmatter shown:** agents `tools`, `disallowedTools`, `model`; skills `allowed-tools`,
    `argument-hint`, `disable-model-invocation`; commands `description`, `argument-hint`. Other keys
    are not indexed.
13. **Install commands** are the two lines in Definitions; dependencies are listed next to them,
    with no claim about automatic dependency installation (unconfirmed, see SPEC-03 AC-7).
14. **Theme:** dark by default, not following the OS setting; light on toggle, stored in
    `localStorage`. Styling with plain CSS and custom properties; no CSS-in-JS runtime, no web
    fonts (system font stack).
15. **Site tests stay out of root `node --test`**: indexer and workflow tests live in `tests/` as
    `*.test.mjs`; site tests run only through Vitest in `site/` and use a file naming or location
    that Node's default discovery does not match (to be confirmed by research).
16. **Actions pinned by commit SHA** with a tag comment; checkout and setup-node at v7 like
    `validate.yml`; no `cache:` in setup-node, matching `validate.yml`.
17. **Node 22** for all jobs and local use, as in `validate.yml`.
18. **`docs/SITE-SPEC.md` is added** as the maintainer reference (AC-70), which fulfils the
    README's "arrives in a later phase" note; `COST-BASELINE.md` stays a later-phase file.
19. **Commit date, not build time,** is shown, to keep the data deterministic (AC-13, AC-14).

## Resolutions (coordinator, before planning)

- Q1 (design reference, read from a throwaway extraction of the design bundle; nothing copied): dark-first palette with a light option. Dark: background `#0b0c0f`, elevated `#101217` / `#161920`, hover `#1c2029`, border `#23262f`, text `#e8eaef`, dim `#98a0ae`. Light: background `#f6f7f9`, surface `#ffffff`, hover `#eef0f4`, border `#e2e5ea`, text `#161a20`, dim `#5a626e`. Kind colors (dark / light): plugin hue 255, skill hue 158, agent hue 305, command hue 55, hook hue 115-132, mcp hue 20, as oklch. The design loads fonts from a font CDN; we do not (no runtime network calls). Use a system sans stack and a system monospace stack. The palette is guidance; contrast ratios must be checked by the implementer and adjusted where they fail (AC for accessibility wins).
- Q2 (pins, from the npm registry and the GitHub releases on 2026-10-17; re-check at install and record the resolved lockfile versions): react and react-dom 19.3.1, vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 7.0.2, minisearch 7.2.0, marked 18.1.1, dompurify 3.4.17, vitest 5.0.5. If a pin does not install or build, step back to the previous major and record why. Actions: checkout v7, setup-node v7 (as in validate.yml), configure-pages v6, upload-pages-artifact v5, deploy-pages v5; resolve each to a full commit SHA with `gh api` and keep the tag in a comment.
- Q3: keep "date not recorded" for releases.
- Q4: `npm ci --ignore-scripts`; if the build needs install scripts, record it and allow only the named package.
- Q5: audit gate as the spec proposes (high or critical in runtime dependencies fails the PR job; summary goes in the PR description).
- Node 22's default `node --test` discovery of `.ts` under `site/` and the CSP versus Vite output are research items for the implementer: verify by running, record the result, and adjust the config (not the tests) accordingly.
- Owner-only steps stay owner-only; branch protection now requires the `validate` check, so the new `site` check is optional.
