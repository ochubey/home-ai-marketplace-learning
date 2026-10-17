import { Card } from '../components/Card';
import { BodyView } from '../components/BodyView';
import { InstallBlock } from '../components/InstallBlock';
import { Screen } from '../components/Screen';
import { findPlugin } from '../catalog';
import { useCatalog } from '../context';
import { t } from '../i18n/t';
import { KINDS } from '../types';
import { NotFound } from './NotFound';

export function PluginDetail({ name }: { name: string }) {
  const { data, ref, repoUrl } = useCatalog();
  const plugin = findPlugin(data.index, name);
  if (!plugin) return <NotFound name={name} />;
  const own = data.index.artifacts.filter((a) => a.plugin === plugin.name && a.kind !== 'plugin');
  return (
    <Screen title={plugin.name}>
      <p>{plugin.description ?? t('card.noDescription')}</p>
      <dl className="facts">
        <dt>{t('plugin.version')}</dt>
        <dd>{plugin.version}</dd>
        <dt>{t('plugin.author')}</dt>
        <dd>{plugin.author?.name ?? t('plugin.noAuthor')}</dd>
      </dl>
      <InstallBlock plugin={plugin.name} />
      <section aria-labelledby="deps" data-dependencies>
        <h2 id="deps">{t('plugin.dependencies')}</h2>
        {plugin.dependencies.length === 0 ? (
          <p>{t('plugin.noDependencies')}</p>
        ) : (
          <ul>
            {plugin.dependencies.map((d) => (
              <li key={`${d.name}@${d.marketplace ?? ''}`}>
                {d.inCatalog ? <a href={`#/plugins/${d.name}`}>{d.name}</a> : <span>{d.name}</span>}{' '}
                <span className="dim">{d.range ? t('plugin.depRange', { range: d.range }) : t('plugin.depNoRange')}</span>
                {!d.inCatalog && <span className="dim"> ({t('plugin.notInCatalog')})</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="usedby" data-used-by>
        <h2 id="usedby">{t('plugin.usedBy')}</h2>
        {plugin.usedBy.length === 0 ? (
          <p>{t('plugin.notUsed')}</p>
        ) : (
          <ul>
            {plugin.usedBy.map((u) => (
              <li key={u}>
                <a href={`#/plugins/${u}`}>{u}</a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="contents" data-artifacts>
        <h2 id="contents">{t('plugin.artifacts')}</h2>
        {own.length === 0 && <p>{t('plugin.noArtifacts')}</p>}
        {KINDS.filter((k) => own.some((a) => a.kind === k)).map((k) => (
          <div key={k}>
            <h3>{t(`kind.${k}.plural`)}</h3>
            <div className="grid">
              {own.filter((a) => a.kind === k).map((a) => (
                <Card key={a.id} artifact={a} />
              ))}
            </div>
          </div>
        ))}
      </section>
      <section aria-labelledby="readme" data-readme>
        <h2 id="readme">{t('plugin.readme')}</h2>
        {plugin.hasReadme ? <BodyView id={plugin.name} baseDir={plugin.sourcePath} /> : <p>{t('plugin.noReadme')}</p>}
      </section>
      <p>
        <a href={`#/whats-new?plugin=${plugin.name}`}>{t('plugin.releases')}</a>
      </p>
      <p>
        <a href={`${repoUrl}/tree/${ref}/${plugin.sourcePath}`} rel="noopener noreferrer nofollow">
          {t('plugin.source')}
        </a>
      </p>
    </Screen>
  );
}
