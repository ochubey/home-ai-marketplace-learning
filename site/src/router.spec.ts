import { describe, expect, it } from 'vitest';
import { parseHash, serializeRoute } from './router';

describe('parseHash', () => {
  it('maps empty and root hashes to home', () => {
    expect(parseHash('')).toEqual({ type: 'home' });
    expect(parseHash('#')).toEqual({ type: 'home' });
    expect(parseHash('#/')).toEqual({ type: 'home' });
  });

  it('parses search query and facets', () => {
    expect(parseHash('#/search?q=zod%20schema&kind=skill,agent&plugin=sdd-engineering,research-tools')).toEqual({
      type: 'search',
      q: 'zod schema',
      kinds: ['skill', 'agent'],
      plugins: ['sdd-engineering', 'research-tools'],
    });
    expect(parseHash('#/search')).toEqual({ type: 'search', q: '', kinds: [], plugins: [] });
  });

  it('ignores unknown kinds and malformed plugin values', () => {
    expect(parseHash('#/search?kind=skill,bogus,plugin&plugin=a-b,Bad%20Name,../x')).toEqual({
      type: 'search',
      q: '',
      kinds: ['skill', 'plugin'],
      plugins: ['a-b'],
    });
  });

  it('parses plugin and artifact detail routes', () => {
    expect(parseHash('#/plugins/sdd-engineering')).toEqual({ type: 'plugin', plugin: 'sdd-engineering' });
    expect(parseHash('#/plugins/sdd-engineering/skill/run-plan')).toEqual({
      type: 'artifact',
      plugin: 'sdd-engineering',
      kind: 'skill',
      name: 'run-plan',
    });
  });

  it('parses whats-new with an optional plugin filter', () => {
    expect(parseHash('#/whats-new')).toEqual({ type: 'whats-new', plugin: null });
    expect(parseHash('#/whats-new?plugin=research-tools')).toEqual({ type: 'whats-new', plugin: 'research-tools' });
    expect(parseHash('#/whats-new?plugin=Bad%20Name')).toEqual({ type: 'whats-new', plugin: null });
  });

  it('parses getting-started', () => {
    expect(parseHash('#/getting-started')).toEqual({ type: 'getting-started' });
  });

  it('falls back to not-found for anything else', () => {
    expect(parseHash('#/nope')).toEqual({ type: 'not-found', path: '/nope' });
    expect(parseHash('#/plugins/sdd-engineering/plugin/x')).toMatchObject({ type: 'not-found' });
    expect(parseHash('#/plugins/sdd-engineering/skill')).toMatchObject({ type: 'not-found' });
    expect(parseHash('#/plugins/Bad Name')).toMatchObject({ type: 'not-found' });
    expect(parseHash('#/plugins/a/skill/..')).toMatchObject({ type: 'not-found' });
    expect(parseHash('#/getting-started/extra')).toMatchObject({ type: 'not-found' });
  });

  it('does not throw on broken percent encoding', () => {
    expect(parseHash('#/search?q=%E0%A4%A')).toMatchObject({ type: 'search' });
    expect(parseHash('#/plugins/%zz')).toMatchObject({ type: 'not-found' });
  });
});

describe('serializeRoute', () => {
  it('round-trips every route type', () => {
    const routes = [
      { type: 'home' as const },
      { type: 'search' as const, q: 'a b&c', kinds: ['skill' as const], plugins: ['x-y'] },
      { type: 'search' as const, q: '', kinds: [], plugins: [] },
      { type: 'plugin' as const, plugin: 'sdd-engineering' },
      { type: 'artifact' as const, plugin: 'p', kind: 'agent' as const, name: 'n' },
      { type: 'whats-new' as const, plugin: 'research-tools' },
      { type: 'whats-new' as const, plugin: null },
      { type: 'getting-started' as const },
    ];
    for (const r of routes) expect(parseHash(serializeRoute(r))).toEqual(r);
  });

  it('omits empty search parameters', () => {
    expect(serializeRoute({ type: 'search', q: '', kinds: [], plugins: [] })).toBe('#/search');
    expect(serializeRoute({ type: 'search', q: 'zod', kinds: ['skill', 'agent'], plugins: [] })).toBe('#/search?q=zod&kind=skill,agent');
  });
});
