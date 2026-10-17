# Plan: SPEC-04 Phase 4 - catalog site on GitHub Pages

Spec: `specs/phase-4-catalog-site.md` (approved; its "Resolutions" section supersedes conflicting text, then "Decisions").
Branch `feat/catalog-site`. Node 22. The implementer never commits, branches or pushes; the coordinator commits per phase.
Mode: three sequential implementer runs: A = P0-P1, B = P2-P4, C = P5-P7 (B needs A's data contract; C needs B's build).
This file is scanned by the validator: no real home paths, no secret-like literals.

Resolved conflicts and defaults:
- configure-pages is not used (AC-60 allows only checkout, setup-node, upload-pages-artifact, deploy-pages). If a deploy needs it, stop and ask.
- Indexer fixtures are built in temp dirs by a test helper, not committed (keeps hostile Markdown, env literals and symlinks out of tracked files).
- Site tests are named `*.spec.ts(x)` under `site/src/`, no folder named `test`, so Node's default discovery never matches them. Verify by running (AC-67).
- Translations: `site/src/i18n/en.json` with typed keys via `keyof typeof en`; readable by a root node test (AC-35).
- The CSP meta is injected only at build time (Vite plugin `apply: 'build'`), `build.modulePreload.polyfill: false`; dev keeps HMR.
- Docs never use the words "lockfile" or "lock file"; they name `site/package-lock.json` (AC-69).
- `scripts/lib/*` may be imported read-only but never edited (AC-65).

## Target layout
```
scripts/build-index.mjs, scripts/site-index/{catalog,artifacts,frontmatter,releases,deps,git,write}.mjs
tests/site-index.test.mjs, tests/site-index-fixtures.mjs, tests/site-repo.test.mjs
site/{package.json,package-lock.json,tsconfig.json,vite.config.ts,index.html}
site/src/{main.tsx,App.tsx,router.ts,data.ts,search.ts,facets.ts,releases.ts,markdown.ts,theme.ts,clipboard.ts}
site/src/i18n/{en.json,t.ts}  site/src/styles/{tokens.css,app.css}  site/src/components/*  site/src/screens/*
site/src/**/*.spec.ts(x), site/src/dist-checks/*.spec.ts (run after build), site/scripts/audit-summary.mjs
.github/workflows/{site.yml,pages.yml}  docs/SITE-SPEC.md  README.md  .gitignore
```

## P0 - Preflight (run A)
Record `node --test` pass/test counts on the base, validator output (expect 4 plugins), `git status --porcelain`, `node --version`; `npm view <pkg> version` for each pin and the drift.

## P1 - Indexer, tests first (run A)
- T1.1 `tests/site-index-fixtures.mjs`: temp-repo builder with a marketplace, plugins of every kind, missing files, a symlink, `Bad Name`, a path-traversal name, hostile SKILL.md (script, onerror, javascript:, closing script tag, comment, null byte), an mcp with env/args/headers placeholders, dated/undated/non-semver CHANGELOG headings.
- T1.2 `tests/site-index.test.mjs` (red first), one describe per AC: only `node:*` or relative imports, walked transitively (AC-1); file set, required keys, `schemaVersion: 1` (AC-2); catalog order, plugin fields, all kinds (AC-3); frontmatter fallbacks (AC-4); path-derived IDs, skip and warn (AC-5); three dependency forms, `inCatalog`, reverse `usedBy` (AC-6); release parsing, no inferred dates (AC-7); missing CHANGELOG/README warns and exits 0 (AC-8); bad marketplace/plugin.json exits 1 and writes nothing (AC-9); empty catalog (AC-10); raw body equals source minus frontmatter (AC-11); symlink skipped (AC-12); two runs byte-identical (AC-13); no `.git` gives null commit (AC-14); hook/mcp keep only names, transport, events (AC-28); caps (searchText 20,000 chars, body 200 KB plus truncation notice). Repository case: 4 plugins, on-disk skill/agent names, `sdd-engineering` deps, `architecture-review` usedBy, releases all `date: null`.
- T1.3 Implement `scripts/build-index.mjs` (`--out <dir>`, default `site/public/data`) and `scripts/site-index/*`: POSIX paths, `lstat` (no symlinks), reads only `plugins/` and `.claude-plugin/`, git via `execFileSync` in try/catch, write to a temp dir then rename, one summary line per kind. Run time under 5 s.
- T1.4 `.gitignore` adds `site/node_modules/`, `site/dist/`, `site/public/data/` (AC-15).
- Gate A: `node --test` green (count >= baseline + new), validator OK.

## P2 - Site scaffold (run B)
- T2.1 `site/package.json` with exact pins from the spec Resolutions (react, react-dom, minisearch, marked, dompurify runtime; vite, @vitejs/plugin-react, typescript, vitest, @types/*, one DOM env dev). Scripts `typecheck`, `test`, `build`, `test:dist`, `index`. Create `package-lock.json` with `npm install` (never hand-edit). If a pin fails, step back one major and record why. Verify `npm ci --ignore-scripts && npm run build`.
- T2.2 `vite.config.ts`: base `/home-ai-marketplace-learning/`, modulePreload polyfill off, build-only CSP meta plugin; vitest includes `src/**/*.spec.ts?(x)`, dist-checks excluded from `test`.
- T2.3 `i18n/en.json` + `t.ts` typed keys; `t.spec.ts` uses `@ts-expect-error` on a bad key.
- T2.4 `styles/tokens.css` dark default and `[data-theme=light]` from the Resolutions palette, six kind tokens per theme, system font stacks, `prefers-reduced-motion`. `theme.ts` with localStorage in try/catch. Specs: theme with and without storage; `contrast.spec.ts` computes WCAG ratios and tokens are adjusted until they pass (AC-48); six distinct kind tokens.
- T2.5 `router.ts` parse/serialize, unknown values ignored, not-found fallback, `router.spec.ts`.
- T2.6 `data.ts` fetch `data/*.json` relative to base, loading/error state naming the file with Retry; spec with pending, 404, malformed mocks.

## P3 - Screens (run B; specs before components)
- T3.1 `search.ts` (MiniSearch, boosts 3/2/1, prefix, fuzzy 0.2, ties by kind then name; empty query lists all) and `facets.ts` (OR within a facet, AND across, counts, zero shown disabled).
- T3.2 Shell: skip link first, header/nav/main/footer, one h1, `lang="en"`, document title and focus on h1 per route, footer commit/date or "unknown" plus repo link, polite live region.
- T3.3 `Card`: kind badge color plus text, name, plugin, description or "No description", version for plugins.
- T3.4 Search screen: query/facets synced to the hash, no-results state, result-count announcement.
- T3.5 Palette: Cmd/Ctrl+K, focus trap, arrows/Enter/Escape, focus restore, actions Home/What's new/Getting started/Toggle theme; `/` focuses header search outside text fields.
- T3.6 `InstallBlock` + `clipboard.ts`: the exact two commands, "Copied" in a live region for at least 2 s, fallback selection plus keyboard hint.
- T3.7 Plugin detail (fields, install, deps with link or "not in this catalog" or none, Used by, artifacts by kind, README, releases link, GitHub source link); artifact detail (allowlisted frontmatter, parent link, install, body, supporting-file links; hook/mcp names/transport only); not-found screen.
- T3.8 Home (search, stats tile for non-zero kinds, plugin cards, 5 newest releases, Getting started link); What's new (ordering, "date not recorded", current marker, `?plugin` filter); Getting started (commands from en.json); empty-catalog state with CONTRIBUTING link and no sample items.
- T3.9 Responsive CSS (single column at 360 px, `overflow-wrap:anywhere`, `pre` horizontal scroll). No download/rating/stars strings; spec asserts it.

## P4 - Content safety (run B)
- T4.1 `markdown.spec.ts` XSS corpus (script, img onerror, javascript:/data: links, SVG/MathML, entities, nested tags); external links get `rel` plus indicator; relative links go to GitHub at the commit or `main`; `#anchor` kept; images become alt text plus link. Red first.
- T4.2 `markdown.ts`: marked then DOMPurify (forbid list, no svg/math profiles, forbid style and on* attributes, `ALLOWED_URI_REGEXP` http/https/mailto, hook for rel/indicator/link rewrite/image replacement); the only `dangerouslySetInnerHTML` sink.
- T4.3 `src/dist-checks/*.spec.ts` (run by `test:dist` after build): CSP meta at least as strict as AC-44; no inline script without src, no `on*=`; no external URL in script/link src/href, CSS `url()`/`@import`; built CSS has the reduced-motion rule. Grep of `site/src` for `eval(` and `new Function` is empty.
- Gate B: in `site/`: `npm ci --ignore-scripts && npm run index && npm run typecheck && npm test && npm run build && npm run test:dist`; root `node --test` still green and lists no `site/` file.

## P5 - CI workflows (run C)
- T5.1 Red first, `tests/site-repo.test.mjs` workflow-shape tests (text and regex): pages.yml triggers only push:main + workflow_dispatch; top-level `contents: read`; deploy job alone adds `pages: write`, `id-token: write`, environment `github-pages`, `needs: build`, deploy-pages; build job has `persist-credentials: false`, Node 22, validator, indexer, `npm ci`, typecheck, test, build, upload-pages-artifact; `concurrency` with `cancel-in-progress: false`. site.yml: `pull_request` only, `contents: read`, Node 22, indexer, site checks, `npm audit`. Both: no `pull_request_target`, no `secrets.`, no `github.event`/`github.head_ref` in run; only the four allowed actions; every `uses:` matches `@[0-9a-f]{40} # v\d+\.\d+\.\d+`; checkout/setup-node v7. Package policy: exact versions, runtime set exact, dev set within the allowed list, `site/package-lock.json` exists.
- T5.2 Write `pages.yml` and `site.yml` with SHAs resolved via `gh api repos/<o>/<r>/git/ref/tags/<tag>` (dereference annotated tags); no `cache:`; `npm ci --ignore-scripts`. `site/scripts/audit-summary.mjs` reads `npm audit --json` (all and `--omit=dev`), writes per-severity counts to the step summary, exits 1 only on high/critical runtime findings. `validate.yml` unchanged.

## P6 - Docs and repo invariants (run C)
- T6.1 Red first in `tests/site-repo.test.mjs`: every `claude plugin ...` and `/reload-plugins` string in `en.json` occurs in `README.md` and uses a known subcommand; README names `site/`, `pages.yml`, `site.yml`, `docs/SITE-SPEC.md`, the base URL.
- T6.2 `tests/repo.test.mjs`: add `docs/SITE-SPEC.md` to `DOCS` (add only).
- T6.3 README: `site/` row, `.github/` row names both workflows, SITE-SPEC mention, base URL (keep the COST-BASELINE later-phase mention). `docs/SITE-SPEC.md`: data contract, routes, local run, safety model (no frame-ancestors via meta), dependency policy, owner steps. English only. `grep -riE 'lock ?file' README.md CONTRIBUTING.md docs/` must be empty.

## P7 - Verification (run C, real output)
Validator OK with 4 plugins and no findings in `site/`; `git diff main -- scripts/lib scripts/validate-allowlist.json` empty; clean-clone `node --test` passes and lists no `site/` file; full site pipeline; JS gzip <= 200 KB and `index.json` <= 1 MB; `git status` clean of generated files; `npm audit` counts (all and runtime) for the PR text; `npm run preview` smoke run over the six screens, palette, keyboard pass, 360x740, CSP console clean, same-origin network only; mutation checks (add `^` to a pin; add `secrets.X` to site.yml; drop `ALLOWED_URI_REGEXP`; bare `fs` import in site-index; rename a spec to `*.test.mjs`), each reverted. Review `git diff main -- tests/` for removed or loosened assertions.
Owner only: enable Pages, first deploy, live route check (AC-64).
