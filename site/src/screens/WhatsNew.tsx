import { MarkdownView } from '../markdown';
import { ReleaseMeta } from '../components/ReleaseHeading';
import { Screen } from '../components/Screen';
import { useCatalog } from '../context';
import { t } from '../i18n/t';
import { sortReleases } from '../releases';

export function WhatsNew({ plugin }: { plugin: string | null }) {
  const { data, ref, repoUrl } = useCatalog();
  const all = sortReleases(data.releases.releases);
  const list = plugin ? all.filter((r) => r.plugin === plugin) : all;
  return (
    <Screen title={t('whatsNew.title')} heading={t('whatsNew.heading')}>
      {plugin && (
        <p>
          {t('whatsNew.filtered', { plugin })} <a href="#/whats-new">{t('whatsNew.showAll')}</a>
        </p>
      )}
      {list.length === 0 ? (
        <p>{t('whatsNew.empty')}</p>
      ) : (
        <ul className="plain" data-releases>
          {list.map((r) => (
            <li key={`${r.plugin}@${r.version}`} className="release">
              <h2>{t('whatsNew.release', { plugin: r.plugin, version: r.version })}</h2>
              <ReleaseMeta release={r} />
              <MarkdownView source={r.body} ctx={{ baseDir: `plugins/${r.plugin}`, repoUrl, ref }} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
