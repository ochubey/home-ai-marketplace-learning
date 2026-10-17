#!/usr/bin/env node
// Catalog-site indexer: turns .claude-plugin/ and plugins/ into the site's data files.
// Dependency-free (node: built-ins only). Usage: node scripts/build-index.mjs [--out <dir>] [--root <dir>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_URL, KIND_ORDER, SCHEMA_VERSION } from './site-index/constants.mjs';
import { readCatalog } from './site-index/catalog.mjs';
import { scanArtifacts } from './site-index/artifacts.mjs';
import { resolveDependencies } from './site-index/deps.mjs';
import { buildReleases } from './site-index/releases.mjs';
import { readGitInfo } from './site-index/git.mjs';
import { createContext } from './site-index/util.mjs';
import { stringify, writeData } from './site-index/write.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node scripts/build-index.mjs [--out <dir>] [--root <dir>]';

function parseArgs(argv) {
  const opts = { root: REPO_ROOT, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--out' || a === '--root') && argv[i + 1] !== undefined) opts[a.slice(2)] = argv[++i];
    else return null;
  }
  opts.root = path.resolve(opts.root);
  opts.out = path.resolve(opts.out ?? path.join(opts.root, 'site', 'public', 'data'));
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    console.error(USAGE);
    return 2;
  }
  const ctx = createContext(opts.root);
  const flush = () => ctx.warnings.forEach((w) => console.error(`warning: ${w}`));

  const catalog = readCatalog(ctx);
  if (catalog.errors.length) {
    flush();
    catalog.errors.forEach((e) => console.error(`error: ${e}`));
    return 1;
  }
  const { marketplace, plugins } = catalog;
  const manifests = new Map(plugins.map((p) => [p.name, p.manifest]));
  const records = plugins.map((p) => p.record);

  const { artifacts, bodies } = scanArtifacts(ctx, plugins);
  const dependencyEdges = resolveDependencies(ctx, records, manifests, marketplace.name);
  const releases = buildReleases(ctx, records);
  const git = readGitInfo(opts.root);

  const publicPlugins = records.map((r) => ({
    id: r.id, name: r.name, version: r.version, description: r.description, author: r.author,
    dependencies: r.dependencies, usedBy: r.usedBy, counts: r.counts, hasReadme: r.hasReadme, sourcePath: r.sourcePath,
  }));
  const counts = Object.fromEntries(KIND_ORDER.map((k) => [k, artifacts.filter((a) => a.kind === k).length]));

  const files = new Map();
  files.set('index.json', stringify({
    schemaVersion: SCHEMA_VERSION,
    marketplace,
    source: { repoUrl: REPO_URL, commit: git.commit, commitDate: git.commitDate },
    plugins: publicPlugins,
    artifacts,
  }));
  files.set('releases.json', stringify({ schemaVersion: SCHEMA_VERSION, releases }));
  files.set('stats.json', stringify({
    schemaVersion: SCHEMA_VERSION,
    plugins: records.length,
    counts,
    dependencyEdges,
    releases: releases.length,
    commit: git.commit,
    commitDate: git.commitDate,
  }));
  for (const [id, body] of [...bodies].sort((a, b) => (a[0] < b[0] ? -1 : 1))) files.set(`bodies/${id}.md`, body);

  try {
    writeData(opts.out, opts.root, files);
  } catch (e) {
    flush();
    console.error(`error: ${e.message}`);
    return 1;
  }
  flush();
  for (const k of KIND_ORDER) console.log(`build-index: ${k} ${counts[k]}`);
  console.log(`build-index: releases ${releases.length}`);
  console.log(`build-index: wrote ${files.size} files to ${path.relative(process.cwd(), opts.out) || '.'}`);
  return 0;
}

process.exitCode = main();
