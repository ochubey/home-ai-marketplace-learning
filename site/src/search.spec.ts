import { describe, expect, it } from 'vitest';
import { fixtureIndex } from './fixtures';
import { createSearcher } from './search';

const searcher = createSearcher(fixtureIndex.artifacts);
const names = (q: string) => searcher.search(q).map((a) => a.id);

describe('search', () => {
  it('ranks the artifact with the name match first', () => {
    expect(names('zod')[0]).toBe('paved-path/skill/zod');
  });

  it('finds an agent by a name prefix', () => {
    expect(names('spec')).toContain('sdd-flow/agent/spec-creator');
  });

  it('finds a word that is only in a body', () => {
    expect(names('zebracorn')).toEqual(['paved-path/skill/zod']);
  });

  it('applies light fuzzy matching', () => {
    expect(names('typscript')).toContain('paved-path/skill/typescript');
  });

  it('returns nothing for text that matches nothing', () => {
    expect(names('qqqqzzzz')).toEqual([]);
  });

  it('lists every artifact by kind order then name for an empty query', () => {
    const all = searcher.search('   ');
    expect(all.length).toBe(fixtureIndex.artifacts.length);
    expect(all.map((a) => `${a.kind}:${a.name}`)).toEqual([
      'plugin:lonely',
      'plugin:paved-path',
      'plugin:sdd-flow',
      'skill:run-plan',
      'skill:typescript',
      'skill:zod',
      'agent:spec-creator',
      'hook:hooks',
      'mcp:docs-server',
    ]);
  });

  it('breaks score ties by kind order then name', () => {
    const tied = createSearcher([
      { ...fixtureIndex.artifacts.find((a) => a.id === 'sdd-flow/agent/spec-creator')!, name: 'tie', id: 'x/agent/tie', description: null, searchText: '' },
      { ...fixtureIndex.artifacts.find((a) => a.id === 'paved-path/skill/zod')!, name: 'tie', id: 'x/skill/tie', description: null, searchText: '' },
    ]);
    expect(tied.search('tie').map((a) => a.kind)).toEqual(['skill', 'agent']);
  });
});
