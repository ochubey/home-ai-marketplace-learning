import type { Route } from './router';
import type { Artifact, CatalogIndex, Kind } from './types';

/** Route of an artifact; the folder name comes from the id, never from the displayed name. */
export function routeOf(a: Artifact): Route {
  if (a.kind === 'plugin') return { type: 'plugin', plugin: a.plugin };
  const folder = a.id.split('/')[2] ?? a.name;
  return { type: 'artifact', plugin: a.plugin, kind: a.kind, name: folder };
}

export const findPlugin = (index: CatalogIndex, name: string) => index.plugins.find((p) => p.name === name);

export const findArtifact = (index: CatalogIndex, plugin: string, kind: Exclude<Kind, 'plugin'>, folder: string) =>
  index.artifacts.find((a) => a.id === `${plugin}/${kind}/${folder}`);

export const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');

export const formatDate = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
