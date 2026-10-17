import { formatDate } from '../catalog';
import { t } from '../i18n/t';
import type { Release } from '../types';

export function ReleaseMeta({ release }: { release: Release }) {
  const date = formatDate(release.date);
  return (
    <p className="dim release-meta">
      {date ? <time dateTime={date}>{date}</time> : <span>{t('whatsNew.dateMissing')}</span>}
      {release.isCurrent && <span className="current">{t('whatsNew.current')}</span>}
    </p>
  );
}
