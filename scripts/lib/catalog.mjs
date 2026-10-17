// Catalog (.claude-plugin/marketplace.json) checks. Appends problems, never throws.
import { problem } from './report.mjs';
import { readJson, isObject } from './json.mjs';
import { exists } from './files.mjs';

export const CATALOG_FILE = '.claude-plugin/marketplace.json';
const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_PREFIXES = ['claude-', 'anthropic-', 'anthropics-', 'cc-plugin-'];

/**
 * Returns { name, entries } where entries are the usable, de-duplicated catalog entries:
 * { name, source, version?, sourceOk }.
 */
export function checkCatalog(root, files, problems) {
  const result = { name: undefined, entries: [] };
  if (!files.includes(CATALOG_FILE)) {
    problems.push(
      problem(CATALOG_FILE, 'catalog-missing', 'marketplace catalog file is missing', `create ${CATALOG_FILE}`),
    );
    return result;
  }
  const read = readJson(root, CATALOG_FILE, problems);
  if (!read.ok) return result;
  const cat = read.value;
  if (!isObject(cat)) {
    problems.push(problem(CATALOG_FILE, 'catalog-field', 'catalog must be a JSON object', 'wrap the catalog in { }'));
    return result;
  }

  if (typeof cat.name !== 'string' || cat.name === '') {
    problems.push(problem(CATALOG_FILE, 'catalog-field', 'missing required field "name"', 'add a kebab-case "name"'));
  } else if (!KEBAB_RE.test(cat.name)) {
    problems.push(
      problem(CATALOG_FILE, 'catalog-field', `field "name" must be kebab-case, got "${cat.name}"`, 'use lowercase letters, digits and hyphens'),
    );
  } else {
    result.name = cat.name;
  }
  if (!isObject(cat.owner) || typeof cat.owner.name !== 'string' || cat.owner.name === '') {
    problems.push(
      problem(CATALOG_FILE, 'catalog-field', 'missing required field "owner.name"', 'add "owner": { "name": "..." }'),
    );
  }
  if (!Array.isArray(cat.plugins)) {
    problems.push(problem(CATALOG_FILE, 'catalog-field', 'missing required field "plugins" (array)', 'add "plugins": []'));
    return result;
  }

  const seen = new Set();
  cat.plugins.forEach((raw, i) => {
    const label = `plugins[${i}]`;
    if (!isObject(raw)) {
      problems.push(problem(CATALOG_FILE, 'entry-name', `${label} must be an object`, 'use { "name", "source" }'));
      return;
    }
    const name = raw.name;
    if (typeof name !== 'string' || !KEBAB_RE.test(name)) {
      problems.push(
        problem(CATALOG_FILE, 'entry-name', `${label} name must be kebab-case, got ${JSON.stringify(name)}`, 'use lowercase letters, digits and hyphens'),
      );
      return;
    }
    const prefix = RESERVED_PREFIXES.find((p) => name.startsWith(p));
    if (prefix) {
      problems.push(
        problem(CATALOG_FILE, 'entry-name', `plugin "${name}" uses the reserved prefix "${prefix}"`, 'rename the plugin'),
      );
      return;
    }
    if (seen.has(name)) {
      problems.push(
        problem(CATALOG_FILE, 'entry-duplicate', `plugin "${name}" is listed more than once`, 'keep a single entry per plugin name'),
      );
      return;
    }
    seen.add(name);
    result.entries.push({ name, source: raw.source, version: raw.version, hasVersion: 'version' in raw, sourceOk: checkSource(name, raw.source, problems) });
  });
  return result;
}

function checkSource(name, source, problems) {
  const expected = `./plugins/${name}`;
  let message;
  if (typeof source !== 'string') {
    message = `plugin "${name}" source must be the string "${expected}"; this marketplace uses relative sources only`;
  } else if (/^[a-z][a-z0-9+.-]*:\/\/|^git@|^github:/i.test(source)) {
    message = `plugin "${name}" source "${source}" is remote; this marketplace uses relative sources only`;
  } else if (source !== expected) {
    message = `plugin "${name}" source "${source}" must equal "${expected}" (no "..", no absolute paths, inside ./plugins/)`;
  }
  if (message) {
    problems.push(problem(CATALOG_FILE, 'entry-source', message, `set "source": "${expected}"`));
    return false;
  }
  return true;
}

/** Directory / manifest presence and orphan checks. */
export function checkPluginDirs(root, files, catalog, problems) {
  for (const e of catalog.entries) {
    if (!e.sourceOk) continue;
    const dir = `plugins/${e.name}`;
    e.dir = dir;
    e.manifestPath = `${dir}/.claude-plugin/plugin.json`;
    if (!files.some((f) => f.startsWith(`${dir}/`))) {
      problems.push(
        problem(CATALOG_FILE, 'plugin-dir-missing', `plugin "${e.name}": source directory ${dir}/ does not exist`, `create ${dir}/ or remove the entry`),
      );
    } else if (!exists(root, e.manifestPath)) {
      problems.push(
        problem(dir, 'plugin-manifest-missing', `plugin "${e.name}": ${e.manifestPath} is missing`, `add ${e.manifestPath}`),
      );
    } else {
      e.manifestOk = true;
    }
  }
}

export function checkOrphans(files, catalog, problems) {
  const listed = new Set(catalog.entries.map((e) => e.name));
  const dirs = new Set();
  for (const f of files) {
    const m = /^plugins\/([^/]+)\/.+/.exec(f);
    if (m) dirs.add(m[1]);
  }
  for (const d of [...dirs].sort()) {
    if (!listed.has(d)) {
      problems.push(
        problem(`plugins/${d}`, 'plugin-orphan', `directory plugins/${d}/ has no catalog entry`, `add "${d}" to ${CATALOG_FILE} or delete the directory`),
      );
    }
  }
}
