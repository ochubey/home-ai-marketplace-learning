import MiniSearch from 'minisearch';
import { KINDS, type Artifact } from './types';

export interface Searcher {
  /** Artifacts matching the query; an empty query lists all by kind order then name. */
  search(query: string): Artifact[];
}

const kindRank = (a: Artifact) => KINDS.indexOf(a.kind);
const byKindThenName = (a: Artifact, b: Artifact) => kindRank(a) - kindRank(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export function createSearcher(artifacts: Artifact[]): Searcher {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const engine = new MiniSearch<Artifact>({
    fields: ['name', 'description', 'searchText'],
    idField: 'id',
    extractField: (doc, field) => {
      const value = (doc as unknown as Record<string, unknown>)[field];
      return typeof value === 'string' ? value : '';
    },
    searchOptions: { boost: { name: 3, description: 2, searchText: 1 }, prefix: true, fuzzy: 0.2 },
  });
  engine.addAll(artifacts);
  return {
    search(query) {
      if (query.trim() === '') return [...artifacts].sort(byKindThenName);
      const hits = engine.search(query.trim());
      const found = hits.flatMap((h) => {
        const a = byId.get(String(h.id));
        return a ? [{ a, score: h.score }] : [];
      });
      found.sort((x, y) => y.score - x.score || byKindThenName(x.a, y.a));
      return found.map((f) => f.a);
    },
  };
}
