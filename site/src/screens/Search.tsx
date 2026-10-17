import { useEffect, useMemo } from 'react';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { EmptyCatalog } from '../components/States';
import { useAnnounce, useCatalog } from '../context';
import { applyFacets, facetCounts } from '../facets';
import { t } from '../i18n/t';
import { navigate } from '../router';
import type { Kind } from '../types';

interface SearchRoute {
  q: string;
  kinds: Kind[];
  plugins: string[];
}

function toggle<V>(list: V[], value: V): V[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function Search({ route }: { route: SearchRoute }) {
  const { data, searcher, repoUrl } = useCatalog();
  const announce = useAnnounce();
  const pluginNames = data.index.plugins.map((p) => p.name);
  const selection = useMemo(() => ({ kinds: route.kinds, plugins: route.plugins.filter((p) => pluginNames.includes(p)) }), [route.kinds, route.plugins, pluginNames.join(',')]);
  const matches = useMemo(() => searcher.search(route.q), [searcher, route.q]);
  const results = applyFacets(matches, selection);
  const facets = facetCounts(matches, pluginNames, selection);
  const hasFacets = selection.kinds.length > 0 || selection.plugins.length > 0;

  const message = results.length === 1 ? t('search.countAnnounceOne') : t('search.countAnnounce', { count: results.length });
  useEffect(() => {
    announce(message);
  }, [message, announce]);

  const go = (next: Partial<SearchRoute>) => navigate({ type: 'search', q: route.q, kinds: selection.kinds, plugins: selection.plugins, ...next }, { replace: true });
  const countText = results.length === 1 ? t('search.countOne') : t('search.count', { count: results.length });
  const plugins = Object.fromEntries(data.index.plugins.map((p) => [p.name, p.version]));

  return (
    <Screen title={t('search.title')}>
      {data.index.plugins.length === 0 ? (
        <EmptyCatalog repoUrl={repoUrl} />
      ) : (
        <div className="search-layout">
          <aside aria-label={t('facets.heading')} className="facets">
            <fieldset>
              <legend>{t('facets.kind')}</legend>
              {facets.kinds.map((f) => (
                <label key={f.value} className={f.disabled ? 'disabled' : undefined}>
                  <input type="checkbox" data-facet="kind" value={f.value} checked={f.selected} disabled={f.disabled} onChange={() => go({ kinds: toggle(selection.kinds, f.value) })} />
                  {t('facets.count', { name: t(`kind.${f.value}`), count: f.count })}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>{t('facets.plugin')}</legend>
              {facets.plugins.map((f) => (
                <label key={f.value} className={f.disabled ? 'disabled' : undefined}>
                  <input type="checkbox" data-facet="plugin" value={f.value} checked={f.selected} disabled={f.disabled} onChange={() => go({ plugins: toggle(selection.plugins, f.value) })} />
                  {t('facets.count', { name: f.value, count: f.count })}
                </label>
              ))}
            </fieldset>
          </aside>
          <section aria-label={t('search.resultsHeading')}>
            <p className="dim">{route.q ? countText : `${t('search.allHeading')}: ${countText}`}</p>
            {results.length === 0 ? (
              <div className="state">
                <h2>{t('search.noResultsTitle')}</h2>
                {route.q !== '' && <p>{t(hasFacets ? 'search.noResultsFacets' : 'search.noResults', { query: route.q })}</p>}
                {hasFacets && (
                  <button type="button" className="button" data-clear-facets onClick={() => go({ kinds: [], plugins: [] })}>
                    {t('search.clearFacets')}
                  </button>
                )}
                <p>
                  <a href="#/search">{t('search.viewAll')}</a>
                </p>
              </div>
            ) : (
              <div className="grid" data-results>
                {results.map((a) => (
                  <Card key={a.id} artifact={a} version={a.kind === 'plugin' ? plugins[a.name] : undefined} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}
