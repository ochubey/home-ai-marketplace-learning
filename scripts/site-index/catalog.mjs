// Reads .claude-plugin/marketplace.json and each catalog entry's plugin.json.
// Problems here are fatal: they are returned as errors, never thrown.
import { SEGMENT_RE } from './constants.mjs';
import { statKind } from './util.mjs';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);

function parseJson(ctx, abs, label, errors) {
  let text;
  try {
    text = ctx.readText(abs);
  } catch {
    errors.push(`${label}: file is missing or unreadable`);
    return undefined;
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    errors.push(`${label}: not valid JSON (${e.message})`);
    return undefined;
  }
}

function author(v) {
  if (typeof v === 'string' && v !== '') return v;
  if (!isObject(v)) return null;
  const out = {};
  for (const k of ['name', 'email', 'url']) if (str(v[k]) !== null) out[k] = v[k];
  return Object.keys(out).length ? out : null;
}

/** Returns { errors, marketplace, plugins: [{ name, dir, manifest, record }] }. */
export function readCatalog(ctx) {
  const errors = [];
  const file = '.claude-plugin/marketplace.json';
  const cat = parseJson(ctx, ctx.abs(file), file, errors);
  if (cat === undefined) return { errors };
  if (!isObject(cat)) return { errors: [`${file}: must be a JSON object`] };
  if (str(cat.name) === null) errors.push(`${file}: missing "name"`);
  if (!Array.isArray(cat.plugins)) errors.push(`${file}: missing "plugins" array`);
  if (errors.length) return { errors };

  const marketplace = {
    name: cat.name,
    owner: isObject(cat.owner) ? str(cat.owner.name) : str(cat.owner),
    description: isObject(cat.metadata) ? str(cat.metadata.description) : null,
  };

  const plugins = [];
  const seen = new Set();
  cat.plugins.forEach((entry, i) => {
    const label = `${file}: plugins[${i}]`;
    if (!isObject(entry) || typeof entry.name !== 'string' || !SEGMENT_RE.test(entry.name)) {
      errors.push(`${label}: "name" must match ${SEGMENT_RE}`);
      return;
    }
    if (seen.has(entry.name)) {
      errors.push(`${label}: duplicate plugin name "${entry.name}"`);
      return;
    }
    seen.add(entry.name);
    const sourcePath = `plugins/${entry.name}`;
    const source = typeof entry.source === 'string' ? entry.source.replace(/\/+$/, '') : null;
    if (source !== `./${sourcePath}`) {
      errors.push(`${label}: "source" must be "./${sourcePath}", got ${JSON.stringify(entry.source)}`);
      return;
    }
    const dir = ctx.abs('plugins', entry.name);
    const kind = statKind(dir);
    if (kind !== 'dir') {
      errors.push(`${sourcePath}: plugin directory is ${kind === 'symlink' ? 'a symlink' : 'missing'}`);
      return;
    }
    const manifestPath = `${sourcePath}/.claude-plugin/plugin.json`;
    const manifest = parseJson(ctx, ctx.abs(manifestPath), manifestPath, errors);
    if (manifest === undefined) return;
    if (!isObject(manifest)) {
      errors.push(`${manifestPath}: must be a JSON object`);
      return;
    }
    if (str(manifest.version) === null) {
      errors.push(`${manifestPath}: missing "version"`);
      return;
    }
    if (manifest.name !== entry.name) ctx.warn(`${manifestPath}: name ${JSON.stringify(manifest.name)} differs from the catalog entry "${entry.name}"`);
    plugins.push({
      name: entry.name,
      dir,
      manifest,
      record: {
        id: entry.name,
        name: entry.name,
        version: manifest.version,
        description: str(manifest.description) ?? str(entry.description),
        author: author(manifest.author),
        sourcePath,
      },
    });
  });
  return errors.length ? { errors } : { errors, marketplace, plugins };
}
