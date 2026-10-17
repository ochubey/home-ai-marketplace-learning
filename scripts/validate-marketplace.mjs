// Dependency-free validator for the marketplace repository. Node 22, node: built-ins only.
// Usage: node scripts/validate-marketplace.mjs [--root <dir>]
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { problem, formatReport } from './lib/report.mjs';
import { listFiles } from './lib/files.mjs';
import { checkCatalog, checkPluginDirs, checkOrphans } from './lib/catalog.mjs';
import { checkManifests } from './lib/manifest.mjs';
import { checkDeps } from './lib/deps.mjs';
import { checkCodeowners } from './lib/codeowners.mjs';
import { scanFiles } from './lib/scan.mjs';
import { applyAllowlist } from './lib/allowlist.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Runs every check. Returns { problems, stats: { plugins, files } }. Never throws. */
export function validate({ root = path.resolve(SCRIPT_DIR, '..') } = {}) {
  const problems = [];
  const stats = { plugins: 0, files: 0 };
  try {
    const { files } = listFiles(root);
    const catalog = checkCatalog(root, files, problems);
    checkPluginDirs(root, files, catalog, problems);
    if (catalog.entries.length > 0 || files.some((f) => f.startsWith('plugins/'))) checkOrphans(files, catalog, problems);
    const manifests = checkManifests(root, catalog, problems);
    checkDeps(catalog, manifests, problems);
    checkCodeowners(root, files, catalog, problems);
    const { findings, scanned } = scanFiles(root, files);
    applyAllowlist(root, files, findings, problems);
    stats.plugins = catalog.entries.length;
    stats.files = scanned;
  } catch (err) {
    problems.push(problem('(validator)', 'internal-error', `unexpected error: ${err?.message ?? err}`, 'report this as a bug in the validator'));
  }
  return { problems, stats };
}

function parseArgs(argv) {
  const i = argv.indexOf('--root');
  return i !== -1 && argv[i + 1] ? { root: path.resolve(argv[i + 1]) } : {};
}

function main() {
  const { problems, stats } = validate(parseArgs(process.argv.slice(2)));
  process.stdout.write(formatReport(problems, stats));
  process.exitCode = problems.length === 0 ? 0 : 1;
}

const invoked = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) main();
