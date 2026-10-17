import { KINDS, type Artifact, type Kind } from './types';

export interface FacetSelection {
  kinds: Kind[];
  plugins: string[];
}

export interface FacetValue<V extends string> {
  value: V;
  count: number;
  selected: boolean;
  disabled: boolean;
}

export interface FacetCounts {
  kinds: FacetValue<Kind>[];
  plugins: FacetValue<string>[];
}

const inKinds = (a: Artifact, kinds: Kind[]) => kinds.length === 0 || kinds.includes(a.kind);
const inPlugins = (a: Artifact, plugins: string[]) => plugins.length === 0 || plugins.includes(a.plugin);

/** OR within a facet, AND across facets. */
export function applyFacets(items: Artifact[], sel: FacetSelection): Artifact[] {
  return items.filter((a) => inKinds(a, sel.kinds) && inPlugins(a, sel.plugins));
}

/** Counts of a value are taken within the other facet's selection; zero counts are disabled unless selected. */
export function facetCounts(items: Artifact[], pluginNames: string[], sel: FacetSelection): FacetCounts {
  const kinds = KINDS.map((value) => {
    const count = items.filter((a) => a.kind === value && inPlugins(a, sel.plugins)).length;
    const selected = sel.kinds.includes(value);
    return { value, count, selected, disabled: count === 0 && !selected };
  });
  const plugins = pluginNames.map((value) => {
    const count = items.filter((a) => a.plugin === value && inKinds(a, sel.kinds)).length;
    const selected = sel.plugins.includes(value);
    return { value, count, selected, disabled: count === 0 && !selected };
  });
  return { kinds, plugins };
}
