// Dependencies of each plugin: the three forms the validator accepts, plus the reverse "usedBy" edges.
import { SEGMENT_RE } from './constants.mjs';

function normalise(item) {
  if (typeof item === 'string') {
    if (item === '') return null;
    const at = item.indexOf('@');
    if (at === -1) return { name: item, marketplace: null, range: null };
    const name = item.slice(0, at);
    const marketplace = item.slice(at + 1);
    return name && marketplace ? { name, marketplace, range: null } : null;
  }
  if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.name === 'string' && item.name !== '') {
    return {
      name: item.name,
      marketplace: typeof item.marketplace === 'string' && item.marketplace !== '' ? item.marketplace : null,
      range: typeof item.version === 'string' && item.version !== '' ? item.version : null,
    };
  }
  return null;
}

/** Fills `dependencies` and `usedBy` on every plugin record; returns the number of internal edges. */
export function resolveDependencies(ctx, plugins, manifests, marketplaceName) {
  const known = new Set(plugins.map((p) => p.name));
  let edges = 0;
  const usedBy = new Map(plugins.map((p) => [p.name, new Set()]));
  for (const plugin of plugins) {
    const raw = manifests.get(plugin.name).dependencies;
    plugin.dependencies = [];
    if (raw === undefined) continue;
    const file = `${plugin.sourcePath}/.claude-plugin/plugin.json`;
    if (!Array.isArray(raw)) {
      ctx.warn(`${file}: "dependencies" is not an array, ignored`);
      continue;
    }
    const internal = new Set();
    raw.forEach((item, i) => {
      const dep = normalise(item);
      if (!dep) {
        ctx.warn(`${file}: dependencies[${i}] is malformed, ignored`);
        return;
      }
      const inCatalog = known.has(dep.name) && (dep.marketplace === null || dep.marketplace === marketplaceName);
      plugin.dependencies.push({ name: dep.name, marketplace: dep.marketplace, range: dep.range, inCatalog });
      if (inCatalog && dep.name !== plugin.name && SEGMENT_RE.test(dep.name)) internal.add(dep.name);
    });
    for (const name of internal) usedBy.get(name).add(plugin.name);
    edges += internal.size;
  }
  for (const plugin of plugins) plugin.usedBy = plugins.map((p) => p.name).filter((n) => usedBy.get(plugin.name).has(n));
  return edges;
}
