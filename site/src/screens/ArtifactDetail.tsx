import { BodyView } from '../components/BodyView';
import { InstallBlock } from '../components/InstallBlock';
import { KindBadge } from '../components/KindBadge';
import { Screen } from '../components/Screen';
import { dirOf, findArtifact, findPlugin } from '../catalog';
import { useCatalog } from '../context';
import { t } from '../i18n/t';
import type { FrontmatterValue, Kind } from '../types';
import { NotFound } from './NotFound';

function show(v: FrontmatterValue): string {
  if (typeof v === 'boolean') return v ? t('artifact.yes') : t('artifact.no');
  return Array.isArray(v) ? v.join(', ') : v;
}

export function ArtifactDetail({ plugin, kind, name }: { plugin: string; kind: Exclude<Kind, 'plugin'>; name: string }) {
  const { data, ref, repoUrl } = useCatalog();
  const artifact = findArtifact(data.index, plugin, kind, name);
  if (!artifact || !findPlugin(data.index, plugin)) return <NotFound name={name} />;
  const fm = Object.entries(artifact.frontmatter);
  const link = (path: string) => `${repoUrl}/blob/${ref}/${path}`;
  return (
    <Screen title={artifact.name}>
      <p>
        <KindBadge kind={artifact.kind} />
      </p>
      <p>{artifact.description ?? t('card.noDescription')}</p>
      <dl className="facts">
        <dt>{t('artifact.name')}</dt>
        <dd>{artifact.name}</dd>
        <dt>{t('artifact.namespaced')}</dt>
        <dd>
          <code>{artifact.namespacedName}</code>
        </dd>
        <dt>{t('artifact.plugin')}</dt>
        <dd>
          <a href={`#/plugins/${artifact.plugin}`}>{artifact.plugin}</a>
        </dd>
        {artifact.kind === 'hook' && (
          <>
            <dt>{t('artifact.hookEvents')}</dt>
            <dd>{artifact.details?.events?.length ? artifact.details.events.join(', ') : t('artifact.noEvents')}</dd>
          </>
        )}
        {artifact.kind === 'mcp' && (
          <>
            <dt>{t('artifact.mcpTransport')}</dt>
            <dd>{artifact.details?.transport ?? ''}</dd>
          </>
        )}
      </dl>
      {fm.length > 0 && (
        <section aria-labelledby="fm" data-frontmatter>
          <h2 id="fm">{t('artifact.frontmatter')}</h2>
          <dl className="facts">
            {fm.map(([k, v]) => (
              <div key={k} className="fact">
                <dt>
                  <code>{k}</code>
                </dt>
                <dd>{show(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <InstallBlock plugin={artifact.plugin} />
      {artifact.hasBody && (
        <section aria-labelledby="body" data-body>
          <h2 id="body">{t('artifact.body')}</h2>
          <BodyView id={artifact.id} baseDir={dirOf(artifact.sourcePath)} />
        </section>
      )}
      {artifact.supportingFiles.length > 0 && (
        <section aria-labelledby="support" data-supporting>
          <h2 id="support">{t('artifact.supporting')}</h2>
          <ul>
            {artifact.supportingFiles.map((f) => (
              <li key={f}>
                <a href={link(f)} rel="noopener noreferrer nofollow">
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p>
        <a href={link(artifact.sourcePath)} rel="noopener noreferrer nofollow">
          {t('artifact.source')}
        </a>
      </p>
    </Screen>
  );
}
