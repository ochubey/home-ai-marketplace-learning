# Catalog site

Maintainer reference for the static catalog site in `site/`. The approved requirements are in
`specs/phase-4-catalog-site.md`. The site is published at
https://ochubey.github.io/home-ai-marketplace-learning/ (Vite `base` is `/home-ai-marketplace-learning/`).

## What it is

A static site (Vite, React, TypeScript) with keyword search, detail pages for plugins and artifacts,
a release feed and a getting-started page. Every fact on it is computed from the repository files by
the indexer at build time. There is no backend, no analytics and no request to a third-party origin.

## Data contract

`node scripts/build-index.mjs` (or `npm run index` in `site/`) reads `.claude-plugin/` and `plugins/`
only, using Node built-ins, and writes to `site/public/data/` (generated, never committed):

- `index.json` - `schemaVersion: 1`, `marketplace`, `source` (repository URL, short commit or null,
  commit date or null), `plugins[]` and `artifacts[]`.
- `releases.json` - `schemaVersion: 1`, `releases[]` with `plugin`, `version`, `date` (ISO or null,
  never inferred), `isCurrent` and `body`.
- `stats.json` - `schemaVersion: 1`, counts per kind, dependency edges, release count, commit.
- `bodies/<artifact ID>.md` - the raw Markdown of an artifact (frontmatter removed) or of a plugin README.

Artifact kinds are `plugin`, `skill`, `agent`, `command`, `hook` and `mcp`. IDs are `<plugin>` for a
plugin and `<plugin>/<kind>/<name>` for the rest. For hooks and MCP servers only names, transport and
event names are kept, never commands, arguments, environment values or headers. Symlinks are skipped.
Bad `marketplace.json` or `plugin.json` makes the indexer exit 1 and write nothing; a missing
CHANGELOG or README is a warning.

## Routes

| Hash route | Screen |
|---|---|
| `#/` | Home |
| `#/search?q=<text>&kind=<kind>[,<kind>]&plugin=<name>[,<name>]` | Search results |
| `#/plugins/<plugin>` | Plugin detail |
| `#/plugins/<plugin>/<kind>/<name>` | Artifact detail |
| `#/whats-new[?plugin=<name>]` | What's new |
| `#/getting-started` | Getting started |
| anything else | Not found |

Hash routing is used because GitHub Pages cannot rewrite paths. Every UI string is in
`site/src/i18n/en.json`.

## Run it locally

From the repository root, with Node 22:

```
cd site
npm ci --ignore-scripts
npm run index        # generates site/public/data
npm run dev          # development server
npm run typecheck && npm test
npm run build        # production build in site/dist
npm run test:dist    # checks of the build output
npm run preview      # serves site/dist
```

The root `node --test` does not discover files under `site/`; site tests are named `*.spec.ts(x)`.

## Safety model

Plugin Markdown and metadata are untrusted. Markdown is rendered only through `marked` and then
DOMPurify with a strict allowlist in `site/src/markdown.ts`, the only place that sets HTML. Links are
limited to http, https and mailto; external links get `rel` and a visible indicator; images are not
loaded and become text with a link. Everything else is rendered as React text. The production build
adds a Content-Security-Policy meta tag (`default-src 'self'`, no inline script, no `unsafe-eval`).
GitHub Pages cannot send HTTP headers, so `frame-ancestors` cannot be set (browsers ignore it in a
meta tag); clickjacking protection is therefore not available and the site holds no sensitive action.

## Dependency policy

`site/package.json` lists exact versions only (no `^`, `~` or ranges) and `site/package-lock.json` is
committed. CI installs with `npm ci --ignore-scripts`. Runtime packages are exactly `react`,
`react-dom`, `minisearch`, `marked` and `dompurify`; development packages are limited to Vite and its
React plugin, TypeScript, React types, Vitest and a DOM environment. Both workflows pin every action
to a full commit SHA with the release tag in a trailing comment. `tests/site-repo.test.mjs` enforces
these rules.

## Workflows

- `.github/workflows/pages.yml` - on push to `main` and manual dispatch: validate, index, check,
  build, upload, then a separate deploy job (the only one with `pages: write` and `id-token: write`).
  A failing step stops the deployment.
- `.github/workflows/site.yml` - on pull requests: the same checks without deploy, plus
  `site/scripts/audit-summary.mjs`, which writes `npm audit` counts per severity (all and runtime
  packages) to the job summary and fails only on high or critical runtime findings.

## Owner steps

1. Enable Pages with GitHub Actions as the source: Settings > Pages > Build and deployment > Source.
2. After the first run, check Settings > Environments > `github-pages`: deployment branches limited to `main`.
3. After merge, confirm the Pages run on `main` succeeded, or start it from Actions > pages > Run workflow.
4. Open each route type on the live URL from a direct link.
5. Optional: add the `site` check to branch protection for `main`.

If Pages is not enabled, the deploy job fails; enable it and re-run the workflow.
