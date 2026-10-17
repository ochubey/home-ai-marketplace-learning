// Artifacts of each plugin: skills, agents, commands, hooks, MCP servers, and the plugin itself.
import path from 'node:path';
import { FRONTMATTER_ALLOWLIST, KIND_ORDER, SEGMENT_RE, SUPPORTING_FILES_MAX } from './constants.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { capBody, toSearchText } from './text.mjs';
import { cmp, statKind } from './util.mjs';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const CONTROL_RE = /[\u0000-\u001f\u007f\\]/;
const EVENT_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function makeArtifact(fields) {
  return {
    id: fields.id,
    kind: fields.kind,
    plugin: fields.plugin,
    name: fields.name,
    namespacedName: fields.namespacedName,
    description: fields.description ?? null,
    frontmatter: fields.frontmatter ?? {},
    details: fields.details ?? null,
    sourcePath: fields.sourcePath,
    supportingFiles: fields.supportingFiles ?? [],
    hasBody: fields.body !== undefined,
    searchText: fields.body === undefined ? '' : toSearchText(fields.body),
  };
}

function pickFrontmatter(kind, data) {
  const out = {};
  for (const key of FRONTMATTER_ALLOWLIST[kind] ?? []) {
    const v = data[key];
    if (typeof v === 'string' && v !== '') out[key] = v;
    else if (typeof v === 'boolean') out[key] = v;
    else if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) out[key] = v;
  }
  return out;
}

/** Reads one Markdown artifact file. Returns null (after a warning) when it cannot be used. */
function readMarkdownArtifact(ctx, plugin, kind, folderName, fileAbs, extra = {}) {
  const sourcePath = ctx.rel(fileAbs);
  const fileKind = statKind(fileAbs);
  if (fileKind !== 'file') {
    ctx.warn(`${sourcePath}: ${fileKind === 'symlink' ? 'symlink skipped' : fileKind === null ? 'file is missing' : 'not a regular file'}, artifact skipped`);
    return null;
  }
  let text;
  try {
    text = ctx.readText(fileAbs);
  } catch (e) {
    ctx.warn(`${sourcePath}: unreadable (${e.code ?? e.message}), artifact skipped`);
    return null;
  }
  const fm = parseFrontmatter(text);
  if (fm.state === 'unterminated') ctx.warn(`${sourcePath}: frontmatter block is not terminated, treated as no frontmatter`);
  const name = nonEmpty(fm.data.name) ?? folderName;
  const body = capBody(fm.body, sourcePath);
  const artifact = makeArtifact({
    id: `${plugin.name}/${kind}/${folderName}`,
    kind,
    plugin: plugin.name,
    name,
    namespacedName: `${plugin.name}:${name}`,
    description: nonEmpty(fm.data.description),
    frontmatter: pickFrontmatter(kind, fm.data),
    sourcePath,
    body,
    ...extra,
  });
  return { artifact, body };
}

function skipBadSegment(ctx, abs, name) {
  if (SEGMENT_RE.test(name)) return false;
  ctx.warn(`${ctx.rel(abs)}: name does not match ${SEGMENT_RE}, skipped`);
  return true;
}

function supportingFiles(ctx, dirAbs, mainAbs) {
  const out = [];
  const walk = (dir) => {
    for (const e of ctx.listDir(dir)) {
      const abs = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        ctx.warn(`${ctx.rel(abs)}: symlink skipped`);
      } else if (CONTROL_RE.test(e.name)) {
        ctx.warn(`${ctx.rel(abs)}: file name has control characters or a backslash, skipped`);
      } else if (e.isDirectory()) {
        walk(abs);
      } else if (e.isFile() && abs !== mainAbs) {
        out.push(ctx.rel(abs));
      }
    }
  };
  walk(dirAbs);
  out.sort(cmp);
  if (out.length > SUPPORTING_FILES_MAX) {
    ctx.warn(`${ctx.rel(dirAbs)}: ${out.length} supporting files, listing the first ${SUPPORTING_FILES_MAX}`);
    out.length = SUPPORTING_FILES_MAX;
  }
  return out;
}

function scanSkills(ctx, plugin, add) {
  const base = path.join(plugin.dir, 'skills');
  for (const e of ctx.listDir(base)) {
    const abs = path.join(base, e.name);
    if (e.isSymbolicLink()) {
      ctx.warn(`${ctx.rel(abs)}: symlink skipped`);
      continue;
    }
    if (!e.isDirectory() || skipBadSegment(ctx, abs, e.name)) continue;
    const main = path.join(abs, 'SKILL.md');
    const r = readMarkdownArtifact(ctx, plugin, 'skill', e.name, main, { supportingFiles: supportingFiles(ctx, abs, main) });
    if (r) add(r);
  }
}

function scanMarkdownFiles(ctx, plugin, kind, folder, add) {
  const base = path.join(plugin.dir, folder);
  for (const e of ctx.listDir(base)) {
    const abs = path.join(base, e.name);
    if (!e.name.endsWith('.md')) continue;
    if (e.isSymbolicLink()) {
      ctx.warn(`${ctx.rel(abs)}: symlink skipped`);
      continue;
    }
    if (!e.isFile()) continue;
    const name = e.name.slice(0, -3);
    if (skipBadSegment(ctx, abs, name)) continue;
    const r = readMarkdownArtifact(ctx, plugin, kind, name, abs);
    if (r) add(r);
  }
}

function readJsonFile(ctx, abs) {
  const kind = statKind(abs);
  if (kind === null) return undefined;
  if (kind !== 'file') {
    ctx.warn(`${ctx.rel(abs)}: ${kind === 'symlink' ? 'symlink skipped' : 'not a regular file'}`);
    return undefined;
  }
  try {
    return JSON.parse(ctx.readText(abs).replace(/^﻿/, ''));
  } catch (e) {
    ctx.warn(`${ctx.rel(abs)}: not valid JSON, ignored (${e.message})`);
    return undefined;
  }
}

/** Hook event names only; commands, matchers and URLs are never read into the output. */
function hookEvents(config) {
  const map = isObject(config) && isObject(config.hooks) ? config.hooks : config;
  return isObject(map) ? Object.keys(map).filter((k) => EVENT_RE.test(k)) : [];
}

function scanHooks(ctx, plugin, add) {
  const fileAbs = path.join(plugin.dir, 'hooks', 'hooks.json');
  const fromFile = readJsonFile(ctx, fileAbs);
  const inManifest = plugin.manifest.hooks;
  if (fromFile === undefined && inManifest === undefined) return;
  const events = new Set();
  if (fromFile !== undefined) hookEvents(fromFile).forEach((x) => events.add(x));
  if (isObject(inManifest)) hookEvents(inManifest).forEach((x) => events.add(x));
  const sourcePath = fromFile !== undefined ? ctx.rel(fileAbs) : `${plugin.record.sourcePath}/.claude-plugin/plugin.json`;
  add({
    artifact: makeArtifact({
      id: `${plugin.name}/hook/hooks`,
      kind: 'hook',
      plugin: plugin.name,
      name: 'hooks',
      namespacedName: `${plugin.name}:hooks`,
      sourcePath,
      details: { events: [...events].sort(cmp) },
    }),
  });
}

function transportOf(cfg) {
  if (!isObject(cfg)) return 'unknown';
  if (['stdio', 'http', 'sse', 'ws'].includes(cfg.type)) return cfg.type;
  if (typeof cfg.url === 'string') return 'http';
  if (typeof cfg.command === 'string') return 'stdio';
  return 'unknown';
}

function scanMcp(ctx, plugin, add) {
  const fileAbs = path.join(plugin.dir, '.mcp.json');
  const fromFile = readJsonFile(ctx, fileAbs);
  const servers = new Map();
  const collect = (map, sourcePath) => {
    if (!isObject(map)) return;
    for (const name of Object.keys(map).sort(cmp)) {
      if (!SEGMENT_RE.test(name)) {
        ctx.warn(`${sourcePath}: MCP server name ${JSON.stringify(name)} does not match ${SEGMENT_RE}, skipped`);
        continue;
      }
      if (!servers.has(name)) servers.set(name, { transport: transportOf(map[name]), sourcePath });
    }
  };
  if (fromFile !== undefined) collect(isObject(fromFile) && isObject(fromFile.mcpServers) ? fromFile.mcpServers : fromFile, ctx.rel(fileAbs));
  collect(plugin.manifest.mcpServers, `${plugin.record.sourcePath}/.claude-plugin/plugin.json`);
  for (const [name, s] of [...servers].sort((a, b) => cmp(a[0], b[0]))) {
    add({
      artifact: makeArtifact({
        id: `${plugin.name}/mcp/${name}`,
        kind: 'mcp',
        plugin: plugin.name,
        name,
        namespacedName: `${plugin.name}:${name}`,
        sourcePath: s.sourcePath,
        details: { transport: s.transport },
      }),
    });
  }
}

function scanReadme(ctx, plugin, add) {
  const sourcePath = `${plugin.record.sourcePath}/README.md`;
  let body;
  if (statKind(ctx.abs(sourcePath)) === 'file') {
    try {
      body = capBody(ctx.readText(ctx.abs(sourcePath)), sourcePath);
    } catch {
      ctx.warn(`${sourcePath}: unreadable, plugin has no README body`);
    }
  } else {
    ctx.warn(`${sourcePath}: README.md is missing, plugin has no README body`);
  }
  plugin.record.hasReadme = body !== undefined;
  add({
    artifact: makeArtifact({
      id: plugin.name,
      kind: 'plugin',
      plugin: plugin.name,
      name: plugin.name,
      namespacedName: plugin.name,
      description: plugin.record.description,
      sourcePath: plugin.record.sourcePath,
      body,
    }),
    body,
  });
}

/** Returns { artifacts, bodies: Map<id, string> }; fills `counts` and `hasReadme` on plugin records. */
export function scanArtifacts(ctx, plugins) {
  const artifacts = [];
  const bodies = new Map();
  for (const plugin of plugins) {
    const counts = Object.fromEntries(KIND_ORDER.filter((k) => k !== 'plugin').map((k) => [k, 0]));
    const add = ({ artifact, body }) => {
      artifacts.push(artifact);
      if (body !== undefined) bodies.set(artifact.id, body);
      if (artifact.kind !== 'plugin') counts[artifact.kind]++;
    };
    scanReadme(ctx, plugin, add);
    scanSkills(ctx, plugin, add);
    scanMarkdownFiles(ctx, plugin, 'agent', 'agents', add);
    scanMarkdownFiles(ctx, plugin, 'command', 'commands', add);
    scanHooks(ctx, plugin, add);
    scanMcp(ctx, plugin, add);
    plugin.record.counts = counts;
  }
  const order = (a) => KIND_ORDER.indexOf(a.kind);
  artifacts.sort((a, b) => order(a) - order(b) || cmp(a.name, b.name) || cmp(a.id, b.id));
  return { artifacts, bodies };
}

