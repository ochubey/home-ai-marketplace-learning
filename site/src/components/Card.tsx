import { routeOf } from '../catalog';
import { t } from '../i18n/t';
import { serializeRoute } from '../router';
import type { Artifact } from '../types';
import { KindBadge } from './KindBadge';

export function Card({ artifact, version }: { artifact: Artifact; version?: string }) {
  return (
    <article className="card">
      <KindBadge kind={artifact.kind} />
      <h3>
        <a className="card-link" href={serializeRoute(routeOf(artifact))}>
          {artifact.name}
        </a>
      </h3>
      {artifact.kind !== 'plugin' && <p className="dim">{t('card.fromPlugin', { plugin: artifact.plugin })}</p>}
      {version && <p className="dim">{t('card.version', { version })}</p>}
      <p>{artifact.description ?? t('card.noDescription')}</p>
    </article>
  );
}
