import { Screen } from '../components/Screen';
import { t } from '../i18n/t';

export function NotFound({ path, name }: { path?: string; name?: string }) {
  return (
    <Screen title={t('notFound.title')} heading={t('notFound.heading')}>
      <p>{name ? t('notFound.item', { name }) : t('notFound.text', { path: path ?? '' })}</p>
      <p>
        <a href="#/">{t('notFound.home')}</a>
      </p>
      {name && (
        <p>
          <a href={`#/search?q=${encodeURIComponent(name)}`}>{t('notFound.search', { name })}</a>
        </p>
      )}
    </Screen>
  );
}
