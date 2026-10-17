// Dependency checks: item forms, marketplace qualifier, name resolution, self, cycles.
import { problem } from './report.mjs';
import { isObject } from './json.mjs';
import { isRangeSyntax } from './semver.mjs';

function normalise(item) {
  if (typeof item === 'string') {
    if (item === '') return undefined;
    const at = item.indexOf('@');
    if (at === -1) return { name: item };
    const name = item.slice(0, at);
    const marketplace = item.slice(at + 1);
    return name && marketplace ? { name, marketplace } : undefined;
  }
  if (isObject(item) && typeof item.name === 'string' && item.name !== '') {
    return { name: item.name, marketplace: item.marketplace, version: item.version, hasVersion: 'version' in item };
  }
  return undefined;
}

export function checkDeps(catalog, manifests, problems) {
  const known = new Set(catalog.entries.map((e) => e.name));
  const graph = new Map();

  for (const e of catalog.entries) {
    const m = manifests.get(e.name);
    if (!m || m.dependencies === undefined) continue;
    const file = e.manifestPath;
    if (!Array.isArray(m.dependencies)) {
      problems.push(problem(file, 'dep-format', '"dependencies" must be an array', 'use an array of names or objects'));
      continue;
    }
    const edges = [];
    m.dependencies.forEach((raw, i) => {
      const dep = normalise(raw);
      if (!dep) {
        problems.push(
          problem(file, 'dep-format', `dependencies[${i}] is malformed: ${JSON.stringify(raw)}`, 'use "name", "name@marketplace" or { "name", "marketplace"?, "version"? }'),
        );
        return;
      }
      if (dep.marketplace !== undefined && dep.marketplace !== catalog.name) {
        problems.push(
          problem(file, 'dep-marketplace', `dependency "${dep.name}" targets marketplace ${JSON.stringify(dep.marketplace)}; only "${catalog.name}" is allowed`, 'depend only on plugins from this marketplace'),
        );
        return;
      }
      if (dep.hasVersion && !isRangeSyntax(dep.version)) {
        problems.push(
          problem(file, 'dep-range', `dependency "${dep.name}" has an invalid version range ${JSON.stringify(dep.version)}`, 'use a SemVer range such as ^1.2.0 or >=1.0.0 <2.0.0'),
        );
      }
      if (dep.name === e.name) {
        problems.push(problem(file, 'dep-self', `plugin depends on itself: ${e.name} -> ${e.name}`, 'remove the self-dependency'));
        return;
      }
      if (!known.has(dep.name)) {
        problems.push(
          problem(file, 'dep-unknown', `unknown dependency: ${e.name} -> ${dep.name}`, 'depend only on plugins listed in this catalog'),
        );
        return;
      }
      edges.push(dep.name);
    });
    graph.set(e.name, [...new Set(edges)]);
  }

  // Three-colour DFS; each distinct cycle is reported once.
  const colour = new Map();
  const stack = [];
  const reported = new Set();
  const visit = (n) => {
    colour.set(n, 1);
    stack.push(n);
    for (const next of graph.get(n) ?? []) {
      if (colour.get(next) === 1) {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join(',');
        if (!reported.has(key)) {
          reported.add(key);
          const chain = [...cycle, next].join(' -> ');
          const owner = catalog.entries.find((e) => e.name === cycle[0]);
          problems.push(problem(owner.manifestPath, 'dep-cycle', `dependency cycle: ${chain}`, 'break the cycle by removing one dependency'));
        }
      } else if (!colour.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    colour.set(n, 2);
  };
  for (const n of [...graph.keys()].sort()) if (!colour.has(n)) visit(n);
}
