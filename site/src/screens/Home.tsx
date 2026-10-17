import { Card } from '../components/Card';
import { ReleaseMeta } from '../components/ReleaseHeading';
import { SearchBox } from '../components/SearchBox';
import { Screen } from '../components/Screen';
import { EmptyCatalog } from '../components/States';
import { useCatalog } from '../context';
import { t } from '../i18n/t';
import { newestReleases } from '../releases';
import type { Route } from '../router';
import { KINDS } from '../types';

export function Home({ route }: { route: Route }) {
  const { data, repoUrl } = useCatalog();
  const { index, stats, releases } = data;
  const pluginCards = index.artifacts.filter((a) => a.kind === 'plugin');
  const recent = newestReleases(releases.releases, 5);
  return (
    <Screen title={t('home.title')} heading={t('home.heading')}>
      <p className="dim">{t('site.tagline')}</p>
      <SearchBox route={route} live={false} />
      {index.plugins.length === 0 ? (
        <EmptyCatalog repoUrl={repoUrl} />
      ) : (
        <>
          <section aria-labelledby="home-stats">
            <h2 id="home-stats">{t('home.stats')}</h2>
            <dl className="stats" data-stats>
              <div>
                <dt>{t('home.statsPlugins')}</dt>
                <dd>{stats.plugins}</dd>
              </div>
              {KINDS.filter((k) => k !== 'plugin' && stats.counts[k] > 0).map((k) => (
                <div key={k}>
                  <dt>{t(`kind.${k}.plural`)}</dt>
                  <dd>{stats.counts[k]}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="home-plugins">
            <h2 id="home-plugins">{t('home.pluginsHeading')}</h2>
            <div className="grid" data-plugins>
              {pluginCards.map((a) => (
                <Card key={a.id} artifact={a} version={index.plugins.find((p) => p.name === a.name)?.version} />
              ))}
            </div>
          </section>
          <section aria-labelledby="home-recent">
            <h2 id="home-recent">{t('home.recentHeading')}</h2>
            {recent.length > 0 && (
              <ul className="plain" data-recent>
                {recent.map((r) => (
                  <li key={`${r.plugin}@${r.version}`}>
                    <a href={`#/whats-new?plugin=${r.plugin}`}>{t('whatsNew.release', { plugin: r.plugin, version: r.version })}</a>
                    <ReleaseMeta release={r} />
                  </li>
                ))}
              </ul>
            )}
            <p>
              <a href="#/whats-new">{t('home.allReleases')}</a>
            </p>
          </section>
        </>
      )}
      <p>
        <a href="#/getting-started" data-getting-started>
          {t('home.gettingStartedLink')}
        </a>
      </p>
    </Screen>
  );
}
