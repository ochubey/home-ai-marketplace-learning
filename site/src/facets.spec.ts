import { describe, expect, it } from 'vitest';
import { applyFacets, facetCounts } from './facets';
import { fixtureIndex } from './fixtures';

const items = fixtureIndex.artifacts;
const plugins = fixtureIndex.plugins.map((p) => p.name);

describe('applyFacets', () => {
  it('keeps everything when nothing is selected', () => {
    expect(applyFacets(items, { kinds: [], plugins: [] })).toHaveLength(items.length);
  });

  it('combines values of one facet with OR', () => {
    const r = applyFacets(items, { kinds: ['skill', 'agent'], plugins: [] });
    expect(r.every((a) => a.kind === 'skill' || a.kind === 'agent')).toBe(true);
    expect(r).toHaveLength(4);
  });

  it('combines facets with AND', () => {
    const r = applyFacets(items, { kinds: ['skill'], plugins: ['sdd-flow'] });
    expect(r.map((a) => a.id)).toEqual(['sdd-flow/skill/run-plan']);
  });
});

describe('facetCounts', () => {
  it('counts each kind within the plugin selection and shows all six kinds', () => {
    const c = facetCounts(items, plugins, { kinds: [], plugins: ['sdd-flow'] });
    expect(c.kinds.map((k) => k.value)).toEqual(['plugin', 'skill', 'agent', 'command', 'hook', 'mcp']);
    const byKind = Object.fromEntries(c.kinds.map((k) => [k.value, k.count]));
    expect(byKind).toEqual({ plugin: 1, skill: 1, agent: 1, command: 0, hook: 1, mcp: 1 });
  });

  it('marks zero-count values disabled unless selected', () => {
    const c = facetCounts(items, plugins, { kinds: [], plugins: [] });
    expect(c.kinds.find((k) => k.value === 'command')).toMatchObject({ count: 0, disabled: true });
    expect(c.kinds.find((k) => k.value === 'skill')).toMatchObject({ count: 3, disabled: false });
    const sel = facetCounts(items, plugins, { kinds: ['command'], plugins: [] });
    expect(sel.kinds.find((k) => k.value === 'command')).toMatchObject({ count: 0, disabled: false, selected: true });
  });

  it('counts plugins within the kind selection', () => {
    const c = facetCounts(items, plugins, { kinds: ['skill'], plugins: [] });
    expect(Object.fromEntries(c.plugins.map((p) => [p.value, p.count]))).toEqual({ 'paved-path': 2, 'sdd-flow': 1, lonely: 0 });
    expect(c.plugins.find((p) => p.value === 'lonely')?.disabled).toBe(true);
  });
});
